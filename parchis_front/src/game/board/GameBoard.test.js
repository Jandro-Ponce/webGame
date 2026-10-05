import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CHARACTER_STATUS_TYPES, createDruidVinesEffect, createFrozenStatus, createIceEffect, EXECUTABLE_ACTION_TYPES, FACTION_IDS, GAME_PHASES, POSITION_TYPES, SAFE_SQUARES, START_SQUARE_BY_FACTION, TERRAIN_EFFECT_TYPES, TURN_PHASES } from '../engine';
import { GameBoard } from './GameBoard';
import { CLASSIC_GOAL, getClassicCommonCellById, getClassicFinalLaneCellsForFaction, getClassicHomeZone } from './classicBoardGeometry';
import { getCharacterSlotCoordinate, getHomeSlots, getTokenBounds } from './boardGeometry';
import { getTerrainEffectRenderer } from './terrain/terrainVisualRegistry';

function createCharacter({ id, characterId, name, factionId, position, ...rest }) {
  return { id, characterId, name, factionId, position, ...rest };
}

function createPlayer({ id, name, factionId, characters }) {
  return { id, name, factionId, characters };
}

function createGameState(players, overrides = {}) {
  return {
    phase: GAME_PHASES.IN_PROGRESS,
    players,
    turnOrder: players.map((player) => player.id),
    currentPlayerId: players[0].id,
    winnerPlayerId: null,
    terrainEffectsByPositionKey: {},
    ...overrides,
  };
}

function createTurnState(overrides = {}) {
  return {
    playerId: 'player-a',
    factionId: FACTION_IDS.RED,
    phase: TURN_PHASES.WAITING_FOR_ACTION,
    consecutiveSixes: 0,
    currentRoll: 5,
    availableActions: [],
    pendingDecision: null,
    availableDecisionActions: [],
    ...overrides,
  };
}

function createPlayers(count = 2) {
  const players = [
    createPlayer({
      id: 'player-a',
      name: 'Player A',
      factionId: FACTION_IDS.RED,
      characters: [
        createCharacter({ id: 'red.fireMage', characterId: 'fireMage', name: 'Mago de fuego', factionId: FACTION_IDS.RED, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'red.warrior', characterId: 'warrior', name: 'Guerrero', factionId: FACTION_IDS.RED, position: { type: POSITION_TYPES.COMMON, square: 5 } }),
        createCharacter({ id: 'red.blacksmith', characterId: 'blacksmith', name: 'Herrero', factionId: FACTION_IDS.RED, position: { type: POSITION_TYPES.FINAL_LANE, factionId: FACTION_IDS.RED, index: 3 } }),
        createCharacter({ id: 'red.assassin', characterId: 'assassin', name: 'Asesino', factionId: FACTION_IDS.RED, position: { type: POSITION_TYPES.GOAL } }),
      ],
    }),
    createPlayer({
      id: 'player-b',
      name: 'Player B',
      factionId: FACTION_IDS.BLUE,
      characters: [
        createCharacter({ id: 'blue.iceMage', characterId: 'iceMage', name: 'Mago de hielo', factionId: FACTION_IDS.BLUE, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'blue.hunter', characterId: 'hunter', name: 'Cazador', factionId: FACTION_IDS.BLUE, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'blue.alchemist', characterId: 'alchemist', name: 'Alquimista', factionId: FACTION_IDS.BLUE, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'blue.rogue', characterId: 'rogue', name: 'Ladrón', factionId: FACTION_IDS.BLUE, position: { type: POSITION_TYPES.HOME } }),
      ],
    }),
    createPlayer({
      id: 'player-c',
      name: 'Player C',
      factionId: FACTION_IDS.GREEN,
      characters: [
        createCharacter({ id: 'green.druid', characterId: 'druid', name: 'Druida', factionId: FACTION_IDS.GREEN, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'green.archer', characterId: 'archer', name: 'Arquero', factionId: FACTION_IDS.GREEN, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'green.ranger', characterId: 'ranger', name: 'Montaraz', factionId: FACTION_IDS.GREEN, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'green.fairy', characterId: 'fairy', name: 'Hada', factionId: FACTION_IDS.GREEN, position: { type: POSITION_TYPES.HOME } }),
      ],
    }),
    createPlayer({
      id: 'player-d',
      name: 'Player D',
      factionId: FACTION_IDS.YELLOW,
      characters: [
        createCharacter({ id: 'yellow.paladin', characterId: 'paladin', name: 'Paladin', factionId: FACTION_IDS.YELLOW, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'yellow.monk', characterId: 'monk', name: 'Monje', factionId: FACTION_IDS.YELLOW, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'yellow.cleric', characterId: 'cleric', name: 'Clérigo', factionId: FACTION_IDS.YELLOW, position: { type: POSITION_TYPES.HOME } }),
        createCharacter({ id: 'yellow.engineer', characterId: 'engineer', name: 'Ingeniero', factionId: FACTION_IDS.YELLOW, position: { type: POSITION_TYPES.HOME } }),
      ],
    }),
  ];

  return players.slice(0, count);
}

function renderBoard({ players = createPlayers(), availableActions = [], availableDecisionActions = [], terrainEffectsByPositionKey = {}, characterStatesById = {} } = {}) {
  const gameState = createGameState(players, { terrainEffectsByPositionKey, characterStatesById });
  const turnState = createTurnState({ availableActions, availableDecisionActions });
  const onExecuteAction = jest.fn();
  const onExecuteDecision = jest.fn();

  const renderResult = render(
    <GameBoard
      gameState={gameState}
      turnState={turnState}
      currentPlayer={gameState.players[0]}
      availableActions={availableActions}
      availableDecisionActions={availableDecisionActions}
      onExecuteAction={onExecuteAction}
      onExecuteDecision={onExecuteDecision}
    />,
  );

  return { gameState, onExecuteAction, onExecuteDecision, ...renderResult };
}

function getCommonSlot(square) {
  return document.querySelector(`[data-common-square="${square}"]`);
}

function getAvatar(piece) {
  return piece.querySelector('img');
}

function getFinalLaneSlots(factionId) {
  return Array.from(document.querySelectorAll(`[data-final-lane="${factionId}"]`));
}

function createNormalMovementAction(characterId, destination = { type: POSITION_TYPES.COMMON, square: 23 }) {
  return {
    type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT,
    characterId,
    movement: { path: [], destination },
  };
}

function createVines(position) {
  return createDruidVinesEffect({
    characterId: 'green.druid',
    factionId: FACTION_IDS.GREEN,
    position,
  });
}

function createIce(position) {
  return createIceEffect({
    characterId: 'blue.iceMage',
    factionId: FACTION_IDS.BLUE,
    position,
    chargeSequence: 2,
  });
}

function createTrap(position) {
  return {
    id: `trap:${position.square}`,
    type: TERRAIN_EFFECT_TYPES.TRAP,
    source: {
      sourceCharacterId: 'blue.hunter',
      factionId: FACTION_IDS.BLUE,
    },
    data: { position },
  };
}

function createFrozen(characterId) {
  return createFrozenStatus({
    sourceCharacterId: 'blue.iceMage',
    sourceFactionId: FACTION_IDS.BLUE,
    targetCharacterId: characterId,
  });
}

function expectPieceAtPoint(piece, point) {
  expect(Number(piece.getAttribute('data-visual-x'))).toBeCloseTo(point.x, 3);
  expect(Number(piece.getAttribute('data-visual-y'))).toBeCloseTo(point.y, 3);
}

function expectPieceAtCellCenter(piece, cell) {
  expectPieceAtPoint(piece, cell.center);
}

function getPieceTokenBounds(piece) {
  const x = Number(piece.getAttribute('data-visual-x'));
  const y = Number(piece.getAttribute('data-visual-y'));
  const tokenSize = Number(piece.getAttribute('data-token-size'));
  const radius = tokenSize / 2;

  return {
    x: x - radius,
    y: y - radius,
    right: x + radius,
    bottom: y + radius,
  };
}

function getPieceTokenObject(piece) {
  return piece.closest('foreignObject');
}

function expectPieceObjectMatchesTokenBounds(piece) {
  const tokenObject = getPieceTokenObject(piece);
  const bounds = getPieceTokenBounds(piece);

  expect(tokenObject).toBeTruthy();
  expect(Number(tokenObject.getAttribute('x'))).toBeCloseTo(bounds.x, 3);
  expect(Number(tokenObject.getAttribute('y'))).toBeCloseTo(bounds.y, 3);
  expect(Number(tokenObject.getAttribute('width'))).toBeCloseTo(bounds.right - bounds.x, 3);
  expect(Number(tokenObject.getAttribute('height'))).toBeCloseTo(bounds.bottom - bounds.y, 3);
}

function expectPieceFitsInsideCell(piece, cell) {
  const bounds = getPieceTokenBounds(piece);

  expect(bounds.x).toBeGreaterThanOrEqual(cell.x);
  expect(bounds.y).toBeGreaterThanOrEqual(cell.y);
  expect(bounds.right).toBeLessThanOrEqual(cell.x + cell.width);
  expect(bounds.bottom).toBeLessThanOrEqual(cell.y + cell.height);
}

function expectPieceFitsInsideBoard(piece) {
  const bounds = getPieceTokenBounds(piece);

  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(1280);
  expect(bounds.bottom).toBeLessThanOrEqual(1280);
}

function expectHomeAt(home, point) {
  expect(home.x).toBeCloseTo(point.x, 3);
  expect(home.y).toBeCloseTo(point.y, 3);
}

function expectHomeSlotRectAt(slotElement, center) {
  expect(slotElement.tagName.toLowerCase()).toBe('rect');
  expect(Number(slotElement.getAttribute('x'))).toBeCloseTo(center.x - 36, 3);
  expect(Number(slotElement.getAttribute('y'))).toBeCloseTo(center.y - 36, 3);
  expect(Number(slotElement.getAttribute('width'))).toBeCloseTo(72, 3);
  expect(Number(slotElement.getAttribute('height'))).toBeCloseTo(72, 3);
  expect(slotElement).toHaveAttribute('rx', '13');
  expect(slotElement).toHaveAttribute('ry', '13');
}

describe('GameBoard', () => {
  test.each([2, 3, 4])('renders %i players without ghost characters', (playerCount) => {
    renderBoard({ players: createPlayers(playerCount) });

    expect(screen.getByLabelText('Visual game board')).toBeInTheDocument();
    expect(screen.getByLabelText(/Mago de fuego/)).toBeInTheDocument();

    if (playerCount < 4) {
      expect(screen.queryByLabelText(/Paladin/)).not.toBeInTheDocument();
    } else {
      expect(screen.getByLabelText(/Paladin/)).toBeInTheDocument();
    }
  });

  test('renders home, common, final lane, and goal positions from GameState', () => {
    renderBoard();

    expect(screen.getByLabelText(/Mago de fuego/)).toHaveAttribute('data-position-key', 'home:red');
    expectPieceAtPoint(screen.getByLabelText(/Mago de fuego/), getClassicHomeZone(FACTION_IDS.RED).slots[0]);
    expect(screen.getByLabelText(/Guerrero/)).toHaveAttribute('data-position-key', 'common:5');
    expectPieceAtCellCenter(screen.getByLabelText(/Guerrero/), getClassicCommonCellById(5));
    expect(screen.getByLabelText(/Herrero/)).toHaveAttribute('data-position-key', 'finalLane:red:3');
    expectPieceAtCellCenter(screen.getByLabelText(/Herrero/), getClassicFinalLaneCellsForFaction(FACTION_IDS.RED)[2]);
    expect(screen.getByLabelText(/Asesino/)).toHaveAttribute('data-position-key', 'goal');
    expectPieceAtPoint(screen.getByLabelText(/Asesino/), CLASSIC_GOAL.center);
  });

  test('renders configured portraits for all factions', () => {
    renderBoard({ players: createPlayers(4) });

    expect(getAvatar(screen.getByLabelText(/Mago de fuego/))).toHaveAttribute('src', 'firemage-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Guerrero/))).toHaveAttribute('src', 'warrior-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Herrero/))).toHaveAttribute('src', 'forge-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Asesino/))).toHaveAttribute('src', 'assasin-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Mago de hielo/))).toHaveAttribute('src', 'frostmage-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Cazador/))).toHaveAttribute('src', 'hunter-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Alquimista/))).toHaveAttribute('src', 'alchemy-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Ladrón/))).toHaveAttribute('src', 'rogue-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Druida/))).toHaveAttribute('src', 'druid-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Arquero/))).toHaveAttribute('src', 'archer-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Montaraz/))).toHaveAttribute('src', 'ranger-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Hada/))).toHaveAttribute('src', 'fairy-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Paladin/))).toHaveAttribute('src', 'pala-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Monje/))).toHaveAttribute('src', 'monk-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Clérigo/))).toHaveAttribute('src', 'cleric-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Ingeniero/))).toHaveAttribute('src', 'engineer-avatar.png');
  });

  test('red portrait tokens keep the faction ring and avatar crop styles', () => {
    renderBoard();
    const css = fs.readFileSync(path.join(__dirname, 'GameBoard.css'), 'utf8');
    const warrior = screen.getByLabelText(/Guerrero/);

    expect(warrior).toHaveClass('game-character--red');
    expect(getAvatar(warrior)).toHaveAttribute('src', 'warrior-avatar.png');
    expect(css).toMatch(/\.game-character\s*\{[^}]*border-radius:\s*18%;/);
    expect(css).not.toMatch(/\.game-character\s*\{[^}]*border-radius:\s*999px;/);
    expect(css).toMatch(/\.game-character--red\s*\{[^}]*border-color:\s*#ef4444;/);
    expect(css).toMatch(/\.game-character__portrait\s*\{[^}]*border-radius:\s*inherit;/);
    expect(css).toMatch(/\.game-character__portrait img\s*\{[^}]*object-fit:\s*cover;[^}]*object-position:\s*center;/);
  });

  test('renders token bounds as SVG foreignObject geometry instead of viewport-positioned boxes', () => {
    renderBoard();

    const warrior = screen.getByLabelText(/Guerrero/);
    const tokenObject = getPieceTokenObject(warrior);
    const expectedCoordinate = getCharacterSlotCoordinate({ type: POSITION_TYPES.COMMON, square: 5 }, FACTION_IDS.RED, 0, 1);
    const expectedBounds = getTokenBounds(expectedCoordinate);

    expect(tokenObject.tagName.toLowerCase()).toBe('foreignobject');
    expect(Number(tokenObject.getAttribute('x'))).toBeCloseTo(expectedBounds.x, 3);
    expect(Number(tokenObject.getAttribute('y'))).toBeCloseTo(expectedBounds.y, 3);
    expect(Number(tokenObject.getAttribute('width'))).toBeCloseTo(expectedBounds.width, 3);
    expect(Number(tokenObject.getAttribute('height'))).toBeCloseTo(expectedBounds.height, 3);
    expect(tokenObject.getAttribute('style') || '').not.toContain('left');
    expect(tokenObject.getAttribute('style') || '').not.toContain('top');
    expectPieceObjectMatchesTokenBounds(warrior);
  });

  test('renders homes in the canonical corner orientation', () => {
    renderBoard({ players: createPlayers(4) });

    expect(screen.getByLabelText('yellow home')).toBeInTheDocument();
    expect(screen.getByLabelText('green home')).toBeInTheDocument();
    expect(screen.getByLabelText('blue home')).toBeInTheDocument();
    expect(screen.getByLabelText('red home')).toBeInTheDocument();

    expectHomeAt(getClassicHomeZone(FACTION_IDS.YELLOW), { x: 20, y: 20 });
    expectHomeAt(getClassicHomeZone(FACTION_IDS.GREEN), { x: 846.667, y: 20 });
    expectHomeAt(getClassicHomeZone(FACTION_IDS.BLUE), { x: 20, y: 846.667 });
    expectHomeAt(getClassicHomeZone(FACTION_IDS.RED), { x: 846.667, y: 846.667 });
  });

  test('renders empty home slots as rounded-square token sockets without moving their centers', () => {
    renderBoard({ players: createPlayers(4) });

    Object.values(FACTION_IDS).forEach((factionId) => {
      const home = screen.getByLabelText(`${factionId} home`);
      const slotElements = Array.from(home.querySelectorAll('.game-board__home-slot'));
      const expectedSlots = getHomeSlots(factionId);

      expect(slotElements).toHaveLength(4);
      slotElements.forEach((slotElement, index) => {
        expectHomeSlotRectAt(slotElement, expectedSlots[index].center);
      });
    });
  });

  test('renders safe markers and faction start styling on canonical safe starts', () => {
    renderBoard({ players: createPlayers(4) });

    expect(SAFE_SQUARES).toEqual([5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63, 68]);
    expect(document.querySelectorAll('[data-safe-marker]')).toHaveLength(SAFE_SQUARES.length);
    expect(document.querySelectorAll('[data-safe-square]')).toHaveLength(SAFE_SQUARES.length);
    expect(Array.from(document.querySelectorAll('[data-safe-marker]')).map((marker) => Number(marker.getAttribute('data-safe-marker')))).toEqual(SAFE_SQUARES);

    const normalCell = getCommonSlot(1);
    expect(normalCell.querySelector('.game-board__slot-number')).toHaveTextContent('1');
    expect(normalCell.querySelector('[data-safe-marker]')).toBeNull();

    const safeCell = getCommonSlot(12);
    expect(safeCell).toHaveAttribute('data-safe-square', '12');
    expect(safeCell.querySelector('.game-board__slot-number')).toHaveTextContent('12');
    expect(safeCell.querySelector('[data-safe-marker]')).toHaveTextContent('◆');

    Object.entries(START_SQUARE_BY_FACTION).forEach(([factionId, square]) => {
      expect(SAFE_SQUARES).toContain(square);
      const startCell = document.querySelector(`[data-start-square="${square}"]`);

      expect(startCell).toBeTruthy();
      expect(startCell).toHaveAttribute('data-common-square', String(square));
      expect(startCell).toHaveAttribute('data-safe-square', String(square));
      expect(startCell.classList.contains(`game-board__slot--${factionId}`)).toBe(true);
      expect(startCell.classList.contains('game-board__slot--start')).toBe(true);
      expect(startCell.classList.contains('game-board__slot--safe')).toBe(true);
      expect(startCell.querySelector('.game-board__slot-number')).toHaveTextContent(String(square));
      expect(startCell.querySelector('[data-safe-marker]')).toHaveTextContent('◆');
    });
  });

  test('uses the centralized vines renderer without adding overlays to clean positions', () => {
    const position = { type: POSITION_TYPES.COMMON, square: 12 };
    const vines = createVines(position);

    renderBoard({
      terrainEffectsByPositionKey: { 'common:12': [vines] },
    });

    expect(getTerrainEffectRenderer(TERRAIN_EFFECT_TYPES.DRUID_VINES)).toBeTruthy();
    expect(getTerrainEffectRenderer('futureTerrain')).toBeNull();
    expect(document.querySelector('[data-terrain-position-key="common:12"]')).toHaveAttribute(
      'data-terrain-effect-type',
      TERRAIN_EFFECT_TYPES.DRUID_VINES,
    );
    expect(document.querySelector('[data-terrain-position-key="common:11"]')).toBeNull();
  });

  test('does not create a terrain surface without renderable effects', () => {
    const { rerender } = renderBoard();

    expect(document.querySelector('.game-board__terrain-surface')).toBeNull();

    const players = createPlayers();
    const gameState = createGameState(players, {
      terrainEffectsByPositionKey: {
        'common:12': [{
          id: 'future-terrain',
          type: 'futureTerrain',
          data: { position: { type: POSITION_TYPES.COMMON, square: 12 } },
        }],
      },
    });

    rerender(
      <GameBoard
        gameState={gameState}
        turnState={createTurnState()}
        currentPlayer={gameState.players[0]}
        availableActions={[]}
        availableDecisionActions={[]}
        onExecuteAction={jest.fn()}
        onExecuteDecision={jest.fn()}
      />,
    );

    expect(document.querySelector('.game-board__terrain-surface')).toBeNull();
  });

  test('keeps the SAFE base marker visible below the translucent vines layer', () => {
    const position = { type: POSITION_TYPES.COMMON, square: 12 };

    renderBoard({
      terrainEffectsByPositionKey: { 'common:12': [createVines(position)] },
    });

    expect(getCommonSlot(12)).toHaveClass('game-board__slot--safe');
    expect(getCommonSlot(12).querySelector('[data-safe-marker]')).toHaveTextContent('◆');
    expect(document.querySelector('[data-terrain-position-key="common:12"]')).toBeInTheDocument();
  });

  test('renders COMMON vines from the canonical SVG cell geometry', () => {
    const position = { type: POSITION_TYPES.COMMON, square: 12 };
    const cell = getClassicCommonCellById(12);

    renderBoard({
      terrainEffectsByPositionKey: { 'common:12': [createVines(position)] },
    });

    const wash = document.querySelector('[data-terrain-position-key="common:12"] .terrain-effect__vines-wash');

    expect(Number(wash.getAttribute('data-terrain-cell-x'))).toBeCloseTo(cell.x, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-y'))).toBeCloseTo(cell.y, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-width'))).toBeCloseTo(cell.width, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-height'))).toBeCloseTo(cell.height, 3);
  });

  test('renders vines with an instance-scoped gradient and glow', () => {
    const position = { type: POSITION_TYPES.COMMON, square: 12 };

    renderBoard({
      terrainEffectsByPositionKey: { 'common:12': [createVines(position)] },
    });

    const effect = document.querySelector('[data-terrain-position-key="common:12"]');
    const gradient = effect.querySelector('linearGradient');
    const filter = effect.querySelector('filter');
    const glow = effect.querySelector('.terrain-effect__vines-glow');
    const wash = effect.querySelector('.terrain-effect__vines-wash');

    expect(gradient.id).toMatch(/^terrain-vines-gradient-/);
    expect(filter.id).toMatch(/^terrain-vines-glow-/);
    expect(wash).toHaveAttribute('fill', `url(#${gradient.id})`);
    expect(glow).toHaveAttribute('fill', `url(#${gradient.id})`);
    expect(glow).toHaveAttribute('filter', `url(#${filter.id})`);
  });

  test('renders FINAL_LANE vines from that lane cell geometry', () => {
    const position = { type: POSITION_TYPES.FINAL_LANE, factionId: FACTION_IDS.GREEN, index: 3 };
    const cell = getClassicFinalLaneCellsForFaction(FACTION_IDS.GREEN)[2];

    renderBoard({
      terrainEffectsByPositionKey: { 'finalLane:green:3': [createVines(position)] },
    });

    const effect = document.querySelector('[data-terrain-position-key="finalLane:green:3"]');
    const wash = effect.querySelector('.terrain-effect__vines-wash');

    expect(effect).toHaveAttribute('data-terrain-effect-type', TERRAIN_EFFECT_TYPES.DRUID_VINES);
    expect(Number(wash.getAttribute('data-terrain-cell-x'))).toBeCloseTo(cell.x, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-y'))).toBeCloseTo(cell.y, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-width'))).toBeCloseTo(cell.width, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-height'))).toBeCloseTo(cell.height, 3);
  });

  test.each([
    [
      'COMMON',
      { type: POSITION_TYPES.COMMON, square: 12 },
      'common:12',
      getClassicCommonCellById(12),
    ],
    [
      'FINAL_LANE',
      { type: POSITION_TYPES.FINAL_LANE, factionId: FACTION_IDS.BLUE, index: 3 },
      'finalLane:blue:3',
      getClassicFinalLaneCellsForFaction(FACTION_IDS.BLUE)[2],
    ],
  ])('renders %s ice through the terrain registry and canonical geometry', (_, position, positionKey, cell) => {
    renderBoard({
      terrainEffectsByPositionKey: { [positionKey]: [createIce(position)] },
    });

    const effect = document.querySelector(`[data-terrain-position-key="${positionKey}"]`);
    const wash = effect.querySelector('.terrain-effect__ice-wash');

    expect(getTerrainEffectRenderer(TERRAIN_EFFECT_TYPES.ICE)).toBeTruthy();
    expect(effect).toHaveAttribute('data-terrain-effect-type', TERRAIN_EFFECT_TYPES.ICE);
    expect(effect).toHaveAttribute('pointer-events', 'none');
    expect(effect.querySelector('.terrain-effect__ice-crystals')).toBeInTheDocument();
    expect(effect.querySelector('linearGradient').id).toMatch(/^terrain-ice-gradient-/);
    expect(effect.querySelector('filter').id).toMatch(/^terrain-ice-glow-/);
    expect(Number(wash.getAttribute('data-terrain-cell-x'))).toBeCloseTo(cell.x, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-y'))).toBeCloseTo(cell.y, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-width'))).toBeCloseTo(cell.width, 3);
    expect(Number(wash.getAttribute('data-terrain-cell-height'))).toBeCloseTo(cell.height, 3);
    if (position.type === POSITION_TYPES.COMMON) {
      expect(getCommonSlot(position.square).querySelector('[data-safe-marker]')).toHaveTextContent('◆');
    }
  });

  test('renders Frozen only on its target without changing token geometry or clicks', () => {
    const players = createPlayers();
    const warrior = players[0].characters.find((character) => character.id === 'red.warrior');
    const fireMage = players[0].characters.find((character) => character.id === 'red.fireMage');
    fireMage.position = { ...warrior.position };
    const action = createNormalMovementAction('red.warrior');
    const { onExecuteAction } = renderBoard({
      players,
      availableActions: [action],
      characterStatesById: {
        'red.warrior': { effects: [createFrozen('red.warrior')] },
      },
    });
    const frozenPiece = screen.getByRole('button', { name: /Guerrero.*Congelado.*available/ });
    const cleanPiece = screen.getByLabelText(/Mago de fuego/);
    const frozenBounds = getPieceTokenBounds(frozenPiece);

    expect(frozenPiece.querySelector('[data-character-status-layer]')).toBeInTheDocument();
    expect(frozenPiece.querySelector('[data-character-status-type="frozen"]')).toBeInTheDocument();
    expect(cleanPiece.querySelector('[data-character-status-layer]')).toBeNull();
    expect(Number(frozenPiece.closest('foreignObject').getAttribute('width'))).toBeCloseTo(
      frozenBounds.right - frozenBounds.x,
      3,
    );

    fireEvent.click(frozenPiece);

    expect(onExecuteAction).toHaveBeenCalledWith(action);
  });

  test('ignores unknown character statuses', () => {
    renderBoard({
      characterStatesById: {
        'red.warrior': {
          effects: [{ id: 'unknown', type: 'futureStatus' }],
        },
      },
    });

    expect(document.querySelector('[data-character-status-layer]')).toBeNull();
    expect(screen.getByLabelText(/Guerrero/)).not.toHaveAccessibleName(/estados/);
  });

  test('keeps terrain between the base and tokens without intercepting token clicks', () => {
    const position = { type: POSITION_TYPES.COMMON, square: 5 };
    const action = createNormalMovementAction('red.warrior');
    const { onExecuteAction } = renderBoard({
      availableActions: [action],
      terrainEffectsByPositionKey: { 'common:5': [createVines(position)] },
    });
    const board = screen.getByTestId('game-board');
    const surface = board.querySelector('.game-board__surface');
    const terrain = board.querySelector('.game-board__terrain-surface');
    const tokens = board.querySelector('.game-board__character-layer');

    expect(terrain).toHaveAttribute('pointer-events', 'none');
    expect(terrain.querySelector('.terrain-effect--vines')).toHaveAttribute('pointer-events', 'none');
    expect(surface.compareDocumentPosition(terrain) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(terrain.compareDocumentPosition(tokens) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Guerrero.*available/ }));

    expect(onExecuteAction).toHaveBeenCalledWith(action);
  });

  test('renders distinct perpetual-motion details for Vines, Ice, and Trap', () => {
    renderBoard({
      terrainEffectsByPositionKey: {
        'common:10': [createVines({ type: POSITION_TYPES.COMMON, square: 10 })],
        'common:11': [createIce({ type: POSITION_TYPES.COMMON, square: 11 })],
        'common:12': [createTrap({ type: POSITION_TYPES.COMMON, square: 12 })],
      },
    });
    const css = fs.readFileSync(path.join(__dirname, 'terrain/TerrainEffectLayer.css'), 'utf8');

    expect(document.querySelectorAll('.terrain-effect__vine')).toHaveLength(6);
    expect(document.querySelectorAll('.terrain-effect__vine-energy')).toHaveLength(3);
    expect(document.querySelectorAll('.terrain-effect__leaf')).toHaveLength(4);
    expect(document.querySelectorAll('.terrain-effect__vine-sprout')).toHaveLength(3);
    expect(document.querySelector('.terrain-effect__ice-sheen')).toBeInTheDocument();
    expect(document.querySelectorAll('.terrain-effect__ice-sparkle')).toHaveLength(3);
    expect(document.querySelectorAll('.terrain-effect__trap-jaw')).toHaveLength(2);
    expect(document.querySelectorAll('.terrain-effect__trap-tooth')).toHaveLength(8);
    expect(document.querySelector('.terrain-effect__trap-arming-ring')).toBeInTheDocument();
    expect(document.querySelectorAll('.terrain-effect__trap-spark')).toHaveLength(2);
    expect(css).toMatch(/\.terrain-effect__vine-energy\s*\{[^}]*animation:[^;]*infinite;/);
    expect(css).toMatch(/\.terrain-effect__ice-sheen\s*\{[^}]*animation:[^;]*infinite;/);
    expect(css).toMatch(/\.terrain-effect__trap-jaw\s*\{[^}]*animation:[^;]*infinite;/);
  });

  test('defines high-contrast common square number and safe marker styles', () => {
    const css = fs.readFileSync(path.join(__dirname, 'GameBoard.css'), 'utf8');

    expect(css).toMatch(/\.game-board__slot\[data-common-square\]\s+\.game-board__slot-number\s*\{[^}]*fill:\s*#0f172a;[^}]*opacity:\s*0\.72;/);
    expect(css).toMatch(/\.game-board__slot\[data-safe-square\]\s+\.game-board__slot-symbol\s*\{[^}]*fill:\s*#111827;[^}]*opacity:\s*0\.78;/);
  });

  test('keeps a static vines glow when reduced motion is preferred', () => {
    const css = fs.readFileSync(path.join(__dirname, 'terrain/TerrainEffectLayer.css'), 'utf8');

    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.terrain-effect__vines-glow\s*\{[^}]*animation:\s*none;[^}]*opacity:\s*0\.52;/);
  });

  test('keeps static Ice and Frozen representations with reduced motion', () => {
    const terrainCss = fs.readFileSync(path.join(__dirname, 'terrain/TerrainEffectLayer.css'), 'utf8');
    const statusCss = fs.readFileSync(path.join(__dirname, 'status/CharacterStatusLayer.css'), 'utf8');

    expect(terrainCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.terrain-effect__ice-glow\s*\{[^}]*animation:\s*none;[^}]*opacity:\s*0\.44;/);
    expect(statusCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.character-status--frozen\s*\{[^}]*animation:\s*none;[^}]*filter:\s*none;/);
    expect(statusCss).toMatch(/\.character-status-layer,[\s\S]*pointer-events:\s*none;/);
    expect(CHARACTER_STATUS_TYPES.FROZEN).toBe('frozen');
  });

  test('keeps a static armed Trap representation with reduced motion', () => {
    const css = fs.readFileSync(path.join(__dirname, 'terrain/TerrainEffectLayer.css'), 'utf8');

    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.terrain-effect__trap-glow\s*\{[^}]*animation:\s*none;[^}]*opacity:\s*0\.42;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.terrain-effect__trap-arming-ring\s*\{[^}]*opacity:\s*0\.72;/);
  });

  test('renders only common-track square numbers while preserving final-lane index metadata', () => {
    renderBoard({ players: createPlayers(4) });

    const commonNumbers = Array.from(document.querySelectorAll('[data-common-square] .game-board__slot-number'));

    expect(commonNumbers).toHaveLength(68);
    expect(commonNumbers.map((label) => Number(label.textContent))).toEqual(Array.from({ length: 68 }, (_, index) => index + 1));
    expect(commonNumbers[0]).toHaveTextContent('1');
    expect(commonNumbers[67]).toHaveTextContent('68');
    expect(document.querySelectorAll('[data-safe-marker]')).toHaveLength(SAFE_SQUARES.length);

    Object.values(FACTION_IDS).forEach((factionId) => {
      const finalLaneSlots = getFinalLaneSlots(factionId);

      expect(finalLaneSlots).toHaveLength(7);
      expect(finalLaneSlots.map((slot) => Number(slot.getAttribute('data-final-index')))).toEqual([1, 2, 3, 4, 5, 6, 7]);
      finalLaneSlots.forEach((slot) => {
        expect(slot.querySelector('.game-board__slot-number')).toBeNull();
      });
    });
  });

  test('defines a reduced-motion-safe movable token halo without changing token dimensions', () => {
    const css = fs.readFileSync(path.join(__dirname, 'GameBoard.css'), 'utf8');

    expect(css).toMatch(/\.game-character--movable\s*\{[^}]*box-shadow:[^}]*rgba\(34, 197, 94/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.game-character--movable\s*\{[^}]*animation:\s*none;/);
  });

  test('renders four home characters in separate 2x2 visual slots', () => {
    const players = createPlayers(1);
    players[0].characters.forEach((character) => {
      character.position = { type: POSITION_TYPES.HOME };
    });

    renderBoard({ players });

    expectPieceAtPoint(screen.getByLabelText(/Mago de fuego/), getClassicHomeZone(FACTION_IDS.RED).slots[0]);
    expectPieceAtPoint(screen.getByLabelText(/Guerrero/), getClassicHomeZone(FACTION_IDS.RED).slots[1]);
    expectPieceAtPoint(screen.getByLabelText(/Herrero/), getClassicHomeZone(FACTION_IDS.RED).slots[2]);
    expectPieceAtPoint(screen.getByLabelText(/Asesino/), getClassicHomeZone(FACTION_IDS.RED).slots[3]);
  });

  test('home characters keep stable slots when another home character exits', () => {
    const players = createPlayers(1);
    players[0].characters[0].position = { type: POSITION_TYPES.HOME };
    players[0].characters[1].position = { type: POSITION_TYPES.COMMON, square: START_SQUARE_BY_FACTION[FACTION_IDS.RED] };
    players[0].characters[2].position = { type: POSITION_TYPES.HOME };
    players[0].characters[3].position = { type: POSITION_TYPES.HOME };

    renderBoard({ players });

    expectPieceAtPoint(screen.getByLabelText(/Mago de fuego/), getClassicHomeZone(FACTION_IDS.RED).slots[0]);
    expectPieceAtCellCenter(screen.getByLabelText(/Guerrero/), getClassicCommonCellById(START_SQUARE_BY_FACTION[FACTION_IDS.RED]));
    expectPieceAtPoint(screen.getByLabelText(/Herrero/), getClassicHomeZone(FACTION_IDS.RED).slots[2]);
    expectPieceAtPoint(screen.getByLabelText(/Asesino/), getClassicHomeZone(FACTION_IDS.RED).slots[3]);
    expect(getAvatar(screen.getByLabelText(/Mago de fuego/))).toHaveAttribute('src', 'firemage-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Guerrero/))).toHaveAttribute('src', 'warrior-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Herrero/))).toHaveAttribute('src', 'forge-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Asesino/))).toHaveAttribute('src', 'assasin-avatar.png');
  });

  test('renders two characters in the same position as separate pieces and shows a barrier', () => {
    const players = createPlayers(1);
    players[0].characters[0].position = { type: POSITION_TYPES.COMMON, square: 22 };
    players[0].characters[1].position = { type: POSITION_TYPES.COMMON, square: 22 };

    renderBoard({ players });

    expect(screen.getByLabelText(/Mago de fuego/)).toHaveAttribute('data-position-key', 'common:22');
    expect(screen.getByLabelText(/Guerrero/)).toHaveAttribute('data-position-key', 'common:22');
    expect(`${screen.getByLabelText(/Mago de fuego/).getAttribute('data-visual-x')}:${screen.getByLabelText(/Mago de fuego/).getAttribute('data-visual-y')}`)
      .not.toBe(`${screen.getByLabelText(/Guerrero/).getAttribute('data-visual-x')}:${screen.getByLabelText(/Guerrero/).getAttribute('data-visual-y')}`);
    expect(Number(screen.getByLabelText(/Mago de fuego/).getAttribute('data-visual-x'))).toBeCloseTo(Number(screen.getByLabelText(/Guerrero/).getAttribute('data-visual-x')), 3);
    expect(Number(screen.getByLabelText(/Mago de fuego/).getAttribute('data-visual-y'))).toBeLessThan(Number(screen.getByLabelText(/Guerrero/).getAttribute('data-visual-y')));
    expect(screen.getByLabelText('Barrier at common:22')).toBeInTheDocument();
    expectPieceFitsInsideCell(screen.getByLabelText(/Mago de fuego/), getClassicCommonCellById(22));
    expectPieceFitsInsideCell(screen.getByLabelText(/Guerrero/), getClassicCommonCellById(22));
    expectPieceObjectMatchesTokenBounds(screen.getByLabelText(/Mago de fuego/));
    expectPieceObjectMatchesTokenBounds(screen.getByLabelText(/Guerrero/));
    expect(getAvatar(screen.getByLabelText(/Mago de fuego/))).toHaveAttribute('src', 'firemage-avatar.png');
    expect(getAvatar(screen.getByLabelText(/Guerrero/))).toHaveAttribute('src', 'warrior-avatar.png');
  });

  test('renders a green character on common 22 inside the green start cell and board', () => {
    const players = [createPlayer({
      id: 'player-green',
      name: 'Green Player',
      factionId: FACTION_IDS.GREEN,
      characters: [
        createCharacter({ id: 'green.druid', characterId: 'druid', name: 'Druida', factionId: FACTION_IDS.GREEN, position: { type: POSITION_TYPES.COMMON, square: 22 } }),
      ],
    })];

    renderBoard({ players });

    const druid = screen.getByLabelText(/Druida/);

    expect(druid).toHaveAttribute('data-position-key', 'common:22');
    expectPieceAtCellCenter(druid, getClassicCommonCellById(22));
    expectPieceFitsInsideCell(druid, getClassicCommonCellById(22));
    expectPieceFitsInsideBoard(druid);
  });

  test('renders characters on all faction starts inside their start cells', () => {
    const characters = Object.entries(START_SQUARE_BY_FACTION).map(([factionId, square]) =>
      createCharacter({
        id: `${factionId}.startTester`,
        characterId: factionId === FACTION_IDS.GREEN ? 'druid' : 'warrior',
        name: `${factionId} tester`,
        factionId,
        position: { type: POSITION_TYPES.COMMON, square },
      }),
    );
    const players = characters.map((character, index) => createPlayer({
      id: `player-${index}`,
      name: `Player ${index}`,
      factionId: character.factionId,
      characters: [character],
    }));

    renderBoard({ players });

    Object.entries(START_SQUARE_BY_FACTION).forEach(([factionId, square]) => {
      const piece = screen.getByLabelText(new RegExp(`${factionId} tester`));

      expectPieceFitsInsideCell(piece, getClassicCommonCellById(square));
      expectPieceFitsInsideBoard(piece);
      expectPieceAtCellCenter(piece, getClassicCommonCellById(square));
      expectPieceObjectMatchesTokenBounds(piece);
    });
  });

  test('portrait images and fallback initials do not own token dimensions', () => {
    const portraitSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const players = [createPlayer({
      id: 'player-blue',
      name: 'Blue Player',
      factionId: FACTION_IDS.BLUE,
      characters: [
        createCharacter({ id: 'blue.portrait', characterId: 'iceMage', name: 'Portrait tester', factionId: FACTION_IDS.BLUE, position: { type: POSITION_TYPES.COMMON, square: 56 }, portraitSrc }),
        createCharacter({ id: 'blue.fallback', characterId: 'unknownTester', name: 'Fallback tester', factionId: FACTION_IDS.BLUE, position: { type: POSITION_TYPES.COMMON, square: 57 } }),
      ],
    })];

    renderBoard({ players });

    const portraitPiece = screen.getByLabelText(/Portrait tester/);
    const fallbackPiece = screen.getByLabelText(/Fallback tester/);
    const portraitObject = getPieceTokenObject(portraitPiece);
    const fallbackObject = getPieceTokenObject(fallbackPiece);

    expect(portraitPiece.querySelector('img')).toHaveAttribute('src', portraitSrc);
    expect(getAvatar(fallbackPiece)).toBeNull();
    expect(within(fallbackPiece).getByText('FT')).toHaveClass('game-character__fallback-initials');
    expect(Number(portraitObject.getAttribute('width'))).toBeCloseTo(Number(portraitPiece.getAttribute('data-token-size')), 3);
    expect(Number(portraitObject.getAttribute('height'))).toBeCloseTo(Number(portraitPiece.getAttribute('data-token-size')), 3);
    expect(Number(fallbackObject.getAttribute('width'))).toBeCloseTo(Number(fallbackPiece.getAttribute('data-token-size')), 3);
    expect(Number(fallbackObject.getAttribute('height'))).toBeCloseTo(Number(fallbackPiece.getAttribute('data-token-size')), 3);
    expectPieceFitsInsideCell(portraitPiece, getClassicCommonCellById(56));
    expectPieceFitsInsideCell(fallbackPiece, getClassicCommonCellById(57));
  });

  test('red avatar follows character identity when position changes', () => {
    const players = createPlayers(1);
    const warrior = players[0].characters[1];
    const gameState = createGameState(players);
    const onExecuteAction = jest.fn();
    const onExecuteDecision = jest.fn();
    const { rerender } = render(
      <GameBoard
        gameState={gameState}
        turnState={createTurnState()}
        currentPlayer={gameState.players[0]}
        availableActions={[]}
        availableDecisionActions={[]}
        onExecuteAction={onExecuteAction}
        onExecuteDecision={onExecuteDecision}
      />,
    );

    expect(screen.getByLabelText(/Guerrero/)).toHaveAttribute('data-position-key', 'common:5');
    expect(getAvatar(screen.getByLabelText(/Guerrero/))).toHaveAttribute('src', 'warrior-avatar.png');

    warrior.position = { type: POSITION_TYPES.FINAL_LANE, factionId: FACTION_IDS.RED, index: 2 };
    rerender(
      <GameBoard
        gameState={gameState}
        turnState={createTurnState()}
        currentPlayer={gameState.players[0]}
        availableActions={[]}
        availableDecisionActions={[]}
        onExecuteAction={onExecuteAction}
        onExecuteDecision={onExecuteDecision}
      />,
    );

    expect(screen.getByLabelText(/Guerrero/)).toHaveAttribute('data-position-key', 'finalLane:red:2');
    expect(getAvatar(screen.getByLabelText(/Guerrero/))).toHaveAttribute('src', 'warrior-avatar.png');
  });

  test('only characters with available actions are interactive', () => {
    const action = { type: EXECUTABLE_ACTION_TYPES.EXIT_HOME, characterId: 'red.fireMage', destination: { type: POSITION_TYPES.COMMON, square: 5 }, occupantRemoval: { required: false } };
    const { onExecuteAction } = renderBoard({ availableActions: [action] });

    expect(screen.getByRole('button', { name: /Mago de fuego.*available/ })).toHaveClass('game-character--movable');
    expect(screen.getByRole('button', { name: /Mago de fuego.*available/ })).toHaveAttribute('data-movable', 'true');
    expect(getAvatar(screen.getByRole('button', { name: /Mago de fuego.*available/ }))).toHaveAttribute('src', 'firemage-avatar.png');
    expect(screen.getByLabelText(/Guerrero/)).not.toHaveClass('game-character--movable');
    expect(screen.getByLabelText(/Guerrero/)).not.toHaveAttribute('data-movable');

    fireEvent.click(screen.getByRole('button', { name: /Mago de fuego.*available/ }));
    fireEvent.click(screen.getByLabelText(/Guerrero/));

    expect(onExecuteAction).toHaveBeenCalledTimes(1);
    expect(onExecuteAction).toHaveBeenCalledWith(action);
    expect(screen.getByLabelText(/Guerrero/).tagName.toLowerCase()).toBe('div');
  });

  test('highlights every character with available actions across home, common, and final lane', () => {
    const actions = [
      { type: EXECUTABLE_ACTION_TYPES.EXIT_HOME, characterId: 'red.fireMage', destination: { type: POSITION_TYPES.COMMON, square: 5 }, occupantRemoval: { required: false } },
      createNormalMovementAction('red.warrior'),
      createNormalMovementAction('red.blacksmith', { type: POSITION_TYPES.FINAL_LANE, factionId: FACTION_IDS.RED, index: 4 }),
    ];

    renderBoard({ availableActions: actions });

    expect(screen.getByRole('button', { name: /Mago de fuego.*available/ })).toHaveAttribute('data-position-key', 'home:red');
    expect(screen.getByRole('button', { name: /Mago de fuego.*available/ })).toHaveClass('game-character--movable');
    expect(screen.getByRole('button', { name: /Guerrero.*available/ })).toHaveAttribute('data-position-key', 'common:5');
    expect(screen.getByRole('button', { name: /Guerrero.*available/ })).toHaveClass('game-character--movable');
    expect(screen.getByRole('button', { name: /Herrero.*available/ })).toHaveAttribute('data-position-key', 'finalLane:red:3');
    expect(screen.getByRole('button', { name: /Herrero.*available/ })).toHaveClass('game-character--movable');
    expect(screen.getByLabelText(/Asesino/)).not.toHaveClass('game-character--movable');
  });

  test('removes movable highlight when available actions disappear', () => {
    const players = createPlayers();
    const gameState = createGameState(players);
    const onExecuteAction = jest.fn();
    const onExecuteDecision = jest.fn();
    const action = createNormalMovementAction('red.warrior');
    const { rerender } = render(
      <GameBoard
        gameState={gameState}
        turnState={createTurnState({ availableActions: [action] })}
        currentPlayer={gameState.players[0]}
        availableActions={[action]}
        availableDecisionActions={[]}
        onExecuteAction={onExecuteAction}
        onExecuteDecision={onExecuteDecision}
      />,
    );

    expect(screen.getByRole('button', { name: /Guerrero.*available/ })).toHaveClass('game-character--movable');

    rerender(
      <GameBoard
        gameState={gameState}
        turnState={createTurnState({ availableActions: [] })}
        currentPlayer={gameState.players[0]}
        availableActions={[]}
        availableDecisionActions={[]}
        onExecuteAction={onExecuteAction}
        onExecuteDecision={onExecuteDecision}
      />,
    );

    expect(screen.getByLabelText(/Guerrero/)).not.toHaveClass('game-character--movable');
    expect(screen.getByLabelText(/Guerrero/).tagName.toLowerCase()).toBe('div');
  });

  test('movable highlight is per character when two characters share a cell', () => {
    const players = createPlayers(1);
    players[0].characters[0].position = { type: POSITION_TYPES.COMMON, square: 22 };
    players[0].characters[1].position = { type: POSITION_TYPES.COMMON, square: 22 };
    const action = createNormalMovementAction('red.fireMage');

    renderBoard({ players, availableActions: [action] });

    expect(screen.getByRole('button', { name: /Mago de fuego.*available/ })).toHaveClass('game-character--movable');
    expect(screen.getByLabelText(/Guerrero/)).not.toHaveClass('game-character--movable');
    expect(screen.getByLabelText(/Mago de fuego/)).toHaveAttribute('data-position-key', 'common:22');
    expect(screen.getByLabelText(/Guerrero/)).toHaveAttribute('data-position-key', 'common:22');
  });

  test('movable highlight does not change token bounds or slot geometry', () => {
    const action = createNormalMovementAction('red.warrior');
    renderBoard({ availableActions: [action] });

    const warrior = screen.getByRole('button', { name: /Guerrero.*available/ });
    const tokenObject = getPieceTokenObject(warrior);
    const expectedCoordinate = getCharacterSlotCoordinate({ type: POSITION_TYPES.COMMON, square: 5 }, FACTION_IDS.RED, 0, 1);
    const expectedBounds = getTokenBounds(expectedCoordinate);
    const startCell = getCommonSlot(5);
    const startRect = startCell.querySelector('rect');
    const expectedCell = getClassicCommonCellById(5);

    expect(warrior).toHaveClass('game-character--movable');
    expect(getAvatar(warrior)).toHaveAttribute('src', 'warrior-avatar.png');
    expect(warrior).toHaveClass('game-character--red');
    expect(Number(tokenObject.getAttribute('x'))).toBeCloseTo(expectedBounds.x, 3);
    expect(Number(tokenObject.getAttribute('y'))).toBeCloseTo(expectedBounds.y, 3);
    expect(Number(tokenObject.getAttribute('width'))).toBeCloseTo(expectedBounds.width, 3);
    expect(Number(tokenObject.getAttribute('height'))).toBeCloseTo(expectedBounds.height, 3);
    expect(Number(warrior.getAttribute('data-visual-x'))).toBeCloseTo(expectedCoordinate.x, 3);
    expect(Number(warrior.getAttribute('data-visual-y'))).toBeCloseTo(expectedCoordinate.y, 3);
    expect(Number(warrior.getAttribute('data-token-size'))).toBeCloseTo(expectedCoordinate.tokenSize, 3);
    expect(Number(startRect.getAttribute('x'))).toBeCloseTo(expectedCell.x, 3);
    expect(Number(startRect.getAttribute('y'))).toBeCloseTo(expectedCell.y, 3);
    expect(Number(startRect.getAttribute('width'))).toBeCloseTo(expectedCell.width, 3);
    expect(Number(startRect.getAttribute('height'))).toBeCloseTo(expectedCell.height, 3);
  });

  test('multiple actions for the same character require explicit action choice', () => {
    const firstAction = { type: EXECUTABLE_ACTION_TYPES.NORMAL_MOVEMENT, characterId: 'red.warrior', movement: { path: [], destination: { type: POSITION_TYPES.COMMON, square: 23 } } };
    const secondAction = { type: EXECUTABLE_ACTION_TYPES.BREAK_BARRIER, characterId: 'red.warrior', movement: { path: [], destination: { type: POSITION_TYPES.COMMON, square: 24 } } };
    const { onExecuteAction } = renderBoard({ availableActions: [firstAction, secondAction] });

    fireEvent.click(screen.getByRole('button', { name: /Guerrero.*available/ }));

    expect(onExecuteAction).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /Guerrero actions/ })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: /Guerrero actions/ })).getByRole('button', { name: /Break barrier/ }));

    expect(onExecuteAction).toHaveBeenCalledWith(secondAction);
  });

  test('exitHome with occupantRemoval asks for removal choice', () => {
    const action = {
      type: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
      characterId: 'red.fireMage',
      destination: { type: POSITION_TYPES.COMMON, square: 5 },
      occupantRemoval: { required: true, removableCharacterIds: ['red.warrior', 'red.blacksmith'] },
    };
    const { onExecuteAction } = renderBoard({ availableActions: [action] });

    fireEvent.click(screen.getByRole('button', { name: /Mago de fuego.*available/ }));
    fireEvent.change(screen.getByLabelText(/Remove occupant/), { target: { value: 'red.blacksmith' } });
    fireEvent.click(screen.getByRole('button', { name: 'Execute action' }));

    expect(onExecuteAction).toHaveBeenCalledWith(action, { removeCharacterId: 'red.blacksmith' });
  });

  test('initial exit with removeAll executes directly without an occupant menu', () => {
    const action = {
      id: 'initialExit:5:first:red.fireMage',
      type: EXECUTABLE_ACTION_TYPES.EXIT_HOME,
      characterId: 'red.fireMage',
      initialExit: true,
      initialExitStage: 'first',
      destination: { type: POSITION_TYPES.COMMON, square: 5 },
      occupantRemoval: {
        required: true,
        removableCharacterIds: ['blue.hunter', 'green.archer'],
        removeAll: true,
      },
    };
    const { onExecuteAction } = renderBoard({ availableActions: [action] });

    fireEvent.click(screen.getByRole('button', { name: /Mago de fuego.*available/ }));

    expect(screen.queryByRole('dialog', { name: 'Choose occupant to remove' })).not.toBeInTheDocument();
    expect(onExecuteAction).toHaveBeenCalledWith({ id: action.id });
  });

  test('does not expose manual destination selection', () => {
    renderBoard();

    expect(screen.queryByText(/select destination/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /common 22/i })).not.toBeInTheDocument();
  });
});
