import {
  CHARACTERS_BY_FACTION,
  FACTION_IDS,
  GAME_PHASES,
  POSITION_TYPES,
  SETUP_PHASES,
  TURN_PHASES,
  applyBleedingStatus,
  chooseFaction,
  completeGameSetup,
  createGameFlow,
  createGameSetup,
  getBleedingStatus,
  registerGameRoll,
  setFactionSelectionOrder,
  setGameSetupTurnOrder,
} from '../index';
import * as Engine from '../index';

const PLAYER_A = { id: 'player-a', name: 'Alejandro' };
const PLAYER_B = { id: 'player-b', name: 'Lidia' };
const PLAYER_C = { id: 'player-c', name: 'Marta' };
const PLAYER_D = { id: 'player-d', name: 'Nico' };
const FACTIONS_FOR_TEST_SETUP = [FACTION_IDS.RED, FACTION_IDS.GREEN, FACTION_IDS.BLUE, FACTION_IDS.YELLOW];

function createPlayers(count) {
  return [PLAYER_A, PLAYER_B, PLAYER_C, PLAYER_D].slice(0, count).map((player) => ({ ...player }));
}

function createSetupWaitingForFactionSelectionOrder(count = 3) {
  return createGameSetup({ players: createPlayers(count) });
}

function createSetupChoosingFactions({ players = createPlayers(3), order = players.map((player) => player.id) } = {}) {
  return setFactionSelectionOrder({
    setupState: createGameSetup({ players }),
    playerOrder: order,
  });
}

function chooseFactionsInOrder({ setupState, factionIds }) {
  return factionIds.reduce((currentSetupState, factionId) => chooseFaction({
    setupState: currentSetupState,
    playerId: currentSetupState.factionSelectionOrder[currentSetupState.factionChoices.length],
    factionId,
  }), setupState);
}

function createSetupWaitingForTurnOrder({ players = createPlayers(3), order = players.map((player) => player.id) } = {}) {
  return chooseFactionsInOrder({
    setupState: createSetupChoosingFactions({ players, order }),
    factionIds: FACTIONS_FOR_TEST_SETUP.slice(0, players.length),
  });
}

function createCompletedSetup({
  players = createPlayers(3),
  selectionOrder = players.map((player) => player.id),
  startingFactionId = FACTION_IDS.RED,
} = {}) {
  return setGameSetupTurnOrder({
    setupState: createSetupWaitingForTurnOrder({ players, order: selectionOrder }),
    startingFactionId,
  });
}

function disableInitialExits(gameState) {
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

describe('game setup', () => {
  describe('createGameSetup', () => {
    test.each([2, 3, 4])('creates a setup state for %i players', (playerCount) => {
      const setupState = createGameSetup({ players: createPlayers(playerCount) });

      expect(setupState).toEqual({
        phase: SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER,
        players: createPlayers(playerCount),
        factionSelectionOrder: null,
        factionChoices: [],
        startingFactionId: null,
        turnOrder: null,
      });
    });

    test('normalizes missing player names to player ids', () => {
      const setupState = createGameSetup({
        players: [{ id: 'player-a' }, { id: 'player-b', name: 'Lidia' }],
      });

      expect(setupState.players).toEqual([
        { id: 'player-a', name: 'player-a' },
        { id: 'player-b', name: 'Lidia' },
      ]);
    });

    test('does not preserve arbitrary player input properties', () => {
      const setupState = createGameSetup({
        players: [
          { id: 'player-a', name: 'Alejandro', factionId: FACTION_IDS.RED, score: 99 },
          { id: 'player-b', name: 'Lidia', token: 'ignored' },
        ],
      });

      expect(setupState.players).toEqual([
        { id: 'player-a', name: 'Alejandro' },
        { id: 'player-b', name: 'Lidia' },
      ]);
    });

    test('keeps compatibility with non-string non-empty ids', () => {
      const setupState = createGameSetup({
        players: [{ id: 1 }, { id: 2 }],
      });

      expect(setupState.players).toEqual([
        { id: 1, name: 1 },
        { id: 2, name: 2 },
      ]);
    });

    test.each([undefined, null, {}, 'players'])('rejects non-array players: %s', (players) => {
      expect(() => createGameSetup({ players })).toThrow('Game setup requires 2, 3, or 4 players.');
    });

    test('rejects fewer than two players', () => {
      expect(() => createGameSetup({ players: [{ id: 'player-a' }] })).toThrow(
        'Game setup requires 2, 3, or 4 players.',
      );
    });

    test('rejects more than four players', () => {
      expect(() => createGameSetup({
        players: [
          { id: 'player-a' },
          { id: 'player-b' },
          { id: 'player-c' },
          { id: 'player-d' },
          { id: 'player-e' },
        ],
      })).toThrow('Game setup requires 2, 3, or 4 players.');
    });

    test('rejects duplicate player ids', () => {
      expect(() => createGameSetup({
        players: [{ id: 'player-a' }, { id: 'player-a' }],
      })).toThrow('Duplicate setup player id: player-a');
    });

    test.each([undefined, null, ''])('rejects missing player id: %s', (id) => {
      expect(() => createGameSetup({
        players: [{ id }, { id: 'player-b' }],
      })).toThrow('Every setup player requires an id.');
    });
  });

  describe('setFactionSelectionOrder', () => {
    test('registers a valid faction selection order', () => {
      const setupState = createSetupWaitingForFactionSelectionOrder();
      const result = setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-b', 'player-a', 'player-c'],
      });

      expect(result.phase).toBe(SETUP_PHASES.CHOOSING_FACTIONS);
      expect(result.factionSelectionOrder).toEqual(['player-b', 'player-a', 'player-c']);
      expect(result.factionChoices).toEqual([]);
      expect(result.turnOrder).toBe(null);
    });

    test('rejects an unknown player', () => {
      const setupState = createSetupWaitingForFactionSelectionOrder();

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-b', 'player-x'],
      })).toThrow('factionSelectionOrder contains an unknown player: player-x');
    });

    test('rejects duplicate players', () => {
      const setupState = createSetupWaitingForFactionSelectionOrder();

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-a', 'player-c'],
      })).toThrow('Player order cannot contain duplicate players: player-a');
    });

    test('rejects absent players', () => {
      const setupState = createSetupWaitingForFactionSelectionOrder();

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-b'],
      })).toThrow('factionSelectionOrder must contain exactly the setup players.');
    });

    test('rejects an incorrect phase', () => {
      const setupState = createSetupChoosingFactions();

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-b', 'player-c'],
      })).toThrow(`Setup phase must be ${SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER}.`);
    });
  });

  describe('chooseFaction', () => {
    test('allows the current selection player to choose a faction', () => {
      const setupState = createSetupChoosingFactions({ order: ['player-b', 'player-a', 'player-c'] });
      const result = chooseFaction({
        setupState,
        playerId: 'player-b',
        factionId: FACTION_IDS.RED,
      });

      expect(result.phase).toBe(SETUP_PHASES.CHOOSING_FACTIONS);
      expect(result.factionChoices).toEqual([
        { playerId: 'player-b', factionId: FACTION_IDS.RED },
      ]);
    });

    test('rejects a player choosing out of turn', () => {
      const setupState = createSetupChoosingFactions({ order: ['player-b', 'player-a', 'player-c'] });

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-a',
        factionId: FACTION_IDS.RED,
      })).toThrow('It is not this player\'s faction selection turn: player-a');
    });

    test('rejects an unknown player', () => {
      const setupState = createSetupChoosingFactions();

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-x',
        factionId: FACTION_IDS.RED,
      })).toThrow('Unknown setup player: player-x');
    });

    test('rejects an invalid faction', () => {
      const setupState = createSetupChoosingFactions();

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-a',
        factionId: 'purple',
      })).toThrow('Invalid faction id: purple');
    });

    test('rejects a faction that is already chosen', () => {
      const setupState = chooseFaction({
        setupState: createSetupChoosingFactions(),
        playerId: 'player-a',
        factionId: FACTION_IDS.RED,
      });

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-b',
        factionId: FACTION_IDS.RED,
      })).toThrow('Faction has already been chosen: red');
    });

    test('rejects a player trying to choose twice', () => {
      const setupState = {
        ...createSetupChoosingFactions({ order: ['player-a', 'player-b', 'player-c'] }),
        factionChoices: [
          { playerId: 'player-a', factionId: FACTION_IDS.RED },
          { playerId: 'player-a', factionId: FACTION_IDS.GREEN },
        ],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-a',
        factionId: FACTION_IDS.BLUE,
      })).toThrow('Player has already chosen a faction: player-a');
    });

    test('advances the selector after each faction choice', () => {
      const setupState = createSetupChoosingFactions({ order: ['player-b', 'player-a', 'player-c'] });
      const first = chooseFaction({ setupState, playerId: 'player-b', factionId: FACTION_IDS.RED });
      const second = chooseFaction({ setupState: first, playerId: 'player-a', factionId: FACTION_IDS.GREEN });

      expect(first.factionChoices).toEqual([
        { playerId: 'player-b', factionId: FACTION_IDS.RED },
      ]);
      expect(second.factionChoices).toEqual([
        { playerId: 'player-b', factionId: FACTION_IDS.RED },
        { playerId: 'player-a', factionId: FACTION_IDS.GREEN },
      ]);
      expect(() => chooseFaction({
        setupState: second,
        playerId: 'player-a',
        factionId: FACTION_IDS.BLUE,
      })).toThrow('Player has already chosen a faction: player-a');
    });

    test('changes phase after the last faction choice', () => {
      const result = createSetupWaitingForTurnOrder();

      expect(result.phase).toBe(SETUP_PHASES.WAITING_FOR_TURN_ORDER);
      expect(result.factionChoices).toHaveLength(3);
      expect(result.turnOrder).toBe(null);
    });

    test('rejects an incorrect phase', () => {
      const setupState = createSetupWaitingForFactionSelectionOrder();

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-a',
        factionId: FACTION_IDS.RED,
      })).toThrow(`Setup phase must be ${SETUP_PHASES.CHOOSING_FACTIONS}.`);
    });

    test('rejects choosing after all factions have been chosen', () => {
      const setupState = createSetupWaitingForTurnOrder();

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-a',
        factionId: FACTION_IDS.YELLOW,
      })).toThrow(`Setup phase must be ${SETUP_PHASES.CHOOSING_FACTIONS}.`);
    });
  });

  describe('setGameSetupTurnOrder', () => {
    test('derives counterclockwise turn order independently from faction selection order', () => {
      const setupState = createSetupWaitingForTurnOrder({ order: ['player-b', 'player-a', 'player-c'] });
      const result = setGameSetupTurnOrder({
        setupState,
        startingFactionId: FACTION_IDS.BLUE,
      });

      expect(result.phase).toBe(SETUP_PHASES.COMPLETED);
      expect(result.factionSelectionOrder).toEqual(['player-b', 'player-a', 'player-c']);
      expect(result.startingFactionId).toBe(FACTION_IDS.BLUE);
      expect(result.turnOrder).toEqual(['player-c', 'player-b', 'player-a']);
    });

    test('skips absent factions while preserving the counterclockwise cycle', () => {
      const setupState = createSetupWaitingForTurnOrder({ order: ['player-b', 'player-a', 'player-c'] });
      const result = setGameSetupTurnOrder({
        setupState,
        startingFactionId: FACTION_IDS.RED,
      });

      expect(result.turnOrder).toEqual(['player-b', 'player-a', 'player-c']);
    });

    test('rejects an absent starting faction', () => {
      const setupState = createSetupWaitingForTurnOrder();

      expect(() => setGameSetupTurnOrder({
        setupState,
        startingFactionId: FACTION_IDS.YELLOW,
      })).toThrow('Starting faction is not participating: yellow');
    });

    test('rejects an incorrect phase', () => {
      const setupState = createSetupChoosingFactions();

      expect(() => setGameSetupTurnOrder({
        setupState,
        startingFactionId: FACTION_IDS.RED,
      })).toThrow(`Setup phase must be ${SETUP_PHASES.WAITING_FOR_TURN_ORDER}.`);
    });

    test('rejects changing turn order after setup is completed', () => {
      const setupState = createCompletedSetup();

      expect(() => setGameSetupTurnOrder({
        setupState,
        startingFactionId: FACTION_IDS.BLUE,
      })).toThrow(`Setup phase must be ${SETUP_PHASES.WAITING_FOR_TURN_ORDER}.`);
    });
  });

  describe('completeGameSetup', () => {
    test('builds a ready GameState using the starting faction draw', () => {
      const setupState = createCompletedSetup({
        selectionOrder: ['player-b', 'player-a', 'player-c'],
        startingFactionId: FACTION_IDS.BLUE,
      });
      const { gameState } = completeGameSetup({ setupState });

      expect(gameState.phase).toBe(GAME_PHASES.READY);
      expect(gameState.winnerPlayerId).toBe(null);
      expect(gameState.startingFactionId).toBe(FACTION_IDS.BLUE);
      expect(gameState.turnOrder).toEqual(['player-c', 'player-b', 'player-a']);
      expect(gameState.currentPlayerId).toBe('player-c');
      expect(gameState.players.map((player) => ({
        id: player.id,
        name: player.name,
        factionId: player.factionId,
      }))).toEqual([
        { id: 'player-a', name: 'Alejandro', factionId: FACTION_IDS.GREEN },
        { id: 'player-b', name: 'Lidia', factionId: FACTION_IDS.RED },
        { id: 'player-c', name: 'Marta', factionId: FACTION_IDS.BLUE },
      ]);
    });

    test.each([2, 3, 4])('creates a GameState compatible with createGameFlow for %i players', (playerCount) => {
      const players = createPlayers(playerCount);
      const selectionOrder = players.map((player) => player.id).reverse();
      const setupState = createCompletedSetup({ players, selectionOrder });
      const { gameState } = completeGameSetup({ setupState });
      const flow = createGameFlow({ gameState });

      expect(gameState.players).toHaveLength(playerCount);
      expect(gameState.turnOrder).toEqual(setupState.turnOrder);
      expect(gameState.currentPlayerId).toBe(setupState.turnOrder[0]);
      expect(flow.gameState.phase).toBe(GAME_PHASES.IN_PROGRESS);
      expect(flow.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ROLL);
      expect(flow.turnState.playerId).toBe(setupState.turnOrder[0]);
    });

    test('creates four home characters for every participating player only', () => {
      const setupState = createCompletedSetup({
        players: createPlayers(2),
        selectionOrder: ['player-b', 'player-a'],
        startingFactionId: FACTION_IDS.GREEN,
      });
      const { gameState } = completeGameSetup({ setupState });

      expect(gameState.players).toHaveLength(2);
      expect(gameState.players.map((player) => player.factionId)).toEqual([
        FACTION_IDS.GREEN,
        FACTION_IDS.RED,
      ]);
      expect(gameState.players.flatMap((player) => player.characters)).toHaveLength(8);
      expect(gameState.players.some((player) => player.factionId === FACTION_IDS.BLUE)).toBe(false);
      expect(gameState.players.some((player) => player.factionId === FACTION_IDS.YELLOW)).toBe(false);

      gameState.players.forEach((player) => {
        expect(player.characters).toHaveLength(4);
        expect(player.characters.every((character) => character.factionId === player.factionId)).toBe(true);
        expect(player.characters.every((character) => character.position.type === POSITION_TYPES.HOME)).toBe(true);
      });
    });

    test('preserves semantic character identity from the selected faction', () => {
      const setupState = createCompletedSetup({
        players: createPlayers(2),
        selectionOrder: ['player-a', 'player-b'],
        startingFactionId: FACTION_IDS.RED,
      });
      const { gameState } = completeGameSetup({ setupState });
      const redPlayer = gameState.players.find((player) => player.factionId === FACTION_IDS.RED);

      expect(redPlayer.characters.map((character) => character.id)).toEqual([
        'red.fireMage',
        'red.warrior',
        'red.blacksmith',
        'red.assassin',
      ]);
      expect(redPlayer.characters.map((character) => character.characterId)).toEqual([
        'fireMage',
        'warrior',
        'blacksmith',
        'assassin',
      ]);
    });

    test('does not call or start Game Flow automatically', () => {
      const setupState = createCompletedSetup();
      const { gameState } = completeGameSetup({ setupState });

      expect(gameState.phase).toBe(GAME_PHASES.READY);
      expect(gameState).not.toHaveProperty('turnState');
    });

    test('rejects completion before setup is completed', () => {
      const setupState = createSetupWaitingForTurnOrder();

      expect(() => completeGameSetup({ setupState })).toThrow(
        `Setup phase must be ${SETUP_PHASES.COMPLETED}.`,
      );
    });

    test('uses the starting faction draw for Game Flow even when it differs from selection order', () => {
      const setupState = createCompletedSetup({
        selectionOrder: ['player-b', 'player-a', 'player-c'],
        startingFactionId: FACTION_IDS.BLUE,
      });
      const { gameState } = completeGameSetup({ setupState });
      const flow = createGameFlow({ gameState });

      expect(gameState.turnOrder).toEqual(['player-c', 'player-b', 'player-a']);
      expect(gameState.currentPlayerId).toBe('player-c');
      expect(flow.turnState.playerId).toBe('player-c');
      expect(flow.turnState.factionId).toBe(FACTION_IDS.BLUE);
    });

    test.each([2, 3, 4])('creates correct character identities for %i players', (playerCount) => {
      const players = createPlayers(playerCount);
      const setupState = createCompletedSetup({ players });
      const { gameState } = completeGameSetup({ setupState });
      const characters = gameState.players.flatMap((player) => player.characters);
      const characterIds = characters.map((character) => character.id);

      expect(new Set(characterIds).size).toBe(characterIds.length);

      gameState.players.forEach((player) => {
        const expectedCharacters = CHARACTERS_BY_FACTION[player.factionId];

        expect(player.characters).toHaveLength(4);
        expect(player.characters.map((character) => character.id)).toEqual(
          expectedCharacters.map((character) => `${player.factionId}.${character.id}`),
        );
        expect(player.characters.map((character) => character.characterId)).toEqual(
          expectedCharacters.map((character) => character.id),
        );
        expect(player.characters.every((character) => character.factionId === player.factionId)).toBe(true);
        expect(player.characters.every((character) => character.position.type === POSITION_TYPES.HOME)).toBe(true);
      });
    });

    test('leaves exactly one faction unused in a three-player game', () => {
      const setupState = createCompletedSetup({ players: createPlayers(3) });
      const { gameState } = completeGameSetup({ setupState });

      expect(gameState.players.map((player) => player.factionId)).toEqual([
        FACTION_IDS.RED,
        FACTION_IDS.GREEN,
        FACTION_IDS.BLUE,
      ]);
      expect(gameState.players.some((player) => player.factionId === FACTION_IDS.YELLOW)).toBe(false);
      expect(gameState.players.flatMap((player) => player.characters)).toHaveLength(12);
    });

    test('preserves starting faction and canonical order through serialization', () => {
      const setupState = createCompletedSetup({
        players: createPlayers(4),
        startingFactionId: FACTION_IDS.YELLOW,
      });
      const restoredGameState = JSON.parse(JSON.stringify(
        completeGameSetup({ setupState }).gameState,
      ));
      const flow = createGameFlow({ gameState: restoredGameState });

      expect(restoredGameState.startingFactionId).toBe(FACTION_IDS.YELLOW);
      expect(restoredGameState.turnOrder).toEqual([
        'player-d',
        'player-c',
        'player-a',
        'player-b',
      ]);
      expect(flow.turnState.playerId).toBe('player-d');
    });

    test('advances definitive turns through the canonical cycle and wraps', () => {
      const setupState = createCompletedSetup({
        players: createPlayers(4),
        startingFactionId: FACTION_IDS.YELLOW,
      });
      let flow = createGameFlow({
        gameState: disableInitialExits(completeGameSetup({ setupState }).gameState),
      });
      const visitedPlayerIds = [];

      for (let index = 0; index < 5; index += 1) {
        visitedPlayerIds.push(flow.gameState.currentPlayerId);
        flow = registerGameRoll({ gameFlow: flow, roll: 1 });
      }

      expect(visitedPlayerIds).toEqual([
        'player-d',
        'player-c',
        'player-a',
        'player-b',
        'player-d',
      ]);
    });

    test('keeps the starting faction on 6 and advances canonically after the third 6', () => {
      const setupState = createCompletedSetup({
        players: createPlayers(4),
        startingFactionId: FACTION_IDS.YELLOW,
      });
      const initialFlow = createGameFlow({
        gameState: disableInitialExits(completeGameSetup({ setupState }).gameState),
      });
      const afterFirstSix = registerGameRoll({ gameFlow: initialFlow, roll: 6 });
      const afterSecondSix = registerGameRoll({ gameFlow: afterFirstSix, roll: 6 });
      const afterThirdSix = registerGameRoll({ gameFlow: afterSecondSix, roll: 6 });

      expect(afterFirstSix.gameState.currentPlayerId).toBe('player-d');
      expect(afterSecondSix.gameState.currentPlayerId).toBe('player-d');
      expect(afterThirdSix.gameState.currentPlayerId).toBe('player-c');
    });

    test('decrements Bleeding once when its faction leaves the turn', () => {
      const setupState = createCompletedSetup({
        players: createPlayers(4),
        startingFactionId: FACTION_IDS.RED,
      });
      const gameState = applyBleedingStatus({
        state: disableInitialExits(completeGameSetup({ setupState }).gameState),
        sourceCharacterId: 'blue.hunter',
        sourceFactionId: FACTION_IDS.BLUE,
        targetCharacterId: 'red.warrior',
      });
      const result = registerGameRoll({
        gameFlow: createGameFlow({ gameState }),
        roll: 1,
      });

      expect(result.gameState.currentPlayerId).toBe('player-b');
      expect(getBleedingStatus({
        state: result.gameState,
        characterId: 'red.warrior',
      }).data.remainingTurns).toBe(2);
    });
  });

  describe('immutability and isolation', () => {
    test('setFactionSelectionOrder does not mutate previous setup state or input order', () => {
      const playerOrder = ['player-b', 'player-a', 'player-c'];
      const setup1 = createSetupWaitingForFactionSelectionOrder();
      const setup2 = setFactionSelectionOrder({ setupState: setup1, playerOrder });

      playerOrder[0] = 'changed-input';
      setup2.factionSelectionOrder[1] = 'changed-state';
      setup2.players[0].name = 'Changed';

      expect(setup1).toEqual(createSetupWaitingForFactionSelectionOrder());
      expect(playerOrder).toEqual(['changed-input', 'player-a', 'player-c']);
    });

    test('chooseFaction does not mutate previous faction choices', () => {
      const setup1 = createSetupChoosingFactions();
      const setup2 = chooseFaction({ setupState: setup1, playerId: 'player-a', factionId: FACTION_IDS.RED });
      const setup3 = chooseFaction({ setupState: setup2, playerId: 'player-b', factionId: FACTION_IDS.GREEN });

      setup2.factionChoices[0].factionId = FACTION_IDS.YELLOW;
      setup3.factionChoices[0].playerId = 'changed-player';

      expect(setup1.factionChoices).toEqual([]);
      expect(setup2.factionChoices).toEqual([
        { playerId: 'player-a', factionId: FACTION_IDS.YELLOW },
      ]);
      expect(setup3.factionChoices).toEqual([
        { playerId: 'changed-player', factionId: FACTION_IDS.RED },
        { playerId: 'player-b', factionId: FACTION_IDS.GREEN },
      ]);
    });

    test('setGameSetupTurnOrder does not mutate previous setup state', () => {
      const setup1 = createSetupWaitingForTurnOrder();
      const setup2 = setGameSetupTurnOrder({
        setupState: setup1,
        startingFactionId: FACTION_IDS.BLUE,
      });

      setup2.turnOrder[0] = 'changed-state';
      setup2.factionChoices[0].factionId = FACTION_IDS.YELLOW;

      expect(setup1.turnOrder).toBe(null);
      expect(setup1.startingFactionId).toBe(null);
      expect(setup1.factionChoices[0].factionId).toBe(FACTION_IDS.RED);
    });

    test('completeGameSetup returns independent GameState instances', () => {
      const setupState = createCompletedSetup();
      const first = completeGameSetup({ setupState }).gameState;
      const second = completeGameSetup({ setupState }).gameState;

      first.players[0].name = 'Changed';
      first.players[0].characters[0].position.type = POSITION_TYPES.GOAL;
      first.turnOrder[0] = 'changed-player';

      expect(second.players[0].name).toBe('Alejandro');
      expect(second.players[0].characters[0].position.type).toBe(POSITION_TYPES.HOME);
      expect(second.turnOrder[0]).toBe('player-a');
      expect(setupState.players[0].name).toBe('Alejandro');
    });

    test('mutating setup players does not contaminate original input players', () => {
      const players = createPlayers(2);
      const setupState = createGameSetup({ players });

      setupState.players[0].name = 'Changed';
      players[0].name = 'Changed input';

      expect(setupState.players[1]).toEqual({ id: 'player-b', name: 'Lidia' });
      expect(players[1]).toEqual({ id: 'player-b', name: 'Lidia' });
      expect(createGameSetup({ players: createPlayers(2) }).players[0]).toEqual(PLAYER_A);
    });
  });

  describe('state consistency errors', () => {
    test('rejects invalid setup phases', () => {
      const setupState = {
        ...createSetupWaitingForFactionSelectionOrder(),
        phase: 'unknown',
      };

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-b', 'player-c'],
      })).toThrow('Invalid setup phase: unknown');
    });

    test('rejects setupState with non-array players', () => {
      const setupState = {
        ...createSetupWaitingForFactionSelectionOrder(),
        players: null,
      };

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-b', 'player-c'],
      })).toThrow('Game setup requires 2, 3, or 4 players.');
    });

    test.each([
      [1, createPlayers(1)],
      [5, [...createPlayers(4), { id: 'player-e', name: 'Sara' }]],
    ])('rejects setupState with invalid player count: %i', (playerCount, players) => {
      const setupState = {
        ...createSetupWaitingForFactionSelectionOrder(),
        players,
      };

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: setupState.players.map((player) => player.id),
      })).toThrow('Game setup requires 2, 3, or 4 players.');
    });

    test('rejects setupState with duplicate player ids', () => {
      const setupState = {
        ...createSetupWaitingForFactionSelectionOrder(),
        players: [PLAYER_A, { ...PLAYER_B, id: PLAYER_A.id }, PLAYER_C],
      };

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-b', 'player-c'],
      })).toThrow('Duplicate setup player id: player-a');
    });

    test('rejects factionSelectionOrder while waiting for faction selection order', () => {
      const setupState = {
        ...createSetupWaitingForFactionSelectionOrder(),
        factionSelectionOrder: ['player-a', 'player-b', 'player-c'],
      };

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-b', 'player-c'],
      })).toThrow('factionSelectionOrder must be null while waiting for faction selection order.');
    });

    test('rejects corrupt factionSelectionOrder once faction choosing has started', () => {
      const setupState = {
        ...createSetupChoosingFactions(),
        factionSelectionOrder: ['player-a', 'player-b'],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-a',
        factionId: FACTION_IDS.RED,
      })).toThrow('factionSelectionOrder must contain exactly the setup players.');
    });

    test('rejects factionChoices with unknown players', () => {
      const setupState = {
        ...createSetupChoosingFactions(),
        factionChoices: [{ playerId: 'player-x', factionId: FACTION_IDS.RED }],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-b',
        factionId: FACTION_IDS.GREEN,
      })).toThrow('Faction choice contains an unknown player: player-x');
    });

    test('rejects factionChoices with duplicate players', () => {
      const setupState = {
        ...createSetupChoosingFactions(),
        factionChoices: [
          { playerId: 'player-a', factionId: FACTION_IDS.RED },
          { playerId: 'player-a', factionId: FACTION_IDS.GREEN },
        ],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-b',
        factionId: FACTION_IDS.BLUE,
      })).toThrow('Player has already chosen a faction: player-a');
    });

    test('rejects factionChoices with invalid factions', () => {
      const setupState = {
        ...createSetupChoosingFactions(),
        factionChoices: [{ playerId: 'player-a', factionId: 'purple' }],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-b',
        factionId: FACTION_IDS.GREEN,
      })).toThrow('Invalid faction id: purple');
    });

    test('rejects factionChoices with duplicate factions', () => {
      const setupState = {
        ...createSetupChoosingFactions(),
        factionChoices: [
          { playerId: 'player-a', factionId: FACTION_IDS.RED },
          { playerId: 'player-b', factionId: FACTION_IDS.RED },
        ],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-c',
        factionId: FACTION_IDS.GREEN,
      })).toThrow('Faction has already been chosen: red');
    });

    test('rejects more factionChoices than setup players', () => {
      const setupState = {
        ...createSetupChoosingFactions({ players: createPlayers(2) }),
        factionChoices: [
          { playerId: 'player-a', factionId: FACTION_IDS.RED },
          { playerId: 'player-b', factionId: FACTION_IDS.GREEN },
          { playerId: 'player-a', factionId: FACTION_IDS.BLUE },
        ],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-b',
        factionId: FACTION_IDS.YELLOW,
      })).toThrow('setupState.factionChoices cannot contain more choices than setup players.');
    });

    test('rejects complete factionChoices while still choosing factions', () => {
      const setupState = {
        ...createSetupChoosingFactions(),
        factionChoices: [
          { playerId: 'player-a', factionId: FACTION_IDS.RED },
          { playerId: 'player-b', factionId: FACTION_IDS.GREEN },
          { playerId: 'player-c', factionId: FACTION_IDS.BLUE },
        ],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-c',
        factionId: FACTION_IDS.YELLOW,
      })).toThrow('factionChoices must be incomplete while choosing factions.');
    });

    test('rejects incomplete factionChoices while waiting for turn order', () => {
      const setupState = {
        ...createSetupWaitingForTurnOrder(),
        factionChoices: [{ playerId: 'player-a', factionId: FACTION_IDS.RED }],
      };

      expect(() => setGameSetupTurnOrder({
        setupState,
        startingFactionId: FACTION_IDS.RED,
      })).toThrow('factionChoices must contain exactly one choice per setup player.');
    });

    test('rejects a corrupt setup state with premature turnOrder', () => {
      const setupState = {
        ...createSetupChoosingFactions(),
        turnOrder: ['player-a', 'player-b', 'player-c'],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-a',
        factionId: FACTION_IDS.RED,
      })).toThrow('turnOrder must be null while choosing factions.');
    });

    test('rejects turnOrder while waiting for faction selection order', () => {
      const setupState = {
        ...createSetupWaitingForFactionSelectionOrder(),
        turnOrder: ['player-a', 'player-b', 'player-c'],
      };

      expect(() => setFactionSelectionOrder({
        setupState,
        playerOrder: ['player-a', 'player-b', 'player-c'],
      })).toThrow('turnOrder must be null while waiting for faction selection order.');
    });

    test('rejects completed setup without valid turnOrder', () => {
      const setupState = {
        ...createCompletedSetup(),
        turnOrder: null,
      };

      expect(() => completeGameSetup({ setupState })).toThrow('turnOrder must be an array.');
    });

    test('rejects corrupt faction choices that do not follow selection order', () => {
      const setupState = {
        ...createSetupChoosingFactions({ order: ['player-b', 'player-a', 'player-c'] }),
        factionChoices: [{ playerId: 'player-a', factionId: FACTION_IDS.RED }],
      };

      expect(() => chooseFaction({
        setupState,
        playerId: 'player-b',
        factionId: FACTION_IDS.GREEN,
      })).toThrow('Faction choice is out of selection order for player: player-a');
    });
  });

  describe('public API exports', () => {
    test('does not export setup validators from the engine barrel', () => {
      expect(Engine.SETUP_PHASES).toBe(SETUP_PHASES);
      expect(Engine.createGameSetup).toBe(createGameSetup);
      expect(Engine.setFactionSelectionOrder).toBe(setFactionSelectionOrder);
      expect(Engine.chooseFaction).toBe(chooseFaction);
      expect(Engine.setGameSetupTurnOrder).toBe(setGameSetupTurnOrder);
      expect(Engine.completeGameSetup).toBe(completeGameSetup);
      expect(Engine.assertSetupState).toBeUndefined();
      expect(Engine.assertSetupPhase).toBeUndefined();
      expect(Engine.assertValidSetupPlayers).toBeUndefined();
    });
  });
});
