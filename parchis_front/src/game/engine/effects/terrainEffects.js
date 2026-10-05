import { isDruidVinesTriggeredBy } from '../abilities/druidVines';
import { applyIceTerrainTrigger, isIceTriggeredBy } from '../abilities/iceMageFreezing';
import { applyTrapTerrainTrigger, isTrapTriggeredBy } from '../abilities/hunterTrap';
import { MOVEMENT_TYPES } from '../movement/types';
import { clonePosition, getPlayablePositionKey, isPlayablePosition } from '../state/positions';
import { TERRAIN_EFFECT_TYPES } from './types';

const TERRAIN_TRAVERSAL_MOVEMENT_TYPES = new Set([
  MOVEMENT_TYPES.NORMAL,
  MOVEMENT_TYPES.REWARD,
]);

const TERRAIN_EFFECT_BEHAVIORS = Object.freeze({
  [TERRAIN_EFFECT_TYPES.DRUID_VINES]: Object.freeze({
    isTriggeredBy: isDruidVinesTriggeredBy,
    applyTrigger: ({ state }) => state,
  }),
  [TERRAIN_EFFECT_TYPES.ICE]: Object.freeze({
    isTriggeredBy: isIceTriggeredBy,
    applyTrigger: applyIceTerrainTrigger,
  }),
  [TERRAIN_EFFECT_TYPES.TRAP]: Object.freeze({
    isTriggeredBy: isTrapTriggeredBy,
    applyTrigger: applyTrapTerrainTrigger,
  }),
});

export function findFirstInterruptingTerrainEffect({ path, rulesContext }) {
  if (
    !rulesContext ||
    !TERRAIN_TRAVERSAL_MOVEMENT_TYPES.has(rulesContext.movementType)
  ) {
    return null;
  }

  for (let pathIndex = 0; pathIndex < path.length; pathIndex += 1) {
    const position = path[pathIndex];

    if (!isPlayablePosition(position)) {
      continue;
    }

    const positionKey = getPlayablePositionKey(position);
    const effects = rulesContext.gameState.terrainEffectsByPositionKey?.[positionKey] || [];
    const effect = effects.find((candidate) => {
      const behavior = TERRAIN_EFFECT_BEHAVIORS[candidate.type];

      return behavior?.isTriggeredBy({
        effect: candidate,
        character: rulesContext.actor,
      });
    });

    if (effect) {
      return {
        effect: JSON.parse(JSON.stringify(effect)),
        position: clonePosition(position),
        positionKey,
        pathIndex,
      };
    }
  }

  return null;
}

export function applyTriggeredTerrainEffects({ state, characterId, terrainTriggers = [] }) {
  return terrainTriggers.reduce((currentState, trigger) => {
    const behavior = TERRAIN_EFFECT_BEHAVIORS[trigger.effect.type];

    return behavior
      ? behavior.applyTrigger({ state: currentState, characterId, trigger })
      : currentState;
  }, state);
}

export function consumeTriggeredTerrainEffects({ state, terrainTriggers = [] }) {
  if (terrainTriggers.length === 0) {
    return state;
  }

  let terrainEffectsByPositionKey = state.terrainEffectsByPositionKey || {};

  terrainTriggers.forEach((trigger) => {
    const remainingEffects = (terrainEffectsByPositionKey[trigger.positionKey] || [])
      .filter((effect) => effect.id !== trigger.effect.id);
    const otherPositions = Object.fromEntries(
      Object.entries(terrainEffectsByPositionKey)
        .filter(([positionKey]) => positionKey !== trigger.positionKey),
    );

    terrainEffectsByPositionKey = remainingEffects.length === 0
      ? otherPositions
      : { ...otherPositions, [trigger.positionKey]: remainingEffects };
  });

  return {
    ...state,
    terrainEffectsByPositionKey,
  };
}
