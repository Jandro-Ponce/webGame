import { getFactionIds } from '../factions/factions';
import { createCounterclockwiseTurnOrder } from '../gameFlow/playerOrder';
import { SETUP_PHASES } from './types';

function isNonEmptyValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function assertArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
}

export function assertValidSetupPlayers(players) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
    throw new Error('Game setup requires 2, 3, or 4 players.');
  }

  const playerIds = new Set();

  players.forEach((player) => {
    if (!player || typeof player !== 'object' || Array.isArray(player)) {
      throw new Error('Every setup player must be an object.');
    }

    if (!isNonEmptyValue(player.id)) {
      throw new Error('Every setup player requires an id.');
    }

    if (playerIds.has(player.id)) {
      throw new Error(`Duplicate setup player id: ${player.id}`);
    }

    playerIds.add(player.id);
  });
}

function assertNoDuplicateOrderPlayers(playerOrder) {
  const seenPlayerIds = new Set();

  playerOrder.forEach((playerId) => {
    if (seenPlayerIds.has(playerId)) {
      throw new Error(`Player order cannot contain duplicate players: ${playerId}`);
    }

    seenPlayerIds.add(playerId);
  });
}

export function assertPlayerOrderMatchesSetupPlayers({ players, playerOrder, label }) {
  assertArray(playerOrder, `${label} must be an array.`);

  if (playerOrder.length !== players.length) {
    throw new Error(`${label} must contain exactly the setup players.`);
  }

  assertNoDuplicateOrderPlayers(playerOrder);

  const setupPlayerIds = players.map((player) => player.id);

  playerOrder.forEach((playerId) => {
    if (!setupPlayerIds.includes(playerId)) {
      throw new Error(`${label} contains an unknown player: ${playerId}`);
    }
  });

  setupPlayerIds.forEach((playerId) => {
    if (!playerOrder.includes(playerId)) {
      throw new Error(`${label} is missing setup player: ${playerId}`);
    }
  });
}

function assertFactionChoices({ setupState, choices }) {
  assertArray(choices, 'setupState.factionChoices must be an array.');

  if (choices.length > setupState.players.length) {
    throw new Error('setupState.factionChoices cannot contain more choices than setup players.');
  }

  const playerIds = setupState.players.map((player) => player.id);
  const validFactionIds = getFactionIds();
  const chosenPlayerIds = new Set();
  const chosenFactionIds = new Set();

  choices.forEach((choice, index) => {
    if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
      throw new Error(`setupState.factionChoices[${index}] must be an object.`);
    }

    if (!playerIds.includes(choice.playerId)) {
      throw new Error(`Faction choice contains an unknown player: ${choice.playerId}`);
    }

    if (chosenPlayerIds.has(choice.playerId)) {
      throw new Error(`Player has already chosen a faction: ${choice.playerId}`);
    }

    if (!validFactionIds.includes(choice.factionId)) {
      throw new Error(`Invalid faction id: ${choice.factionId}`);
    }

    if (chosenFactionIds.has(choice.factionId)) {
      throw new Error(`Faction has already been chosen: ${choice.factionId}`);
    }

    if (Array.isArray(setupState.factionSelectionOrder)) {
      const expectedPlayerId = setupState.factionSelectionOrder[index];

      if (choice.playerId !== expectedPlayerId) {
        throw new Error(`Faction choice is out of selection order for player: ${choice.playerId}`);
      }
    }

    chosenPlayerIds.add(choice.playerId);
    chosenFactionIds.add(choice.factionId);
  });
}

function assertSetupShapeForPhase(setupState) {
  const assertNoStartingFaction = () => {
    if (setupState.startingFactionId !== null) {
      throw new Error('startingFactionId must be null before the starting faction draw.');
    }
  };

  if (setupState.phase === SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER) {
    assertNoStartingFaction();
    if (setupState.factionSelectionOrder !== null) {
      throw new Error('factionSelectionOrder must be null while waiting for faction selection order.');
    }

    if (setupState.factionChoices.length !== 0) {
      throw new Error('factionChoices must be empty while waiting for faction selection order.');
    }

    if (setupState.turnOrder !== null) {
      throw new Error('turnOrder must be null while waiting for faction selection order.');
    }

    return;
  }

  assertPlayerOrderMatchesSetupPlayers({
    players: setupState.players,
    playerOrder: setupState.factionSelectionOrder,
    label: 'factionSelectionOrder',
  });

  if (setupState.phase === SETUP_PHASES.CHOOSING_FACTIONS) {
    assertNoStartingFaction();
    if (setupState.factionChoices.length >= setupState.players.length) {
      throw new Error('factionChoices must be incomplete while choosing factions.');
    }

    if (setupState.turnOrder !== null) {
      throw new Error('turnOrder must be null while choosing factions.');
    }

    return;
  }

  if (setupState.factionChoices.length !== setupState.players.length) {
    throw new Error('factionChoices must contain exactly one choice per setup player.');
  }

  if (setupState.phase === SETUP_PHASES.WAITING_FOR_TURN_ORDER) {
    assertNoStartingFaction();
    if (setupState.turnOrder !== null) {
      throw new Error('turnOrder must be null while waiting for turn order.');
    }

    return;
  }

  assertPlayerOrderMatchesSetupPlayers({
    players: setupState.players,
    playerOrder: setupState.turnOrder,
    label: 'turnOrder',
  });

  const playersWithFactions = setupState.players.map((player) => ({
    ...player,
    factionId: setupState.factionChoices.find((choice) => choice.playerId === player.id).factionId,
  }));
  const expectedTurnOrder = createCounterclockwiseTurnOrder({
    players: playersWithFactions,
    startingFactionId: setupState.startingFactionId,
  });

  if (expectedTurnOrder.some((playerId, index) => setupState.turnOrder[index] !== playerId)) {
    throw new Error('turnOrder must follow the counterclockwise faction order.');
  }
}

export function assertSetupState(setupState) {
  if (!setupState || typeof setupState !== 'object' || Array.isArray(setupState)) {
    throw new Error('setupState must be an object.');
  }

  if (!Object.values(SETUP_PHASES).includes(setupState.phase)) {
    throw new Error(`Invalid setup phase: ${setupState.phase}`);
  }

  assertValidSetupPlayers(setupState.players);
  assertFactionChoices({ setupState, choices: setupState.factionChoices });
  assertSetupShapeForPhase(setupState);
}

export function assertSetupPhase(setupState, phase) {
  assertSetupState(setupState);

  if (setupState.phase !== phase) {
    throw new Error(`Setup phase must be ${phase}.`);
  }
}
