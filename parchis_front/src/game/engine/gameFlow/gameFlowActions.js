import { GAME_PHASES } from '../state/initialState';
import { createTurnState } from '../turns/turnState';
import { TURN_PHASES } from '../turns/types';
import { executeTurnAction, executeTurnDecision, registerTurnRoll } from '../turns/turnActions';
import { assertGameFlowInProgress, assertGameStateForFlow } from './gameFlowValidation';
import { getCurrentPlayer, getNextPlayerId } from './playerOrder';
import { GAME_STOP_REASONS } from './types';
import { getWinningPlayerId } from './victory';
import { decrementBleedingForFaction } from '../abilities/hunterTrap';

function createTurnForCurrentPlayer(gameState) {
  const player = getCurrentPlayer(gameState);

  return createTurnState({
    playerId: player.id,
    factionId: player.factionId,
  });
}

function createVictoryStop(gameState) {
  const winnerPlayerId = getWinningPlayerId(gameState);

  if (!winnerPlayerId) {
    return null;
  }

  return {
    reason: GAME_STOP_REASONS.VICTORY,
    winnerPlayerId,
  };
}

function finishGame({ gameState, winnerPlayerId }) {
  return {
    ...gameState,
    phase: GAME_PHASES.FINISHED,
    winnerPlayerId,
  };
}

function advanceToNextTurn(gameState) {
  const currentPlayer = getCurrentPlayer(gameState);
  const currentFactionId = currentPlayer.factionId;

  const stateAfterBleeding = decrementBleedingForFaction({ state: gameState, factionId: currentFactionId });

  const nextPlayerId = getNextPlayerId(stateAfterBleeding);
  const nextGameState = {
    ...stateAfterBleeding,
    currentPlayerId: nextPlayerId,
  };

  return {
    gameState: nextGameState,
    turnState: createTurnForCurrentPlayer(nextGameState),
  };
}

function completeEndedTurn({ gameState, turnState, stop = null }) {
  if (stop) {
    if (stop.reason !== GAME_STOP_REASONS.VICTORY) {
      throw new Error(`Unsupported game stop reason: ${stop.reason}`);
    }

    const winnerPlayerId = getWinningPlayerId(gameState);

    if (winnerPlayerId !== stop.winnerPlayerId) {
      throw new Error('Victory stop must match the player that satisfies the victory condition.');
    }

    return {
      gameState: finishGame({ gameState, winnerPlayerId }),
      turnState: null,
      stop: { ...stop, winnerPlayerId },
    };
  }

  const winnerPlayerId = getWinningPlayerId(gameState);

  if (winnerPlayerId) {
    return {
      gameState: finishGame({ gameState, winnerPlayerId }),
      turnState: null,
      stop: {
        reason: GAME_STOP_REASONS.VICTORY,
        winnerPlayerId,
      },
    };
  }

  if (turnState.phase !== TURN_PHASES.ENDED) {
    return { gameState, turnState };
  }

  return advanceToNextTurn(gameState);
}

function createShouldStopConsequences() {
  return ({ state }) => createVictoryStop(state);
}

function handleTurnResult(result) {
  if (result.turnState.phase !== TURN_PHASES.ENDED && !result.stop) {
    return {
      gameState: result.state,
      turnState: result.turnState,
      events: result.events,
    };
  }

  return {
    ...completeEndedTurn({
      gameState: result.state,
      turnState: result.turnState,
      stop: result.stop,
    }),
    events: result.events,
  };
}

export function createGameFlow({ gameState }) {
  assertGameStateForFlow(gameState);

  if (gameState.phase !== GAME_PHASES.READY) {
    throw new Error('createGameFlow requires a ready gameState.');
  }

  const nextGameState = {
    ...gameState,
    phase: GAME_PHASES.IN_PROGRESS,
  };

  return {
    gameState: nextGameState,
    turnState: createTurnForCurrentPlayer(nextGameState),
  };
}

export function registerGameRoll({ gameFlow, roll }) {
  assertGameFlowInProgress(gameFlow);

  return handleTurnResult(registerTurnRoll({
    state: gameFlow.gameState,
    turnState: gameFlow.turnState,
    roll,
  }));
}

export function executeGameAction({ gameFlow, action, choice }) {
  assertGameFlowInProgress(gameFlow);

  return handleTurnResult(executeTurnAction({
    state: gameFlow.gameState,
    turnState: gameFlow.turnState,
    action,
    choice,
    shouldStopConsequences: createShouldStopConsequences(),
  }));
}

export function executeGameDecision({ gameFlow, action }) {
  assertGameFlowInProgress(gameFlow);

  return handleTurnResult(executeTurnDecision({
    state: gameFlow.gameState,
    turnState: gameFlow.turnState,
    action,
    shouldStopConsequences: createShouldStopConsequences(),
  }));
}
