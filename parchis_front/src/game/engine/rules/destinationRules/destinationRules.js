import { SAFE_SQUARES } from '../../board/board';
import { canCaptureEnemyOnSafeDestination } from '../../abilities/abilityModifiers';
import { getFactionIds } from '../../factions/factions';
import { assertCharactersArray, getOccupantsAtPosition } from '../../occupancy/occupancy';
import { assertRulesContextActor } from '../../rulesContext/rulesContext';
import { POSITION_TYPES, clonePosition, isPlayablePosition, isValidPosition } from '../../state/positions';

export const DESTINATION_OUTCOME_TYPES = Object.freeze({
  EMPTY: 'empty',
  SHARE_WITH_ALLY: 'shareWithAlly',
  CAPTURE: 'capture',
  SAFE_SHARE: 'safeShare',
  GOAL: 'goal',
});

export const DESTINATION_FAILURE_REASONS = Object.freeze({
  DESTINATION_FULL: 'destinationFull',
});

function getMovingCharacterById({ movingCharacterId, characters }) {
  const matchingCharacters = characters.filter((character) => character.id === movingCharacterId);

  if (matchingCharacters.length === 0) {
    throw new Error(`movingCharacterId does not match an existing character: ${movingCharacterId}`);
  }

  if (matchingCharacters.length > 1) {
    throw new Error(`Duplicate character id: ${movingCharacterId}`);
  }

  return matchingCharacters[0];
}

function assertValidCharacterFaction(factionId, messagePrefix) {
  if (!getFactionIds().includes(factionId)) {
    throw new Error(`${messagePrefix}: ${factionId}`);
  }
}

function isSafeCommonDestination(destination) {
  return destination.type === POSITION_TYPES.COMMON && SAFE_SQUARES.includes(destination.square);
}

export { isSafeCommonDestination };

function createLegalResult({ destination, outcome }) {
  return {
    legal: true,
    outcome,
    destination: clonePosition(destination),
  };
}

function createDestinationFullResult(destination) {
  return {
    legal: false,
    reason: DESTINATION_FAILURE_REASONS.DESTINATION_FULL,
    destination: clonePosition(destination),
  };
}

function createCaptureResult({ destination, capturedCharacterId }) {
  return createLegalResult({
    destination,
    outcome: {
      type: DESTINATION_OUTCOME_TYPES.CAPTURE,
      capturedCharacterId,
    },
  });
}

function assertDestinationCanReceiveFaction(destination, factionId) {
  if (destination.type === POSITION_TYPES.FINAL_LANE && destination.factionId !== factionId) {
    throw new Error('Destination final lane does not match moving character faction.');
  }
}

function assertRelevantOccupantsAreConsistent({ destination, occupants, movingFactionId }) {
  occupants.forEach((occupant) => {
    assertValidCharacterFaction(occupant.factionId, 'Invalid occupant faction id');
  });

  if (destination.type === POSITION_TYPES.FINAL_LANE) {
    if (occupants.some((occupant) => occupant.factionId !== movingFactionId)) {
      throw new Error('Enemy occupant cannot be in a final lane.');
    }
    return;
  }

  if (
    destination.type === POSITION_TYPES.COMMON &&
    !isSafeCommonDestination(destination) &&
    new Set(occupants.map((occupant) => occupant.factionId)).size > 1
  ) {
    throw new Error('Different-faction occupants cannot coexist on a normal common position.');
  }
}

export function evaluateDestination({
  movingCharacterId,
  destination,
  characters,
  rulesContext = null,
}) {
  assertCharactersArray(characters);

  const movingCharacter = getMovingCharacterById({ movingCharacterId, characters });
  assertRulesContextActor({ actor: movingCharacter, rulesContext });
  assertValidCharacterFaction(movingCharacter.factionId, 'Invalid moving character faction id');

  if (!isValidPosition(destination)) {
    throw new Error('Destination position is invalid.');
  }

  if (destination.type === POSITION_TYPES.HOME) {
    throw new Error('Destination cannot be home.');
  }

  if (destination.type === POSITION_TYPES.GOAL) {
    return createLegalResult({
      destination,
      outcome: { type: DESTINATION_OUTCOME_TYPES.GOAL },
    });
  }

  if (!isPlayablePosition(destination)) {
    throw new Error('Destination position is invalid.');
  }

  assertDestinationCanReceiveFaction(destination, movingCharacter.factionId);

  const charactersWithoutMovingCharacter = characters.filter(
    (character) => character.id !== movingCharacterId,
  );
  const occupants = getOccupantsAtPosition({
    position: destination,
    characters: charactersWithoutMovingCharacter,
  });

  if (occupants.length > 2) {
    throw new Error('Cannot evaluate destination with more than two occupants.');
  }

  assertRelevantOccupantsAreConsistent({
    destination,
    occupants,
    movingFactionId: movingCharacter.factionId,
  });

  if (occupants.length === 0) {
    return createLegalResult({
      destination,
      outcome: { type: DESTINATION_OUTCOME_TYPES.EMPTY },
    });
  }

  if (occupants.length === 2) {
    return createDestinationFullResult(destination);
  }

  const occupant = occupants[0];

  if (occupant.factionId === movingCharacter.factionId) {
    return createLegalResult({
      destination,
      outcome: {
        type: DESTINATION_OUTCOME_TYPES.SHARE_WITH_ALLY,
        occupantCharacterId: occupant.id,
      },
    });
  }

  if (isSafeCommonDestination(destination)) {
    if (canCaptureEnemyOnSafeDestination({ rulesContext })) {
      return createCaptureResult({
        destination,
        capturedCharacterId: occupant.id,
      });
    }

    return createLegalResult({
      destination,
      outcome: {
        type: DESTINATION_OUTCOME_TYPES.SAFE_SHARE,
        occupantCharacterId: occupant.id,
      },
    });
  }

  return createCaptureResult({
    destination,
    capturedCharacterId: occupant.id,
  });
}
