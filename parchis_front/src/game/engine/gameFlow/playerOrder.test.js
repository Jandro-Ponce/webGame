import {
  COUNTERCLOCKWISE_FACTION_ORDER,
  FACTION_IDS,
  createCounterclockwiseTurnOrder,
  getNextPlayerId,
} from '../index';

const PLAYERS = Object.freeze([
  Object.freeze({ id: 'green-player', factionId: FACTION_IDS.GREEN }),
  Object.freeze({ id: 'yellow-player', factionId: FACTION_IDS.YELLOW }),
  Object.freeze({ id: 'red-player', factionId: FACTION_IDS.RED }),
  Object.freeze({ id: 'blue-player', factionId: FACTION_IDS.BLUE }),
]);

describe('counterclockwise player order', () => {
  test('defines the physical cycle independently from faction declaration order', () => {
    expect(COUNTERCLOCKWISE_FACTION_ORDER).toEqual([
      FACTION_IDS.YELLOW,
      FACTION_IDS.BLUE,
      FACTION_IDS.RED,
      FACTION_IDS.GREEN,
    ]);
  });

  test.each([
    [FACTION_IDS.YELLOW, ['yellow-player', 'blue-player', 'red-player', 'green-player']],
    [FACTION_IDS.BLUE, ['blue-player', 'red-player', 'green-player', 'yellow-player']],
    [FACTION_IDS.RED, ['red-player', 'green-player', 'yellow-player', 'blue-player']],
    [FACTION_IDS.GREEN, ['green-player', 'yellow-player', 'blue-player', 'red-player']],
  ])('rotates all four factions from %s', (startingFactionId, expected) => {
    expect(createCounterclockwiseTurnOrder({ players: PLAYERS, startingFactionId })).toEqual(expected);
  });

  test.each([
    [
      [PLAYERS[2], PLAYERS[0], PLAYERS[1]],
      FACTION_IDS.GREEN,
      ['green-player', 'yellow-player', 'red-player'],
    ],
    [
      [PLAYERS[0], PLAYERS[3], PLAYERS[2]],
      FACTION_IDS.BLUE,
      ['blue-player', 'red-player', 'green-player'],
    ],
    [
      [PLAYERS[0], PLAYERS[3]],
      FACTION_IDS.BLUE,
      ['blue-player', 'green-player'],
    ],
    [
      [PLAYERS[2], PLAYERS[1]],
      FACTION_IDS.RED,
      ['red-player', 'yellow-player'],
    ],
  ])('skips absent factions for 2/3 players', (players, startingFactionId, expected) => {
    expect(createCounterclockwiseTurnOrder({ players, startingFactionId })).toEqual(expected);
  });

  test('wraps from the final participant to the starting faction', () => {
    const turnOrder = createCounterclockwiseTurnOrder({
      players: [PLAYERS[2], PLAYERS[0], PLAYERS[3]],
      startingFactionId: FACTION_IDS.BLUE,
    });

    expect(getNextPlayerId({ turnOrder, currentPlayerId: 'green-player' })).toBe('blue-player');
  });

  test('rejects a non-participating starting faction', () => {
    expect(() => createCounterclockwiseTurnOrder({
      players: [PLAYERS[2], PLAYERS[3]],
      startingFactionId: FACTION_IDS.YELLOW,
    })).toThrow('Starting faction is not participating: yellow');
  });
});
