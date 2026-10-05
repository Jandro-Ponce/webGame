import {
  CHARACTERS_BY_FACTION,
  ABILITY_IDS,
  COMMON_SQUARES,
  FACTION_IDS,
  FACTIONS,
  LAST_COMMON_SQUARE_BY_FACTION,
  FINAL_LANE_LENGTH,
  FINAL_LANES_BY_FACTION,
  GAME_PHASES,
  POSITION_TYPES,
  ROUTES_BY_FACTION,
  SAFE_SQUARES,
  START_SQUARE_BY_FACTION,
  createInitialGameState,
  getCommonRouteSquaresForFaction,
} from './index';

const EXPECTED_CHARACTERS_BY_FACTION = {
  [FACTION_IDS.GREEN]: ['Druida', 'Arquero', 'Montaraz', 'Hada'],
  [FACTION_IDS.RED]: ['Mago de fuego', 'Guerrero', 'Herrero', 'Asesino'],
  [FACTION_IDS.BLUE]: ['Mago de hielo', 'Cazador', 'Alquimista', 'Ladrón'],
  [FACTION_IDS.YELLOW]: ['Paladín', 'Monje', 'Clérigo', 'Ingeniero'],
};

const EXPECTED_SAFE_SQUARES = [5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63, 68];

const EXPECTED_START_SQUARES = {
  [FACTION_IDS.YELLOW]: 39,
  [FACTION_IDS.GREEN]: 22,
  [FACTION_IDS.BLUE]: 56,
  [FACTION_IDS.RED]: 5,
};

const EXPECTED_FINAL_ENTRY_SQUARES = {
  [FACTION_IDS.YELLOW]: 38,
  [FACTION_IDS.GREEN]: 21,
  [FACTION_IDS.BLUE]: 55,
  [FACTION_IDS.RED]: 4,
};

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

const EXPECTED_COMMON_ROUTES = {
  [FACTION_IDS.YELLOW]: [...range(39, 68), ...range(1, 38)],
  [FACTION_IDS.GREEN]: [...range(22, 68), ...range(1, 21)],
  [FACTION_IDS.BLUE]: [...range(56, 68), ...range(1, 55)],
  [FACTION_IDS.RED]: [...range(5, 68), ...range(1, 4)],
};

function makePlayers(count) {
  const factionIds = [FACTION_IDS.RED, FACTION_IDS.GREEN, FACTION_IDS.BLUE, FACTION_IDS.YELLOW];

  return factionIds.slice(0, count).map((factionId, index) => ({
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    factionId,
  }));
}

describe('game engine foundation', () => {
  test('defines exactly four factions', () => {
    expect(FACTIONS).toHaveLength(4);
    expect(FACTIONS.map((faction) => faction.id).sort()).toEqual(
      [FACTION_IDS.BLUE, FACTION_IDS.GREEN, FACTION_IDS.RED, FACTION_IDS.YELLOW].sort(),
    );
  });

  test('defines exactly the four documented characters for each faction', () => {
    Object.entries(EXPECTED_CHARACTERS_BY_FACTION).forEach(([factionId, expectedNames]) => {
      const characters = CHARACTERS_BY_FACTION[factionId];

      expect(characters).toHaveLength(4);
      expect(characters.map((character) => character.name)).toEqual(expectedNames);
      expect(characters.every((character) => character.factionId === factionId)).toBe(true);
    });
  });

  test('defines exactly 68 common squares', () => {
    expect(COMMON_SQUARES).toHaveLength(68);
    expect(COMMON_SQUARES).toEqual(range(1, 68));
  });

  test('defines safe squares exactly as documented', () => {
    expect(SAFE_SQUARES).toEqual(EXPECTED_SAFE_SQUARES);
  });

  test('defines start squares exactly as documented', () => {
    expect(START_SQUARE_BY_FACTION).toEqual(EXPECTED_START_SQUARES);
  });

  test('defines final lane entry squares exactly as documented', () => {
    expect(LAST_COMMON_SQUARE_BY_FACTION).toEqual(EXPECTED_FINAL_ENTRY_SQUARES);
  });

  test('defines one seven-position final lane for each faction', () => {
    FACTIONS.forEach((faction) => {
      const lane = FINAL_LANES_BY_FACTION[faction.id];

      expect(lane).toHaveLength(FINAL_LANE_LENGTH);
      expect(lane).toEqual(
        range(1, FINAL_LANE_LENGTH).map((index) => ({
          type: POSITION_TYPES.FINAL_LANE,
          factionId: faction.id,
          index,
        })),
      );
    });
  });

  test('defines ordered common routes for each faction', () => {
    Object.entries(EXPECTED_COMMON_ROUTES).forEach(([factionId, expectedRoute]) => {
      expect(getCommonRouteSquaresForFaction(factionId)).toEqual(expectedRoute);
    });
  });

  test('defines full faction routes from home to common path, final lane, and goal', () => {
    FACTIONS.forEach((faction) => {
      const route = ROUTES_BY_FACTION[faction.id];
      const expectedCommonRoute = EXPECTED_COMMON_ROUTES[faction.id];

      expect(route[0]).toEqual({ type: POSITION_TYPES.HOME });
      expect(route.slice(1, 69)).toEqual(
        expectedCommonRoute.map((square) => ({ type: POSITION_TYPES.COMMON, square })),
      );
      expect(route.slice(69, 76)).toEqual(FINAL_LANES_BY_FACTION[faction.id]);
      expect(route[76]).toEqual({ type: POSITION_TYPES.GOAL });
      expect(route).toHaveLength(77);
    });
  });

test.each([2, 3, 4])('creates a ready initial state for %i players', (playerCount) => {
    const players = makePlayers(playerCount);
    const turnOrder = players.map((player) => player.id);
    const state = createInitialGameState({ players, turnOrder });

    expect(state.phase).toBe(GAME_PHASES.READY);
    expect(state.players).toHaveLength(playerCount);
    expect(state.turnOrder).toEqual(turnOrder);
    expect(state.currentPlayerId).toBe(turnOrder[0]);

    const expectedCharacterStates = {
      'green.druid': {
        abilityStatesById: {
          [ABILITY_IDS.DRUID_VINES]: { charges: 2 },
        },
      },
    };
    if (playerCount >= 3) {
      expectedCharacterStates['blue.iceMage'] = {
        abilityStatesById: {
          [ABILITY_IDS.ICE_MAGE_FREEZING]: { charges: 2 },
        },
      };
      expectedCharacterStates['blue.hunter'] = {
        abilityStatesById: {
          [ABILITY_IDS.HUNTER_TRAP]: { charges: 2 },
        },
      };
      expectedCharacterStates['blue.alchemist'] = {
        abilityStatesById: {
          [ABILITY_IDS.ALCHEMIST_DIZZY]: { charges: 2 },
        },
      };
    }
    expect(state.characterStatesById).toEqual(expectedCharacterStates);
    expect(state.factionStatesById).toEqual(Object.fromEntries(
      players.map((player) => [player.factionId, {
        initialExitAvailable: true,
        pendingInitialExit: null,
      }]),
    ));
    expect(state.globalEffects).toEqual([]);
    expect(state.terrainEffectsByPositionKey).toEqual({});

    state.players.forEach((player) => {
      expect(player.characters).toHaveLength(4);
      expect(player.characters.every((character) => character.factionId === player.factionId)).toBe(true);
      expect(player.characters.every((character) => character.position.type === POSITION_TYPES.HOME)).toBe(true);
    });
  });

  test('creates only participating players in initial state', () => {
    const players = makePlayers(3);
    const state = createInitialGameState({
      players,
      turnOrder: players.map((player) => player.id),
    });

    expect(state.players).toHaveLength(3);
    expect(state.players.map((player) => player.factionId)).toEqual(players.map((player) => player.factionId));
  });

  test('creates a serializable initial state', () => {
    const players = makePlayers(4);
    const state = createInitialGameState({
      players,
      turnOrder: players.map((player) => player.id),
    });

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
