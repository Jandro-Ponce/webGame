import { createEffectState } from '../effects/effectState';
import { addCharacterEffect, getCharacterEffects, removeCharacterEffectsById } from '../effects/characterEffects';
import {
  CHARACTER_STATUS_TYPES,
  EFFECT_SCOPE_TYPES,
  TERRAIN_EFFECT_TYPES,
} from '../effects/types';
import { getOccupantsAtPosition } from '../occupancy/occupancy';
import {
  clonePosition,
  getPlayablePositionKey,
  isPlayablePosition,
  isSamePosition,
} from '../state/positions';
import { ABILITY_IDS } from './abilities';
import { getCharacterAbilityState, updateCharacterAbilityState } from './abilityState';
import { createHomePosition } from '../state/positions';
import { updateCharacterPositionsInState } from '../state/characters';
import { EXECUTION_EVENT_TYPES } from '../actions/types';

export const HUNTER_TRAP_INITIAL_CHARGES = 2;

function getCharacters(state) {
  return state.players.flatMap((player) => player.characters);
}

function getCharacter(state, characterId) {
  return getCharacters(state).find((character) => character.id === characterId) || null;
}

function isTrapEffectFrom(effect, characterId) {
  return (
    effect?.type === TERRAIN_EFFECT_TYPES.TRAP &&
    effect.source?.abilityId === ABILITY_IDS.HUNTER_TRAP &&
    effect.source?.sourceCharacterId === characterId
  );
}

export function createBleedingStatus({ sourceCharacterId, sourceFactionId, targetCharacterId }) {
  return createEffectState({
    id: `${CHARACTER_STATUS_TYPES.BLEEDING}:${targetCharacterId}`,
    type: CHARACTER_STATUS_TYPES.BLEEDING,
    scope: { type: EFFECT_SCOPE_TYPES.CHARACTER, targetId: targetCharacterId },
    source: {
      type: 'ability',
      abilityId: ABILITY_IDS.HUNTER_TRAP,
      sourceCharacterId,
      factionId: sourceFactionId,
    },
    data: { remainingTurns: 3 },
  });
}

export function getBleedingStatus({ state, characterId }) {
  return getCharacterEffects({ state, characterId }).find(
    (effect) => effect.type === CHARACTER_STATUS_TYPES.BLEEDING,
  );
}

export function applyBleedingStatus({ state, sourceCharacterId, sourceFactionId, targetCharacterId }) {
  const existing = getBleedingStatus({ state, characterId: targetCharacterId });
  if (existing) {
    return state;
  }

  return addCharacterEffect({
    state,
    characterId: targetCharacterId,
    effect: createBleedingStatus({ sourceCharacterId, sourceFactionId, targetCharacterId }),
  });
}

export function createTrapEffect({ characterId, factionId, position, chargeSequence }) {
  const positionKey = getPlayablePositionKey(position);

  return createEffectState({
    id: `${ABILITY_IDS.HUNTER_TRAP}:${characterId}:${positionKey}:${chargeSequence}`,
    type: TERRAIN_EFFECT_TYPES.TRAP,
    scope: { type: EFFECT_SCOPE_TYPES.TERRAIN, targetId: positionKey },
    source: {
      type: 'ability',
      abilityId: ABILITY_IDS.HUNTER_TRAP,
      sourceCharacterId: characterId,
      factionId,
    },
    data: {
      position: clonePosition(position),
      sourceCharacterId: characterId,
      factionId,
    },
  });
}

function hasValidTrapState({ state, characterId, position, previousPosition }) {
  const character = getCharacter(state, characterId);
  const abilityState = getCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.HUNTER_TRAP,
  });

  if (!(
    character?.characterId === 'hunter' &&
    isSamePosition(character.position, position) &&
    isPlayablePosition(position) &&
    isPlayablePosition(previousPosition) &&
    Number.isInteger(abilityState?.charges) &&
    abilityState.charges > 0
  )) {
    return false;
  }

  return getOccupantsAtPosition({
    position: previousPosition,
    characters: getCharacters(state),
  }).every((occupant) => occupant.factionId === character.factionId);
}

export function getHunterTrapActivationOptions({
  state,
  characterId,
  position,
  previousPosition,
}) {
  if (!hasValidTrapState({ state, characterId, position, previousPosition })) {
    return [];
  }

  return [{}];
}

export function activateHunterTrap({
  state,
  characterId,
  position,
  previousPosition,
}) {
  const options = getHunterTrapActivationOptions({
    state,
    characterId,
    position,
    previousPosition,
  });

  if (options.length === 0) {
    throw new Error('Hunter trap cannot be activated in the current state.');
  }

  const character = getCharacter(state, characterId);
  const abilityState = getCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.HUNTER_TRAP,
  });
  const stateWithCharge = updateCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.HUNTER_TRAP,
    abilityState: { ...abilityState, charges: abilityState.charges - 1 },
  });

  const positionKey = getPlayablePositionKey(previousPosition);
  const effect = createTrapEffect({
    characterId,
    factionId: character.factionId,
    position: previousPosition,
    chargeSequence: abilityState.charges,
  });

  return {
    ...stateWithCharge,
    terrainEffectsByPositionKey: {
      ...(stateWithCharge.terrainEffectsByPositionKey || {}),
      [positionKey]: [
        ...(stateWithCharge.terrainEffectsByPositionKey?.[positionKey] || []),
        effect,
      ],
    },
  };
}

export function isTrapTriggeredBy({ effect, character }) {
  return (
    effect?.type === TERRAIN_EFFECT_TYPES.TRAP &&
    effect.source?.factionId !== character.factionId
  );
}

export function applyTrapTerrainTrigger({ state, characterId, trigger }) {
  const target = getCharacter(state, characterId);
  const sourceCharacterId = trigger.effect.source.sourceCharacterId;
  const sourceFactionId = trigger.effect.source.factionId;

  return applyBleedingStatus({
    state,
    sourceCharacterId,
    sourceFactionId,
    targetCharacterId: target.id,
  });
}

export function resetHunterTrapAfterCapture({ state, characterId }) {
  const character = getCharacter(state, characterId);

  if (character?.characterId !== 'hunter') {
    return state;
  }

  const abilityState = getCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.HUNTER_TRAP,
  }) || {};
  const stateWithCharges = updateCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.HUNTER_TRAP,
    abilityState: { ...abilityState, charges: HUNTER_TRAP_INITIAL_CHARGES },
  });
  const terrainEffectsByPositionKey = Object.fromEntries(
    Object.entries(stateWithCharges.terrainEffectsByPositionKey || {}).flatMap(([positionKey, effects]) => {
      const remainingEffects = effects.filter(
        (effect) => !isTrapEffectFrom(effect, characterId),
      );

      return remainingEffects.length === 0 ? [] : [[positionKey, remainingEffects]];
    }),
  );

  return {
    ...stateWithCharges,
    terrainEffectsByPositionKey,
  };
}

export function decrementBleedingForFaction({ state, factionId }) {
  const characters = getCharacters(state).filter((c) => c.factionId === factionId);

  return characters.reduce((currentState, character) => {
    const bleeding = getBleedingStatus({ state: currentState, characterId: character.id });
    if (!bleeding) {
      return currentState;
    }

    const remaining = bleeding.data.remainingTurns;
    if (remaining <= 1) {
      return killByBleeding({ state: currentState, characterId: character.id });
    }

    return updateBleedingRemainingTurns({
      state: currentState,
      characterId: character.id,
      remainingTurns: remaining - 1,
    });
  }, state);
}

function updateBleedingRemainingTurns({ state, characterId, remainingTurns }) {
  const bleeding = getBleedingStatus({ state, characterId });
  if (!bleeding) {
    return state;
  }

  const stateWithout = removeCharacterEffectsById({
    state,
    characterId,
    effectIds: [bleeding.id],
  });

  const updatedEffect = createEffectState({
    ...bleeding,
    data: { ...bleeding.data, remainingTurns },
  });

  return addCharacterEffect({
    state: stateWithout,
    characterId,
    effect: updatedEffect,
  });
}

export function killByBleeding({ state, characterId }) {
  const character = getCharacter(state, characterId);
  if (!character) {
    return state;
  }

  const bleeding = getBleedingStatus({ state, characterId });
  const stateWithoutBleeding = removeCharacterEffectsById({
    state,
    characterId,
    effectIds: bleeding ? [bleeding.id] : [],
  });

  const positionedState = updateCharacterPositionsInState({
    state: stateWithoutBleeding,
    positionByCharacterId: { [characterId]: createHomePosition() },
  });

  return {
    ...positionedState,
    events: [
      ...(positionedState.events || []),
      {
        type: EXECUTION_EVENT_TYPES.CHARACTER_DIED,
        characterId,
        factionId: character.factionId,
        cause: 'bleeding',
        from: character.position,
        to: createHomePosition(),
      },
    ],
  };
}

export function healBleedingOnSafe({ state, characterId }) {
  const bleeding = getBleedingStatus({ state, characterId });
  if (!bleeding) {
    return state;
  }

  return removeCharacterEffectsById({
    state,
    characterId,
    effectIds: [bleeding.id],
  });
}
