import { SETUP_PHASES } from './types';
import { assertValidSetupPlayers } from './setupValidation';

function normalizePlayer(player) {
  return {
    id: player.id,
    name: player.name || player.id,
  };
}

export function createGameSetup({ players }) {
  assertValidSetupPlayers(players);

  return {
    phase: SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER,
    players: players.map(normalizePlayer),
    factionSelectionOrder: null,
    factionChoices: [],
    startingFactionId: null,
    turnOrder: null,
  };
}
