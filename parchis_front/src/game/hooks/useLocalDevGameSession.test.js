import { act, renderHook } from '@testing-library/react';
import { FACTION_IDS, GAME_PHASES, POSITION_TYPES, SETUP_PHASES, TURN_PHASES } from '../engine';
import { LOCAL_DEV_GAME_MODES, useLocalDevGameSession } from './useLocalDevGameSession';

function createShuffle(results) {
  return jest.fn(() => results.shift());
}

function createPicker(results) {
  return jest.fn(() => results.shift());
}

const FACTIONS_BY_PLAYER = Object.freeze({
  'player-a': FACTION_IDS.RED,
  'player-b': FACTION_IDS.BLUE,
  'player-c': FACTION_IDS.GREEN,
  'player-d': FACTION_IDS.YELLOW,
});

function completeSetup(result, { playerCount = 2 } = {}) {
  if (playerCount !== 2) {
    act(() => {
      result.current.setup.setPlayerCount(playerCount);
    });
  }

  act(() => {
    result.current.setup.sortFactionSelectionOrder();
  });

  result.current.setup.setupState.factionSelectionOrder.forEach((playerId) => {
    act(() => {
      result.current.setup.chooseFaction({ playerId, factionId: FACTIONS_BY_PLAYER[playerId] });
    });
  });

  act(() => {
    result.current.setup.drawStartingFaction();
  });
}

describe('useLocalDevGameSession', () => {
  test('starts in setup mode without Game Flow', () => {
    const { result } = renderHook(() => useLocalDevGameSession());

    expect(result.current.mode).toBe(LOCAL_DEV_GAME_MODES.SETUP);
    expect(result.current.setup.setupState.phase).toBe(SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER);
    expect(result.current.game.gameFlow).toBe(null);
  });

  test('does not create Game Flow before Start game', () => {
    const shuffle = createShuffle([['player-b', 'player-a']]);
    const pick = createPicker([FACTION_IDS.RED]);
    const { result } = renderHook(() => useLocalDevGameSession({ shuffle, pick }));

    completeSetup(result);

    expect(result.current.setup.setupState.phase).toBe(SETUP_PHASES.COMPLETED);
    expect(result.current.game.gameFlow).toBe(null);
    expect(result.current.mode).toBe(LOCAL_DEV_GAME_MODES.SETUP);
  });

  test('Start game completes setup, creates Game Flow, and switches to game mode', () => {
    const shuffle = createShuffle([['player-b', 'player-a']]);
    const pick = createPicker([FACTION_IDS.RED]);
    const { result } = renderHook(() => useLocalDevGameSession({ shuffle, pick }));

    completeSetup(result);
    act(() => {
      result.current.startGame();
    });

    expect(result.current.mode).toBe(LOCAL_DEV_GAME_MODES.GAME);
    expect(result.current.game.gameState.phase).toBe(GAME_PHASES.IN_PROGRESS);
    expect(result.current.game.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ROLL);
    expect(result.current.game.gameState.turnOrder).toEqual(['player-a', 'player-b']);
    expect(result.current.game.gameState.currentPlayerId).toBe('player-a');
    expect(result.current.game.turnState.playerId).toBe('player-a');
  });

  test('calling Start game twice keeps the engine-derived Game Flow consistent', () => {
    const shuffle = createShuffle([['player-b', 'player-a']]);
    const pick = createPicker([FACTION_IDS.RED]);
    const { result } = renderHook(() => useLocalDevGameSession({ shuffle, pick }));

    completeSetup(result);
    act(() => {
      result.current.startGame();
    });
    act(() => {
      result.current.startGame();
    });

    expect(result.current.mode).toBe(LOCAL_DEV_GAME_MODES.GAME);
    expect(result.current.game.gameState.phase).toBe(GAME_PHASES.IN_PROGRESS);
    expect(result.current.game.gameState.turnOrder).toEqual(['player-a', 'player-b']);
    expect(result.current.game.gameState.currentPlayerId).toBe('player-a');
    expect(result.current.game.turnState.playerId).toBe('player-a');
  });

  test.each([
    {
      playerCount: 2,
      selectionOrder: ['player-b', 'player-a'],
      startingFactionId: FACTION_IDS.RED,
      turnOrder: ['player-a', 'player-b'],
      expectedFactions: [FACTION_IDS.RED, FACTION_IDS.BLUE],
      unusedFactions: [FACTION_IDS.GREEN, FACTION_IDS.YELLOW],
    },
    {
      playerCount: 3,
      selectionOrder: ['player-b', 'player-a', 'player-c'],
      startingFactionId: FACTION_IDS.GREEN,
      turnOrder: ['player-c', 'player-b', 'player-a'],
      expectedFactions: [FACTION_IDS.RED, FACTION_IDS.BLUE, FACTION_IDS.GREEN],
      unusedFactions: [FACTION_IDS.YELLOW],
    },
    {
      playerCount: 4,
      selectionOrder: ['player-d', 'player-b', 'player-a', 'player-c'],
      startingFactionId: FACTION_IDS.GREEN,
      turnOrder: ['player-c', 'player-d', 'player-b', 'player-a'],
      expectedFactions: [FACTION_IDS.RED, FACTION_IDS.BLUE, FACTION_IDS.GREEN, FACTION_IDS.YELLOW],
      unusedFactions: [],
    },
  ])('starts a real game for $playerCount players without ghost factions', ({
    playerCount,
    selectionOrder,
    startingFactionId,
    turnOrder,
    expectedFactions,
    unusedFactions,
  }) => {
    const shuffle = createShuffle([selectionOrder]);
    const pick = createPicker([startingFactionId]);
    const { result } = renderHook(() => useLocalDevGameSession({ shuffle, pick }));

    completeSetup(result, { playerCount });
    act(() => {
      result.current.startGame();
    });

    const gameState = result.current.game.gameState;

    expect(gameState.players).toHaveLength(playerCount);
    expect(gameState.turnOrder).toEqual(turnOrder);
    expect(gameState.currentPlayerId).toBe(turnOrder[0]);
    expect(result.current.game.turnState.playerId).toBe(turnOrder[0]);
    expect(gameState.players.map((player) => player.factionId).sort()).toEqual([...expectedFactions].sort());
    unusedFactions.forEach((factionId) => {
      expect(gameState.players.some((player) => player.factionId === factionId)).toBe(false);
    });
    gameState.players.forEach((player) => {
      expect(player.characters).toHaveLength(4);
      expect(player.characters.every((character) => character.position.type === POSITION_TYPES.HOME)).toBe(true);
    });
  });
});
