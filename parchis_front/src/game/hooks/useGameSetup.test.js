import { act, renderHook } from '@testing-library/react';
import { FACTION_IDS, SETUP_PHASES } from '../engine';
import { useGameSetup } from './useGameSetup';

function createShuffle(results) {
  const shuffle = jest.fn(() => results.shift());
  return shuffle;
}

function createPicker(results) {
  return jest.fn(() => results.shift());
}

describe('useGameSetup', () => {
  test('starts with 2 players and no GameState', () => {
    const { result } = renderHook(() => useGameSetup());

    expect(result.current.playerCount).toBe(2);
    expect(result.current.players.map((player) => player.id)).toEqual(['player-a', 'player-b']);
    expect(result.current.setupState.phase).toBe(SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER);
    expect(result.current.setupState).not.toHaveProperty('gameState');
    expect(result.current.setupState).not.toHaveProperty('turnState');
  });

  test('allows selecting 3 and 4 players before the first draw', () => {
    const { result } = renderHook(() => useGameSetup());

    act(() => {
      result.current.setPlayerCount(3);
    });

    expect(result.current.playerCount).toBe(3);
    expect(result.current.players.map((player) => player.id)).toEqual(['player-a', 'player-b', 'player-c']);

    act(() => {
      result.current.setPlayerCount(4);
    });

    expect(result.current.playerCount).toBe(4);
    expect(result.current.players.map((player) => player.id)).toEqual(['player-a', 'player-b', 'player-c', 'player-d']);
  });

  test('changing player count before the first draw recreates setup without stale data', () => {
    const { result } = renderHook(() => useGameSetup());

    act(() => {
      result.current.setPlayerCount(4);
    });
    act(() => {
      result.current.setPlayerCount(2);
    });

    expect(result.current.playerCount).toBe(2);
    expect(result.current.setupState.players.map((player) => player.id)).toEqual(['player-a', 'player-b']);
    expect(result.current.setupState.factionSelectionOrder).toBe(null);
    expect(result.current.setupState.factionChoices).toEqual([]);
    expect(result.current.setupState.startingFactionId).toBe(null);
    expect(result.current.setupState.turnOrder).toBe(null);
    expect(result.current.factionChoiceByPlayerId).toEqual({});
  });

  test('registers the first draw as faction selection order', () => {
    const shuffle = createShuffle([['player-b', 'player-a']]);
    const { result } = renderHook(() => useGameSetup({ shuffle }));

    act(() => {
      result.current.sortFactionSelectionOrder();
    });

    expect(shuffle).toHaveBeenCalledWith(['player-a', 'player-b']);
    expect(result.current.setupState.phase).toBe(SETUP_PHASES.CHOOSING_FACTIONS);
    expect(result.current.setupState.factionSelectionOrder).toEqual(['player-b', 'player-a']);
    expect(result.current.canChangePlayerCount).toBe(false);
    expect(result.current.currentSelectionPlayer.id).toBe('player-b');
  });

  test('rejects changing player count after the first draw', () => {
    const shuffle = createShuffle([['player-b', 'player-a']]);
    const { result } = renderHook(() => useGameSetup({ shuffle }));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      act(() => {
        result.current.sortFactionSelectionOrder();
      });

      expect(() => {
        act(() => {
          result.current.setPlayerCount(4);
        });
      }).toThrow('Player count can only be changed before sorting faction selection order.');
    } finally {
      consoleError.mockRestore();
    }
  });

  test('chooses factions in faction selection order and keeps factions unique', () => {
    const shuffle = createShuffle([['player-b', 'player-a']]);
    const { result } = renderHook(() => useGameSetup({ shuffle }));

    act(() => {
      result.current.sortFactionSelectionOrder();
    });
    act(() => {
      result.current.chooseFaction({ playerId: 'player-b', factionId: FACTION_IDS.BLUE });
    });

    expect(result.current.factionChoiceByPlayerId).toEqual({ 'player-b': FACTION_IDS.BLUE });
    expect(result.current.currentSelectionPlayer.id).toBe('player-a');
    expect(result.current.availableFactions.find((faction) => faction.id === FACTION_IDS.BLUE).available).toBe(false);

    act(() => {
      result.current.chooseFaction({ playerId: 'player-a', factionId: FACTION_IDS.RED });
    });

    expect(result.current.setupState.phase).toBe(SETUP_PHASES.WAITING_FOR_TURN_ORDER);
    expect(result.current.factionChoiceByPlayerId).toEqual({
      'player-b': FACTION_IDS.BLUE,
      'player-a': FACTION_IDS.RED,
    });
  });

  test('draws only the starting faction and derives counterclockwise turn order', () => {
    const shuffle = createShuffle([['player-b', 'player-a']]);
    const pick = createPicker([FACTION_IDS.RED]);
    const { result } = renderHook(() => useGameSetup({ shuffle, pick }));

    act(() => {
      result.current.sortFactionSelectionOrder();
    });
    act(() => {
      result.current.chooseFaction({ playerId: 'player-b', factionId: FACTION_IDS.BLUE });
    });
    act(() => {
      result.current.chooseFaction({ playerId: 'player-a', factionId: FACTION_IDS.RED });
    });
    act(() => {
      result.current.drawStartingFaction();
    });

    expect(shuffle).toHaveBeenCalledTimes(1);
    expect(shuffle).toHaveBeenCalledWith(['player-a', 'player-b']);
    expect(pick).toHaveBeenCalledWith([FACTION_IDS.BLUE, FACTION_IDS.RED]);
    expect(result.current.setupState.phase).toBe(SETUP_PHASES.COMPLETED);
    expect(result.current.setupState.factionSelectionOrder).toEqual(['player-b', 'player-a']);
    expect(result.current.setupState.startingFactionId).toBe(FACTION_IDS.RED);
    expect(result.current.setupState.turnOrder).toEqual(['player-a', 'player-b']);
    expect(result.current.setupState).not.toHaveProperty('gameState');
  });

  test('keeps the starting faction draw independent from faction selection order', () => {
    const sameOrder = ['player-b', 'player-a'];
    const shuffle = createShuffle([sameOrder]);
    const pick = createPicker([FACTION_IDS.BLUE]);
    const { result } = renderHook(() => useGameSetup({ shuffle, pick }));

    act(() => {
      result.current.sortFactionSelectionOrder();
    });
    act(() => {
      result.current.chooseFaction({ playerId: 'player-b', factionId: FACTION_IDS.BLUE });
    });
    act(() => {
      result.current.chooseFaction({ playerId: 'player-a', factionId: FACTION_IDS.RED });
    });
    act(() => {
      result.current.drawStartingFaction();
    });

    expect(shuffle).toHaveBeenCalledTimes(1);
    expect(pick).toHaveBeenCalledTimes(1);
    expect(result.current.setupState.factionSelectionOrder).toEqual(sameOrder);
    expect(result.current.setupState.startingFactionId).toBe(FACTION_IDS.BLUE);
    expect(result.current.setupState.turnOrder).toEqual(sameOrder);
  });
});
