import { createAbilityDefinition, createAbilityRegistry } from './abilityRegistry';
import { ABILITY_ACTIVATION_TYPES } from './types';

export const ABILITY_IDS = Object.freeze({
  DRUID_VINES: 'druid.vines',
  ICE_MAGE_FREEZING: 'iceMage.freezing',
  HUNTER_TRAP: 'hunter.trap',
  ALCHEMIST_DIZZY: 'alchemist.dizzy',
  RANGER_PASS_THROUGH_BARRIERS: 'ranger.passThroughBarriers',
  ASSASSIN_CAPTURE_ON_SAFE_SQUARE: 'assassin.captureOnSafeSquare',
});

export const ABILITY_HOOKS = Object.freeze({
  OPTIONAL_POST_MOVEMENT_ACTIVATION: 'optionalPostMovementActivation',
  PASS_THROUGH_INTERMEDIATE_BARRIERS: 'passThroughIntermediateBarriers',
  CAPTURE_ENEMY_ON_SAFE_DESTINATION: 'captureEnemyOnSafeDestination',
});

export const DRUID_VINES = createAbilityDefinition({
  id: ABILITY_IDS.DRUID_VINES,
  characterType: 'druid',
  activationType: ABILITY_ACTIVATION_TYPES.PASSIVE,
  hooks: [ABILITY_HOOKS.OPTIONAL_POST_MOVEMENT_ACTIVATION],
  initialState: { charges: 2 },
  metadata: {
    label: 'Enredaderas',
    permanent: true,
    maxActiveTerrainEffects: 2,
  },
});

export const ICE_MAGE_FREEZING = createAbilityDefinition({
  id: ABILITY_IDS.ICE_MAGE_FREEZING,
  characterType: 'iceMage',
  activationType: ABILITY_ACTIVATION_TYPES.PASSIVE,
  hooks: [ABILITY_HOOKS.OPTIONAL_POST_MOVEMENT_ACTIVATION],
  initialState: { charges: 2 },
  metadata: {
    label: 'Congelacion',
    permanent: true,
  },
});

export const RANGER_PASS_THROUGH_BARRIERS = createAbilityDefinition({
  id: ABILITY_IDS.RANGER_PASS_THROUGH_BARRIERS,
  characterType: 'ranger',
  activationType: ABILITY_ACTIVATION_TYPES.PASSIVE,
  hooks: [ABILITY_HOOKS.PASS_THROUGH_INTERMEDIATE_BARRIERS],
  metadata: {
    label: 'Paso entre barreras',
    permanent: true,
  },
});

export const ASSASSIN_CAPTURE_ON_SAFE_SQUARE = createAbilityDefinition({
  id: ABILITY_IDS.ASSASSIN_CAPTURE_ON_SAFE_SQUARE,
  characterType: 'assassin',
  activationType: ABILITY_ACTIVATION_TYPES.PASSIVE,
  hooks: [ABILITY_HOOKS.CAPTURE_ENEMY_ON_SAFE_DESTINATION],
  metadata: {
    label: 'Captura en tabernas',
    permanent: true,
  },
});

export const HUNTER_TRAP = createAbilityDefinition({
  id: ABILITY_IDS.HUNTER_TRAP,
  characterType: 'hunter',
  activationType: ABILITY_ACTIVATION_TYPES.PASSIVE,
  hooks: [ABILITY_HOOKS.OPTIONAL_POST_MOVEMENT_ACTIVATION],
  initialState: { charges: 2 },
  metadata: {
    label: 'Trampa',
    permanent: true,
  },
});

export const ALCHEMIST_DIZZY = createAbilityDefinition({
  id: ABILITY_IDS.ALCHEMIST_DIZZY,
  characterType: 'alchemist',
  activationType: ABILITY_ACTIVATION_TYPES.PASSIVE,
  hooks: [ABILITY_HOOKS.OPTIONAL_POST_MOVEMENT_ACTIVATION],
  initialState: { charges: 2 },
  metadata: {
    label: 'Mareo',
    permanent: true,
  },
});

export const ABILITY_REGISTRY = createAbilityRegistry([
  DRUID_VINES,
  ICE_MAGE_FREEZING,
  HUNTER_TRAP,
  ALCHEMIST_DIZZY,
  RANGER_PASS_THROUGH_BARRIERS,
  ASSASSIN_CAPTURE_ON_SAFE_SQUARE,
]);
