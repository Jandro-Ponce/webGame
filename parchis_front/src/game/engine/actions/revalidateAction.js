import { getFactionIds } from '../factions/factions';
import { getAvailableRollFiveActions } from '../rules/rollFive/rollFive';
import { getAvailableRollSixActions } from '../rules/rollSix/rollSix';
import { getMovableCharacters } from '../rules/movableCharacters/movableCharacters';
import { EXECUTABLE_ACTION_TYPES } from './types';
import { getAvailableInitialExitActions } from '../rules/initialExit/initialExit';

function assertValidFactionId(factionId) {
  if (!getFactionIds().includes(factionId)) {
    throw new Error(`Invalid faction id: ${factionId}`);
  }
}

function assertSupportedRoll(roll) {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new Error(`Unsupported roll: ${roll}. Roll must be an integer from 1 to 6.`);
  }
}

function assertValidAction(action) {
  if (!action || typeof action !== 'object') {
    throw new Error('action is required.');
  }

  if (!Object.values(EXECUTABLE_ACTION_TYPES).includes(action.type)) {
    throw new Error(`Unknown action type: ${action.type}`);
  }

  if (action.characterId === undefined || action.characterId === null || action.characterId === '') {
    throw new Error('action.characterId is required.');
  }
}

function findAvailableAction({ availableActions, action }) {
  return availableActions.find(
    (availableAction) => availableAction.id || action.id
      ? availableAction.id === action.id
      : availableAction.type === action.type && availableAction.characterId === action.characterId,
  );
}

function assertActionAvailable(availableAction) {
  if (!availableAction) {
    throw new Error('Action is not available for the current state.');
  }
}

function revalidateNormalRollAction({ state, factionId, roll, action, characters }) {
  if (action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME) {
    const availableAction = findAvailableAction({
      availableActions: getAvailableInitialExitActions({ state, factionId, roll, characters }),
      action,
    });
    assertActionAvailable(availableAction);

    return { action: availableAction, movement: availableAction.movement, steps: roll };
  }

  if (action.type !== EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT) {
    throw new Error('Action is not available for the current state.');
  }

  const { movableCharacters } = getMovableCharacters({
    factionId,
    steps: roll,
    characters,
    gameState: state,
  });
  const movableCharacter = movableCharacters.find(
    (candidate) => candidate.characterId === action.characterId,
  );

  assertActionAvailable(movableCharacter);

  return {
    action: {
      type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT,
      characterId: movableCharacter.characterId,
    },
    movement: movableCharacter.movement,
    steps: roll,
  };
}

function revalidateRollFiveAction({ state, factionId, action, characters }) {
  const initialExitActions = getAvailableInitialExitActions({ state, factionId, roll: 5, characters });
  if (initialExitActions.length > 0) {
    const availableAction = findAvailableAction({ availableActions: initialExitActions, action });
    assertActionAvailable(availableAction);
    return { action: availableAction, movement: availableAction.movement, steps: 5 };
  }

  const result = getAvailableRollFiveActions({ factionId, characters, gameState: state });
  const availableAction = findAvailableAction({ availableActions: result.availableActions, action });

  assertActionAvailable(availableAction);

  return {
    action: availableAction,
    movement: availableAction.movement,
    steps: 5,
  };
}

function revalidateRollSixAction({ state, factionId, action, characters }) {
  if (action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME) {
    const availableAction = findAvailableAction({
      availableActions: getAvailableInitialExitActions({ state, factionId, roll: 6, characters }),
      action,
    });
    assertActionAvailable(availableAction);
    return { action: availableAction, movement: availableAction.movement, steps: 6 };
  }

  const result = getAvailableRollSixActions({ factionId, characters, gameState: state });
  const availableAction = findAvailableAction({ availableActions: result.availableActions, action });

  assertActionAvailable(availableAction);

  return {
    action: availableAction,
    movement: availableAction.movement,
    steps: 6,
  };
}

export function revalidateAction({ state, factionId, roll, action, characters }) {
  assertValidFactionId(factionId);
  assertSupportedRoll(roll);
  assertValidAction(action);

  if (roll >= 1 && roll <= 4) {
    return revalidateNormalRollAction({ state, factionId, roll, action, characters });
  }

  if (roll === 5) {
    return revalidateRollFiveAction({ state, factionId, action, characters });
  }

  return revalidateRollSixAction({ state, factionId, action, characters });
}
