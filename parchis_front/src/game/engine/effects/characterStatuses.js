import { MOVEMENT_TYPES } from '../movement/types';
import { CHARACTER_STATUS_TYPES } from './types';
import { removeCharacterEffectsById } from './characterEffects';

export function resolveMovementStepsFromStatuses({ steps, rulesContext }) {
  const frozen = rulesContext?.effects?.character?.find(
    (effect) => effect.type === CHARACTER_STATUS_TYPES.FROZEN,
  );

  const dizzy = rulesContext?.effects?.character?.find(
    (effect) => effect.type === CHARACTER_STATUS_TYPES.DIZZY,
  );

  if (rulesContext?.movementType !== MOVEMENT_TYPES.NORMAL) {
    return { effectiveSteps: steps, usedStatusEffectIds: [], reverseDirection: false };
  }

  if (frozen && dizzy) {
    throw new Error('Character has both Frozen and Dizzy - interaction not defined');
  }

  if (frozen) {
    return {
      effectiveSteps: Math.ceil(steps / 2),
      usedStatusEffectIds: [frozen.id],
      reverseDirection: false,
    };
  }

  if (dizzy) {
    return {
      effectiveSteps: steps * 2,
      usedStatusEffectIds: [dizzy.id],
      reverseDirection: true,
    };
  }

  return { effectiveSteps: steps, usedStatusEffectIds: [], reverseDirection: false };
}

export function consumeUsedMovementStatuses({ state, characterId, usedStatusEffectIds = [] }) {
  return removeCharacterEffectsById({
    state,
    characterId,
    effectIds: usedStatusEffectIds,
  });
}

export function isCharacterBleeding({ state, characterId }) {
  return (state.characterStatesById?.[characterId]?.effects || []).some(
    (effect) => effect.type === CHARACTER_STATUS_TYPES.BLEEDING,
  );
}

export function isCharacterDizzy({ state, characterId }) {
  return (state.characterStatesById?.[characterId]?.effects || []).some(
    (effect) => effect.type === CHARACTER_STATUS_TYPES.DIZZY,
  );
}
