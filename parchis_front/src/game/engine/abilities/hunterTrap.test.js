import {
  ABILITY_IDS,
  CHARACTER_STATUS_TYPES,
  CONSEQUENCE_RESOLUTION_STATUS,
  DESTINATION_OUTCOME_TYPES,
  EXECUTABLE_ACTION_TYPES,
  EXECUTION_EVENT_TYPES,
  FACTION_IDS,
  GAME_PHASES,
  MOVEMENT_SOURCE_TYPES,
  MOVEMENT_TYPES,
  OPTIONAL_ABILITY_ACTION_TYPES,
  REWARD_LOST_REASONS,
  REWARD_SOURCE_TYPES,
  REWARD_STATUS,
  REWARD_TYPES,
  TERRAIN_EFFECT_TYPES,
  TURN_PHASES,
  activateHunterTrap,
  applyAbilityStateTransitionsFromEvents,
  applyBleedingStatus,
  createCommonPosition,
  createDruidVinesEffect,
  createFinalLanePosition,
  createFrozenStatus,
  createIceEffect,
  createInitialGameState,
  createRulesContext,
  createTurnState,
  evaluateMovement,
  executeAction,
  executeDecision,
  executeRewardAction,
  executeTurnAction,
  getAvailableRewardActions,
  getCharacterAbilityState,
  getCharacterEffects,
  getCharactersFromState,
  getHunterTrapActivationOptions,
  getMovableCharacters,
  getPlayablePositionKey,
  isCharacterBleeding,
  killByBleeding,
  registerTurnRoll,
  resolveConsequences,
  healBleedingOnSafe,
  decrementBleedingForFaction,
} from '../index';
import { revalidateAction } from '../actions/revalidateAction';

function createState() {
  const state = createInitialGameState({
    players: [
      { id: 'player-blue', factionId: FACTION_IDS.BLUE },
      { id: 'player-red', factionId: FACTION_IDS.RED },
      { id: 'player-green', factionId: FACTION_IDS.GREEN },
      { id: 'player-yellow', factionId: FACTION_IDS.YELLOW },
    ],
    turnOrder: ['player-blue', 'player-red', 'player-green', 'player-yellow'],
  });

  return { ...state, phase: GAME_PHASES.IN_PROGRESS };
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

function setHunterCharges(state, charges) {
  return {
    ...state,
    characterStatesById: {
      ...state.characterStatesById,
      'blue.hunter': {
        ...state.characterStatesById['blue.hunter'],
        abilityStatesById: {
          ...state.characterStatesById['blue.hunter'].abilityStatesById,
          [ABILITY_IDS.HUNTER_TRAP]: { charges },
        },
      },
    },
  };
}

function addTerrain(state, effect) {
  const positionKey = getPlayablePositionKey(effect.data.position);

  return {
    ...state,
    terrainEffectsByPositionKey: {
      ...state.terrainEffectsByPositionKey,
      [positionKey]: [...(state.terrainEffectsByPositionKey[positionKey] || []), effect],
    },
  };
}

function addTrap(state, position, chargeSequence = 2) {
  return addTerrain(state, {
    id: `hunter.trap:blue.hunter:${getPlayablePositionKey(position)}:${chargeSequence}`,
    type: TERRAIN_EFFECT_TYPES.TRAP,
    scope: { type: 'terrain', targetId: getPlayablePositionKey(position) },
    source: {
      type: 'ability',
      abilityId: ABILITY_IDS.HUNTER_TRAP,
      sourceCharacterId: 'blue.hunter',
      factionId: FACTION_IDS.BLUE,
    },
    data: {
      position,
      sourceCharacterId: 'blue.hunter',
      factionId: FACTION_IDS.BLUE,
    },
  });
}

function addVines(state, position) {
  return addTerrain(state, createDruidVinesEffect({
    characterId: 'green.druid',
    factionId: FACTION_IDS.GREEN,
    position,
  }));
}

function addIce(state, position, chargeSequence = 2) {
  return addTerrain(state, createIceEffect({
    characterId: 'blue.iceMage',
    factionId: FACTION_IDS.BLUE,
    position,
    chargeSequence,
  }));
}

function applyBleeding(state, characterId, sourceCharacterId = 'blue.hunter') {
  return applyBleedingStatus({
    state,
    sourceCharacterId,
    sourceFactionId: FACTION_IDS.BLUE,
    targetCharacterId: characterId,
  });
}

function evaluate(state, characterId, steps, movementType = MOVEMENT_TYPES.NORMAL) {
  const source = movementType === MOVEMENT_TYPES.REWARD
    ? { type: MOVEMENT_SOURCE_TYPES.REWARD }
    : { type: MOVEMENT_SOURCE_TYPES.DICE, roll: steps };

  return evaluateMovement({
    characterId,
    steps,
    characters: getCharactersFromState(state),
    rulesContext: createRulesContext({
      gameState: state,
      actorCharacterId: characterId,
      source,
      movementType,
    }),
  });
}

function movedEvent({
  characterId = 'blue.hunter',
  factionId = FACTION_IDS.BLUE,
  from = createCommonPosition(10),
  to = createCommonPosition(13),
  previousPosition = createCommonPosition(12),
  movementType = MOVEMENT_TYPES.NORMAL,
} = {}) {
  return {
    type: EXECUTION_EVENT_TYPES.CHARACTER_MOVED,
    characterId,
    factionId,
    from,
    to,
    previousPosition,
    steps: 3,
    actionType: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT,
    movementType,
    source: { type: MOVEMENT_SOURCE_TYPES.DICE, roll: 3 },
  };
}

function getTrapDecision(state, event = movedEvent()) {
  return resolveConsequences({ state, events: [event] });
}

function activateTrapDecision({ state, pending }) {
  const activate = pending.availableDecisionActions.find(
    (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
  );

  return executeDecision({ state, decision: pending.pendingDecision, action: activate });
}

function captureReward(characterId = 'red.warrior', factionId = FACTION_IDS.RED) {
  return {
    type: REWARD_TYPES.MOVEMENT_REWARD,
    source: { type: REWARD_SOURCE_TYPES.CAPTURE, characterId },
    ownerFactionId: factionId,
    steps: 20,
    excludedCharacterIds: [],
  };
}

describe('Cazador Trampa / Sangrado', () => {
  describe('cargas y activación', () => {
    test('empieza con 2 cargas serializables bajo abilityId estable', () => {
      const state = createState();

      expect(getCharacterAbilityState({
        state,
        characterId: 'blue.hunter',
        abilityId: ABILITY_IDS.HUNTER_TRAP,
      })).toEqual({ charges: 2 });
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    });

    test('colocar Trampa consume 1 carga por action id autoritativo', () => {
      const state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(13),
      });
      const pending = getTrapDecision(state);
      const activate = pending.availableDecisionActions.find(
        (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
      );
      const result = executeDecision({
        state,
        decision: pending.pendingDecision,
        action: activate,
      });

      expect(pending.status).toBe(CONSEQUENCE_RESOLUTION_STATUS.DECISION_REQUIRED);
      expect(pending.pendingDecision).toMatchObject({
        type: 'optionalAbilityActivation',
        abilityId: ABILITY_IDS.HUNTER_TRAP,
        characterId: 'blue.hunter',
        position: createCommonPosition(13),
        previousPosition: createCommonPosition(12),
      });
      expect(getCharacterAbilityState({
        state,
        characterId: 'blue.hunter',
        abilityId: ABILITY_IDS.HUNTER_TRAP,
      })).toEqual({ charges: 2 });
      expect(state.terrainEffectsByPositionKey).toEqual({});
      expect(getCharacterAbilityState({
        state: result.state,
        characterId: 'blue.hunter',
        abilityId: ABILITY_IDS.HUNTER_TRAP,
      })).toEqual({ charges: 1 });
      expect(result.state.terrainEffectsByPositionKey['common:12']).toHaveLength(1);
      expect(result.state.terrainEffectsByPositionKey['common:12'][0].type).toBe(TERRAIN_EFFECT_TYPES.TRAP);
      expect(result.state.terrainEffectsByPositionKey['common:13']).toBeUndefined();
    });

    test('evaluación y revalidación no crean terrain ni consumen cargas', () => {
      const state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(10),
      });
      const characters = getCharactersFromState(state);
      const availability = getMovableCharacters({
        factionId: FACTION_IDS.BLUE,
        steps: 3,
        characters,
        gameState: state,
      });
      const revalidated = revalidateAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 3,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.hunter' },
        characters,
      });

      expect(availability.movableCharacters.find(
        (candidate) => candidate.characterId === 'blue.hunter',
      )).toBeTruthy();
      expect(revalidated.movement.destination).toEqual(createCommonPosition(13));
      expect(getCharacterAbilityState({
        state,
        characterId: 'blue.hunter',
        abilityId: ABILITY_IDS.HUNTER_TRAP,
      })).toEqual({ charges: 2 });
      expect(state.terrainEffectsByPositionKey).toEqual({});
    });

    test('con 0 cargas no ofrece activación', () => {
      const zeroChargeState = setPositions(setHunterCharges(createState(), 0), {
        'blue.hunter': createCommonPosition(13),
      });

      expect(getTrapDecision(zeroChargeState).status).toBe(
        CONSEQUENCE_RESOLUTION_STATUS.RESOLVED,
      );
    });

    test('captura restaura cargas y elimina solo Trampas de ese Cazador', () => {
      let state = setPositions(setHunterCharges(createState(), 0), {
        'blue.hunter': createCommonPosition(13),
      });
      state = addTrap(state, createCommonPosition(20), 2);
      state = addTrap(state, createCommonPosition(21), 1);
      state = addTerrain(state, {
        id: 'hunter.trap:yellow.hunter:common:22:2',
        type: TERRAIN_EFFECT_TYPES.TRAP,
        scope: { type: 'terrain', targetId: 'common:22' },
        source: { type: 'ability', abilityId: ABILITY_IDS.HUNTER_TRAP, sourceCharacterId: 'yellow.hunter', factionId: FACTION_IDS.YELLOW },
        data: { position: createCommonPosition(22), sourceCharacterId: 'yellow.hunter', factionId: FACTION_IDS.YELLOW },
      });
      const result = applyAbilityStateTransitionsFromEvents({
        state,
        events: [{
          type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
          characterId: 'red.warrior',
          capturedCharacterId: 'blue.hunter',
        }],
      });

      expect(getCharacterAbilityState({
        state: result,
        characterId: 'blue.hunter',
        abilityId: ABILITY_IDS.HUNTER_TRAP,
      }).charges).toBe(2);
      expect(result.terrainEffectsByPositionKey['common:20']).toBeUndefined();
      expect(result.terrainEffectsByPositionKey['common:21']).toBeUndefined();
      expect(result.terrainEffectsByPositionKey['common:22']).toHaveLength(1);
    });
  });

  describe('posición anterior real y colocación', () => {
    test('movimiento normal coloca la Trampa en la posición anterior del path real', () => {
      const state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(10),
      });
      const movementResult = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.hunter' },
      });
      const pending = resolveConsequences({
        state: movementResult.state,
        events: movementResult.events,
      });
      const activation = activateTrapDecision({ state: movementResult.state, pending });

      expect(movementResult.events[0].to).toEqual(createCommonPosition(14));
      expect(movementResult.events[0].previousPosition).toEqual(createCommonPosition(13));
      expect(pending.pendingDecision.position).toEqual(createCommonPosition(14));
      expect(pending.pendingDecision.previousPosition).toEqual(createCommonPosition(13));
      expect(movementResult.state.terrainEffectsByPositionKey).toEqual({});
      expect(activation.state.terrainEffectsByPositionKey['common:13']).toHaveLength(1);
      expect(activation.state.terrainEffectsByPositionKey['common:14']).toBeUndefined();
    });

    test('wrap COMMON 68 → 1 conserva common 68 como posición anterior sin aritmética manual', () => {
      const state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(67),
      });
      const movementResult = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 2,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.hunter' },
      });
      const pending = resolveConsequences({
        state: movementResult.state,
        events: movementResult.events,
      });
      const activation = activateTrapDecision({ state: movementResult.state, pending });

      expect(getCharacter(movementResult.state, 'blue.hunter').position).toEqual(createCommonPosition(1));
      expect(pending.pendingDecision.previousPosition).toEqual(createCommonPosition(68));
      expect(activation.state.terrainEffectsByPositionKey['common:68']).toHaveLength(1);
      expect(activation.state.terrainEffectsByPositionKey['common:1']).toBeUndefined();
    });

    test('coloca Trampa detrás del Cazador dentro de FINAL_LANE', () => {
      const state = setPositions(createState(), {
        'blue.hunter': createFinalLanePosition(FACTION_IDS.BLUE, 1),
      });
      const movementResult = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 2,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.hunter' },
      });
      const pending = resolveConsequences({
        state: movementResult.state,
        events: movementResult.events,
      });
      const activation = activateTrapDecision({ state: movementResult.state, pending });

      expect(getCharacter(movementResult.state, 'blue.hunter').position).toEqual(
        createFinalLanePosition(FACTION_IDS.BLUE, 3),
      );
      expect(pending.pendingDecision.previousPosition).toEqual(
        createFinalLanePosition(FACTION_IDS.BLUE, 2),
      );
      expect(activation.state.terrainEffectsByPositionKey['finalLane:blue:2']).toHaveLength(1);
    });

    test('usa el path truncado real si terrain interrumpió al Cazador', () => {
      let state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(10),
      });
      state = addVines(state, createCommonPosition(12));
      const movementResult = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.hunter' },
      });
      const pending = resolveConsequences({
        state: movementResult.state,
        events: movementResult.events,
      });
      const activation = activateTrapDecision({ state: movementResult.state, pending });

      expect(getCharacter(movementResult.state, 'blue.hunter').position).toEqual(
        createCommonPosition(12),
      );
      expect(pending.pendingDecision.position).toEqual(createCommonPosition(12));
      expect(pending.pendingDecision.previousPosition).toEqual(createCommonPosition(11));
      expect(activation.state.terrainEffectsByPositionKey['common:11']).toHaveLength(1);
      expect(activation.state.terrainEffectsByPositionKey['common:12']).toBeUndefined();
    });

    test('movementReward ofrece activación y coloca Trampa en su posición anterior real', () => {
      const state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(10),
      });
      const reward = captureReward('blue.hunter', FACTION_IDS.BLUE);
      const availability = getAvailableRewardActions({ state, reward });
      const action = availability.availableActions.find(
        (candidate) => candidate.characterId === 'blue.hunter',
      );
      const movementResult = executeRewardAction({ state, reward, action });
      const pending = resolveConsequences({
        state: movementResult.state,
        events: movementResult.events,
      });
      const activation = activateTrapDecision({ state: movementResult.state, pending });

      expect(action.steps).toBe(20);
      expect(getCharacter(movementResult.state, 'blue.hunter').position).toEqual(createCommonPosition(30));
      expect(movementResult.events[0].previousPosition).toEqual(createCommonPosition(29));
      expect(pending).toMatchObject({
        status: CONSEQUENCE_RESOLUTION_STATUS.DECISION_REQUIRED,
        pendingDecision: {
          movementType: MOVEMENT_TYPES.REWARD,
          previousPosition: createCommonPosition(29),
        },
      });
      expect(activation.state.terrainEffectsByPositionKey['common:29']).toHaveLength(1);
    });

    test('sin posición anterior jugable o con enemigo detrás no ofrece activación ni consume carga', () => {
      const noPreviousState = setPositions(createState(), {
        'blue.hunter': createCommonPosition(13),
      });
      const occupiedState = setPositions(createState(), {
        'blue.hunter': createCommonPosition(13),
        'red.warrior': createCommonPosition(12),
      });

      expect(getHunterTrapActivationOptions({
        state: noPreviousState,
        characterId: 'blue.hunter',
        position: createCommonPosition(13),
        previousPosition: { type: 'home' },
      })).toEqual([]);
      expect(getHunterTrapActivationOptions({
        state: occupiedState,
        characterId: 'blue.hunter',
        position: createCommonPosition(13),
        previousPosition: createCommonPosition(12),
      })).toEqual([]);
      expect(() => activateHunterTrap({
        state: occupiedState,
        characterId: 'blue.hunter',
        position: createCommonPosition(13),
        previousPosition: createCommonPosition(12),
      })).toThrow('Hunter trap cannot be activated in the current state.');
      expect(getCharacterAbilityState({
        state: occupiedState,
        characterId: 'blue.hunter',
        abilityId: ABILITY_IDS.HUNTER_TRAP,
      }).charges).toBe(2);
      expect(occupiedState.terrainEffectsByPositionKey).toEqual({});
    });
  });

  describe('regresión: la Trampa queda detrás del Cazador', () => {
    test('Hunter en 60 no es capturado cuando un enemigo activa su Trampa en 59', () => {
      let state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(57),
        'red.warrior': createCommonPosition(58),
      });
      const hunterMovement = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 3,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.hunter' },
      });
      const pending = resolveConsequences({
        state: hunterMovement.state,
        events: hunterMovement.events,
      });
      const activation = activateTrapDecision({ state: hunterMovement.state, pending });
      state = activation.state;

      expect(getCharacter(state, 'blue.hunter').position).toEqual(createCommonPosition(60));
      expect(state.terrainEffectsByPositionKey['common:59']).toHaveLength(1);
      expect(state.terrainEffectsByPositionKey['common:60']).toBeUndefined();

      const enemyMovement = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 3,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });
      const resolution = resolveConsequences({
        state: enemyMovement.state,
        events: enemyMovement.events,
      });
      const common60Occupants = getCharactersFromState(enemyMovement.state).filter(
        (character) => character.position.type === 'common' && character.position.square === 60,
      );

      expect(getCharacter(enemyMovement.state, 'red.warrior').position).toEqual(createCommonPosition(59));
      expect(isCharacterBleeding({ state: enemyMovement.state, characterId: 'red.warrior' })).toBe(true);
      expect(enemyMovement.state.terrainEffectsByPositionKey['common:59']).toBeUndefined();
      expect(getCharacter(enemyMovement.state, 'blue.hunter').position).toEqual(createCommonPosition(60));
      expect(common60Occupants.map((character) => character.id)).toEqual(['blue.hunter']);
      expect(enemyMovement.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
        capturedCharacterId: 'blue.hunter',
      }));
      expect(resolution.status).toBe(CONSEQUENCE_RESOLUTION_STATUS.RESOLVED);
      expect(resolution.generatedEvents).toEqual([]);
    });
  });

  describe('Trampa terrain traversal', () => {
    test('un aliado atraviesa Trampa sin activarla ni consumirla', () => {
      let state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(10),
        'blue.alchemist': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.alchemist' },
      });

      expect(getCharacter(result.state, 'blue.alchemist').position).toEqual(createCommonPosition(14));
      expect(result.state.terrainEffectsByPositionKey['common:13']).toHaveLength(1);
      expect(isCharacterBleeding({ state: result.state, characterId: 'blue.alchemist' })).toBe(false);
    });

    test('un enemigo se detiene en Trampa, recibe Bleeding y consume solo esa Trampa', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = addTrap(state, createCommonPosition(15), 1);
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(13));
      expect(result.state.terrainEffectsByPositionKey['common:13']).toBeUndefined();
      expect(result.state.terrainEffectsByPositionKey['common:15']).toHaveLength(1);
      expect(isCharacterBleeding({ state: result.state, characterId: 'red.warrior' })).toBe(true);
      const bleeding = getCharacterEffects({ state: result.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleeding.data.remainingTurns).toBe(3);
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.TERRAIN_EFFECT_TRIGGERED,
        effectType: TERRAIN_EFFECT_TYPES.TRAP,
        characterId: 'red.warrior',
      }));
    });

    test('movementReward activa Trampa sin reducir sus veinte pasos solicitados', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(15));
      const reward = captureReward();
      const availability = getAvailableRewardActions({ state, reward });
      const action = availability.availableActions.find(
        (candidate) => candidate.characterId === 'red.warrior',
      );
      const result = executeRewardAction({ state, reward, action });

      expect(action.steps).toBe(20);
      expect(action.movement.path).toHaveLength(5);
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(15));
      expect(isCharacterBleeding({ state: result.state, characterId: 'red.warrior' })).toBe(true);
    });

    test('una barrera posterior hace reward ilegal antes de que Trampa resuelva', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(9),
        'green.ranger': createCommonPosition(28),
        'green.archer': createCommonPosition(28),
      });
      state = addTrap(state, createCommonPosition(23));
      const availability = getAvailableRewardActions({ state, reward: captureReward() });

      expect(availability).toMatchObject({
        status: REWARD_STATUS.LOST,
        availableActions: [],
        reason: REWARD_LOST_REASONS.NO_LEGAL_RECIPIENT,
      });
      expect(state.terrainEffectsByPositionKey['common:23']).toHaveLength(1);
      expect(isCharacterBleeding({ state, characterId: 'red.warrior' })).toBe(false);
    });

    test('Montaraz atraviesa barrera intermedia pero activa Trampa posterior', () => {
      let state = setPositions(createState(), {
        'green.ranger': createCommonPosition(9),
        'green.druid': createCommonPosition(40),
        'green.archer': createCommonPosition(41),
        'green.fairy': createCommonPosition(42),
        'red.warrior': createCommonPosition(10),
        'red.blacksmith': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(11));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.GREEN,
        roll: 5,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'green.ranger' },
      });

      expect(getCharacter(result.state, 'green.ranger').position).toEqual(createCommonPosition(11));
      expect(isCharacterBleeding({ state: result.state, characterId: 'green.ranger' })).toBe(true);
    });

    test('solo el primer terrain hostil en el path resuelve (Vines antes que Trap)', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addVines(state, createCommonPosition(12));
      state = addTrap(state, createCommonPosition(13));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(12));
      expect(isCharacterBleeding({ state: result.state, characterId: 'red.warrior' })).toBe(false);
      expect(result.state.terrainEffectsByPositionKey['common:13']).toHaveLength(1);
    });
  });

  describe('Bleeding contador y progresión', () => {
    test('Bleeding comienza exactamente en remainingTurns=3', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      const bleeding = getCharacterEffects({ state: result.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleeding.data.remainingTurns).toBe(3);
    });

    test('fin de turno de OTRA facción no decrementa Bleeding', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(isCharacterBleeding({ state: state.state, characterId: 'red.warrior' })).toBe(true);
      const bleedingBefore = getCharacterEffects({ state: state.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleedingBefore.data.remainingTurns).toBe(3);

      const afterGreenTurn = decrementBleedingForFaction({ state: state.state, factionId: FACTION_IDS.GREEN });
      const bleedingAfter = getCharacterEffects({ state: afterGreenTurn, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleedingAfter.data.remainingTurns).toBe(3);
    });

    test('fin de turno de SU facción: 3→2', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      const afterRedTurn = decrementBleedingForFaction({ state: state.state, factionId: FACTION_IDS.RED });
      const bleeding = getCharacterEffects({ state: afterRedTurn, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleeding.data.remainingTurns).toBe(2);
    });

    test('siguiente turno propio: 2→1', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      state = decrementBleedingForFaction({ state: state.state, factionId: FACTION_IDS.RED });
      state = decrementBleedingForFaction({ state, factionId: FACTION_IDS.RED });
      const bleeding = getCharacterEffects({ state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleeding.data.remainingTurns).toBe(1);
    });

    test('siguiente turno propio: 1→muerte y HOME', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      state = decrementBleedingForFaction({ state: state.state, factionId: FACTION_IDS.RED });
      state = decrementBleedingForFaction({ state, factionId: FACTION_IDS.RED });
      state = decrementBleedingForFaction({ state, factionId: FACTION_IDS.RED });

      const character = getCharacter(state, 'red.warrior');
      expect(character.position).toEqual({ type: 'home' });
      expect(isCharacterBleeding({ state, characterId: 'red.warrior' })).toBe(false);
      expect(state.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_DIED,
        cause: 'bleeding',
        characterId: 'red.warrior',
      }));
    });

    test('muerte por Bleeding NO genera captura ni +20', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
        'blue.hunter': createCommonPosition(20),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      state = decrementBleedingForFaction({ state: state.state, factionId: FACTION_IDS.RED });
      state = decrementBleedingForFaction({ state, factionId: FACTION_IDS.RED });
      state = decrementBleedingForFaction({ state, factionId: FACTION_IDS.RED });

      expect(state.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
      }));
      expect(state.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.REWARD_LOST,
      }));
    });
  });

  describe('curación SAFE', () => {
    test('terminar movimiento en SAFE cura Bleeding', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(isCharacterBleeding({ state: state.state, characterId: 'red.warrior' })).toBe(true);

      state = setPositions(state.state, {
        'red.warrior': createCommonPosition(19),
      });
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 3,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(isCharacterBleeding({ state: result.state, characterId: 'red.warrior' })).toBe(false);
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(22));
    });

    test('pasar por SAFE sin terminar allí NO cura', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(isCharacterBleeding({ state: state.state, characterId: 'red.warrior' })).toBe(true);

      state = setPositions(state.state, {
        'red.warrior': createCommonPosition(14),
      });
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(isCharacterBleeding({ state: result.state, characterId: 'red.warrior' })).toBe(true);
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(18));
    });
  });

  describe('segunda Trampa sobre ficha ya sangrando', () => {
    test('detiene, consume Trampa, NO reinicia remainingTurns, NO crea segundo Bleeding', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      state = decrementBleedingForFaction({ state: state.state, factionId: FACTION_IDS.RED });
      state = decrementBleedingForFaction({ state, factionId: FACTION_IDS.RED });
      const bleedingBefore = getCharacterEffects({ state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleedingBefore.data.remainingTurns).toBe(1);

      state = addTrap(state, createCommonPosition(15));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 2,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(15));
      expect(result.state.terrainEffectsByPositionKey['common:15']).toBeUndefined();
      const bleedingAfter = getCharacterEffects({ state: result.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleedingAfter).toBeTruthy();
      expect(bleedingAfter.data.remainingTurns).toBe(1);
      expect(getCharacterEffects({ state: result.state, characterId: 'red.warrior' }).filter(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      )).toHaveLength(1);
    });
  });

  describe('evaluation / availableActions / revalidación no mutan Bleeding', () => {
    test('evaluateMovement no consume Bleeding', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(isCharacterBleeding({ state: state.state, characterId: 'red.warrior' })).toBe(true);
      const before = getCharacterEffects({ state: state.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );

      evaluate(state.state, 'red.warrior', 4);

      const after = getCharacterEffects({ state: state.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(after.data.remainingTurns).toBe(before.data.remainingTurns);
    });

    test('getMovableCharacters no consume Bleeding', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      const before = getCharacterEffects({ state: state.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );

      getMovableCharacters({
        factionId: FACTION_IDS.RED,
        steps: 4,
        characters: getCharactersFromState(state.state),
        gameState: state.state,
      });

      const after = getCharacterEffects({ state: state.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(after.data.remainingTurns).toBe(before.data.remainingTurns);
    });

    test('revalidateAction no consume Bleeding', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      const characters = getCharactersFromState(state.state);
      const before = getCharacterEffects({ state: state.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );

      revalidateAction({
        state: state.state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
        characters,
      });

      const after = getCharacterEffects({ state: state.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(after.data.remainingTurns).toBe(before.data.remainingTurns);
    });
  });

  describe('movimiento base ilegal no activa ni consume Trampa', () => {
    test('barrera posterior invalida movimiento antes de Trampa', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(9),
        'green.ranger': createCommonPosition(14),
        'green.archer': createCommonPosition(14),
      });
      state = addTrap(state, createCommonPosition(12));
      const movement = evaluate(state, 'red.warrior', 5);

      expect(movement.legal).toBe(false);
      expect(movement.reason).toBe('barrier');
      expect(state.terrainEffectsByPositionKey['common:12']).toHaveLength(1);
      expect(isCharacterBleeding({ state, characterId: 'red.warrior' })).toBe(false);
    });
  });

  describe('Montaraz atraviesa barreras pero activa Trampa', () => {
    test('Montaraz pasa barrera y se detiene en Trampa enemiga', () => {
      let state = setPositions(createState(), {
        'green.ranger': createCommonPosition(9),
        'green.druid': createCommonPosition(40),
        'green.archer': createCommonPosition(41),
        'green.fairy': createCommonPosition(42),
        'red.warrior': createCommonPosition(10),
        'red.blacksmith': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(11));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.GREEN,
        roll: 5,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'green.ranger' },
      });

      expect(getCharacter(result.state, 'green.ranger').position).toEqual(createCommonPosition(11));
      expect(isCharacterBleeding({ state: result.state, characterId: 'green.ranger' })).toBe(true);
    });
  });

  describe('muerte por Bleeding y reset de nueva vida (Druida)', () => {
    test('Druida con Bleeding remainingTurns=1 muere por Bleeding: HOME, recupera cargas, Enredaderas desaparecen, sin +20', () => {
      let state = setPositions(createState(), {
        'green.druid': createCommonPosition(10),
        'green.ranger': createCommonPosition(40),
        'green.archer': createCommonPosition(41),
        'green.fairy': createCommonPosition(42),
        'red.hunter': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      state = executeAction({
        state,
        factionId: FACTION_IDS.GREEN,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'green.druid' },
      });

      state = decrementBleedingForFaction({ state: state.state, factionId: FACTION_IDS.GREEN });
      state = decrementBleedingForFaction({ state, factionId: FACTION_IDS.GREEN });
      state = decrementBleedingForFaction({ state, factionId: FACTION_IDS.GREEN });

      const druidBefore = getCharacter(state, 'green.druid');
      expect(druidBefore.position.type).toBe('home');
      expect(isCharacterBleeding({ state, characterId: 'green.druid' })).toBe(false);

      expect(getCharacterAbilityState({
        state,
        characterId: 'green.druid',
        abilityId: ABILITY_IDS.DRUID_VINES,
      }).charges).toBe(2);

      expect(state.terrainEffectsByPositionKey).toEqual({});

      expect(state.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.REWARD_LOST,
      }));
      expect(state.events).not.toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
        capturedCharacterId: 'green.druid',
      }));
    });
  });

  describe('aplicación de Bleeding durante turno propio no decrementa en ese mismo turno', () => {
    test('si Bleeding se aplica durante turno de la facción afectada, no pierde contador hasta el siguiente fin de turno', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addTrap(state, createCommonPosition(13));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(isCharacterBleeding({ state: result.state, characterId: 'red.warrior' })).toBe(true);
      const bleeding = getCharacterEffects({ state: result.state, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleeding.data.remainingTurns).toBe(3);

      const afterSameFactionTurn = decrementBleedingForFaction({ state: result.state, factionId: FACTION_IDS.RED });
      const bleedingAfter = getCharacterEffects({ state: afterSameFactionTurn, characterId: 'red.warrior' }).find(
        (e) => e.type === CHARACTER_STATUS_TYPES.BLEEDING,
      );
      expect(bleedingAfter.data.remainingTurns).toBe(2);
    });
  });
});
