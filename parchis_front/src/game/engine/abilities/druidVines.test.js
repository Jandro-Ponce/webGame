import {
  ABILITY_IDS,
  CONSEQUENCE_ITEM_TYPES,
  CONSEQUENCE_RESOLUTION_STATUS,
  DECISION_TYPES,
  DESTINATION_OUTCOME_TYPES,
  EXECUTABLE_ACTION_TYPES,
  EXECUTION_EVENT_TYPES,
  FACTION_IDS,
  GAME_PHASES,
  LEGAL_MOVEMENT_FAILURE_REASONS,
  MOVEMENT_SOURCE_TYPES,
  MOVEMENT_TYPES,
  OPTIONAL_ABILITY_ACTION_TYPES,
  REWARD_ACTION_TYPES,
  REWARD_LOST_REASONS,
  REWARD_SOURCE_TYPES,
  REWARD_STATUS,
  REWARD_TYPES,
  TERRAIN_EFFECT_TYPES,
  TURN_PHASES,
  activateDruidVines,
  applyAbilityStateTransitionsFromEvents,
  canActivateDruidVines,
  createCommonPosition,
  createDruidVinesEffect,
  createFinalLanePosition,
  createInitialGameState,
  createRulesContext,
  createTurnState,
  evaluateMovement,
  executeAction,
  executeDecision,
  executeRewardAction,
  executeTurnAction,
  executeTurnDecision,
  getActiveDruidVines,
  getAvailableDecisionActions,
  getAvailableRewardActions,
  getCharacterAbilityState,
  getCharactersFromState,
  getMovableCharacters,
  getPlayablePositionKey,
  registerTurnRoll,
  resolveConsequences,
} from '../index';

function createState() {
  const state = createInitialGameState({
    players: [
      { id: 'player-green', factionId: FACTION_IDS.GREEN },
      { id: 'player-red', factionId: FACTION_IDS.RED },
    ],
    turnOrder: ['player-green', 'player-red'],
  });

  return {
    ...state,
    phase: GAME_PHASES.IN_PROGRESS,
    factionStatesById: Object.fromEntries(
      Object.entries(state.factionStatesById).map(([factionId, factionState]) => [
        factionId,
        { ...factionState, initialExitAvailable: false },
      ]),
    ),
  };
}

function setPositions(state, positionByCharacterId) {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      characters: player.characters.map((character) => (
        positionByCharacterId[character.id]
          ? { ...character, position: positionByCharacterId[character.id] }
          : character
      )),
    })),
  };
}

function getCharacter(state, characterId) {
  return getCharactersFromState(state).find((character) => character.id === characterId);
}

function addVine(state, { characterId = 'green.druid', factionId = FACTION_IDS.GREEN, position }) {
  const effect = createDruidVinesEffect({ characterId, factionId, position });
  const positionKey = getPlayablePositionKey(position);

  return {
    ...state,
    terrainEffectsByPositionKey: {
      ...state.terrainEffectsByPositionKey,
      [positionKey]: [...(state.terrainEffectsByPositionKey[positionKey] || []), effect],
    },
  };
}

function createMovementContext(state, characterId, movementType = MOVEMENT_TYPES.NORMAL) {
  return createRulesContext({
    gameState: state,
    actorCharacterId: characterId,
    source: movementType === MOVEMENT_TYPES.REWARD
      ? { type: MOVEMENT_SOURCE_TYPES.REWARD }
      : { type: MOVEMENT_SOURCE_TYPES.DICE },
    movementType,
  });
}

function evaluate(state, characterId, steps, movementType = MOVEMENT_TYPES.NORMAL) {
  return evaluateMovement({
    characterId,
    steps,
    characters: getCharactersFromState(state),
    rulesContext: createMovementContext(state, characterId, movementType),
  });
}

function movedEvent(characterId, factionId, to, movementType = MOVEMENT_TYPES.NORMAL) {
  return {
    type: EXECUTION_EVENT_TYPES.CHARACTER_MOVED,
    characterId,
    factionId,
    from: createCommonPosition(1),
    to,
    steps: 1,
    actionType: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT,
    movementType,
    source: { type: MOVEMENT_SOURCE_TYPES.DICE },
  };
}

function getAbilityDecision(state, position, movementType = MOVEMENT_TYPES.NORMAL) {
  return resolveConsequences({
    state,
    events: [movedEvent('green.druid', FACTION_IDS.GREEN, position, movementType)],
  });
}

describe('Druid Enredaderas', () => {
  test('starts with two serializable charges under the stable ability id', () => {
    const state = createState();

    expect(getCharacterAbilityState({
      state,
      characterId: 'green.druid',
      abilityId: ABILITY_IDS.DRUID_VINES,
    })).toEqual({ charges: 2 });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  test('creates a typed serializable terrain effect with owner and source identity', () => {
    const position = createCommonPosition(23);
    const effect = createDruidVinesEffect({
      characterId: 'green.druid',
      factionId: FACTION_IDS.GREEN,
      position,
    });

    expect(effect).toMatchObject({
      id: 'druid.vines:green.druid:common:23',
      type: TERRAIN_EFFECT_TYPES.DRUID_VINES,
      scope: { type: 'terrain', targetId: 'common:23' },
      source: {
        abilityId: ABILITY_IDS.DRUID_VINES,
        sourceCharacterId: 'green.druid',
        factionId: FACTION_IDS.GREEN,
      },
      data: { position, sourceCharacterId: 'green.druid', factionId: FACTION_IDS.GREEN },
    });
    expect(JSON.parse(JSON.stringify(effect))).toEqual(effect);
  });

  test('offers deterministic activate and skip actions after a normal movement', () => {
    const position = createCommonPosition(23);
    const state = setPositions(createState(), { 'green.druid': position });
    const result = getAbilityDecision(state, position);

    expect(result.status).toBe(CONSEQUENCE_RESOLUTION_STATUS.DECISION_REQUIRED);
    expect(result.pendingDecision).toMatchObject({
      type: DECISION_TYPES.OPTIONAL_ABILITY_ACTIVATION,
      abilityId: ABILITY_IDS.DRUID_VINES,
      characterId: 'green.druid',
      position,
    });
    expect(result.availableDecisionActions.map((action) => action.type)).toEqual([
      OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
      OPTIONAL_ABILITY_ACTION_TYPES.SKIP,
    ]);
    expect(new Set(result.availableDecisionActions.map((action) => action.id)).size).toBe(2);
    expect(getAvailableDecisionActions({
      state,
      decision: result.pendingDecision,
    }).map((action) => action.id)).toEqual(result.availableDecisionActions.map((action) => action.id));
  });

  test('activates authoritatively by id, decrements one charge, and ignores manipulated payload', () => {
    const position = createCommonPosition(23);
    const state = setPositions(createState(), { 'green.druid': position });
    const pending = getAbilityDecision(state, position);
    const activate = pending.availableDecisionActions.find(
      (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
    );
    const result = executeDecision({
      state,
      decision: pending.pendingDecision,
      action: { ...activate, characterId: 'red.warrior', position: createCommonPosition(50) },
    });

    expect(getCharacterAbilityState({
      state: result.state,
      characterId: 'green.druid',
      abilityId: ABILITY_IDS.DRUID_VINES,
    })).toEqual({ charges: 1 });
    expect(getActiveDruidVines({ state: result.state, characterId: 'green.druid' })).toHaveLength(1);
    expect(result.state.terrainEffectsByPositionKey['common:23']).toHaveLength(1);
    expect(result.state.terrainEffectsByPositionKey['common:50']).toBeUndefined();
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });

  test('skipping does not consume charges or create terrain', () => {
    const position = createCommonPosition(23);
    const state = setPositions(createState(), { 'green.druid': position });
    const pending = getAbilityDecision(state, position);
    const skip = pending.availableDecisionActions.find(
      (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.SKIP,
    );
    const result = executeDecision({ state, decision: pending.pendingDecision, action: skip });

    expect(result.state).toBe(state);
    expect(result.state.terrainEffectsByPositionKey).toEqual({});
    expect(getCharacterAbilityState({
      state: result.state,
      characterId: 'green.druid',
      abilityId: ABILITY_IDS.DRUID_VINES,
    }).charges).toBe(2);
  });

  test('does not create a decision with no charges, two active vines, or a duplicate position', () => {
    const first = createCommonPosition(23);
    const second = createCommonPosition(24);
    let state = setPositions(createState(), { 'green.druid': first });
    state = activateDruidVines({ state, characterId: 'green.druid', position: first });

    expect(getAbilityDecision(state, first).status).toBe(CONSEQUENCE_RESOLUTION_STATUS.RESOLVED);

    state = setPositions(state, { 'green.druid': second });
    state = activateDruidVines({ state, characterId: 'green.druid', position: second });

    state = setPositions(state, { 'green.druid': createCommonPosition(25) });
    expect(getAbilityDecision(state, createCommonPosition(25)).status).toBe(
      CONSEQUENCE_RESOLUTION_STATUS.RESOLVED,
    );
    const stateWithArtificialCharge = {
      ...state,
      characterStatesById: {
        ...state.characterStatesById,
        'green.druid': {
          abilityStatesById: { [ABILITY_IDS.DRUID_VINES]: { charges: 1 } },
        },
      },
    };
    expect(getAbilityDecision(stateWithArtificialCharge, createCommonPosition(25)).status).toBe(
      CONSEQUENCE_RESOLUTION_STATUS.RESOLVED,
    );
    expect(canActivateDruidVines({
      state,
      characterId: 'green.druid',
      position: createCommonPosition(25),
    })).toBe(false);
  });

  test('supports activation on a playable final-lane position but not on GOAL', () => {
    const position = createFinalLanePosition(FACTION_IDS.GREEN, 3);
    const state = setPositions(createState(), { 'green.druid': position });

    expect(getAbilityDecision(state, position).status).toBe(
      CONSEQUENCE_RESOLUTION_STATUS.DECISION_REQUIRED,
    );
    expect(resolveConsequences({
      state: setPositions(state, { 'green.druid': { type: 'goal' } }),
      events: [movedEvent('green.druid', FACTION_IDS.GREEN, { type: 'goal' })],
    }).status).toBe(CONSEQUENCE_RESOLUTION_STATUS.RESOLVED);
  });

  test('does not trigger for allies and interrupts enemies that pass over it', () => {
    const vinePosition = createCommonPosition(12);
    let state = setPositions(createState(), {
      'green.druid': createCommonPosition(9),
      'green.ranger': createCommonPosition(9),
      'red.warrior': createCommonPosition(9),
    });
    state = addVine(state, { position: vinePosition });

    expect(evaluate(state, 'green.ranger', 5).destination).toEqual(createCommonPosition(14));

    const enemyMovement = evaluate(state, 'red.warrior', 5);
    expect(enemyMovement.destination).toEqual(vinePosition);
    expect(enemyMovement.path).toEqual([
      createCommonPosition(10),
      createCommonPosition(11),
      createCommonPosition(12),
    ]);
    expect(enemyMovement.terrainTriggers).toHaveLength(1);
    expect(state.terrainEffectsByPositionKey['common:12']).toHaveLength(1);
  });

  test.each([MOVEMENT_TYPES.FORCED_DISPLACEMENT, MOVEMENT_TYPES.SPECIAL_TRAVERSAL])(
    'does not trigger or offer activation during %s',
    (movementType) => {
      const vinePosition = createCommonPosition(12);
      let state = setPositions(createState(), {
        'green.druid': createCommonPosition(14),
        'red.warrior': createCommonPosition(10),
      });
      state = addVine(state, { position: vinePosition });

      expect(evaluate(state, 'red.warrior', 4, movementType).destination).toEqual(
        createCommonPosition(14),
      );
      expect(getAbilityDecision(state, createCommonPosition(14), movementType).status).toBe(
        CONSEQUENCE_RESOLUTION_STATUS.RESOLVED,
      );
    },
  );

  test('does not trigger or offer activation for EXIT_HOME', () => {
    const vinePosition = createCommonPosition(5);
    const state = addVine(createState(), { position: vinePosition });
    const result = executeAction({
      state,
      factionId: FACTION_IDS.RED,
      roll: 5,
      action: { type: EXECUTABLE_ACTION_TYPES.EXIT_HOME, characterId: 'red.warrior' },
    });

    expect(getCharacter(result.state, 'red.warrior').position).toEqual(vinePosition);
    expect(result.state.terrainEffectsByPositionKey['common:5']).toHaveLength(1);
    expect(result.events.map((event) => event.type)).toEqual([
      EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME,
    ]);
  });

  test('triggers when an enemy lands exactly on it and consumes only that vine on execution', () => {
    const vinePosition = createCommonPosition(12);
    let state = setPositions(createState(), { 'red.warrior': createCommonPosition(10) });
    state = addVine(state, { position: vinePosition });
    state = addVine(state, {
      characterId: 'yellow.druid',
      factionId: FACTION_IDS.YELLOW,
      position: vinePosition,
    });
    const result = executeAction({
      state,
      factionId: FACTION_IDS.RED,
      roll: 2,
      action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
    });

    expect(getCharacter(result.state, 'red.warrior').position).toEqual(vinePosition);
    expect(result.state.terrainEffectsByPositionKey['common:12']).toHaveLength(1);
    expect(result.state.terrainEffectsByPositionKey['common:12'][0].source.sourceCharacterId).toBe(
      'yellow.druid',
    );
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.TERRAIN_EFFECT_TRIGGERED,
        effectType: TERRAIN_EFFECT_TYPES.DRUID_VINES,
        characterId: 'red.warrior',
      }),
    ]));
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });

  test('reuses normal SAFE and assassin capture outcomes at the interrupted destination', () => {
    const safePosition = createCommonPosition(12);
    let state = setPositions(createState(), {
      'red.warrior': createCommonPosition(10),
      'red.assassin': createCommonPosition(10),
      'green.ranger': safePosition,
    });
    state = addVine(state, {
      characterId: 'blue.druid',
      factionId: FACTION_IDS.BLUE,
      position: safePosition,
    });

    expect(evaluate(state, 'red.warrior', 4).outcome).toEqual({
      type: DESTINATION_OUTCOME_TYPES.SAFE_SHARE,
      occupantCharacterId: 'green.ranger',
    });
    expect(evaluate(state, 'red.assassin', 4).outcome).toEqual({
      type: DESTINATION_OUTCOME_TYPES.CAPTURE,
      capturedCharacterId: 'green.ranger',
    });
  });

  test('rejects a normal movement blocked after vines in its intended path', () => {
    let state = setPositions(createState(), {
      'red.warrior': createCommonPosition(9),
      'red.fireMage': createCommonPosition(12),
      'red.blacksmith': createCommonPosition(12),
    });
    state = addVine(state, { position: createCommonPosition(10) });

    expect(evaluate(state, 'red.warrior', 4)).toMatchObject({
      legal: false,
      reason: LEGAL_MOVEMENT_FAILURE_REASONS.BARRIER,
      blockedAt: createCommonPosition(12),
    });
    expect(evaluate(state, 'red.warrior', 4).terrainTriggers).toBeUndefined();
    expect(getMovableCharacters({
      factionId: FACTION_IDS.RED,
      steps: 4,
      characters: getCharactersFromState(state),
      gameState: state,
    }).movableCharacters.map((candidate) => candidate.characterId)).not.toContain('red.warrior');
    expect(() => executeAction({
      state,
      factionId: FACTION_IDS.RED,
      roll: 4,
      action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
    })).toThrow('Action is not available for the current state.');
    expect(getCharacter(state, 'red.warrior').position).toEqual(createCommonPosition(9));
    expect(state.terrainEffectsByPositionKey['common:10']).toHaveLength(1);
  });

  test('does not consider a barrier outside the intended path', () => {
    let state = setPositions(createState(), {
      'red.warrior': createCommonPosition(9),
      'green.ranger': createCommonPosition(14),
      'green.archer': createCommonPosition(14),
    });
    state = addVine(state, { position: createCommonPosition(10) });

    expect(evaluate(state, 'red.warrior', 4)).toMatchObject({
      legal: true,
      destination: createCommonPosition(10),
      path: [createCommonPosition(10)],
      terrainTriggers: [expect.objectContaining({ position: createCommonPosition(10) })],
    });
  });

  test('never permits a Ranger to stop on a barrier after terrain interruption', () => {
    let state = setPositions(createState(), {
      'green.ranger': createCommonPosition(9),
      'red.fireMage': createCommonPosition(12),
      'red.blacksmith': createCommonPosition(12),
    });

    state = addVine(state, {
      characterId: 'red.druid',
      factionId: FACTION_IDS.RED,
      position: createCommonPosition(12),
    });
    expect(evaluate(state, 'green.ranger', 4)).toMatchObject({
      legal: false,
      reason: LEGAL_MOVEMENT_FAILURE_REASONS.BARRIER,
      blockedAt: createCommonPosition(12),
    });
  });

  test('Ranger passes an intermediate barrier but still stops at later enemy vines', () => {
    let state = setPositions(createState(), {
      'green.ranger': createCommonPosition(9),
      'red.warrior': createCommonPosition(10),
      'red.blacksmith': createCommonPosition(10),
    });
    state = addVine(state, {
      characterId: 'red.druid',
      factionId: FACTION_IDS.RED,
      position: createCommonPosition(11),
    });

    expect(evaluate(state, 'green.ranger', 5)).toMatchObject({
      legal: true,
      destination: createCommonPosition(11),
      path: [createCommonPosition(10), createCommonPosition(11)],
    });
  });

  test('movementReward triggers vines and discards its remaining steps', () => {
    let state = setPositions(createState(), { 'red.warrior': createCommonPosition(9) });
    state = addVine(state, { position: createCommonPosition(23) });
    const reward = {
      type: REWARD_TYPES.MOVEMENT_REWARD,
      source: { type: REWARD_SOURCE_TYPES.CAPTURE, characterId: 'red.warrior' },
      ownerFactionId: FACTION_IDS.RED,
      steps: 20,
      excludedCharacterIds: [],
    };
    const availability = getAvailableRewardActions({ state, reward });
    const action = availability.availableActions.find(
      (candidate) => candidate.characterId === 'red.warrior',
    );
    const result = executeRewardAction({ state, reward, action });

    expect(action.movement.destination).toEqual(createCommonPosition(23));
    expect(action.movement.path).toHaveLength(14);
    expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(23));
    expect(result.state.terrainEffectsByPositionKey['common:23']).toBeUndefined();
  });

  test('loses movementReward when its intended path has a barrier after vines', () => {
    let state = setPositions(createState(), {
      'red.warrior': createCommonPosition(9),
      'green.ranger': createCommonPosition(28),
      'green.archer': createCommonPosition(28),
    });
    state = addVine(state, { position: createCommonPosition(23) });
    const reward = {
      type: REWARD_TYPES.MOVEMENT_REWARD,
      source: { type: REWARD_SOURCE_TYPES.CAPTURE, characterId: 'red.warrior' },
      ownerFactionId: FACTION_IDS.RED,
      steps: 20,
      excludedCharacterIds: [],
    };
    const availability = getAvailableRewardActions({ state, reward });

    expect(availability).toMatchObject({
      status: REWARD_STATUS.LOST,
      mustChooseAction: false,
      availableActions: [],
      reason: REWARD_LOST_REASONS.NO_LEGAL_RECIPIENT,
    });

    const result = executeRewardAction({
      state,
      reward,
      action: { type: REWARD_ACTION_TYPES.LOSE_REWARD },
    });

    expect(result.state).toBe(state);
    expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(9));
    expect(result.state.terrainEffectsByPositionKey['common:23']).toHaveLength(1);
    expect(result.events.map((event) => event.type)).toEqual([
      EXECUTION_EVENT_TYPES.REWARD_LOST,
    ]);
  });

  test('capture sends the Druid HOME, restores two charges, and removes only its vines', () => {
    let state = setPositions(createState(), {
      'green.druid': createCommonPosition(13),
      'red.warrior': createCommonPosition(10),
    });
    state = addVine(state, { position: createCommonPosition(20) });
    state = addVine(state, { position: createCommonPosition(21) });
    state = addVine(state, {
      characterId: 'red.druid',
      factionId: FACTION_IDS.RED,
      position: createCommonPosition(20),
    });
    state = {
      ...state,
      characterStatesById: {
        ...state.characterStatesById,
        'green.druid': {
          abilityStatesById: { [ABILITY_IDS.DRUID_VINES]: { charges: 0 } },
        },
      },
    };
    const result = executeAction({
      state,
      factionId: FACTION_IDS.RED,
      roll: 3,
      action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
    });

    expect(getCharacter(result.state, 'green.druid').position.type).toBe('home');
    expect(getCharacterAbilityState({
      state: result.state,
      characterId: 'green.druid',
      abilityId: ABILITY_IDS.DRUID_VINES,
    }).charges).toBe(2);
    expect(getActiveDruidVines({ state: result.state, characterId: 'green.druid' })).toEqual([]);
    expect(result.state.terrainEffectsByPositionKey['common:20']).toHaveLength(1);
    expect(result.events.some((event) => event.type === EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED)).toBe(true);
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);

    const rewards = resolveConsequences({ state: result.state, events: result.events });
    expect(getCharacter(rewards.state, 'red.warrior').position).toEqual(createCommonPosition(33));
    expect(rewards.generatedEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_MOVED,
        characterId: 'red.warrior',
        steps: 20,
        movementType: MOVEMENT_TYPES.REWARD,
      }),
    ]));
  });

  test('does not reset vines for non-capture HOME removals', () => {
    const state = addVine(createState(), { position: createCommonPosition(20) });
    const result = applyAbilityStateTransitionsFromEvents({
      state,
      events: [{
        type: EXECUTION_EVENT_TYPES.CHARACTER_REMOVED_FROM_START,
        characterId: 'green.druid',
      }],
    });

    expect(result).toBe(state);
    expect(result.terrainEffectsByPositionKey['common:20']).toHaveLength(1);
  });

  test('pauses and resumes a normal turn for activate or skip without blocking progression', () => {
    const state = setPositions(createState(), { 'green.druid': createCommonPosition(10) });
    const turn = createTurnState({ playerId: 'player-green', factionId: FACTION_IDS.GREEN });
    const rolled = registerTurnRoll({ state, turnState: turn, roll: 2 });
    const moved = executeTurnAction({
      state,
      turnState: rolled.turnState,
      action: rolled.turnState.availableActions.find(
        (action) => action.characterId === 'green.druid',
      ),
    });

    expect(moved.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_DECISION);
    expect(moved.turnState.pendingDecision.type).toBe(DECISION_TYPES.OPTIONAL_ABILITY_ACTIVATION);

    const skipped = executeTurnDecision({
      state: moved.state,
      turnState: moved.turnState,
      action: moved.turnState.availableDecisionActions.find(
        (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.SKIP,
      ),
    });

    expect(skipped.turnState.phase).toBe(TURN_PHASES.ENDED);
    expect(skipped.state.terrainEffectsByPositionKey).toEqual({});

    const activated = executeTurnDecision({
      state: moved.state,
      turnState: moved.turnState,
      action: moved.turnState.availableDecisionActions.find(
        (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
      ),
    });

    expect(activated.turnState.phase).toBe(TURN_PHASES.ENDED);
    expect(activated.state.terrainEffectsByPositionKey['common:12']).toHaveLength(1);
  });

  test('places the post-movement decision before capture rewards and resumes the queued +20', () => {
    let state = setPositions(createState(), {
      'green.druid': createCommonPosition(10),
      'red.warrior': createCommonPosition(13),
    });
    const turn = createTurnState({ playerId: 'player-green', factionId: FACTION_IDS.GREEN });
    const rolled = registerTurnRoll({ state, turnState: turn, roll: 3 });
    const moved = executeTurnAction({
      state,
      turnState: rolled.turnState,
      action: rolled.turnState.availableActions.find(
        (action) => action.characterId === 'green.druid',
      ),
    });

    expect(moved.turnState.pendingDecision.type).toBe(DECISION_TYPES.OPTIONAL_ABILITY_ACTIVATION);
    expect(moved.turnState.pendingConsequences).toEqual([
      expect.objectContaining({ type: CONSEQUENCE_ITEM_TYPES.REWARD }),
    ]);

    const firstSkip = executeTurnDecision({
      state: moved.state,
      turnState: moved.turnState,
      action: moved.turnState.availableDecisionActions.find(
        (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.SKIP,
      ),
    });

    expect(getCharacter(firstSkip.state, 'green.druid').position).toEqual(
      createFinalLanePosition(FACTION_IDS.GREEN, 4),
    );
    expect(firstSkip.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_DECISION);
    expect(firstSkip.turnState.pendingDecision.movementType).toBe(MOVEMENT_TYPES.REWARD);

    const secondSkip = executeTurnDecision({
      state: firstSkip.state,
      turnState: firstSkip.turnState,
      action: firstSkip.turnState.availableDecisionActions.find(
        (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.SKIP,
      ),
    });

    expect(secondSkip.turnState.phase).toBe(TURN_PHASES.ENDED);
  });
});
