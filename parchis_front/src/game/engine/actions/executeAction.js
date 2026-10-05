import { getCharactersFromState } from '../state/characters';
import { revalidateAction } from './revalidateAction';
import { executeBreakBarrierAction } from './executeBreakBarrierAction';
import { executeExitHomeAction } from './executeExitHomeAction';
import { executeNormalMovementAction } from './executeNormalMovementAction';
import { EXECUTABLE_ACTION_TYPES } from './types';

export function executeAction({ state, factionId, roll, action, choice }) {
  const characters = getCharactersFromState(state);
  const revalidated = revalidateAction({ state, factionId, roll, action, characters });

  if (revalidated.action.type === EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT) {
    return executeNormalMovementAction({
      state,
      characters,
      action: revalidated.action,
      movement: revalidated.movement,
      steps: revalidated.steps,
    });
  }

  if (revalidated.action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME) {
    return executeExitHomeAction({
      state,
      characters,
      action: revalidated.action,
      choice,
      steps: revalidated.steps,
      factionId,
    });
  }

  if (revalidated.action.type === EXECUTABLE_ACTION_TYPES.BREAK_BARRIER) {
    return executeBreakBarrierAction({
      state,
      characters,
      action: revalidated.action,
      movement: revalidated.movement,
      steps: revalidated.steps,
    });
  }

  throw new Error(`Unknown action type: ${revalidated.action.type}`);
}
