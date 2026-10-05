import { createEffectState } from '../effects/effectState';
import { addCharacterEffect } from '../effects/characterEffects';
import { isCharacterDizzy } from '../effects/characterStatuses';
import {
  CHARACTER_STATUS_TYPES,
  EFFECT_SCOPE_TYPES,
} from '../effects/types';
import { getOccupantsAtPosition } from '../occupancy/occupancy';
import {
  isSamePosition,
} from '../state/positions';
import { ABILITY_IDS } from './abilities';
import { getCharacterAbilityState, updateCharacterAbilityState } from './abilityState';
import { ROUTES_BY_FACTION } from '../board/routes';

export const ALCHEMIST_DIZZY_INITIAL_CHARGES = 2;

function getCharacters(state) {
  return state.players.flatMap((player) => player.characters);
}

function getCharacter(state, characterId) {
  return getCharacters(state).find((character) => character.id === characterId) || null;
}

function getRouteForFaction(factionId) {
  return ROUTES_BY_FACTION[factionId];
}

function getRouteIndex(route, position) {
  return route.findIndex((routePosition) => isSamePosition(routePosition, position));
}

function getAdjacentPositions({ state, characterId, position, factionId }) {
  const route = getRouteForFaction(factionId);
  const currentIndex = getRouteIndex(route, position);

  if (currentIndex === -1) {
    return { forward: null, backward: null };
  }

  const forwardPosition = currentIndex + 1 < route.length ? route[currentIndex + 1] : null;
  const backwardPosition = currentIndex - 1 >= 0 ? route[currentIndex - 1] : null;

  return { forward: forwardPosition, backward: backwardPosition };
}

function hasValidDizzyState({ state, characterId, position }) {
  const character = getCharacter(state, characterId);
  const abilityState = getCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.ALCHEMIST_DIZZY,
  });

  return Boolean(
    character?.characterId === 'alchemist' &&
    isSamePosition(character.position, position) &&
    Number.isInteger(abilityState?.charges) &&
    abilityState.charges > 0
  );
}

export function getAlchemistDizzyActivationOptions({
  state,
  characterId,
  position,
}) {
  if (!hasValidDizzyState({ state, characterId, position })) {
    return [];
  }

  const character = getCharacter(state, characterId);
  const { forward, backward } = getAdjacentPositions({
    state,
    characterId,
    position,
    factionId: character.factionId,
  });

  const targets = [];

  if (forward) {
    const occupants = getOccupantsAtPosition({
      position: forward,
      characters: getCharacters(state),
    });
    for (const occupant of occupants) {
      if (occupant.factionId !== character.factionId) {
        targets.push({ targetCharacterId: occupant.id, position: forward });
      }
    }
  }

  if (backward) {
    const occupants = getOccupantsAtPosition({
      position: backward,
      characters: getCharacters(state),
    });
    for (const occupant of occupants) {
      if (occupant.factionId !== character.factionId) {
        targets.push({ targetCharacterId: occupant.id, position: backward });
      }
    }
  }

  return targets;
}

export function activateAlchemistDizzy({
  state,
  characterId,
  position,
  targetCharacterId,
}) {
  const options = getAlchemistDizzyActivationOptions({
    state,
    characterId,
    position,
  });
  const selectedOption = options.find(
    (option) => option.targetCharacterId === targetCharacterId,
  );

  if (!selectedOption) {
    throw new Error('Alchemist dizzy cannot be activated in the current state.');
  }

  const character = getCharacter(state, characterId);
  const abilityState = getCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.ALCHEMIST_DIZZY,
  });
  const stateWithCharge = updateCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.ALCHEMIST_DIZZY,
    abilityState: { ...abilityState, charges: abilityState.charges - 1 },
  });

  return applyDizzyStatus({
    state: stateWithCharge,
    sourceCharacterId: characterId,
    sourceFactionId: character.factionId,
    targetCharacterId,
  });
}

export function applyDizzyStatus({ state, sourceCharacterId, sourceFactionId, targetCharacterId }) {
  if (isCharacterDizzy({ state, characterId: targetCharacterId })) {
    return state;
  }

  return addCharacterEffect({
    state,
    characterId: targetCharacterId,
    effect: createDizzyStatus({ sourceCharacterId, sourceFactionId, targetCharacterId }),
  });
}

function createDizzyStatus({ sourceCharacterId, sourceFactionId, targetCharacterId }) {
  return createEffectState({
    id: `${CHARACTER_STATUS_TYPES.DIZZY}:${targetCharacterId}`,
    type: CHARACTER_STATUS_TYPES.DIZZY,
    scope: { type: EFFECT_SCOPE_TYPES.CHARACTER, targetId: targetCharacterId },
    source: {
      type: 'ability',
      abilityId: ABILITY_IDS.ALCHEMIST_DIZZY,
      sourceCharacterId,
      factionId: sourceFactionId,
    },
    data: {},
  });
}

export function resetAlchemistDizzyAfterCapture({ state, characterId }) {
  const character = getCharacter(state, characterId);

  if (character?.characterId !== 'alchemist') {
    return state;
  }

  const abilityState = getCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.ALCHEMIST_DIZZY,
  }) || {};
  const stateWithCharges = updateCharacterAbilityState({
    state,
    characterId,
    abilityId: ABILITY_IDS.ALCHEMIST_DIZZY,
    abilityState: { ...abilityState, charges: ALCHEMIST_DIZZY_INITIAL_CHARGES },
  });

  return stateWithCharges;
}

export function getAlchemistDizzyActivationOptionsForDecision({ state, characterId, position }) {
  return getAlchemistDizzyActivationOptions({ state, characterId, position });
}