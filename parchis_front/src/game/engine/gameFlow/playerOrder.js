import { FACTION_IDS } from '../factions/factions';

export const COUNTERCLOCKWISE_FACTION_ORDER = Object.freeze([
  FACTION_IDS.YELLOW,
  FACTION_IDS.BLUE,
  FACTION_IDS.RED,
  FACTION_IDS.GREEN,
]);

export function createCounterclockwiseTurnOrder({ players, startingFactionId }) {
  if (!Array.isArray(players)) {
    throw new Error('players must be an array.');
  }

  const playerByFactionId = new Map(players.map((player) => [player.factionId, player]));

  if (playerByFactionId.size !== players.length) {
    throw new Error('Players must have unique faction ids.');
  }

  if (!playerByFactionId.has(startingFactionId)) {
    throw new Error(`Starting faction is not participating: ${startingFactionId}`);
  }

  const startingIndex = COUNTERCLOCKWISE_FACTION_ORDER.indexOf(startingFactionId);

  if (startingIndex === -1 || players.some((player) => !COUNTERCLOCKWISE_FACTION_ORDER.includes(player.factionId))) {
    throw new Error('Players must use valid faction ids.');
  }

  return COUNTERCLOCKWISE_FACTION_ORDER
    .map((_, offset) => COUNTERCLOCKWISE_FACTION_ORDER[(startingIndex + offset) % COUNTERCLOCKWISE_FACTION_ORDER.length])
    .filter((factionId) => playerByFactionId.has(factionId))
    .map((factionId) => playerByFactionId.get(factionId).id);
}

export function getCurrentPlayer(gameState) {
  if (!gameState || !Array.isArray(gameState.players)) {
    throw new Error('gameState must be a GameState with players.');
  }

  const player = gameState.players.find((candidate) => candidate.id === gameState.currentPlayerId);

  if (!player) {
    throw new Error(`currentPlayerId does not match a player: ${gameState.currentPlayerId}`);
  }

  return player;
}

export function getNextPlayerId(gameState) {
  if (!Array.isArray(gameState.turnOrder)) {
    throw new Error('gameState.turnOrder must be an array.');
  }

  const currentIndex = gameState.turnOrder.indexOf(gameState.currentPlayerId);

  if (currentIndex === -1) {
    throw new Error(`currentPlayerId is not present in turnOrder: ${gameState.currentPlayerId}`);
  }

  return gameState.turnOrder[(currentIndex + 1) % gameState.turnOrder.length];
}
