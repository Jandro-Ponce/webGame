import { START_SQUARE_BY_FACTION } from '../../board/board';
import { MOVEMENT_SOURCE_TYPES, MOVEMENT_TYPES } from '../../movement/types';
import { assertCharactersArray, getOccupantsAtPosition } from '../../occupancy/occupancy';
import { getMovableCharacters } from '../movableCharacters/movableCharacters';
import { createCommonPosition, POSITION_TYPES } from '../../state/positions';
import { getPendingInitialExit, isInitialExitAvailable } from '../../state/factionStates';
import { EXECUTABLE_ACTION_TYPES } from '../../actions/types';

export const INITIAL_EXIT_STAGES = Object.freeze({
  MOVEMENT: 'movement',
  SINGLE: 'single',
  FIRST: 'first',
  SECOND: 'second',
});

function getHomeCharacters({ characters, factionId }) {
  return characters.filter(
    (character) => character.factionId === factionId && character.position?.type === POSITION_TYPES.HOME,
  );
}

function createActionId({ roll, characterId, stage }) {
  return `initialExit:${roll}:${stage}:${characterId}`;
}

function createInitialExitAction({ roll, characterId, stage, start, movement = null, occupantRemoval }) {
  return {
    id: createActionId({ roll, characterId, stage }),
    type: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
    characterId,
    initialExit: true,
    initialExitStage: stage,
    destination: { ...start },
    ...(movement ? { movement } : {}),
    occupantRemoval,
  };
}

function getInitialFiveActions({ homeCharacters, occupants, start, pendingInitialExit }) {
  if (pendingInitialExit) {
    const firstCharacter = occupants.find(
      (occupant) => occupant.id === pendingInitialExit.firstCharacterId,
    );

    if (!firstCharacter || occupants.length !== 1) {
      return [];
    }

    return homeCharacters.map((character) => createInitialExitAction({
      roll: 5,
      characterId: character.id,
      stage: INITIAL_EXIT_STAGES.SECOND,
      start,
      occupantRemoval: {
        required: false,
        removableCharacterIds: [],
        removeAll: false,
        isCapture: false,
        grantsCaptureReward: false,
      },
    }));
  }

  if (homeCharacters.length === 1) {
    const removableCharacterIds = occupants.length === 2
      ? occupants.map((occupant) => occupant.id)
      : [];

    return [createInitialExitAction({
      roll: 5,
      characterId: homeCharacters[0].id,
      stage: INITIAL_EXIT_STAGES.SINGLE,
      start,
      occupantRemoval: {
        required: removableCharacterIds.length > 0,
        removableCharacterIds,
        removeAll: false,
        isCapture: false,
        grantsCaptureReward: false,
      },
    })];
  }

  return homeCharacters.map((character) => createInitialExitAction({
    roll: 5,
    characterId: character.id,
    stage: INITIAL_EXIT_STAGES.FIRST,
    start,
    occupantRemoval: {
      required: occupants.length > 0,
      removableCharacterIds: occupants.map((occupant) => occupant.id),
      removeAll: true,
      isCapture: false,
      grantsCaptureReward: false,
    },
  }));
}

function getMovementInitialExitActions({ state, factionId, roll, characters, homeCharacters, start }) {
  return homeCharacters.flatMap((homeCharacter) => {
    const virtualCharacters = characters.map((character) => character.id === homeCharacter.id
      ? { ...character, position: { ...start } }
      : character);
    const { movableCharacters } = getMovableCharacters({
      factionId,
      steps: roll,
      characters: virtualCharacters,
      gameState: state,
      movementType: MOVEMENT_TYPES.NORMAL,
      source: { type: MOVEMENT_SOURCE_TYPES.DICE, roll },
    });
    const candidate = movableCharacters.find(({ characterId }) => characterId === homeCharacter.id);

    return candidate
      ? [createInitialExitAction({
        roll,
        characterId: homeCharacter.id,
        stage: INITIAL_EXIT_STAGES.MOVEMENT,
        start,
        movement: candidate.movement,
        occupantRemoval: {
          required: false,
          removableCharacterIds: [],
          removeAll: false,
          isCapture: false,
          grantsCaptureReward: false,
        },
      })]
      : [];
  });
}

export function getAvailableInitialExitActions({ state, factionId, roll, characters }) {
  assertCharactersArray(characters);

  if (!isInitialExitAvailable({ state, factionId })) {
    return [];
  }

  const pendingInitialExit = getPendingInitialExit({ state, factionId });
  if (pendingInitialExit && roll !== 5) {
    return [];
  }

  const homeCharacters = getHomeCharacters({ characters, factionId });
  if (homeCharacters.length === 0) {
    return [];
  }

  const start = createCommonPosition(START_SQUARE_BY_FACTION[factionId]);

  if (roll !== 5) {
    return getMovementInitialExitActions({
      state,
      factionId,
      roll,
      characters,
      homeCharacters,
      start,
    });
  }

  const occupants = getOccupantsAtPosition({ position: start, characters });
  if (occupants.length > 2) {
    throw new Error('Cannot evaluate initial exit with more than two start-square occupants.');
  }

  return getInitialFiveActions({
    homeCharacters,
    occupants,
    start,
    pendingInitialExit,
  });
}
