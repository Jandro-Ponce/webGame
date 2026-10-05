import { getFactionIds } from '../../factions/factions';
import { canPassThroughIntermediateBarrier } from '../../abilities/abilityModifiers';
import { calculateMovementPath } from '../../movement/movement';
import { assertValidMovementSteps } from '../../movement/validation';
import { assertCharactersArray } from '../../occupancy/occupancy';
import { assertRulesContextActor } from '../../rulesContext/rulesContext';
import { findFirstInterruptingTerrainEffect } from '../../effects/terrainEffects';
import { resolveMovementStepsFromStatuses } from '../../effects/characterStatuses';
import { checkPathBlockedByBarrier } from '../barriers/barriers';
import { evaluateDestination } from '../destinationRules/destinationRules';
import { POSITION_TYPES, isValidPosition } from '../../state/positions';

export const LEGAL_MOVEMENT_FAILURE_REASONS = Object.freeze({
  CHARACTER_AT_HOME: 'characterAtHome',
  CHARACTER_AT_GOAL: 'characterAtGoal',
  BARRIER: 'barrier',
});

function getCharacterById({ characterId, characters }) {
  const matchingCharacters = characters.filter((character) => character.id === characterId);

  if (matchingCharacters.length === 0) {
    throw new Error(`characterId does not match an existing character: ${characterId}`);
  }

  if (matchingCharacters.length > 1) {
    throw new Error(`Duplicate character id: ${characterId}`);
  }

  return matchingCharacters[0];
}

function assertValidCharacterFaction(factionId) {
  if (!getFactionIds().includes(factionId)) {
    throw new Error(`Invalid character faction id: ${factionId}`);
  }
}

function assertCharacterPositionCanUseFaction(position, factionId) {
  if (position.type === POSITION_TYPES.FINAL_LANE && position.factionId !== factionId) {
    throw new Error('Character final lane does not match its faction.');
  }
}

export function evaluateMovement({ characterId, steps, characters, rulesContext = null }) {
  assertCharactersArray(characters);

  const character = getCharacterById({ characterId, characters });

  assertRulesContextActor({ actor: character, rulesContext });

  assertValidCharacterFaction(character.factionId);

  if (!isValidPosition(character.position)) {
    throw new Error('Character position is invalid.');
  }

  assertCharacterPositionCanUseFaction(character.position, character.factionId);
  assertValidMovementSteps(steps);

  if (character.position.type === POSITION_TYPES.HOME) {
    return {
      legal: false,
      reason: LEGAL_MOVEMENT_FAILURE_REASONS.CHARACTER_AT_HOME,
    };
  }

  if (character.position.type === POSITION_TYPES.GOAL) {
    return {
      legal: false,
      reason: LEGAL_MOVEMENT_FAILURE_REASONS.CHARACTER_AT_GOAL,
    };
  }

  const stepResolution = resolveMovementStepsFromStatuses({ steps, rulesContext });
  const pathResult = calculateMovementPath({
    factionId: character.factionId,
    from: character.position,
    steps: stepResolution.effectiveSteps,
    reverse: stepResolution.reverseDirection,
  });

  if (!pathResult.ok) {
    return {
      legal: false,
      reason: pathResult.reason,
    };
  }

  const intendedPath = pathResult.path;
  const intendedBarrierResult = checkPathBlockedByBarrier({
    path: intendedPath,
    characters,
    movingCharacterId: characterId,
    canPassBarrier: ({ pathIndex, pathLength }) => canPassThroughIntermediateBarrier({
      rulesContext,
      pathIndex,
      pathLength,
    }),
  });

  if (intendedBarrierResult.blocked) {
    return {
      legal: false,
      reason: LEGAL_MOVEMENT_FAILURE_REASONS.BARRIER,
      blockedAt: intendedBarrierResult.position,
      pathIndex: intendedBarrierResult.pathIndex,
    };
  }

  const intendedDestinationResult = evaluateDestination({
    movingCharacterId: characterId,
    destination: intendedPath[intendedPath.length - 1],
    characters,
    rulesContext,
  });

  if (!intendedDestinationResult.legal) {
    return intendedDestinationResult;
  }

  const terrainTrigger = findFirstInterruptingTerrainEffect({
    path: intendedPath,
    rulesContext,
  });

  if (!terrainTrigger) {
    return {
      legal: true,
      destination: intendedDestinationResult.destination,
      path: intendedPath,
      outcome: intendedDestinationResult.outcome,
      ...(stepResolution.usedStatusEffectIds.length > 0
        ? { usedStatusEffectIds: stepResolution.usedStatusEffectIds }
        : {}),
    };
  }

  const effectivePath = intendedPath.slice(0, terrainTrigger.pathIndex + 1);
  const effectiveBarrierResult = checkPathBlockedByBarrier({
    path: effectivePath,
    characters,
    movingCharacterId: characterId,
    canPassBarrier: ({ pathIndex, pathLength }) => canPassThroughIntermediateBarrier({
      rulesContext,
      pathIndex,
      pathLength,
    }),
  });

  if (effectiveBarrierResult.blocked) {
    return {
      legal: false,
      reason: LEGAL_MOVEMENT_FAILURE_REASONS.BARRIER,
      blockedAt: effectiveBarrierResult.position,
      pathIndex: effectiveBarrierResult.pathIndex,
    };
  }

  const effectiveDestinationResult = evaluateDestination({
    movingCharacterId: characterId,
    destination: effectivePath[effectivePath.length - 1],
    characters,
    rulesContext,
  });

  if (!effectiveDestinationResult.legal) {
    return effectiveDestinationResult;
  }

  return {
    legal: true,
    destination: effectiveDestinationResult.destination,
    path: effectivePath,
    outcome: effectiveDestinationResult.outcome,
    terrainTriggers: [terrainTrigger],
    ...(stepResolution.usedStatusEffectIds.length > 0
      ? { usedStatusEffectIds: stepResolution.usedStatusEffectIds }
      : {}),
  };
}
