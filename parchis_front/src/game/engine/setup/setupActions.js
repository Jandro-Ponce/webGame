import { getFactionIds } from '../factions/factions';
import { createCounterclockwiseTurnOrder } from '../gameFlow/playerOrder';
import { createInitialGameState } from '../state/initialState';
import { SETUP_PHASES } from './types';
import {
  assertPlayerOrderMatchesSetupPlayers,
  assertSetupPhase,
} from './setupValidation';

function clonePlayer(player) {
  return {
    id: player.id,
    name: player.name,
  };
}

function cloneChoice(choice) {
  return {
    playerId: choice.playerId,
    factionId: choice.factionId,
  };
}

function cloneOrder(order) {
  return order === null ? null : [...order];
}

function cloneSetupState(setupState) {
  return {
    phase: setupState.phase,
    players: setupState.players.map(clonePlayer),
    factionSelectionOrder: cloneOrder(setupState.factionSelectionOrder),
    factionChoices: setupState.factionChoices.map(cloneChoice),
    startingFactionId: setupState.startingFactionId,
    turnOrder: cloneOrder(setupState.turnOrder),
  };
}

function getCurrentSelectionPlayerId(setupState) {
  return setupState.factionSelectionOrder[setupState.factionChoices.length];
}

function assertKnownSetupPlayer({ setupState, playerId }) {
  if (!setupState.players.some((player) => player.id === playerId)) {
    throw new Error(`Unknown setup player: ${playerId}`);
  }
}

function assertFactionCanBeChosen({ setupState, factionId }) {
  if (!getFactionIds().includes(factionId)) {
    throw new Error(`Invalid faction id: ${factionId}`);
  }

  if (setupState.factionChoices.some((choice) => choice.factionId === factionId)) {
    throw new Error(`Faction has already been chosen: ${factionId}`);
  }
}

function assertPlayerCanChooseNow({ setupState, playerId }) {
  assertKnownSetupPlayer({ setupState, playerId });

  if (setupState.factionChoices.some((choice) => choice.playerId === playerId)) {
    throw new Error(`Player has already chosen a faction: ${playerId}`);
  }

  const currentSelectionPlayerId = getCurrentSelectionPlayerId(setupState);

  if (playerId !== currentSelectionPlayerId) {
    throw new Error(`It is not this player's faction selection turn: ${playerId}`);
  }
}

function getFactionIdByPlayerId(setupState) {
  return new Map(setupState.factionChoices.map((choice) => [choice.playerId, choice.factionId]));
}

export function setFactionSelectionOrder({ setupState, playerOrder }) {
  assertSetupPhase(setupState, SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER);
  assertPlayerOrderMatchesSetupPlayers({
    players: setupState.players,
    playerOrder,
    label: 'factionSelectionOrder',
  });

  return {
    ...cloneSetupState(setupState),
    phase: SETUP_PHASES.CHOOSING_FACTIONS,
    factionSelectionOrder: [...playerOrder],
  };
}

export function chooseFaction({ setupState, playerId, factionId }) {
  assertSetupPhase(setupState, SETUP_PHASES.CHOOSING_FACTIONS);
  assertPlayerCanChooseNow({ setupState, playerId });
  assertFactionCanBeChosen({ setupState, factionId });

  const factionChoices = [
    ...setupState.factionChoices.map(cloneChoice),
    { playerId, factionId },
  ];
  const nextPhase = factionChoices.length === setupState.players.length
    ? SETUP_PHASES.WAITING_FOR_TURN_ORDER
    : SETUP_PHASES.CHOOSING_FACTIONS;

  return {
    ...cloneSetupState(setupState),
    phase: nextPhase,
    factionChoices,
  };
}

export function setGameSetupTurnOrder({ setupState, startingFactionId }) {
  assertSetupPhase(setupState, SETUP_PHASES.WAITING_FOR_TURN_ORDER);
  const players = setupState.players.map((player) => ({
    ...player,
    factionId: setupState.factionChoices.find((choice) => choice.playerId === player.id).factionId,
  }));
  const turnOrder = createCounterclockwiseTurnOrder({ players, startingFactionId });

  return {
    ...cloneSetupState(setupState),
    phase: SETUP_PHASES.COMPLETED,
    startingFactionId,
    turnOrder,
  };
}

export function completeGameSetup({ setupState }) {
  assertSetupPhase(setupState, SETUP_PHASES.COMPLETED);

  const factionIdByPlayerId = getFactionIdByPlayerId(setupState);
  const players = setupState.players.map((player) => ({
    id: player.id,
    name: player.name,
    factionId: factionIdByPlayerId.get(player.id),
  }));

  return {
    gameState: createInitialGameState({
      players,
      turnOrder: [...setupState.turnOrder],
      startingFactionId: setupState.startingFactionId,
    }),
  };
}
