import { EXECUTION_EVENT_TYPES } from '../actions/types';
import { ABILITY_IDS } from '../abilities/abilities';
import { activateDruidVines, canActivateDruidVines } from '../abilities/druidVines';
import {
  activateIceMageFreezing,
  getIceMageFreezingActivationOptions,
} from '../abilities/iceMageFreezing';
import {
  activateHunterTrap,
  getHunterTrapActivationOptions,
} from '../abilities/hunterTrap';
import {
  activateAlchemistDizzy,
  getAlchemistDizzyActivationOptionsForDecision,
} from '../abilities/alchemistDizzy';
import { MOVEMENT_TYPES } from '../movement/types';
import {
  clonePosition,
  getPlayablePositionKey,
  isPlayablePosition,
  isValidPosition,
} from '../state/positions';
import { createDecisionActionId } from './decisionActions';
import { DECISION_TYPES, OPTIONAL_ABILITY_ACTION_TYPES } from './types';

function getPositionIdentity(position) {
  if (!isValidPosition(position)) {
    throw new Error('A valid position is required for an optional ability decision.');
  }

  return isPlayablePosition(position) ? getPlayablePositionKey(position) : position.type;
}

const OPTIONAL_ABILITY_BEHAVIORS = Object.freeze({
  [ABILITY_IDS.DRUID_VINES]: Object.freeze({
    getOptions: ({ state, decision }) => (
      canActivateDruidVines({
        state,
        characterId: decision.characterId,
        position: decision.position,
      }) ? [{}] : []
    ),
    activate: ({ state, decision }) => activateDruidVines({
      state,
      characterId: decision.characterId,
      position: decision.position,
    }),
  }),
  [ABILITY_IDS.ICE_MAGE_FREEZING]: Object.freeze({
    includePreviousPositionInActionId: true,
    includeActivationOptionInActionId: true,
    getOptions: ({ state, decision }) => getIceMageFreezingActivationOptions({
      state,
      characterId: decision.characterId,
      position: decision.position,
      previousPosition: decision.previousPosition,
    }),
    activate: ({ state, decision, action }) => activateIceMageFreezing({
      state,
      characterId: decision.characterId,
      position: decision.position,
      previousPosition: decision.previousPosition,
      targetCharacterId: action.targetCharacterId,
    }),
  }),
  [ABILITY_IDS.HUNTER_TRAP]: Object.freeze({
    includePreviousPositionInActionId: true,
    getOptions: ({ state, decision }) => getHunterTrapActivationOptions({
      state,
      characterId: decision.characterId,
      position: decision.position,
      previousPosition: decision.previousPosition,
    }),
    activate: ({ state, decision }) => activateHunterTrap({
      state,
      characterId: decision.characterId,
      position: decision.position,
      previousPosition: decision.previousPosition,
    }),
  }),
  [ABILITY_IDS.ALCHEMIST_DIZZY]: Object.freeze({
    includeActivationOptionInActionId: true,
    getOptions: ({ state, decision }) => getAlchemistDizzyActivationOptionsForDecision({
      state,
      characterId: decision.characterId,
      position: decision.position,
    }),
    activate: ({ state, decision, action }) => activateAlchemistDizzy({
      state,
      characterId: decision.characterId,
      position: decision.position,
      targetCharacterId: action.targetCharacterId,
    }),
  }),
});

function getActivationOptions({ state, decision }) {
  if (
    ![MOVEMENT_TYPES.NORMAL, MOVEMENT_TYPES.REWARD].includes(decision.movementType) ||
    decision.positionKey !== getPositionIdentity(decision.position)
  ) {
    return [];
  }

  const behavior = OPTIONAL_ABILITY_BEHAVIORS[decision.abilityId];

  return behavior ? behavior.getOptions({ state, decision }) : [];
}

function createAction({ decision, actionType, option = null }) {
  const behavior = OPTIONAL_ABILITY_BEHAVIORS[decision.abilityId];
  const identityParts = [
    decision.abilityId,
    decision.characterId,
    decision.positionKey,
  ];

  if (behavior?.includePreviousPositionInActionId) {
    identityParts.push(decision.previousPositionKey);
  }

  if (
    actionType === OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE &&
    option &&
    behavior?.includeActivationOptionInActionId
  ) {
    identityParts.push(option.targetCharacterId || 'terrain');
  }

  return {
    id: createDecisionActionId({
      decisionType: DECISION_TYPES.OPTIONAL_ABILITY_ACTIVATION,
      actionType,
      identityParts,
    }),
    type: actionType,
    abilityId: decision.abilityId,
    characterId: decision.characterId,
    ...(option && Object.prototype.hasOwnProperty.call(option, 'targetCharacterId')
      ? { targetCharacterId: option.targetCharacterId }
      : {}),
  };
}

export function createOptionalAbilityActivationDecision({
  abilityId,
  characterId,
  position,
  previousPosition = null,
  movementType,
}) {
  return {
    type: DECISION_TYPES.OPTIONAL_ABILITY_ACTIVATION,
    abilityId,
    characterId,
    position: clonePosition(position),
    positionKey: getPositionIdentity(position),
    ...(previousPosition
      ? {
        previousPosition: clonePosition(previousPosition),
        previousPositionKey: getPositionIdentity(previousPosition),
      }
      : {}),
    movementType,
  };
}

export function getOptionalAbilityActivationActions({ state, decision }) {
  const skipAction = createAction({
    decision,
    actionType: OPTIONAL_ABILITY_ACTION_TYPES.SKIP,
  });

  const activationOptions = getActivationOptions({ state, decision });

  if (activationOptions.length === 0) {
    return [skipAction];
  }

  return [
    ...activationOptions.map((option) => createAction({
      decision,
      actionType: OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
      option,
    })),
    skipAction,
  ];
}

export function executeOptionalAbilityActivation({ state, decision, action }) {
  if (action.type === OPTIONAL_ABILITY_ACTION_TYPES.SKIP) {
    return {
      state,
      events: [{
        type: EXECUTION_EVENT_TYPES.ABILITY_ACTIVATION_SKIPPED,
        abilityId: decision.abilityId,
        characterId: decision.characterId,
      }],
    };
  }

  if (action.type !== OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE) {
    throw new Error(`Unknown optional ability action type: ${action.type}`);
  }

  const behavior = OPTIONAL_ABILITY_BEHAVIORS[decision.abilityId];

  if (!behavior) {
    throw new Error(`Unsupported optional ability: ${decision.abilityId}`);
  }

  return {
    state: behavior.activate({ state, decision, action }),
    events: [{
      type: EXECUTION_EVENT_TYPES.ABILITY_ACTIVATED,
      abilityId: decision.abilityId,
      characterId: decision.characterId,
      position: clonePosition(decision.position),
      positionKey: decision.positionKey,
      ...(decision.previousPosition
        ? {
          targetPosition: clonePosition(decision.previousPosition),
          targetPositionKey: decision.previousPositionKey,
        }
        : {}),
      ...(action.targetCharacterId
        ? { targetCharacterId: action.targetCharacterId }
        : {}),
    }],
  };
}
