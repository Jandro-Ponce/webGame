import {
  EXECUTABLE_ACTION_TYPES,
  EXECUTION_EVENT_TYPES,
  FACTION_IDS,
  GAME_PHASES,
  INITIAL_EXIT_STAGES,
  LEGAL_MOVEMENT_FAILURE_REASONS,
  MOVEMENT_SOURCE_TYPES,
  MOVEMENT_TYPES,
  POSITION_TYPES,
  REWARD_SOURCE_TYPES,
  REWARD_TYPES,
  START_SQUARE_BY_FACTION,
  TERRAIN_EFFECT_TYPES,
  TURN_END_REASONS,
  TURN_PHASES,
  applyFrozenStatus,
  createCommonPosition,
  createDruidVinesEffect,
  createGoalPosition,
  createHomePosition,
  createIceEffect,
  createInitialGameState,
  createTrapEffect,
  createTurnState,
  deriveRewardsFromEvents,
  evaluateMovement,
  executeAction,
  executeTurnAction,
  getAvailableInitialExitActions,
  getBarrierAtPosition,
  getCharactersFromState,
  getPlayablePositionKey,
  isCharacterBleeding,
  isCharacterFrozen,
  registerTurnRoll,
} from '../../index';
import { revalidateAction } from '../../actions/revalidateAction';

const ALL_FACTIONS = [
  FACTION_IDS.RED,
  FACTION_IDS.GREEN,
  FACTION_IDS.BLUE,
  FACTION_IDS.YELLOW,
];

function createState() {
  const players = ALL_FACTIONS.map((factionId) => ({
    id: `player-${factionId}`,
    factionId,
  }));
  const state = createInitialGameState({
    players,
    turnOrder: players.map((player) => player.id),
  });

  return { ...state, phase: GAME_PHASES.IN_PROGRESS };
}

function setPositions(state, positionByCharacterId) {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      characters: player.characters.map((character) => (
        Object.prototype.hasOwnProperty.call(positionByCharacterId, character.id)
          ? { ...character, position: positionByCharacterId[character.id] }
          : character
      )),
    })),
  };
}

function setInitialExitAvailable(state, factionId, initialExitAvailable) {
  return {
    ...state,
    factionStatesById: {
      ...state.factionStatesById,
      [factionId]: {
        ...state.factionStatesById[factionId],
        initialExitAvailable,
      },
    },
  };
}

function getCharacter(state, characterId) {
  return getCharactersFromState(state).find((character) => character.id === characterId);
}

function getInitialActions(state, factionId, roll) {
  return getAvailableInitialExitActions({
    state,
    factionId,
    roll,
    characters: getCharactersFromState(state),
  });
}

function getCharacterAction(state, factionId, roll, characterId) {
  return getInitialActions(state, factionId, roll).find(
    (action) => action.characterId === characterId,
  );
}

function executeInitialExit({ state, factionId, roll, characterId, choice }) {
  const action = getCharacterAction(state, factionId, roll, characterId);

  return executeAction({ state, factionId, roll, action, choice });
}

function addTerrainEffect(state, effect) {
  const positionKey = getPlayablePositionKey(effect.data.position);

  return {
    ...state,
    terrainEffectsByPositionKey: {
      ...state.terrainEffectsByPositionKey,
      [positionKey]: [...(state.terrainEffectsByPositionKey[positionKey] || []), effect],
    },
  };
}

function createRedTurn(overrides = {}) {
  return {
    ...createTurnState({ playerId: 'player-red', factionId: FACTION_IDS.RED }),
    ...overrides,
  };
}

describe('initial faction exit', () => {
  describe('per-faction state', () => {
    test.each(ALL_FACTIONS)('%s starts with an independently serializable available exit', (factionId) => {
      const state = createState();

      expect(state.factionStatesById[factionId]).toEqual({
        initialExitAvailable: true,
        pendingInitialExit: null,
      });
      expect(JSON.parse(JSON.stringify(state.factionStatesById[factionId]))).toEqual(
        state.factionStatesById[factionId],
      );
    });

    test('consuming one faction exit leaves every other faction available', () => {
      const state = createState();
      const result = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 1,
        characterId: 'red.fireMage',
      });

      expect(result.state.factionStatesById).toEqual({
        [FACTION_IDS.RED]: { initialExitAvailable: false, pendingInitialExit: null },
        [FACTION_IDS.GREEN]: { initialExitAvailable: true, pendingInitialExit: null },
        [FACTION_IDS.BLUE]: { initialExitAvailable: true, pendingInitialExit: null },
        [FACTION_IDS.YELLOW]: { initialExitAvailable: true, pendingInitialExit: null },
      });
    });

    test('keeps the faction state serializable after consumption', () => {
      const result = executeInitialExit({
        state: createState(),
        factionId: FACTION_IDS.GREEN,
        roll: 2,
        characterId: 'green.archer',
      });

      expect(JSON.parse(JSON.stringify(result.state.factionStatesById))).toEqual(
        result.state.factionStatesById,
      );
      expect(result.state.factionStatesById.green.initialExitAvailable).toBe(false);
    });
  });

  describe('rolls other than five', () => {
    test.each([
      [1, 6],
      [2, 7],
      [3, 8],
      [4, 9],
      [6, 11],
    ])('red roll %i exits through START and ends on common %i', (roll, square) => {
      const state = createState();
      const action = getCharacterAction(state, FACTION_IDS.RED, roll, 'red.fireMage');
      const result = executeAction({ state, factionId: FACTION_IDS.RED, roll, action });

      expect(action.destination).toEqual(createCommonPosition(5));
      expect(action.movement.path).toEqual(
        Array.from({ length: roll }, (_, index) => createCommonPosition(6 + index)),
      );
      expect(getCharacter(result.state, 'red.fireMage').position).toEqual(
        createCommonPosition(square),
      );
      expect(result.state.factionStatesById.red.initialExitAvailable).toBe(false);
    });

    test('uses START as the logical movement origin for red 5 plus roll 4', () => {
      const state = createState();
      const result = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        characterId: 'red.warrior',
      });

      expect(result.events).toEqual([
        {
          type: EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
          characterId: 'red.warrior',
          from: createHomePosition(),
          to: createCommonPosition(5),
        },
        {
          type: EXECUTION_EVENT_TYPES.CHARACTER_MOVED,
          characterId: 'red.warrior',
          factionId: FACTION_IDS.RED,
          from: createCommonPosition(5),
          to: createCommonPosition(9),
          previousPosition: createCommonPosition(8),
          steps: 4,
          actionType: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
          movementType: MOVEMENT_TYPES.NORMAL,
          source: { type: MOVEMENT_SOURCE_TYPES.DICE, roll: 4 },
        },
      ]);
    });

    test('offers every own HOME character as a selectable exit', () => {
      const actions = getInitialActions(createState(), FACTION_IDS.RED, 3);

      expect(actions.map((action) => action.characterId)).toEqual([
        'red.fireMage',
        'red.warrior',
        'red.blacksmith',
        'red.assassin',
      ]);
      expect(actions.every((action) => action.characterIds === undefined)).toBe(true);
    });

    test('does not displace or capture occupants of logical START', () => {
      const start = createCommonPosition(START_SQUARE_BY_FACTION.red);
      const state = setPositions(createState(), {
        'blue.hunter': start,
        'green.archer': start,
      });
      const result = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 2,
        characterId: 'red.blacksmith',
      });

      expect(getCharacter(result.state, 'red.blacksmith').position).toEqual(createCommonPosition(7));
      expect(getCharacter(result.state, 'blue.hunter').position).toEqual(start);
      expect(getCharacter(result.state, 'green.archer').position).toEqual(start);
      expect(result.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
      }));
      expect(result.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_REMOVED_FROM_START,
      }));
    });

    test('availability calculation does not consume the exit', () => {
      const state = createState();
      const before = JSON.parse(JSON.stringify(state));
      const actions = getInitialActions(state, FACTION_IDS.RED, 4);

      expect(actions).toHaveLength(4);
      expect(state).toEqual(before);
      expect(state.factionStatesById.red.initialExitAvailable).toBe(true);
    });

    test('authoritative revalidation does not consume the exit', () => {
      const state = createState();
      const characters = getCharactersFromState(state);
      const action = getCharacterAction(state, FACTION_IDS.RED, 4, 'red.warrior');
      const revalidated = revalidateAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action,
        characters,
      });

      expect(revalidated.action.id).toBe(action.id);
      expect(revalidated.movement.destination).toEqual(createCommonPosition(9));
      expect(state.factionStatesById.red.initialExitAvailable).toBe(true);
    });

    test('only successful execution consumes the exit', () => {
      const state = createState();
      const action = getCharacterAction(state, FACTION_IDS.RED, 3, 'red.assassin');
      const result = executeAction({ state, factionId: FACTION_IDS.RED, roll: 3, action });

      expect(state.factionStatesById.red.initialExitAvailable).toBe(true);
      expect(result.state.factionStatesById.red.initialExitAvailable).toBe(false);
      expect(getCharacter(result.state, 'red.assassin').position).toEqual(createCommonPosition(8));
    });

    test('a stale action that became illegal does not consume the exit', () => {
      const state = createState();
      const action = getCharacterAction(state, FACTION_IDS.RED, 4, 'red.fireMage');
      const changedState = setPositions(state, {
        'blue.hunter': createCommonPosition(7),
        'blue.alchemist': createCommonPosition(7),
      });

      expect(() => executeAction({
        state: changedState,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action,
      })).toThrow('Action is not available for the current state.');
      expect(changedState.factionStatesById.red.initialExitAvailable).toBe(true);
      expect(getCharacter(changedState, 'red.fireMage').position).toEqual(createHomePosition());
    });
  });

  describe('special roll five', () => {
    test('offers one individual first-selection action per HOME character', () => {
      const actions = getInitialActions(createState(), FACTION_IDS.RED, 5);

      expect(actions.map((action) => ({
        id: action.id,
        characterId: action.characterId,
        stage: action.initialExitStage,
      }))).toEqual([
        { id: 'initialExit:5:first:red.fireMage', characterId: 'red.fireMage', stage: INITIAL_EXIT_STAGES.FIRST },
        { id: 'initialExit:5:first:red.warrior', characterId: 'red.warrior', stage: INITIAL_EXIT_STAGES.FIRST },
        { id: 'initialExit:5:first:red.blacksmith', characterId: 'red.blacksmith', stage: INITIAL_EXIT_STAGES.FIRST },
        { id: 'initialExit:5:first:red.assassin', characterId: 'red.assassin', stage: INITIAL_EXIT_STAGES.FIRST },
      ]);
      expect(actions.every((action) => action.characterIds === undefined)).toBe(true);
    });

    test('the first selection exits immediately and keeps the advantage pending', () => {
      const state = createState();
      const action = getCharacterAction(state, FACTION_IDS.RED, 5, 'red.fireMage');
      const result = executeAction({ state, factionId: FACTION_IDS.RED, roll: 5, action });

      expect(getCharacter(result.state, 'red.fireMage').position).toEqual(createCommonPosition(5));
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createHomePosition());
      expect(getCharacter(result.state, 'red.blacksmith').position).toEqual(createHomePosition());
      expect(result.state.factionStatesById.red).toEqual({
        initialExitAvailable: true,
        pendingInitialExit: { roll: 5, firstCharacterId: 'red.fireMage' },
      });
      expect(result.requiresInitialExitCompletion).toBe(true);
    });

    test('the partial resolution is serializable', () => {
      const state = createState();
      const first = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 5,
        characterId: 'red.warrior',
      });

      expect(JSON.parse(JSON.stringify(first.state))).toEqual(first.state);
      expect(first.state.factionStatesById.red.pendingInitialExit).toEqual({
        roll: 5,
        firstCharacterId: 'red.warrior',
      });
    });

    test('after the first selection only the other HOME characters remain selectable', () => {
      const first = executeInitialExit({
        state: createState(),
        factionId: FACTION_IDS.GREEN,
        roll: 5,
        characterId: 'green.druid',
      });
      const actions = getInitialActions(first.state, FACTION_IDS.GREEN, 5);

      expect(actions.map((action) => action.characterId)).toEqual([
        'green.archer',
        'green.ranger',
        'green.fairy',
      ]);
      expect(actions.every(
        (action) => action.initialExitStage === INITIAL_EXIT_STAGES.SECOND,
      )).toBe(true);
      expect(actions.some((action) => action.characterId === 'green.druid')).toBe(false);
      expect(actions.some((action) => action.type === 'cancel')).toBe(false);
    });

    test('the second selection exits beside the first and completes a barrier', () => {
      const first = executeInitialExit({
        state: createState(),
        factionId: FACTION_IDS.GREEN,
        roll: 5,
        characterId: 'green.druid',
      });
      const second = executeInitialExit({
        state: first.state,
        factionId: FACTION_IDS.GREEN,
        roll: 5,
        characterId: 'green.ranger',
      });
      const startOccupants = getCharactersFromState(second.state).filter(
        (character) => character.position.type === POSITION_TYPES.COMMON && character.position.square === 22,
      );

      expect(startOccupants.map((character) => character.id)).toEqual(['green.druid', 'green.ranger']);
      const barrier = getBarrierAtPosition({
        position: createCommonPosition(22),
        characters: getCharactersFromState(second.state),
      });
      expect(barrier).toMatchObject({ exists: true, factionId: FACTION_IDS.GREEN });
      expect(second.state.factionStatesById.green).toEqual({
        initialExitAvailable: false,
        pendingInitialExit: null,
      });
    });

    test('neither sequential selection adds five movement steps', () => {
      const state = createState();
      const firstAction = getCharacterAction(state, FACTION_IDS.BLUE, 5, 'blue.hunter');
      const first = executeAction({ state, factionId: FACTION_IDS.BLUE, roll: 5, action: firstAction });
      const secondAction = getCharacterAction(first.state, FACTION_IDS.BLUE, 5, 'blue.rogue');
      const second = executeAction({
        state: first.state,
        factionId: FACTION_IDS.BLUE,
        roll: 5,
        action: secondAction,
      });

      expect(firstAction.movement).toBeUndefined();
      expect(secondAction.movement).toBeUndefined();
      expect(first.events).toEqual([expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
        characterId: 'blue.hunter',
      })]);
      expect(second.events).toEqual([expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
        characterId: 'blue.rogue',
      })]);
    });

    test('a forged or stale second selection is rejected without changing pending state', () => {
      const first = executeInitialExit({
        state: createState(),
        factionId: FACTION_IDS.RED,
        roll: 5,
        characterId: 'red.warrior',
      });
      const snapshot = JSON.parse(JSON.stringify(first.state));

      expect(() => executeAction({
        state: first.state,
        factionId: FACTION_IDS.RED,
        roll: 5,
        action: {
          id: 'initialExit:5:second:red.warrior',
          type: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
          characterId: 'red.warrior',
        },
      })).toThrow('Action is not available for the current state.');
      expect(first.state).toEqual(snapshot);
      expect(first.state.factionStatesById.red).toEqual({
        initialExitAvailable: true,
        pendingInitialExit: { roll: 5, firstCharacterId: 'red.warrior' },
      });

      const staleAction = getCharacterAction(first.state, FACTION_IDS.RED, 5, 'red.assassin');
      const changedState = setPositions(first.state, { 'red.assassin': createCommonPosition(20) });
      expect(() => executeAction({
        state: changedState,
        factionId: FACTION_IDS.RED,
        roll: 5,
        action: staleAction,
      })).toThrow('Action is not available for the current state.');
      expect(changedState.factionStatesById.red.pendingInitialExit).toEqual({
        roll: 5,
        firstCharacterId: 'red.warrior',
      });
    });

    test('turn flow remains waiting for the authoritative second click', () => {
      const state = createState();
      const rolled = registerTurnRoll({ state, turnState: createRedTurn(), roll: 5 });
      const firstAction = rolled.turnState.availableActions.find(
        (action) => action.characterId === 'red.fireMage',
      );
      const first = executeTurnAction({ state, turnState: rolled.turnState, action: firstAction });

      expect(first.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ACTION);
      expect(first.turnState.currentRoll).toBe(5);
      expect(first.turnState.availableActions.map((action) => action.characterId)).toEqual([
        'red.warrior',
        'red.blacksmith',
        'red.assassin',
      ]);
      expect(first.turnState.diceMoveHistory).toEqual([{
        characterId: 'red.fireMage',
        actionType: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
        roll: 5,
      }]);

      const secondAction = first.turnState.availableActions.find(
        (action) => action.characterId === 'red.assassin',
      );
      const second = executeTurnAction({
        state: first.state,
        turnState: first.turnState,
        action: secondAction,
      });
      expect(second.turnState.phase).toBe(TURN_PHASES.ENDED);
      expect(second.turnState.diceMoveHistory.map((entry) => entry.characterId)).toEqual([
        'red.fireMage',
        'red.assassin',
      ]);
    });

    test('offers the only remaining HOME character as a single selection', () => {
      const state = setPositions(createState(), {
        'red.fireMage': createCommonPosition(10),
        'red.blacksmith': createCommonPosition(20),
        'red.assassin': createGoalPosition(),
      });
      const actions = getInitialActions(state, FACTION_IDS.RED, 5);

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        id: 'initialExit:5:single:red.warrior',
        characterId: 'red.warrior',
        initialExitStage: INITIAL_EXIT_STAGES.SINGLE,
        destination: createCommonPosition(5),
        occupantRemoval: { required: false, removeAll: false },
      });

      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 5,
        action: actions[0],
      });
      expect(result.state.factionStatesById.red).toEqual({
        initialExitAvailable: false,
        pendingInitialExit: null,
      });
      expect(result.requiresInitialExitCompletion).toBeUndefined();
    });

    test('with one HOME character and two START occupants removes only the chosen occupant', () => {
      const start = createCommonPosition(5);
      const state = setPositions(createState(), {
        'red.fireMage': createCommonPosition(10),
        'red.blacksmith': createCommonPosition(20),
        'red.assassin': createGoalPosition(),
        'blue.hunter': start,
        'green.archer': start,
      });
      const action = getCharacterAction(state, FACTION_IDS.RED, 5, 'red.warrior');
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 5,
        action,
        choice: { removeCharacterId: 'green.archer' },
      });

      expect(action.occupantRemoval).toMatchObject({
        required: true,
        removableCharacterIds: expect.arrayContaining(['blue.hunter', 'green.archer']),
        removeAll: false,
      });
      expect(action.occupantRemoval.removableCharacterIds).toHaveLength(2);
      expect(getCharacter(result.state, 'green.archer').position).toEqual(createHomePosition());
      expect(getCharacter(result.state, 'blue.hunter').position).toEqual(start);
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(start);
    });

    test('the first selection removes the single previous START occupant', () => {
      const start = createCommonPosition(5);
      const state = setPositions(createState(), { 'blue.hunter': start });
      const action = getInitialActions(state, FACTION_IDS.RED, 5)[0];
      const result = executeAction({ state, factionId: FACTION_IDS.RED, roll: 5, action });

      expect(action.occupantRemoval).toEqual({
        required: true,
        removableCharacterIds: ['blue.hunter'],
        removeAll: true,
        isCapture: false,
        grantsCaptureReward: false,
      });
      expect(getCharacter(result.state, 'blue.hunter').position).toEqual(createHomePosition());
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_REMOVED_FROM_START,
        characterId: 'blue.hunter',
      }));
      expect(getCharacter(result.state, action.characterId).position).toEqual(start);
      expect(result.state.factionStatesById.red.pendingInitialExit).toEqual({
        roll: 5,
        firstCharacterId: action.characterId,
      });
    });

    test('previous START occupants leave on the first click and the first new character remains on the second', () => {
      const start = createCommonPosition(5);
      const state = setPositions(createState(), {
        'blue.hunter': start,
        'green.archer': start,
      });
      const first = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 5,
        characterId: 'red.blacksmith',
      });

      expect(getCharacter(first.state, 'blue.hunter').position).toEqual(createHomePosition());
      expect(getCharacter(first.state, 'green.archer').position).toEqual(createHomePosition());
      expect(getCharacter(first.state, 'red.blacksmith').position).toEqual(start);
      expect(first.events.filter(
        (event) => event.type === EXECUTION_EVENT_TYPES.CHARACTER_REMOVED_FROM_START,
      )).toHaveLength(2);
      expect(first.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
      }));
      expect(deriveRewardsFromEvents({ events: first.events })).toEqual([]);

      const second = executeInitialExit({
        state: first.state,
        factionId: FACTION_IDS.RED,
        roll: 5,
        characterId: 'red.assassin',
      });
      expect(getCharacter(second.state, 'red.blacksmith').position).toEqual(start);
      expect(getCharacter(second.state, 'red.assassin').position).toEqual(start);
      expect(second.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_REMOVED_FROM_START,
      }));
    });
  });

  describe('after the initial exit is consumed', () => {
    test.each([1, 2, 3, 4, 6])('roll %i no longer offers a HOME exit', (roll) => {
      const state = setInitialExitAvailable(createState(), FACTION_IDS.RED, false);

      expect(getInitialActions(state, FACTION_IDS.RED, roll)).toEqual([]);
    });

    test('roll five falls back to one-character mandatory normal exit', () => {
      const state = setInitialExitAvailable(createState(), FACTION_IDS.RED, false);
      const rolled = registerTurnRoll({ state, turnState: createRedTurn(), roll: 5 });

      expect(rolled.turnState.availableActions.map((action) => action.characterId)).toEqual([
        'red.fireMage',
        'red.warrior',
        'red.blacksmith',
        'red.assassin',
      ]);
      expect(rolled.turnState.availableActions.every(
        (action) => action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME && !action.initialExit,
      )).toBe(true);

      const result = executeTurnAction({
        state,
        turnState: rolled.turnState,
        action: rolled.turnState.availableActions[1],
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(5));
      expect(getCharacter(result.state, 'red.fireMage').position).toEqual(createHomePosition());
      expect(result.state.factionStatesById.red.initialExitAvailable).toBe(false);
    });

    test('capturing the character that used the initial exit does not restore it', () => {
      const exited = executeInitialExit({
        state: createState(),
        factionId: FACTION_IDS.RED,
        roll: 4,
        characterId: 'red.warrior',
      });
      let captureState = setInitialExitAvailable(
        exited.state,
        FACTION_IDS.BLUE,
        false,
      );
      captureState = setPositions(captureState, {
        'blue.hunter': createCommonPosition(5),
      });
      const captured = executeAction({
        state: captureState,
        factionId: FACTION_IDS.BLUE,
        roll: 4,
        action: {
          type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT,
          characterId: 'blue.hunter',
        },
      });

      expect(getCharacter(captured.state, 'red.warrior').position).toEqual(createHomePosition());
      expect(captured.state.factionStatesById.red.initialExitAvailable).toBe(false);
      expect(getInitialActions(captured.state, FACTION_IDS.RED, 3)).toEqual([]);
    });
  });

  describe('roll six turn integration', () => {
    test('preserves the original frozen six for repeat, count, history, and events', () => {
      let state = applyFrozenStatus({
        state: createState(),
        sourceCharacterId: 'green.druid',
        sourceFactionId: FACTION_IDS.GREEN,
        targetCharacterId: 'blue.rogue',
      });
      const turn = createTurnState({ playerId: 'player-blue', factionId: FACTION_IDS.BLUE });
      const rolled = registerTurnRoll({ state, turnState: turn, roll: 6 });
      const action = rolled.turnState.availableActions.find(
        (candidate) => candidate.characterId === 'blue.rogue',
      );
      const result = executeTurnAction({ state, turnState: rolled.turnState, action });

      expect(action.movement.destination).toEqual(createCommonPosition(59));
      expect(result.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ROLL);
      expect(result.turnState.consecutiveSixes).toBe(1);
      expect(result.turnState.diceMoveHistory).toEqual([{
        characterId: 'blue.rogue',
        actionType: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
        roll: 6,
      }]);
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_MOVED,
        characterId: 'blue.rogue',
        steps: 6,
        source: { type: MOVEMENT_SOURCE_TYPES.DICE, roll: 6 },
        to: createCommonPosition(59),
      }));
      expect(isCharacterFrozen({ state: result.state, characterId: 'blue.rogue' })).toBe(false);
    });

    test('an initial exit on the second six preserves the consecutive count', () => {
      const state = createState();
      const turn = createRedTurn({ consecutiveSixes: 1 });
      const rolled = registerTurnRoll({ state, turnState: turn, roll: 6 });
      const action = rolled.turnState.availableActions.find(
        (candidate) => candidate.characterId === 'red.warrior',
      );
      const result = executeTurnAction({ state, turnState: rolled.turnState, action });

      expect(result.turnState.consecutiveSixes).toBe(2);
      expect(result.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_ROLL);
      expect(result.turnState.diceMoveHistory[0]).toEqual({
        characterId: 'red.warrior',
        actionType: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
        roll: 6,
      });
    });

    test('the third-six penalty runs before an exit and does not consume it', () => {
      const state = createState();
      const result = registerTurnRoll({
        state,
        turnState: createRedTurn({ consecutiveSixes: 2 }),
        roll: 6,
      });

      expect(result.turnState.phase).toBe(TURN_PHASES.ENDED);
      expect(result.turnState.endReason).toBe(TURN_END_REASONS.THIRD_SIX_PENALTY);
      expect(result.turnState.availableActions).toEqual([]);
      expect(result.state.factionStatesById.red.initialExitAvailable).toBe(true);
    });
  });

  describe('movement rule interactions', () => {
    test('an intermediate barrier makes an ordinary initial exit unavailable', () => {
      const state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(7),
        'blue.alchemist': createCommonPosition(7),
      });
      const actions = getInitialActions(state, FACTION_IDS.RED, 4);

      expect(actions.map((action) => action.characterId)).toEqual([]);
      expect(state.factionStatesById.red.initialExitAvailable).toBe(true);
    });

    test('Ranger can cross an intermediate barrier during an initial exit', () => {
      const state = setPositions(createState(), {
        'red.warrior': createCommonPosition(24),
        'red.blacksmith': createCommonPosition(24),
      });
      const action = getCharacterAction(state, FACTION_IDS.GREEN, 4, 'green.ranger');
      const result = executeAction({ state, factionId: FACTION_IDS.GREEN, roll: 4, action });

      expect(action.movement.path).toEqual([
        createCommonPosition(23),
        createCommonPosition(24),
        createCommonPosition(25),
        createCommonPosition(26),
      ]);
      expect(getCharacter(result.state, 'green.ranger').position).toEqual(createCommonPosition(26));
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(24));
      expect(getCharacter(result.state, 'red.blacksmith').position).toEqual(createCommonPosition(24));
    });

    test('Ranger still cannot finish an initial exit on a barrier', () => {
      const state = setPositions(createState(), {
        'red.warrior': createCommonPosition(26),
        'red.blacksmith': createCommonPosition(26),
      });

      expect(getCharacterAction(state, FACTION_IDS.GREEN, 4, 'green.ranger')).toBeUndefined();
      expect(state.factionStatesById.green.initialExitAvailable).toBe(true);
    });

    test('enemy Vines interrupt the post-START path and are consumed only on execution', () => {
      const position = createCommonPosition(7);
      let state = setPositions(createState(), { 'green.druid': createCommonPosition(20) });
      state = addTerrainEffect(state, createDruidVinesEffect({
        characterId: 'green.druid',
        factionId: FACTION_IDS.GREEN,
        position,
      }));
      const action = getCharacterAction(state, FACTION_IDS.RED, 4, 'red.warrior');

      expect(action.movement).toMatchObject({
        destination: position,
        path: [createCommonPosition(6), position],
        terrainTriggers: [expect.objectContaining({ position })],
      });
      expect(state.terrainEffectsByPositionKey['common:7']).toHaveLength(1);

      const result = executeAction({ state, factionId: FACTION_IDS.RED, roll: 4, action });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(position);
      expect(result.state.terrainEffectsByPositionKey['common:7']).toBeUndefined();
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.TERRAIN_EFFECT_TRIGGERED,
        effectType: TERRAIN_EFFECT_TYPES.DRUID_VINES,
      }));
    });

    test('enemy Ice interrupts the path, is consumed, and applies Frozen', () => {
      const position = createCommonPosition(7);
      let state = setPositions(createState(), { 'blue.iceMage': createCommonPosition(20) });
      state = addTerrainEffect(state, createIceEffect({
        characterId: 'blue.iceMage',
        factionId: FACTION_IDS.BLUE,
        position,
        chargeSequence: 2,
      }));
      const result = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        characterId: 'red.blacksmith',
      });

      expect(getCharacter(result.state, 'red.blacksmith').position).toEqual(position);
      expect(result.state.terrainEffectsByPositionKey['common:7']).toBeUndefined();
      expect(isCharacterFrozen({ state: result.state, characterId: 'red.blacksmith' })).toBe(true);
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.TERRAIN_EFFECT_TRIGGERED,
        effectType: TERRAIN_EFFECT_TYPES.ICE,
      }));
    });

    test('enemy Trap interrupts the path, is consumed, and applies Bleeding', () => {
      const position = createCommonPosition(7);
      let state = setPositions(createState(), { 'blue.hunter': createCommonPosition(20) });
      state = addTerrainEffect(state, createTrapEffect({
        characterId: 'blue.hunter',
        factionId: FACTION_IDS.BLUE,
        position,
        chargeSequence: 2,
      }));
      const result = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        characterId: 'red.assassin',
      });

      expect(getCharacter(result.state, 'red.assassin').position).toEqual(position);
      expect(result.state.terrainEffectsByPositionKey['common:7']).toBeUndefined();
      expect(isCharacterBleeding({ state: result.state, characterId: 'red.assassin' })).toBe(true);
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.TERRAIN_EFFECT_TRIGGERED,
        effectType: TERRAIN_EFFECT_TYPES.TRAP,
      }));
    });

    test('captures normally on the intended non-safe destination and grants +20', () => {
      const state = setPositions(createState(), { 'blue.hunter': createCommonPosition(9) });
      const result = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        characterId: 'red.warrior',
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(9));
      expect(getCharacter(result.state, 'blue.hunter').position).toEqual(createHomePosition());
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
        characterId: 'red.warrior',
        capturedCharacterId: 'blue.hunter',
        movementType: MOVEMENT_TYPES.NORMAL,
      }));
      expect(deriveRewardsFromEvents({ events: result.events })).toEqual([{
        type: REWARD_TYPES.MOVEMENT_REWARD,
        source: { type: REWARD_SOURCE_TYPES.CAPTURE, characterId: 'red.warrior' },
        ownerFactionId: FACTION_IDS.RED,
        steps: 20,
        excludedCharacterIds: [],
      }]);
    });

    test('validates the full intended path before an earlier terrain interruption', () => {
      const vinePosition = createCommonPosition(6);
      let state = setPositions(createState(), {
        'green.druid': createCommonPosition(20),
        'blue.hunter': createCommonPosition(9),
        'blue.alchemist': createCommonPosition(9),
      });
      state = addTerrainEffect(state, createDruidVinesEffect({
        characterId: 'green.druid',
        factionId: FACTION_IDS.GREEN,
        position: vinePosition,
      }));
      const characters = getCharactersFromState(state);
      const virtualCharacters = characters.map((character) => (
        character.id === 'red.fireMage'
          ? { ...character, position: createCommonPosition(5) }
          : character
      ));

      expect(getInitialActions(state, FACTION_IDS.RED, 4)).toEqual([]);
      expect(() => revalidateAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: {
          id: 'initialExit:4:red.fireMage',
          type: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
          characterId: 'red.fireMage',
        },
        characters,
      })).toThrow('Action is not available for the current state.');
      expect(state.terrainEffectsByPositionKey['common:6']).toHaveLength(1);
      expect(state.factionStatesById.red.initialExitAvailable).toBe(true);

      expect(evaluateMovement({
        characterId: 'red.fireMage',
        steps: 4,
        characters: virtualCharacters,
      })).toMatchObject({
        legal: false,
        reason: LEGAL_MOVEMENT_FAILURE_REASONS.BARRIER,
        blockedAt: createCommonPosition(9),
      });
    });

    test('terrain on START is not entered and remains untouched', () => {
      const start = createCommonPosition(5);
      let state = setPositions(createState(), { 'green.druid': createCommonPosition(20) });
      state = addTerrainEffect(state, createDruidVinesEffect({
        characterId: 'green.druid',
        factionId: FACTION_IDS.GREEN,
        position: start,
      }));
      const result = executeInitialExit({
        state,
        factionId: FACTION_IDS.RED,
        roll: 2,
        characterId: 'red.fireMage',
      });

      expect(getCharacter(result.state, 'red.fireMage').position).toEqual(createCommonPosition(7));
      expect(result.state.terrainEffectsByPositionKey['common:5']).toHaveLength(1);
      expect(result.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.TERRAIN_EFFECT_TRIGGERED,
      }));
    });
  });

  describe('normal roll five regression', () => {
    test('with no HOME characters roll five remains an ordinary movement', () => {
      let state = setPositions(createState(), {
        'red.fireMage': createCommonPosition(10),
        'red.warrior': createCommonPosition(20),
        'red.blacksmith': createCommonPosition(30),
        'red.assassin': createCommonPosition(40),
      });
      state = setInitialExitAvailable(state, FACTION_IDS.RED, true);
      const rolled = registerTurnRoll({ state, turnState: createRedTurn(), roll: 5 });
      const action = rolled.turnState.availableActions.find(
        (candidate) => candidate.characterId === 'red.warrior',
      );
      const result = executeTurnAction({ state, turnState: rolled.turnState, action });

      expect(action.type).toBe(EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT);
      expect(action.movement.destination).toEqual(createCommonPosition(25));
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(25));
      expect(result.state.factionStatesById.red.initialExitAvailable).toBe(true);
    });
  });
});
