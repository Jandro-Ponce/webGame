import { useReducer } from 'react';
import * as Engine from '../engine';
import { pickRandomItem } from '../utils/pickRandomItem';
import { shufflePlayerIds } from '../utils/shufflePlayerIds';

export const LOCAL_SETUP_PLAYERS = Object.freeze([
  Object.freeze({ id: 'player-a', name: 'Player A' }),
  Object.freeze({ id: 'player-b', name: 'Player B' }),
  Object.freeze({ id: 'player-c', name: 'Player C' }),
  Object.freeze({ id: 'player-d', name: 'Player D' }),
]);

export const VISUAL_FACTION_ORDER = Object.freeze([
  Engine.FACTION_IDS.GREEN,
  Engine.FACTION_IDS.RED,
  Engine.FACTION_IDS.BLUE,
  Engine.FACTION_IDS.YELLOW,
]);

const ACTION_TYPES = Object.freeze({
  SET_PLAYER_COUNT: 'setPlayerCount',
  SORT_FACTION_SELECTION_ORDER: 'sortFactionSelectionOrder',
  CHOOSE_FACTION: 'chooseFaction',
  DRAW_STARTING_FACTION: 'drawStartingFaction',
});

function createPlayers(playerCount) {
  return LOCAL_SETUP_PLAYERS.slice(0, playerCount).map((player) => ({ ...player }));
}

function createSetupState(playerCount) {
  return Engine.createGameSetup({ players: createPlayers(playerCount) });
}

function createInitialState() {
  const playerCount = 2;

  return {
    playerCount,
    setupState: createSetupState(playerCount),
  };
}

function assertCanChangePlayerCount(setupState) {
  if (setupState.phase !== Engine.SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER) {
    throw new Error('Player count can only be changed before sorting faction selection order.');
  }
}

function gameSetupReducer(state, action) {
  if (action.type === ACTION_TYPES.SET_PLAYER_COUNT) {
    assertCanChangePlayerCount(state.setupState);

    return {
      playerCount: action.playerCount,
      setupState: createSetupState(action.playerCount),
    };
  }

  if (action.type === ACTION_TYPES.SORT_FACTION_SELECTION_ORDER) {
    const playerOrder = action.shuffle(state.setupState.players.map((player) => player.id));

    return {
      ...state,
      setupState: Engine.setFactionSelectionOrder({
        setupState: state.setupState,
        playerOrder,
      }),
    };
  }

  if (action.type === ACTION_TYPES.CHOOSE_FACTION) {
    return {
      ...state,
      setupState: Engine.chooseFaction({
        setupState: state.setupState,
        playerId: action.playerId,
        factionId: action.factionId,
      }),
    };
  }

  if (action.type === ACTION_TYPES.DRAW_STARTING_FACTION) {
    const factionIds = state.setupState.factionChoices.map((choice) => choice.factionId);
    const startingFactionId = action.pick(factionIds);

    return {
      ...state,
      setupState: Engine.setGameSetupTurnOrder({
        setupState: state.setupState,
        startingFactionId,
      }),
    };
  }

  throw new Error(`Unknown game setup action: ${action.type}`);
}

function getChoiceByPlayerId(setupState) {
  return setupState.factionChoices.reduce((choices, choice) => ({
    ...choices,
    [choice.playerId]: choice.factionId,
  }), {});
}

function getAvailableFactions(setupState) {
  const chosenFactionIds = setupState.factionChoices.map((choice) => choice.factionId);

  return VISUAL_FACTION_ORDER.map((factionId) => Engine.FACTIONS.find((faction) => faction.id === factionId))
    .filter(Boolean)
    .map((faction) => ({
      ...faction,
      available: !chosenFactionIds.includes(faction.id),
    }));
}

function getCurrentSelectionPlayer(setupState) {
  if (setupState.phase !== Engine.SETUP_PHASES.CHOOSING_FACTIONS) {
    return null;
  }

  const playerId = setupState.factionSelectionOrder[setupState.factionChoices.length];

  return setupState.players.find((player) => player.id === playerId) || null;
}

export function useGameSetup({ shuffle = shufflePlayerIds, pick = pickRandomItem } = {}) {
  const [state, dispatch] = useReducer(gameSetupReducer, undefined, createInitialState);
  const { setupState, playerCount } = state;

  return {
    playerCount,
    setupState,
    players: setupState.players,
    currentSelectionPlayer: getCurrentSelectionPlayer(setupState),
    factionChoiceByPlayerId: getChoiceByPlayerId(setupState),
    availableFactions: getAvailableFactions(setupState),
    canChangePlayerCount: setupState.phase === Engine.SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER,
    setPlayerCount(playerCountValue) {
      dispatch({ type: ACTION_TYPES.SET_PLAYER_COUNT, playerCount: playerCountValue });
    },
    sortFactionSelectionOrder() {
      dispatch({ type: ACTION_TYPES.SORT_FACTION_SELECTION_ORDER, shuffle });
    },
    chooseFaction({ playerId, factionId }) {
      dispatch({ type: ACTION_TYPES.CHOOSE_FACTION, playerId, factionId });
    },
    drawStartingFaction() {
      dispatch({ type: ACTION_TYPES.DRAW_STARTING_FACTION, pick });
    },
  };
}

export default useGameSetup;
