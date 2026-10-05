import { EXECUTION_EVENT_TYPES } from '../actions/types';
import { resetDruidVinesAfterCapture } from './druidVines';
import { resetIceMageFreezingAfterCapture } from './iceMageFreezing';
import { resetHunterTrapAfterCapture } from './hunterTrap';
import { resetAlchemistDizzyAfterCapture } from './alchemistDizzy';

const CAPTURE_STATE_TRANSITIONS = [
  resetDruidVinesAfterCapture,
  resetIceMageFreezingAfterCapture,
  resetHunterTrapAfterCapture,
  resetAlchemistDizzyAfterCapture,
];

export function applyAbilityStateTransitionsFromEvents({ state, events }) {
  return events.reduce((currentState, event) => {
    if (event.type === EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED) {
      return CAPTURE_STATE_TRANSITIONS.reduce(
        (capturedState, transition) => transition({
          state: capturedState,
          characterId: event.capturedCharacterId,
        }),
        currentState,
      );
    }

    return currentState;
  }, state);
}
