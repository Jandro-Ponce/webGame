import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import {
  EXECUTABLE_ACTION_TYPES,
  FACTION_IDS,
  SAFE_SQUARES,
  START_SQUARE_BY_FACTION,
} from '../engine';
import {
  BOARD_VIEW_BOX_SIZE,
  FACTION_VISUAL_ORDER,
  getGoalCell,
  getGoalPointsSvg,
  getBoardPositionForKey,
  getCharacterSlotCoordinate,
  getCommonBoardSlots,
  getFinalLaneBoardSlots,
  getHomeSlots,
  getHomeZone,
  getPositionKey,
} from './boardGeometry';
import {
  createActionsByCharacterId,
  getCharactersFromGameState,
  getVisualBarriers,
  groupCharactersByPosition,
} from './boardOccupancy';
import { getCharacterVisual } from './characterVisuals';
import { TerrainEffectLayer } from './terrain/TerrainEffectLayer';
import {
  CharacterStatusLayer,
  getCharacterStatusLabels,
} from './status/CharacterStatusLayer';
import './GameBoard.css';

const FACTION_LABELS = Object.freeze({
  [FACTION_IDS.GREEN]: 'Green',
  [FACTION_IDS.RED]: 'Red',
  [FACTION_IDS.BLUE]: 'Blue',
  [FACTION_IDS.YELLOW]: 'Yellow',
});

const HOME_SLOT_SIZE = 72;
const HOME_SLOT_RADIUS = 13;

function getActionReference(action) {
  return action.id ? { id: action.id } : action;
}

function getActionLabel(action) {
  if (action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME) {
    return action.initialExit ? 'Initial exit' : 'Exit home';
  }

  if (action.type === EXECUTABLE_ACTION_TYPES.BREAK_BARRIER) {
    return 'Break barrier';
  }

  return 'Move';
}

function BoardSlot({ slot, factionId, isSafe, isStart }) {
  const { cell } = slot;

  return (
    <g
      className={`game-board__slot game-board__slot--${factionId || 'common'}${isSafe ? ' game-board__slot--safe' : ''}${isStart ? ' game-board__slot--start' : ''}`}
      data-common-square={slot.square || undefined}
      data-final-lane={slot.factionId || undefined}
      data-final-index={slot.index || undefined}
      data-safe-square={isSafe ? slot.square : undefined}
      data-start-square={isStart ? slot.square : undefined}
    >
      <rect x={cell.x} y={cell.y} width={cell.width} height={cell.height} rx="5" />
      {isSafe && <text className="game-board__slot-symbol" x={slot.coordinate.x} y={slot.coordinate.y + 9} data-safe-marker={slot.square}>◆</text>}
      {slot.square && <text className="game-board__slot-number" x={cell.x + 10} y={cell.y + 18}>{slot.square}</text>}
    </g>
  );
}

function CommonTrack() {
  return (
    <g aria-label="Common track">
      {getCommonBoardSlots().map((slot) => {
        const startFaction = Object.entries(START_SQUARE_BY_FACTION).find(([, square]) => square === slot.square)?.[0];

        return (
          <BoardSlot
            key={slot.key}
            slot={slot}
            factionId={startFaction}
            isSafe={SAFE_SQUARES.includes(slot.square)}
            isStart={Boolean(startFaction)}
          />
        );
      })}
    </g>
  );
}

function FinalLane({ factionId }) {
  return (
    <g aria-label={`${factionId} final lane`} className={`game-board__final-lane game-board__final-lane--${factionId}`}>
      {getFinalLaneBoardSlots(factionId).map((slot) => (
        <BoardSlot key={slot.key} slot={slot} factionId={factionId} />
      ))}
    </g>
  );
}

function HomeArea({ factionId, isPresent }) {
  const zone = getHomeZone(factionId);
  const slots = getHomeSlots(factionId);

  return (
    <g className={`game-board__home game-board__home--${factionId}${isPresent ? '' : ' game-board__home--empty'}`} aria-label={`${factionId} home`}>
      <rect className="game-board__home-zone" x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx="28" />
      <circle className="game-board__home-ring" cx={zone.center.x} cy={zone.center.y} r="150" />
      <circle className="game-board__home-ring game-board__home-ring--inner" cx={zone.center.x} cy={zone.center.y} r="98" />
      {slots.map((slot, index) => (
        <rect
          key={`${factionId}:home-slot:${index}`}
          className="game-board__home-slot"
          x={slot.center.x - (HOME_SLOT_SIZE / 2)}
          y={slot.center.y - (HOME_SLOT_SIZE / 2)}
          width={HOME_SLOT_SIZE}
          height={HOME_SLOT_SIZE}
          rx={HOME_SLOT_RADIUS}
          ry={HOME_SLOT_RADIUS}
        />
      ))}
      <text x={zone.center.x} y={zone.center.y + 8}>{FACTION_LABELS[factionId]}</text>
    </g>
  );
}

function GoalArea() {
  const cell = getGoalCell();

  return (
    <g className="game-board__goal" aria-label="Goal">
      <polygon className="game-board__goal-cell" points={getGoalPointsSvg()} />
      <line className="game-board__goal-line" x1={cell.center.x} y1={cell.y} x2={cell.center.x} y2={cell.y + cell.height} />
      <line className="game-board__goal-line" x1={cell.x} y1={cell.center.y} x2={cell.x + cell.width} y2={cell.center.y} />
      <text x={cell.center.x} y={cell.center.y + 7}>GOAL</text>
    </g>
  );
}

function BarrierIndicator({ barrier }) {
  const coordinate = getBoardPositionForKey(getPositionKey(barrier.position, barrier.factionId));

  if (!coordinate) {
    return null;
  }

  return (
    <div
      className={`game-board__barrier game-board__barrier--${barrier.factionId}`}
      style={{ left: `${(coordinate.x / BOARD_VIEW_BOX_SIZE) * 100}%`, top: `${(coordinate.y / BOARD_VIEW_BOX_SIZE) * 100}%` }}
      aria-label={`Barrier at ${getPositionKey(barrier.position, barrier.factionId)}`}
    >
      <Shield size={18} aria-hidden="true" />
    </div>
  );
}

function BoardSurface({ presentFactionIds }) {
  return (
    <svg className="game-board__surface" viewBox={`0 0 ${BOARD_VIEW_BOX_SIZE} ${BOARD_VIEW_BOX_SIZE}`} role="img" aria-label="Parchis board">
      <defs>
        <radialGradient id="board-core" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2f7" />
        </radialGradient>
      </defs>
      <rect className="game-board__plate" x="10" y="10" width="1260" height="1260" rx="18" />
      {FACTION_VISUAL_ORDER.map((factionId) => (
        <HomeArea key={factionId} factionId={factionId} isPresent={presentFactionIds.includes(factionId)} />
      ))}
      <CommonTrack />
      {Object.values(FACTION_IDS).map((factionId) => (
        <FinalLane key={factionId} factionId={factionId} />
      ))}
      <GoalArea />
    </svg>
  );
}

function ActionChooser({ character, actions, onChooseAction, onClose }) {
  return (
    <div className="game-board__action-menu" role="dialog" aria-label={`${character.name} actions`}>
      <strong>{character.name}</strong>
      <p>Choose an engine action</p>
      {actions.map((action, index) => (
        <button key={action.id || `${action.type}:${index}`} type="button" onClick={() => onChooseAction(action)}>
          {getActionLabel(action)} #{index + 1}
        </button>
      ))}
      <button type="button" className="game-board__secondary-action" onClick={onClose}>Cancel</button>
    </div>
  );
}

function OccupantRemovalChooser({ action, gameState, onConfirm, onCancel }) {
  const [removeCharacterId, setRemoveCharacterId] = useState(action.occupantRemoval.removableCharacterIds[0] || '');
  const characters = getCharactersFromGameState(gameState);

  return (
    <div className="game-board__action-menu" role="dialog" aria-label="Choose occupant to remove">
      <strong>Exit home is blocked</strong>
      <label>
        Remove occupant
        <select value={removeCharacterId} onChange={(event) => setRemoveCharacterId(event.target.value)}>
          {action.occupantRemoval.removableCharacterIds.map((characterId) => {
            const character = characters.find((candidate) => candidate.id === characterId);

            return (
              <option key={characterId} value={characterId}>{character ? character.name : characterId}</option>
            );
          })}
        </select>
      </label>
      <button type="button" onClick={() => onConfirm(action, { removeCharacterId })}>Execute action</button>
      <button type="button" className="game-board__secondary-action" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function CharacterPiece({ character, coordinate, effects, actions, decisionActions, onExecuteAction, onExecuteDecision, onMultipleActions, onRequiresRemoval }) {
  const isInteractive = actions.length > 0 || decisionActions.length > 0;
  const isMovable = actions.length > 0;
  const isDecision = actions.length === 0 && decisionActions.length > 0;
  const characterVisual = getCharacterVisual(character);
  const statusLabels = getCharacterStatusLabels(effects);
  const statusLabel = statusLabels.length > 0 ? `, estados: ${statusLabels.join(', ')}` : '';

  function handleClick() {
    if (!isInteractive) {
      return;
    }

    const executableActions = actions.length > 0 ? actions : decisionActions;
    const execute = actions.length > 0
      ? onExecuteAction
      : (decisionAction) => onExecuteDecision(decisionAction.id);

    if (executableActions.length > 1) {
      onMultipleActions(character, executableActions, execute);
      return;
    }

    const action = executableActions[0];

    if (
      actions.length > 0 &&
      action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME &&
      action.occupantRemoval?.required &&
      !action.occupantRemoval.removeAll
    ) {
      onRequiresRemoval(action);
      return;
    }

    execute(getActionReference(action));
  }

  const Element = isInteractive ? 'button' : 'div';
  const tokenSize = coordinate.tokenSize || 54;
  const tokenRadius = tokenSize / 2;

  return (
    <foreignObject
      className="game-character__object"
      x={coordinate.x - tokenRadius}
      y={coordinate.y - tokenRadius}
      width={tokenSize}
      height={tokenSize}
      data-token-object="true"
    >
      <Element
        type={isInteractive ? 'button' : undefined}
        className={`game-character game-character--${character.factionId}${isInteractive ? ' game-character--interactive' : ''}${isMovable ? ' game-character--movable' : ''}${isDecision ? ' game-character--decision' : ''}`}
        style={{ fontSize: `${tokenSize * 0.32}px` }}
        onClick={handleClick}
        aria-label={`${character.name} (${character.id})${statusLabel}${isInteractive ? ' available' : ''}`}
        data-character-id={character.id}
        data-position-key={getPositionKey(character.position, character.factionId)}
        data-visual-row={coordinate.row}
        data-visual-column={coordinate.column}
        data-visual-x={coordinate.x}
        data-visual-y={coordinate.y}
        data-token-size={tokenSize}
        data-movable={isMovable ? 'true' : undefined}
      >
        <span className="game-character__portrait" aria-hidden="true">
          {characterVisual.portraitSrc ? (
            <img src={characterVisual.portraitSrc} alt="" />
          ) : <span className="game-character__fallback-initials">{characterVisual.fallbackInitials}</span>}
        </span>
        <CharacterStatusLayer characterId={character.id} effects={effects} />
        <span className="game-character__name">{character.name}</span>
      </Element>
    </foreignObject>
  );
}

function CharacterLayer({ gameState, actionsByCharacterId, decisionActionsByCharacterId, onExecuteAction, onExecuteDecision }) {
  const groups = groupCharactersByPosition(gameState);
  const [pendingActions, setPendingActions] = useState(null);
  const [pendingRemovalAction, setPendingRemovalAction] = useState(null);

  function getStableSlotIndex(character, groupedSlotIndex) {
    const owningPlayer = gameState.players.find((player) =>
      player.characters.some((candidate) => candidate.id === character.id),
    );

    if (character.position?.type !== 'home' || !owningPlayer) {
      return groupedSlotIndex;
    }

    return owningPlayer.characters.findIndex((candidate) => candidate.id === character.id);
  }

  function handleChooseAction(action) {
    if (
      action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME &&
      action.occupantRemoval?.required &&
      !action.occupantRemoval.removeAll
    ) {
      setPendingActions(null);
      setPendingRemovalAction(action);
      return;
    }

    pendingActions.execute(getActionReference(action));
    setPendingActions(null);
  }

  return (
    <div className="game-board__character-layer" aria-label="Character layer">
      <svg className="game-board__character-surface" viewBox={`0 0 ${BOARD_VIEW_BOX_SIZE} ${BOARD_VIEW_BOX_SIZE}`} focusable="false">
        {Array.from(groups.values()).flatMap((characters) => characters.map((character, slotIndex) => {
          const stableSlotIndex = getStableSlotIndex(character, slotIndex);
          const totalOccupants = character.position?.type === 'home' ? 4 : characters.length;
          const coordinate = getCharacterSlotCoordinate(
            character.position,
            character.factionId,
            stableSlotIndex,
            totalOccupants,
          );

          if (!coordinate) {
            return null;
          }

          return (
            <CharacterPiece
              key={character.id}
              character={character}
              coordinate={coordinate}
              effects={gameState.characterStatesById?.[character.id]?.effects || []}
              actions={actionsByCharacterId.get(character.id) || []}
              decisionActions={decisionActionsByCharacterId.get(character.id) || []}
              onExecuteAction={onExecuteAction}
              onExecuteDecision={onExecuteDecision}
              onRequiresRemoval={setPendingRemovalAction}
              onMultipleActions={(selectedCharacter, actions, execute) => setPendingActions({ character: selectedCharacter, actions, execute })}
            />
          );
        }))}
      </svg>
      {pendingActions && (
        <ActionChooser
          character={pendingActions.character}
          actions={pendingActions.actions}
          onChooseAction={handleChooseAction}
          onClose={() => setPendingActions(null)}
        />
      )}
      {pendingRemovalAction && (
        <OccupantRemovalChooser
          action={pendingRemovalAction}
          gameState={gameState}
          onConfirm={(action, choice) => {
            onExecuteAction(getActionReference(action), choice);
            setPendingRemovalAction(null);
          }}
          onCancel={() => setPendingRemovalAction(null)}
        />
      )}
    </div>
  );
}

export function GameBoard({
  gameState,
  availableActions = [],
  availableDecisionActions = [],
  onExecuteAction,
  onExecuteDecision,
}) {
  const actionsByCharacterId = createActionsByCharacterId(availableActions);
  const decisionActionsByCharacterId = createActionsByCharacterId(availableDecisionActions);
  const presentFactionIds = gameState.players.map((player) => player.factionId);
  const barriers = getVisualBarriers(gameState);

  return (
    <section className="game-board-shell" aria-label="Visual game board">
      <div className="game-board" data-testid="game-board">
        <BoardSurface presentFactionIds={presentFactionIds} />
        <TerrainEffectLayer
          terrainEffectsByPositionKey={gameState.terrainEffectsByPositionKey}
        />
        {barriers.map((barrier) => (
          <BarrierIndicator key={getPositionKey(barrier.position, barrier.factionId)} barrier={barrier} />
        ))}
        <CharacterLayer
          gameState={gameState}
          actionsByCharacterId={actionsByCharacterId}
          decisionActionsByCharacterId={decisionActionsByCharacterId}
          onExecuteAction={onExecuteAction}
          onExecuteDecision={onExecuteDecision}
        />
      </div>
    </section>
  );
}

export default GameBoard;
