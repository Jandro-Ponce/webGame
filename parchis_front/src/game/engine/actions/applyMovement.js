import { createHomePosition, clonePosition } from '../state/positions';
import { updateCharacterPositionsInState } from '../state/characters';
import { DESTINATION_OUTCOME_TYPES, isSafeCommonDestination } from '../rules/destinationRules/destinationRules';
import { MOVEMENT_TYPES } from '../movement/types';
import { EXECUTION_EVENT_TYPES } from './types';
import { consumeUsedMovementStatuses } from '../effects/characterStatuses';
import {
  applyTriggeredTerrainEffects,
  consumeTriggeredTerrainEffects,
} from '../effects/terrainEffects';
import { applyAbilityStateTransitionsFromEvents } from '../abilities/abilityEvents';
import { healBleedingOnSafe } from '../abilities/hunterTrap';

function getCharacterById({ characterId, characters }) {
  const character = characters.find((candidate) => candidate.id === characterId);

  if (!character) {
    throw new Error(`characterId does not match an existing character: ${characterId}`);
  }

  return character;
}

export function applyMovementToState({
  state,
  characters,
  actionType,
  movementType,
  source,
  characterId,
  movement,
  steps,
}) {
  if (!Object.values(MOVEMENT_TYPES).includes(movementType)) {
    throw new Error(`Invalid movementType: ${movementType}`);
  }

  const character = getCharacterById({ characterId, characters });
  const previousPosition = movement.path.length > 1
    ? movement.path[movement.path.length - 2]
    : character.position;
  const positionByCharacterId = {
    [characterId]: movement.destination,
  };
  const events = [
    {
      type: EXECUTION_EVENT_TYPES.CHARACTER_MOVED,
      characterId,
      factionId: character.factionId,
      from: clonePosition(character.position),
      to: clonePosition(movement.destination),
      previousPosition: clonePosition(previousPosition),
      steps,
      actionType,
      movementType,
      source: source ? JSON.parse(JSON.stringify(source)) : null,
    },
  ];

  (movement.terrainTriggers || []).forEach((trigger) => {
    events.push({
      type: EXECUTION_EVENT_TYPES.TERRAIN_EFFECT_TRIGGERED,
      characterId,
      factionId: character.factionId,
      effectId: trigger.effect.id,
      effectType: trigger.effect.type,
      position: clonePosition(trigger.position),
      positionKey: trigger.positionKey,
      source: trigger.effect.source ? JSON.parse(JSON.stringify(trigger.effect.source)) : null,
    });
  });

  if (movement.outcome.type === DESTINATION_OUTCOME_TYPES.CAPTURE) {
    positionByCharacterId[movement.outcome.capturedCharacterId] = createHomePosition();
    events.push({
      type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
      characterId,
      factionId: character.factionId,
      capturedCharacterId: movement.outcome.capturedCharacterId,
      actionType,
      movementType,
      source: source ? JSON.parse(JSON.stringify(source)) : null,
    });
  }

  if (movement.outcome.type === DESTINATION_OUTCOME_TYPES.GOAL) {
    events.push({
      type: EXECUTION_EVENT_TYPES.CHARACTER_REACHED_GOAL,
      characterId,
      factionId: character.factionId,
      actionType,
      movementType,
      source: source ? JSON.parse(JSON.stringify(source)) : null,
    });
  }

  const positionedState = updateCharacterPositionsInState({ state, positionByCharacterId });
  const stateAfterUsedStatuses = consumeUsedMovementStatuses({
    state: positionedState,
    characterId,
    usedStatusEffectIds: movement.usedStatusEffectIds || [],
  });
  const stateAfterTerrainConsumption = consumeTriggeredTerrainEffects({
    state: stateAfterUsedStatuses,
    terrainTriggers: movement.terrainTriggers || [],
  });
  const stateAfterTerrainTriggers = applyTriggeredTerrainEffects({
    state: stateAfterTerrainConsumption,
    characterId,
    terrainTriggers: movement.terrainTriggers || [],
  });

  let stateAfterSafeHeal = stateAfterTerrainTriggers;
  if (
    movementType === MOVEMENT_TYPES.NORMAL ||
    movementType === MOVEMENT_TYPES.REWARD
  ) {
    const destination = movement.destination;
    if (isSafeCommonDestination(destination)) {
      stateAfterSafeHeal = healBleedingOnSafe({
        state: stateAfterTerrainTriggers,
        characterId,
      });
    }
  }

  return {
    state: applyAbilityStateTransitionsFromEvents({ state: stateAfterSafeHeal, events }),
    events,
  };
}
