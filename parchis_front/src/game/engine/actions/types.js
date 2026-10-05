export const EXECUTABLE_ACTION_TYPES = Object.freeze({
  NORMAL_MOVEMENT: 'normalMovement',
  EXIT_HOME: 'exitHome',
  BREAK_BARRIER: 'breakBarrier',
});

export const EXECUTION_EVENT_TYPES = Object.freeze({
  CHARACTER_MOVED: 'characterMoved',
  CHARACTER_CAPTURED: 'characterCaptured',
  CHARACTER_REACHED_GOAL: 'characterReachedGoal',
  CHARACTER_EXITED_HOME: 'characterExitedHome',
  CHARACTER_REMOVED_FROM_START: 'characterRemovedFromStart',
  CHARACTER_DIED: 'characterDied',
  BARRIER_BROKEN: 'barrierBroken',
  REWARD_LOST: 'rewardLost',
  TERRAIN_EFFECT_TRIGGERED: 'terrainEffectTriggered',
  ABILITY_ACTIVATED: 'abilityActivated',
  ABILITY_ACTIVATION_SKIPPED: 'abilityActivationSkipped',
});
