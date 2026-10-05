import { useReducer } from 'react';
import * as Engine from '../engine';

const ACTION_TYPES = Object.freeze({
  START_GAME: 'startGame',
  REGISTER_ROLL: 'registerRoll',
  EXECUTE_ACTION: 'executeAction',
  EXECUTE_DECISION: 'executeDecision',
});

function createInitialState() {
  return {
    gameFlow: null,
    lastEvents: [],
  };
}

function assertGameStarted(gameFlow) {
  if (!gameFlow) {
    throw new Error('Game Flow has not been started.');
  }
}

function applyGameFlowResult(result) {
  return {
    gameFlow: {
      gameState: result.gameState,
      turnState: result.turnState,
    },
    lastEvents: result.events || [],
  };
}

function gameEngineReducer(state, action) {
  if (action.type === ACTION_TYPES.START_GAME) {
    return {
      gameFlow: Engine.createGameFlow({ gameState: action.gameState }),
      lastEvents: [],
    };
  }

  if (action.type === ACTION_TYPES.REGISTER_ROLL) {
    assertGameStarted(state.gameFlow);

    return applyGameFlowResult(Engine.registerGameRoll({
      gameFlow: state.gameFlow,
      roll: action.value,
    }));
  }

  if (action.type === ACTION_TYPES.EXECUTE_ACTION) {
    assertGameStarted(state.gameFlow);

    return applyGameFlowResult(Engine.executeGameAction({
      gameFlow: state.gameFlow,
      action: action.action,
      choice: action.choice,
    }));
  }

  if (action.type === ACTION_TYPES.EXECUTE_DECISION) {
    assertGameStarted(state.gameFlow);

    return applyGameFlowResult(Engine.executeGameDecision({
      gameFlow: state.gameFlow,
      action: { id: action.actionId },
    }));
  }

  throw new Error(`Unknown game engine action: ${action.type}`);
}

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameEngineReducer, undefined, createInitialState);
  const { gameFlow, lastEvents } = state;
  const gameState = gameFlow?.gameState || null;
  const turnState = gameFlow?.turnState || null;

  return {
    gameFlow,
    gameState,
    turnState,
    currentPlayer: gameState ? Engine.getCurrentPlayer(gameState) : null,
    availableActions: turnState?.availableActions || [],
    pendingDecision: turnState?.pendingDecision || null,
    availableDecisionActions: turnState?.availableDecisionActions || [],
    lastEvents,
    startGame({ gameState: readyGameState }) {
      dispatch({ type: ACTION_TYPES.START_GAME, gameState: readyGameState });
    },
    registerRoll(value) {
      dispatch({ type: ACTION_TYPES.REGISTER_ROLL, value });
    },
    executeAction(action, choice) {
      dispatch({
        type: ACTION_TYPES.EXECUTE_ACTION,
        action: action?.id ? { id: action.id } : action,
        choice,
      });
    },
    executeDecision(actionId) {
      dispatch({ type: ACTION_TYPES.EXECUTE_DECISION, actionId });
    },
  };
}

export default useGameEngine;
