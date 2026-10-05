import { createHomePosition, clonePosition } from '../state/positions';
import { updateCharacterPositionsInState } from '../state/characters';
import { EXECUTION_EVENT_TYPES } from './types';
import { applyMovementToState } from './applyMovement';
import { MOVEMENT_SOURCE_TYPES, MOVEMENT_TYPES } from '../movement/types';
import { beginPendingInitialExit, consumeInitialExit } from '../state/factionStates';
import { INITIAL_EXIT_STAGES } from '../rules/initialExit/initialExit';

function consumeInitialExitAfterExecution({ state, factionId }) {
  return consumeInitialExit({ state, factionId });
}

function executeMovementInitialExit({ state, characters, action, steps, factionId }) {
  const start = action.destination;
  const virtualCharacters = characters.map((character) => character.id === action.characterId
    ? { ...character, position: clonePosition(start) }
    : character);
  const movementResult = applyMovementToState({
    state,
    characters: virtualCharacters,
    actionType: action.type,
    movementType: MOVEMENT_TYPES.NORMAL,
    source: { type: MOVEMENT_SOURCE_TYPES.DICE, roll: steps },
    characterId: action.characterId,
    movement: action.movement,
    steps,
  });

  return {
    state: consumeInitialExitAfterExecution({ state: movementResult.state, factionId }),
    events: [
      {
        type: EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
        characterId: action.characterId,
        from: createHomePosition(),
        to: clonePosition(start),
      },
      ...movementResult.events,
    ],
  };
}

function executeInitialFiveExit({ state, action, choice, factionId }) {
  const positionByCharacterId = { [action.characterId]: action.destination };
  const events = [];
  let removedCharacterIds = [];

  if (action.occupantRemoval.removeAll) {
    removedCharacterIds = action.occupantRemoval.removableCharacterIds;
  } else if (action.occupantRemoval.required) {
    const removeCharacterId = choice?.removeCharacterId;

    if (!removeCharacterId) {
      throw new Error('choice.removeCharacterId is required for this exitHome action.');
    }
    if (!action.occupantRemoval.removableCharacterIds.includes(removeCharacterId)) {
      throw new Error('choice.removeCharacterId is not removable in the current state.');
    }
    removedCharacterIds = [removeCharacterId];
  }

  removedCharacterIds.forEach((characterId) => {
    positionByCharacterId[characterId] = createHomePosition();
    events.push({
      type: EXECUTION_EVENT_TYPES.CHARACTER_REMOVED_FROM_START,
      characterId,
      removedByCharacterId: action.characterId,
      position: clonePosition(action.destination),
    });
  });
  events.push({
    type: EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
    characterId: action.characterId,
    from: createHomePosition(),
    to: clonePosition(action.destination),
  });

  const positionedState = updateCharacterPositionsInState({ state, positionByCharacterId });

  if (action.initialExitStage === INITIAL_EXIT_STAGES.FIRST) {
    return {
      state: beginPendingInitialExit({
        state: positionedState,
        factionId,
        firstCharacterId: action.characterId,
      }),
      events,
      requiresInitialExitCompletion: true,
    };
  }

  return {
    state: consumeInitialExitAfterExecution({ state: positionedState, factionId }),
    events,
  };
}

export function executeExitHomeAction({ state, characters, action, choice, steps, factionId }) {
  if (action.initialExit && action.movement) {
    return executeMovementInitialExit({ state, characters, action, steps, factionId });
  }

  if (action.initialExit) {
    return executeInitialFiveExit({ state, action, choice, factionId });
  }

  const positionByCharacterId = {
    [action.characterId]: action.destination,
  };
  const events = [];

  if (action.occupantRemoval.required) {
    const removeCharacterId = choice?.removeCharacterId;

    if (!removeCharacterId) {
      throw new Error('choice.removeCharacterId is required for this exitHome action.');
    }

    if (!action.occupantRemoval.removableCharacterIds.includes(removeCharacterId)) {
      throw new Error('choice.removeCharacterId is not removable in the current state.');
    }

    positionByCharacterId[removeCharacterId] = createHomePosition();
    events.push({
      type: EXECUTION_EVENT_TYPES.CHARACTER_REMOVED_FROM_START,
      characterId: removeCharacterId,
      removedByCharacterId: action.characterId,
      position: clonePosition(action.destination),
    });
  }

  events.push({
    type: EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
    characterId: action.characterId,
    from: createHomePosition(),
    to: clonePosition(action.destination),
  });

  return {
    state: updateCharacterPositionsInState({ state, positionByCharacterId }),
    events,
  };
}
