import { act, renderHook } from '@testing-library/react';
import {
  EXECUTABLE_ACTION_TYPES,
  EXECUTION_EVENT_TYPES,
  FACTION_IDS,
  GAME_PHASES,
  POSITION_TYPES,
  TURN_PHASES,
  chooseFaction,
  completeGameSetup,
  createGameSetup,
  setFactionSelectionOrder,
  setGameSetupTurnOrder,
} from '../engine';
import { useGameEngine } from './useGameEngine';

function getCharacter(gameState, characterId) {
  return gameState.players
    .flatMap((player) => player.characters)
    .find((character) => character.id === characterId);
}

function createReadyGameState({
  turnOrder = ['player-b', 'player-a'],
  initialExitAvailable = true,
} = {}) {
  const setupState = createGameSetup({
    players: [
      { id: 'player-a', name: 'Player A' },
      { id: 'player-b', name: 'Player B' },
    ],
  });
  const withSelectionOrder = setFactionSelectionOrder({
    setupState,
    playerOrder: ['player-a', 'player-b'],
  });
  const withPlayerAFaction = chooseFaction({
    setupState: withSelectionOrder,
    playerId: 'player-a',
    factionId: FACTION_IDS.RED,
  });
  const withPlayerBFaction = chooseFaction({
    setupState: withPlayerAFaction,
    playerId: 'player-b',
    factionId: FACTION_IDS.BLUE,
  });
  const completedSetup = setGameSetupTurnOrder({
    setupState: withPlayerBFaction,
    startingFactionId: turnOrder[0] === 'player-b' ? FACTION_IDS.BLUE : FACTION_IDS.RED,
  });

  const gameState = completeGameSetup({ setupState: completedSetup }).gameState;

  if (initialExitAvailable) {
    return gameState;
  }

  return {
    ...gameState,
    factionStatesById: Object.fromEntries(
      Object.entries(gameState.factionStatesById).map(([factionId, factionState]) => [
        factionId,
        { ...factionState, initialExitAvailable: false },
      ]),
    ),
  };
}

function startGame(result, options) {
  act(() => {
    result.current.startGame({ gameState: createReadyGameState(options) });
  });
}

describe('useGameEngine', () => {
  test('starts without Game Flow', () => {
    const { result } = renderHook(() => useGameEngine());

    expect(result.current.gameFlow).toBe(null);
    expect(result.current.gameState).toBe(null);
    expect(result.current.turnState).toBe(null);
    expect(result.current.currentPlayer).toBe(null);
    expect(result.current.availableActions).toEqual([]);
    expect(result.current.pendingDecision).toBe(null);
    expect(result.current.availableDecisionActions).toEqual([]);
    expect(result.current.lastEvents).toEqual([]);
  });

  test('startGame receives a ready GameState and creates Game Flow', () => {
    const { result } = renderHook(() => useGameEngine());

    startGame(result);

    expect(result.current.gameState.phase).toBe(GAME_PHASES.IN_PROGRESS);
    expect(result.current.gameState.players.map((player) => ({
      id: player.id,
      name: player.name,
      factionId: player.factionId,
    }))).toEqual([
      { id: 'player-a', name: 'Player A', factionId: 'red' },
      { id: 'player-b', name: 'Player B', factionId: 'blue' },
    ]);
    expect(result.current.gameState.turnOrder).toEqual(['player-b', 'player-a']);
    expect(result.current.gameState.currentPlayerId).toBe('player-b');
    expect(result.current.turnState.playerId).toBe('player-b');
    expect(result.current.turnState.factionId).toBe('blue');
    expect(result.current.currentPlayer.id).toBe('player-b');
    expect(result.current.availableActions).toEqual([]);
    expect(result.current.pendingDecision).toBe(null);
    expect(result.current.availableDecisionActions).toEqual([]);
    expect(result.current.lastEvents).toEqual([]);
  });

  test.each([
    ['registerRoll', (current) => current.registerRoll(5)],
    ['executeAction', (current) => current.executeAction({ type: EXECUTABLE_ACTION_TYPES.EXIT_HOME })],
    ['executeDecision', (current) => current.executeDecision('decision-action-id')],
  ])('%s before startGame fails explicitly without creating Game Flow', (_, command) => {
    const { result } = renderHook(() => useGameEngine());
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => {
        act(() => {
          command(result.current);
        });
      }).toThrow('Game Flow has not been started.');
    } finally {
      consoleError.mockRestore();
    }

    expect(result.current.gameFlow).toBe(null);
    expect(result.current.lastEvents).toEqual([]);
  });

  test('registerRoll delegates to the engine and exposes roll 5 home-exit actions', () => {
    const { result } = renderHook(() => useGameEngine());

    startGame(result);

    act(() => {
      result.current.registerRoll(5);
    });

    expect(result.current.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ACTION);
    expect(result.current.turnState.currentRoll).toBe(5);
    expect(result.current.availableActions).toHaveLength(4);
    expect(result.current.availableActions.every((action) => action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME)).toBe(true);
    expect(result.current.availableActions.every(
      (action) => action.initialExit && action.characterIds === undefined,
    )).toBe(true);
    expect(result.current.availableActions.every((action) => action.destination?.type === POSITION_TYPES.COMMON)).toBe(true);
    expect(result.current.lastEvents).toEqual([]);
  });

  test('roll without legal movement advances according to Game Flow', () => {
    const { result } = renderHook(() => useGameEngine());

    startGame(result, { initialExitAvailable: false });

    act(() => {
      result.current.registerRoll(1);
    });

    expect(result.current.gameState.currentPlayerId).toBe('player-a');
    expect(result.current.turnState.playerId).toBe('player-a');
    expect(result.current.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ROLL);
    expect(result.current.lastEvents).toEqual([]);
  });

  test('roll 6 without legal movement preserves the engine-provided turn state', () => {
    const { result } = renderHook(() => useGameEngine());

    startGame(result, { initialExitAvailable: false });

    act(() => {
      result.current.registerRoll(6);
    });

    expect(result.current.gameState.currentPlayerId).toBe('player-b');
    expect(result.current.turnState.playerId).toBe('player-b');
    expect(result.current.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ROLL);
    expect(result.current.turnState.consecutiveSixes).toBe(1);
    expect(result.current.lastEvents).toEqual([]);
  });

  test('executeAction delegates both sequential initial-exit selections', () => {
    const { result } = renderHook(() => useGameEngine());

    startGame(result);

    act(() => {
      result.current.registerRoll(5);
    });

    const action = result.current.availableActions[0];

    act(() => {
      result.current.executeAction(action);
    });

    expect(getCharacter(result.current.gameState, action.characterId).position).toEqual(action.destination);
    expect(result.current.gameState.currentPlayerId).toBe('player-b');
    expect(result.current.turnState.playerId).toBe('player-b');
    expect(result.current.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ACTION);
    expect(result.current.availableActions).toHaveLength(3);
    expect(result.current.availableActions.some(
      (candidate) => candidate.characterId === action.characterId,
    )).toBe(false);
    expect(result.current.lastEvents).toEqual([
      expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
        characterId: action.characterId,
      }),
    ]);

    const secondAction = result.current.availableActions[0];
    act(() => {
      result.current.executeAction(secondAction);
    });

    expect(getCharacter(result.current.gameState, secondAction.characterId).position).toEqual(secondAction.destination);
    expect(getCharacter(result.current.gameState, action.characterId).position).toEqual(action.destination);
    expect(result.current.gameState.currentPlayerId).toBe('player-a');
    expect(result.current.turnState.playerId).toBe('player-a');
    expect(result.current.lastEvents).toEqual([
      expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
        characterId: secondAction.characterId,
      }),
    ]);
  });

  test('stale actions from a previous turn are rejected by the engine', () => {
    const { result } = renderHook(() => useGameEngine());
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      startGame(result);
      act(() => {
        result.current.registerRoll(5);
      });

      const staleAction = result.current.availableActions[0];

      act(() => {
        result.current.executeAction(staleAction);
      });

      const secondAction = result.current.availableActions[0];
      act(() => {
        result.current.executeAction(secondAction);
      });

      expect(result.current.gameState.currentPlayerId).toBe('player-a');

      expect(() => {
        act(() => {
          result.current.executeAction(staleAction);
        });
      }).toThrow('Turn phase must be waitingForAction.');
    } finally {
      consoleError.mockRestore();
    }

    expect(result.current.gameState.currentPlayerId).toBe('player-a');
    expect(result.current.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ROLL);
  });

  test('lastEvents only reflects the latest engine operation', () => {
    const { result } = renderHook(() => useGameEngine());

    startGame(result);

    act(() => {
      result.current.registerRoll(5);
    });

    const action = result.current.availableActions[0];

    act(() => {
      result.current.executeAction(action);
    });

    expect(result.current.lastEvents).toHaveLength(1);

    const secondAction = result.current.availableActions[0];
    act(() => {
      result.current.executeAction(secondAction);
    });

    expect(result.current.lastEvents).toHaveLength(1);

    act(() => {
      result.current.registerRoll(1);
    });

    expect(result.current.lastEvents).toEqual([]);
  });

  test('startGame replaces prior Game Flow and resets lastEvents', () => {
    const { result } = renderHook(() => useGameEngine());

    startGame(result);
    act(() => {
      result.current.registerRoll(5);
    });
    const action = result.current.availableActions[0];
    act(() => {
      result.current.executeAction(action);
    });

    expect(result.current.lastEvents).toHaveLength(1);

    act(() => {
      result.current.startGame({ gameState: createReadyGameState({ turnOrder: ['player-a', 'player-b'] }) });
    });

    expect(result.current.gameState.currentPlayerId).toBe('player-a');
    expect(result.current.turnState.playerId).toBe('player-a');
    expect(result.current.lastEvents).toEqual([]);
  });

  test('executeDecision delegates to the engine instead of validating decisions in React', () => {
    const { result } = renderHook(() => useGameEngine());
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    startGame(result);

    try {
      expect(() => {
        act(() => {
          result.current.executeDecision('unknown-decision-action-id');
        });
      }).toThrow('Turn phase must be waitingForDecision.');
    } finally {
      consoleError.mockRestore();
    }
  });

  test('does not expose manual destination movement commands', () => {
    const { result } = renderHook(() => useGameEngine());

    expect(result.current.moveCharacterToBox).toBeUndefined();
    expect(result.current.moveToDestination).toBeUndefined();
    expect(result.current.selectDestination).toBeUndefined();
    expect(result.current.dispatch).toBeUndefined();
  });
});
