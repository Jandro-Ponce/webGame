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
  activateIceMageFreezing,
  applyAbilityStateTransitionsFromEvents,
  applyFrozenStatus,
  createCommonPosition,
  createDruidVinesEffect,
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
  getIceMageFreezingActivationOptions,
  getMovableCharacters,
  getPlayablePositionKey,
  isCharacterFrozen,
  registerTurnRoll,
  resolveConsequences,
} from '../index';
import { revalidateAction } from '../actions/revalidateAction';

function createState() {
  const state = createInitialGameState({
    players: [
      { id: 'player-blue', factionId: FACTION_IDS.BLUE },
      { id: 'player-red', factionId: FACTION_IDS.RED },
      { id: 'player-green', factionId: FACTION_IDS.GREEN },
    ],
    turnOrder: ['player-blue', 'player-red', 'player-green'],
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

function setIceMageCharges(state, charges) {
  return {
    ...state,
    characterStatesById: {
      ...state.characterStatesById,
      'blue.iceMage': {
        ...state.characterStatesById['blue.iceMage'],
        abilityStatesById: {
          ...state.characterStatesById['blue.iceMage'].abilityStatesById,
          [ABILITY_IDS.ICE_MAGE_FREEZING]: { charges },
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

function addIce(state, position, chargeSequence = 2) {
  return addTerrain(state, createIceEffect({
    characterId: 'blue.iceMage',
    factionId: FACTION_IDS.BLUE,
    position,
    chargeSequence,
  }));
}

function addVines(state, position) {
  return addTerrain(state, createDruidVinesEffect({
    characterId: 'green.druid',
    factionId: FACTION_IDS.GREEN,
    position,
  }));
}

function freeze(state, characterId, sourceCharacterId = 'blue.iceMage') {
  return applyFrozenStatus({
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
  characterId = 'blue.iceMage',
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

function getFreezingDecision(state, event = movedEvent()) {
  return resolveConsequences({ state, events: [event] });
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

describe('Ice Mage Congelacion', () => {
  describe('charges and optional activation', () => {
    test('starts with two serializable charges under the stable ability id', () => {
      const state = createState();

      expect(getCharacterAbilityState({
        state,
        characterId: 'blue.iceMage',
        abilityId: ABILITY_IDS.ICE_MAGE_FREEZING,
      })).toEqual({ charges: 2 });
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    });

    test('creates serializable typed Ice and Frozen effects', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addIce(state, createCommonPosition(12));
      state = freeze(state, 'red.warrior');

      expect(state.terrainEffectsByPositionKey['common:12'][0]).toMatchObject({
        type: TERRAIN_EFFECT_TYPES.ICE,
        scope: { type: 'terrain', targetId: 'common:12' },
        source: {
          abilityId: ABILITY_IDS.ICE_MAGE_FREEZING,
          sourceCharacterId: 'blue.iceMage',
          factionId: FACTION_IDS.BLUE,
        },
      });
      expect(getCharacterEffects({ state, characterId: 'red.warrior' })[0]).toMatchObject({
        id: 'frozen:red.warrior',
        type: CHARACTER_STATUS_TYPES.FROZEN,
        scope: { type: 'character', targetId: 'red.warrior' },
      });
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    });

    test('reuses optionalAbilityActivation and spends one charge by authoritative action id', () => {
      const state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(13),
      });
      const pending = getFreezingDecision(state);
      const activate = pending.availableDecisionActions.find(
        (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
      );
      const result = executeDecision({
        state,
        decision: pending.pendingDecision,
        action: { id: activate.id, targetCharacterId: 'red.warrior' },
      });

      expect(pending.status).toBe(CONSEQUENCE_RESOLUTION_STATUS.DECISION_REQUIRED);
      expect(pending.pendingDecision).toMatchObject({
        type: 'optionalAbilityActivation',
        abilityId: ABILITY_IDS.ICE_MAGE_FREEZING,
        characterId: 'blue.iceMage',
        previousPosition: createCommonPosition(12),
      });
      expect(getCharacterAbilityState({
        state: result.state,
        characterId: 'blue.iceMage',
        abilityId: ABILITY_IDS.ICE_MAGE_FREEZING,
      })).toEqual({ charges: 1 });
      expect(result.state.terrainEffectsByPositionKey['common:12']).toHaveLength(1);
    });

    test('does not offer an activation with zero charges or only allies behind', () => {
      const zeroChargeState = setPositions(setIceMageCharges(createState(), 0), {
        'blue.iceMage': createCommonPosition(13),
      });
      const allyState = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(13),
        'blue.hunter': createCommonPosition(12),
      });

      expect(getFreezingDecision(zeroChargeState).status).toBe(
        CONSEQUENCE_RESOLUTION_STATUS.RESOLVED,
      );
      expect(getFreezingDecision(allyState).status).toBe(
        CONSEQUENCE_RESOLUTION_STATUS.RESOLVED,
      );
      expect(isCharacterFrozen({ state: allyState, characterId: 'blue.hunter' })).toBe(false);
    });

    test('offers the same optional activation after an ordinary reward movement', () => {
      const state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(13),
      });

      expect(getFreezingDecision(state, movedEvent({
        movementType: MOVEMENT_TYPES.REWARD,
      }))).toMatchObject({
        status: CONSEQUENCE_RESOLUTION_STATUS.DECISION_REQUIRED,
        pendingDecision: {
          abilityId: ABILITY_IDS.ICE_MAGE_FREEZING,
          movementType: MOVEMENT_TYPES.REWARD,
          previousPosition: createCommonPosition(12),
        },
      });
    });

    test('rejects invalid activation without consuming a charge', () => {
      const state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(13),
        'blue.hunter': createCommonPosition(12),
      });

      expect(() => activateIceMageFreezing({
        state,
        characterId: 'blue.iceMage',
        position: createCommonPosition(13),
        previousPosition: createCommonPosition(12),
      })).toThrow('Ice Mage freezing cannot be activated in the current state.');
      expect(getCharacterAbilityState({
        state,
        characterId: 'blue.iceMage',
        abilityId: ABILITY_IDS.ICE_MAGE_FREEZING,
      }).charges).toBe(2);
    });

    test('capture restores charges and removes only ice created by that Ice Mage', () => {
      let state = setPositions(setIceMageCharges(createState(), 0), {
        'blue.iceMage': createCommonPosition(13),
      });
      state = addIce(state, createCommonPosition(20), 2);
      state = addIce(state, createCommonPosition(21), 1);
      state = addTerrain(state, createIceEffect({
        characterId: 'yellow.iceMage',
        factionId: FACTION_IDS.YELLOW,
        position: createCommonPosition(22),
        chargeSequence: 2,
      }));
      state = freeze(state, 'red.warrior');
      const result = applyAbilityStateTransitionsFromEvents({
        state,
        events: [{
          type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
          characterId: 'red.warrior',
          capturedCharacterId: 'blue.iceMage',
        }],
      });

      expect(getCharacterAbilityState({
        state: result,
        characterId: 'blue.iceMage',
        abilityId: ABILITY_IDS.ICE_MAGE_FREEZING,
      }).charges).toBe(2);
      expect(result.terrainEffectsByPositionKey['common:20']).toBeUndefined();
      expect(result.terrainEffectsByPositionKey['common:21']).toBeUndefined();
      expect(result.terrainEffectsByPositionKey['common:22']).toHaveLength(1);
      expect(isCharacterFrozen({ state: result, characterId: 'red.warrior' })).toBe(true);
    });
  });

  describe('real previous position and direct target', () => {
    test('derives the previous position from the authoritative real movement path', () => {
      const state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(10),
      });
      const movementResult = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.iceMage' },
      });
      const pending = resolveConsequences({
        state: movementResult.state,
        events: movementResult.events,
      });

      expect(movementResult.events[0].previousPosition).toEqual(createCommonPosition(13));
      expect(pending.pendingDecision.previousPosition).toEqual(createCommonPosition(13));
    });

    test('uses the origin as the real previous position for a one-step movement', () => {
      const state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(10),
      });
      const movementResult = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 1,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.iceMage' },
      });
      const pending = resolveConsequences({
        state: movementResult.state,
        events: movementResult.events,
      });

      expect(getCharacter(movementResult.state, 'blue.iceMage').position).toEqual(
        createCommonPosition(11),
      );
      expect(pending.pendingDecision.previousPosition).toEqual(createCommonPosition(10));
    });

    test('uses the truncated real path when terrain interrupted the Ice Mage', () => {
      let state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(10),
      });
      state = addVines(state, createCommonPosition(12));
      const movementResult = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.iceMage' },
      });
      const pending = resolveConsequences({
        state: movementResult.state,
        events: movementResult.events,
      });

      expect(getCharacter(movementResult.state, 'blue.iceMage').position).toEqual(
        createCommonPosition(12),
      );
      expect(pending.pendingDecision.previousPosition).toEqual(createCommonPosition(11));
    });

    test('freezes the unique enemy directly without movement, capture, reward, or ice', () => {
      const state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(13),
        'red.warrior': createCommonPosition(12),
      });
      const pending = getFreezingDecision(state);
      const activate = pending.availableDecisionActions.find(
        (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
      );
      const result = executeDecision({ state, decision: pending.pendingDecision, action: activate });

      expect(activate.targetCharacterId).toBe('red.warrior');
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(12));
      expect(isCharacterFrozen({ state: result.state, characterId: 'red.warrior' })).toBe(true);
      expect(result.state.terrainEffectsByPositionKey['common:12']).toBeUndefined();
      expect(result.events.map((event) => event.type)).toEqual([
        EXECUTION_EVENT_TYPES.ABILITY_ACTIVATED,
      ]);
    });

    test('targets the single enemy when an ally shares its SAFE square', () => {
      const state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(13),
        'blue.hunter': createCommonPosition(12),
        'red.warrior': createCommonPosition(12),
      });

      expect(getIceMageFreezingActivationOptions({
        state,
        characterId: 'blue.iceMage',
        position: createCommonPosition(13),
        previousPosition: createCommonPosition(12),
      })).toEqual([{ targetCharacterId: 'red.warrior' }]);
    });

    test('offers one authoritative activation per enemy when two enemies share SAFE', () => {
      const state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(13),
        'red.warrior': createCommonPosition(12),
        'green.ranger': createCommonPosition(12),
      });
      const pending = getFreezingDecision(state);
      const activateActions = pending.availableDecisionActions.filter(
        (action) => action.type === OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE,
      );
      const selected = activateActions.find((action) => action.targetCharacterId === 'green.ranger');
      const result = executeDecision({ state, decision: pending.pendingDecision, action: selected });

      expect(activateActions.map((action) => action.targetCharacterId)).toEqual([
        'red.warrior',
        'green.ranger',
      ]);
      expect(new Set(activateActions.map((action) => action.id)).size).toBe(2);
      expect(isCharacterFrozen({ state: result.state, characterId: 'green.ranger' })).toBe(true);
      expect(isCharacterFrozen({ state: result.state, characterId: 'red.warrior' })).toBe(false);
    });
  });

  describe('ice terrain traversal', () => {
    test('an ally passes through ice without triggering or consuming it', () => {
      let state = setPositions(createState(), {
        'blue.hunter': createCommonPosition(10),
      });
      state = addIce(state, createCommonPosition(12));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'blue.hunter' },
      });

      expect(getCharacter(result.state, 'blue.hunter').position).toEqual(createCommonPosition(14));
      expect(result.state.terrainEffectsByPositionKey['common:12']).toHaveLength(1);
      expect(isCharacterFrozen({ state: result.state, characterId: 'blue.hunter' })).toBe(false);
    });

    test('an enemy stops on ice, becomes Frozen, and consumes only that ice', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addIce(state, createCommonPosition(12));
      state = addIce(state, createCommonPosition(15), 1);
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(12));
      expect(result.state.terrainEffectsByPositionKey['common:12']).toBeUndefined();
      expect(result.state.terrainEffectsByPositionKey['common:15']).toHaveLength(1);
      expect(isCharacterFrozen({ state: result.state, characterId: 'red.warrior' })).toBe(true);
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.TERRAIN_EFFECT_TRIGGERED,
        effectType: TERRAIN_EFFECT_TYPES.ICE,
        characterId: 'red.warrior',
      }));
    });

    test('movementReward activates ice without reducing its twenty requested steps', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addIce(state, createCommonPosition(15));
      const reward = captureReward();
      const availability = getAvailableRewardActions({ state, reward });
      const action = availability.availableActions.find(
        (candidate) => candidate.characterId === 'red.warrior',
      );
      const result = executeRewardAction({ state, reward, action });

      expect(action.steps).toBe(20);
      expect(action.movement.path).toHaveLength(5);
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(15));
      expect(isCharacterFrozen({ state: result.state, characterId: 'red.warrior' })).toBe(true);
    });

    test('a later barrier makes reward illegal before ice can resolve', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(9),
        'green.ranger': createCommonPosition(28),
        'green.archer': createCommonPosition(28),
      });
      state = addIce(state, createCommonPosition(23));
      const availability = getAvailableRewardActions({ state, reward: captureReward() });

      expect(availability).toMatchObject({
        status: REWARD_STATUS.LOST,
        availableActions: [],
        reason: REWARD_LOST_REASONS.NO_LEGAL_RECIPIENT,
      });
      expect(state.terrainEffectsByPositionKey['common:23']).toHaveLength(1);
      expect(isCharacterFrozen({ state, characterId: 'red.warrior' })).toBe(false);
    });

    test('Ranger passes an intermediate barrier but still triggers later enemy ice', () => {
      let state = setPositions(createState(), {
        'green.ranger': createCommonPosition(9),
        'green.druid': createCommonPosition(40),
        'green.archer': createCommonPosition(41),
        'green.fairy': createCommonPosition(42),
        'red.warrior': createCommonPosition(10),
        'red.blacksmith': createCommonPosition(10),
      });
      state = addIce(state, createCommonPosition(11));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.GREEN,
        roll: 5,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'green.ranger' },
      });

      expect(getCharacter(result.state, 'green.ranger').position).toEqual(createCommonPosition(11));
      expect(isCharacterFrozen({ state: result.state, characterId: 'green.ranger' })).toBe(true);
    });

    test('only the first hostile terrain effect on the path resolves', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = addVines(state, createCommonPosition(12));
      state = addIce(state, createCommonPosition(13));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(12));
      expect(isCharacterFrozen({ state: result.state, characterId: 'red.warrior' })).toBe(false);
      expect(result.state.terrainEffectsByPositionKey['common:13']).toHaveLength(1);
    });
  });

  describe('Frozen movement modifier', () => {
    test.each([
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
      [5, 3],
      [6, 3],
    ])('maps normal roll %i to %i movement steps', (roll, effectiveSteps) => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = freeze(state, 'red.warrior');

      expect(evaluate(state, 'red.warrior', roll)).toMatchObject({
        legal: true,
        destination: createCommonPosition(10 + effectiveSteps),
        path: Array.from({ length: effectiveSteps }, (_, index) => createCommonPosition(11 + index)),
        usedStatusEffectIds: [`${CHARACTER_STATUS_TYPES.FROZEN}:red.warrior`],
      });
    });

    test('consumes Frozen only when the modified normal movement executes', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = freeze(state, 'red.warrior');
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(12));
      expect(isCharacterFrozen({ state: result.state, characterId: 'red.warrior' })).toBe(false);
    });

    test('availability and authoritative revalidation remain pure', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = freeze(state, 'red.warrior');
      const characters = getCharactersFromState(state);

      expect(getMovableCharacters({
        factionId: FACTION_IDS.RED,
        steps: 4,
        characters,
        gameState: state,
      }).movableCharacters).toHaveLength(1);
      expect(revalidateAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
        characters,
      }).movement.destination).toEqual(createCommonPosition(12));
      expect(isCharacterFrozen({ state, characterId: 'red.warrior' })).toBe(true);
    });

    test('reward movement remains twenty steps and leaves Frozen pending', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = freeze(state, 'red.warrior');
      const reward = captureReward();
      const availability = getAvailableRewardActions({ state, reward });
      const action = availability.availableActions.find(
        (candidate) => candidate.characterId === 'red.warrior',
      );
      const result = executeRewardAction({ state, reward, action });

      expect(action.movement.destination).toEqual(createCommonPosition(30));
      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(30));
      expect(isCharacterFrozen({ state: result.state, characterId: 'red.warrior' })).toBe(true);
    });

    test.each([MOVEMENT_TYPES.FORCED_DISPLACEMENT, MOVEMENT_TYPES.SPECIAL_TRAVERSAL])(
      '%s neither reduces movement nor consumes Frozen during evaluation',
      (movementType) => {
        let state = setPositions(createState(), {
          'red.warrior': createCommonPosition(10),
        });
        state = freeze(state, 'red.warrior');

        expect(evaluate(state, 'red.warrior', 4, movementType)).toMatchObject({
          destination: createCommonPosition(14),
          path: [
            createCommonPosition(11),
            createCommonPosition(12),
            createCommonPosition(13),
            createCommonPosition(14),
          ],
        });
        expect(evaluate(state, 'red.warrior', 4, movementType).usedStatusEffectIds).toBeUndefined();
        expect(isCharacterFrozen({ state, characterId: 'red.warrior' })).toBe(true);
      },
    );

    test('does not stack Frozen and reapplies it after consuming the old status on ice', () => {
      let state = setPositions(createState(), {
        'red.warrior': createCommonPosition(10),
      });
      state = freeze(state, 'red.warrior');
      const sameState = freeze(state, 'red.warrior', 'blue.hunter');

      expect(sameState).toBe(state);
      expect(getCharacterEffects({ state, characterId: 'red.warrior' })).toHaveLength(1);

      state = addIce(state, createCommonPosition(11));
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 4,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior' },
      });

      expect(getCharacter(result.state, 'red.warrior').position).toEqual(createCommonPosition(11));
      expect(getCharacterEffects({ state: result.state, characterId: 'red.warrior' })).toHaveLength(1);
    });

    test('original six still controls turn rules while Frozen moves three', () => {
      let state = setPositions(createState(), {
        'blue.iceMage': createCommonPosition(10),
      });
      state = freeze(state, 'blue.iceMage', 'green.druid');
      const rolled = registerTurnRoll({
        state,
        turnState: createTurnState({ playerId: 'player-blue', factionId: FACTION_IDS.BLUE }),
        roll: 6,
      });
      const action = rolled.turnState.availableActions.find(
        (candidate) => candidate.characterId === 'blue.iceMage',
      );
      const result = executeTurnAction({ state, turnState: rolled.turnState, action });

      expect(action.movement.destination).toEqual(createCommonPosition(13));
      expect(result.turnState.currentRoll).toBe(6);
      expect(result.turnState.consecutiveSixes).toBe(1);
      expect(result.turnState.diceMoveHistory).toEqual([expect.objectContaining({ roll: 6 })]);
      expect(result.events[0]).toMatchObject({
        steps: 6,
        source: { type: MOVEMENT_SOURCE_TYPES.DICE, roll: 6 },
        to: createCommonPosition(13),
      });
      expect(isCharacterFrozen({ state: result.state, characterId: 'blue.iceMage' })).toBe(false);
      expect(result.turnState.phase).toBe(TURN_PHASES.WAITING_FOR_DECISION);
    });

    test('EXIT_HOME does not consume Frozen', () => {
      let state = freeze(createState(), 'blue.iceMage', 'green.druid');
      const result = executeAction({
        state,
        factionId: FACTION_IDS.BLUE,
        roll: 5,
        action: { type: EXECUTABLE_ACTION_TYPES.EXIT_HOME, characterId: 'blue.iceMage' },
      });

      expect(isCharacterFrozen({ state: result.state, characterId: 'blue.iceMage' })).toBe(true);
    });

    test('Frozen Assassin still applies SAFE capture after modified movement', () => {
      let state = setPositions(createState(), {
        'red.assassin': createCommonPosition(10),
        'blue.hunter': createCommonPosition(12),
      });
      state = freeze(state, 'red.assassin');
      const result = executeAction({
        state,
        factionId: FACTION_IDS.RED,
        roll: 3,
        action: { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.assassin' },
      });

      expect(getCharacter(result.state, 'red.assassin').position).toEqual(createCommonPosition(12));
      expect(getCharacter(result.state, 'blue.hunter').position).toEqual({ type: 'home' });
      expect(result.events).toContainEqual(expect.objectContaining({
        type: EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED,
        capturedCharacterId: 'blue.hunter',
      }));
      expect(evaluate(state, 'red.assassin', 3).outcome).toEqual({
        type: DESTINATION_OUTCOME_TYPES.CAPTURE,
        capturedCharacterId: 'blue.hunter',
      });
    });
  });
});
