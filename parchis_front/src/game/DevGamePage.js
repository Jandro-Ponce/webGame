import React, { useState } from 'react';
import {
  EXECUTABLE_ACTION_TYPES,
  EXECUTION_EVENT_TYPES,
  DECISION_TYPES,
  SETUP_PHASES,
  TURN_PHASES,
} from './engine';
import { AbilityDecisionModal } from './abilities/AbilityDecisionModal';
import './DevGamePage.css';
import { GameBoard } from './board/GameBoard';
import { GameDice } from './dice/GameDice';
import { LOCAL_DEV_GAME_MODES, useLocalDevGameSession } from './hooks/useLocalDevGameSession';

const ROLL_VALUES = [1, 2, 3, 4, 5, 6];

function formatValue(value) {
  if (value === null || value === undefined) {
    return 'none';
  }

  return String(value);
}

function formatReward(reward) {
  if (!reward) {
    return 'none';
  }

  if (reward.source) {
    return `${reward.source.type} by ${reward.source.characterId}: ${reward.steps} for ${reward.ownerFactionId}`;
  }

  return JSON.stringify(reward);
}

function formatPosition(position) {
  if (!position) {
    return 'unknown';
  }

  if (position.type === 'home') {
    return 'HOME';
  }

  if (position.type === 'common') {
    return `common ${position.square}`;
  }

  if (position.type === 'finalLane') {
    return `finalLane ${position.factionId} ${position.index}`;
  }

  if (position.type === 'goal') {
    return 'GOAL';
  }

  return JSON.stringify(position);
}

function formatPath(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return 'none';
  }

  return path.map(formatPosition).join(' -> ');
}

function getCharacterById(gameState, characterId) {
  return gameState.players
    .flatMap((player) => player.characters)
    .find((character) => character.id === characterId);
}

function getCharacterLabel(gameState, characterId) {
  const character = getCharacterById(gameState, characterId);

  if (!character) {
    return characterId;
  }

  return `${character.name} (${character.id})`;
}

function getPlayerLabel(players, playerId) {
  const player = players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return playerId;
  }

  return `${player.name} (${player.id})`;
}

function formatFactionChoice(factionId) {
  return factionId || 'pending';
}

function formatEvent(event, gameState) {
  if (!event || !event.type) {
    return 'Unknown event';
  }

  if (event.type === EXECUTION_EVENT_TYPES.CHARACTER_MOVED) {
    const movementDetails = [event.actionType, event.steps ? `${event.steps} steps` : null]
      .filter(Boolean)
      .join(', ');

    return `${getCharacterLabel(gameState, event.characterId)} moved ${formatPosition(event.from)} -> ${formatPosition(event.to)}${movementDetails ? ` (${movementDetails})` : ''}`;
  }

  if (event.type === EXECUTION_EVENT_TYPES.CHARACTER_CAPTURED) {
    return `${getCharacterLabel(gameState, event.characterId)} captured ${getCharacterLabel(gameState, event.capturedCharacterId)}`;
  }

  if (event.type === EXECUTION_EVENT_TYPES.CHARACTER_REACHED_GOAL) {
    return `${getCharacterLabel(gameState, event.characterId)} reached GOAL`;
  }

  if (event.type === EXECUTION_EVENT_TYPES.CHARACTER_EXITED_HOME) {
    return `${getCharacterLabel(gameState, event.characterId)} exited HOME to ${formatPosition(event.to)}`;
  }

  if (event.type === EXECUTION_EVENT_TYPES.CHARACTER_REMOVED_FROM_START) {
    return `${getCharacterLabel(gameState, event.characterId)} returned HOME from start`;
  }

  if (event.type === EXECUTION_EVENT_TYPES.BARRIER_BROKEN) {
    return `${getCharacterLabel(gameState, event.characterId)} broke barrier at ${formatPosition(event.position)}`;
  }

  if (event.type === EXECUTION_EVENT_TYPES.REWARD_LOST) {
    return `${event.rewardType} lost for ${getCharacterLabel(gameState, event.characterId)} (${event.reason})`;
  }

  return event.type;
}

function ActionDetails({ action }) {
  const movement = action.movement;

  return (
    <dl className="dev-game-action-details">
      <dt>Type</dt>
      <dd>{action.type}</dd>
      {action.id && (
        <>
          <dt>Action ID</dt>
          <dd>{action.id}</dd>
        </>
      )}
      <dt>Character</dt>
      <dd>{action.characterId}</dd>
      {action.steps && (
        <>
          <dt>Steps</dt>
          <dd>{action.steps}</dd>
        </>
      )}
      {action.rewardSteps && (
        <>
          <dt>Reward budget</dt>
          <dd>{action.rewardSteps}</dd>
        </>
      )}
      {action.destination && (
        <>
          <dt>Destination</dt>
          <dd>{formatPosition(action.destination)}</dd>
        </>
      )}
      {movement?.destination && (
        <>
          <dt>Destination</dt>
          <dd>{formatPosition(movement.destination)}</dd>
        </>
      )}
      {movement?.path && (
        <>
          <dt>Path</dt>
          <dd>{formatPath(movement.path)}</dd>
        </>
      )}
      {movement?.outcome && (
        <>
          <dt>Outcome</dt>
          <dd>{JSON.stringify(movement.outcome)}</dd>
        </>
      )}
      {action.barrier && (
        <>
          <dt>Barrier</dt>
          <dd>
            {formatPosition(action.barrier.position)} | {action.barrier.occupantCharacterIds.join(', ')}
          </dd>
        </>
      )}
    </dl>
  );
}

function RollControls({ disabled, onRoll }) {
  return (
    <section className="dev-game-card" aria-label="Roll controls">
      <h2>Deterministic Roll</h2>
      <div className="dev-game-roll-grid">
        {ROLL_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className="dev-game-roll-button"
            disabled={disabled}
            onClick={() => onRoll(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </section>
  );
}

function GameStatusPanel({ gameState, turnState, currentPlayer, availableActions, pendingDecision, availableDecisionActions }) {
  return (
    <section className="dev-game-card dev-game-status" aria-label="Game status">
      <h2>Game Status</h2>
      <dl>
        <dt>Game phase</dt>
        <dd>{gameState.phase}</dd>
        <dt>Current player</dt>
        <dd>{currentPlayer.name} ({gameState.currentPlayerId})</dd>
        <dt>Faction</dt>
        <dd>{currentPlayer.factionId}</dd>
        <dt>Turn phase</dt>
        <dd>{formatValue(turnState?.phase)}</dd>
        <dt>Current roll</dt>
        <dd>{formatValue(turnState?.currentRoll)}</dd>
        <dt>Consecutive sixes</dt>
        <dd>{formatValue(turnState?.consecutiveSixes)}</dd>
        <dt>Winner</dt>
        <dd>{formatValue(gameState.winnerPlayerId)}</dd>
        <dt>Available actions</dt>
        <dd>{availableActions.length}</dd>
        <dt>Pending decision</dt>
        <dd>{pendingDecision ? pendingDecision.type : 'none'}</dd>
        <dt>Decision source</dt>
        <dd>{pendingDecision?.reward ? formatReward(pendingDecision.reward) : 'none'}</dd>
        <dt>Decision actions</dt>
        <dd>{availableDecisionActions.length}</dd>
      </dl>
    </section>
  );
}

function CurrentTurnIndicator({ gameState, turnState, currentPlayer }) {
  const factionId = currentPlayer?.factionId || turnState?.factionId || 'unknown';
  const playerId = gameState?.currentPlayerId || currentPlayer?.id || 'unknown';
  const playerName = currentPlayer?.name || playerId;

  return (
    <section
      className={`dev-game-turn-indicator dev-game-turn-indicator--${factionId}`}
      aria-label="Current turn"
      data-current-player-id={playerId}
      data-current-faction={factionId}
    >
      <p className="dev-game-turn-indicator__kicker">Turn</p>
      <div className="dev-game-turn-indicator__player">
        <strong>{playerName}</strong>
        <span>{playerId}</span>
      </div>
      <div className="dev-game-turn-indicator__details">
        <div>
          <span>Faction</span>
          <strong>{factionId}</strong>
        </div>
        <div>
          <span>Phase</span>
          <strong>{formatValue(turnState?.phase)}</strong>
        </div>
      </div>
    </section>
  );
}

function AvailableActionCard({ action, gameState, onExecuteAction }) {
  const [removeCharacterId, setRemoveCharacterId] = useState(action.occupantRemoval?.removableCharacterIds?.[0] || '');
  const needsRemoval =
    action.type === EXECUTABLE_ACTION_TYPES.EXIT_HOME &&
    action.occupantRemoval?.required &&
    !action.occupantRemoval.removeAll;

  function handleExecute() {
    const actionReference = action.id ? { id: action.id } : action;

    if (needsRemoval) {
      onExecuteAction(actionReference, { removeCharacterId });
      return;
    }

    onExecuteAction(actionReference);
  }

  return (
    <article className="dev-game-action-card">
      <header>
        <h3>{getCharacterLabel(gameState, action.characterId)}</h3>
        <span>{action.type}</span>
      </header>
      <ActionDetails action={action} />
      {needsRemoval && (
        <label className="dev-game-field">
          Remove occupant
          <select value={removeCharacterId} onChange={(event) => setRemoveCharacterId(event.target.value)}>
            {action.occupantRemoval.removableCharacterIds.map((characterId) => (
              <option key={characterId} value={characterId}>
                {getCharacterLabel(gameState, characterId)}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className="dev-game-primary-button" onClick={handleExecute}>
        Execute
      </button>
    </article>
  );
}

function AvailableActionsPanel({ actions, gameState, onExecuteAction }) {
  return (
    <section className="dev-game-card" aria-label="Available actions">
      <h2>Available Actions</h2>
      {actions.length === 0 ? (
        <p className="dev-game-muted">No actions available.</p>
      ) : (
        <div className="dev-game-action-list">
          {actions.map((action) => (
            <AvailableActionCard
              key={action.id || `${action.type}:${action.characterId}`}
              action={action}
              gameState={gameState}
              onExecuteAction={onExecuteAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DecisionActionsPanel({ pendingDecision, actions, gameState, onExecuteDecision }) {
  return (
    <section className="dev-game-card" aria-label="Decision actions">
      <h2>Decision Actions</h2>
      <p className="dev-game-muted">
        Pending: {pendingDecision ? pendingDecision.type : 'none'}
        {pendingDecision?.reward ? ` (${formatReward(pendingDecision.reward)})` : ''}
      </p>
      {actions.length === 0 ? (
        <p className="dev-game-muted">No decision actions available.</p>
      ) : (
        <div className="dev-game-action-list">
          {actions.map((action) => (
            <article className="dev-game-action-card" key={action.id}>
              <header>
                <h3>{getCharacterLabel(gameState, action.characterId)}</h3>
                <span>{action.type}</span>
              </header>
              <ActionDetails action={action} />
              <button type="button" className="dev-game-primary-button" onClick={() => onExecuteDecision(action.id)}>
                Execute decision
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PositionsPanel({ gameState }) {
  return (
    <section className="dev-game-card" aria-label="Character positions">
      <h2>Positions</h2>
      <div className="dev-game-table-wrap">
        <table className="dev-game-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Faction</th>
              <th>Character</th>
              <th>ID</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {gameState.players.flatMap((player) => player.characters.map((character) => (
              <tr key={character.id}>
                <td>{player.name}</td>
                <td>{player.factionId}</td>
                <td>{character.name}</td>
                <td>{character.id}</td>
                <td>{formatPosition(character.position)}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LastEventsPanel({ events, gameState }) {
  return (
    <section className="dev-game-card" aria-label="Last events">
      <h2>Last Events</h2>
      {events.length === 0 ? (
        <p className="dev-game-muted">No events from the last operation.</p>
      ) : (
        <div className="dev-game-event-list">
          {events.map((event, index) => (
            <details key={`${event.type}:${index}`} className="dev-game-event" open>
              <summary>{formatEvent(event, gameState)}</summary>
              <pre>{JSON.stringify(event, null, 2)}</pre>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function PlayerCountPanel({ setup }) {
  return (
    <section className="dev-game-card" aria-label="Player setup">
      <h2>Players</h2>
      <p className="dev-game-muted">Choose the local player count before the first draw.</p>
      <div className="dev-game-choice-grid dev-game-player-count-grid">
        {[2, 3, 4].map((count) => (
          <button
            key={count}
            type="button"
            className={setup.playerCount === count ? 'dev-game-choice-button dev-game-choice-button-active' : 'dev-game-choice-button'}
            disabled={!setup.canChangePlayerCount}
            onClick={() => setup.setPlayerCount(count)}
          >
            {count} players
          </button>
        ))}
      </div>
      <ol className="dev-game-compact-list">
        {setup.players.map((player) => (
          <li key={player.id}>{player.name}</li>
        ))}
      </ol>
    </section>
  );
}

function OrderList({ order, players, emptyText }) {
  if (!Array.isArray(order) || order.length === 0) {
    return <p className="dev-game-muted">{emptyText}</p>;
  }

  return (
    <ol className="dev-game-order-list">
      {order.map((playerId) => (
        <li key={playerId}>{getPlayerLabel(players, playerId)}</li>
      ))}
    </ol>
  );
}

function FactionSelectionOrderPanel({ setup }) {
  return (
    <section className="dev-game-card" aria-label="Faction selection order">
      <h2>Faction Selection Draw</h2>
      <p className="dev-game-muted">First draw: only decides who chooses faction first.</p>
      {setup.setupState.phase === SETUP_PHASES.WAITING_FOR_FACTION_SELECTION_ORDER && (
        <button type="button" className="dev-game-primary-button" onClick={setup.sortFactionSelectionOrder}>
          Sort faction selection order
        </button>
      )}
      <OrderList
        order={setup.setupState.factionSelectionOrder}
        players={setup.players}
        emptyText="Faction selection order has not been sorted yet."
      />
    </section>
  );
}

function FactionChoicesSummary({ setup }) {
  return (
    <div className="dev-game-summary-block" aria-label="Faction choices summary">
      <h3>Faction Choices</h3>
      <dl className="dev-game-summary-list">
        {setup.players.map((player) => (
          <React.Fragment key={player.id}>
            <dt>{player.name}</dt>
            <dd>{formatFactionChoice(setup.factionChoiceByPlayerId[player.id])}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function FactionChoicePanel({ setup }) {
  const isChoosing = setup.setupState.phase === SETUP_PHASES.CHOOSING_FACTIONS;

  return (
    <section className="dev-game-card" aria-label="Faction choices">
      <h2>Faction Choice</h2>
      {isChoosing ? (
        <>
          <p className="dev-game-callout">
            {setup.currentSelectionPlayer.name}, choose your faction
          </p>
          <div className="dev-game-choice-grid">
            {setup.availableFactions.map((faction) => (
              <button
                key={faction.id}
                type="button"
                className="dev-game-choice-button"
                disabled={!faction.available}
                onClick={() => setup.chooseFaction({
                  playerId: setup.currentSelectionPlayer.id,
                  factionId: faction.id,
                })}
              >
                {faction.id}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="dev-game-muted">Faction choice starts after the first draw.</p>
      )}
      <FactionChoicesSummary setup={setup} />
    </section>
  );
}

function TurnOrderPanel({ setup }) {
  return (
    <section className="dev-game-card" aria-label="Turn order">
      <h2>Starting Faction Draw</h2>
      <p className="dev-game-muted">
        Second independent draw: decides who starts. Turns then follow yellow, blue, red, green.
      </p>
      {setup.setupState.phase === SETUP_PHASES.WAITING_FOR_TURN_ORDER && (
        <button type="button" className="dev-game-primary-button" onClick={setup.drawStartingFaction}>
          Draw starting faction
        </button>
      )}
      <p>Starting faction: {formatValue(setup.setupState.startingFactionId)}</p>
      <OrderList
        order={setup.setupState.turnOrder}
        players={setup.players}
        emptyText="Starting faction has not been drawn yet."
      />
    </section>
  );
}

function SetupSummaryPanel({ setup, onStartGame }) {
  if (setup.setupState.phase !== SETUP_PHASES.COMPLETED) {
    return null;
  }

  return (
    <section className="dev-game-card dev-game-start-card" aria-label="Setup summary">
      <h2>Setup Summary</h2>
      <div className="dev-game-summary-grid">
        <div className="dev-game-summary-block">
          <h3>Players</h3>
          <ol className="dev-game-compact-list">
            {setup.players.map((player) => (
              <li key={player.id}>{getPlayerLabel(setup.players, player.id)}</li>
            ))}
          </ol>
        </div>
        <FactionChoicesSummary setup={setup} />
        <div className="dev-game-summary-block">
          <h3>Faction Selection Order</h3>
          <OrderList order={setup.setupState.factionSelectionOrder} players={setup.players} emptyText="none" />
        </div>
        <div className="dev-game-summary-block">
          <h3>Turn Order</h3>
          <OrderList order={setup.setupState.turnOrder} players={setup.players} emptyText="none" />
        </div>
      </div>
      <button type="button" className="dev-game-primary-button" onClick={onStartGame}>
        Start game
      </button>
    </section>
  );
}

function DevGameSetupContent({ setup, onStartGame }) {
  return (
    <main className="dev-game-page">
      <header className="dev-game-hero">
        <p className="dev-game-kicker">Engine setup lab</p>
        <h1>Dev Game Setup</h1>
        <p>
          Temporary setup flow using the real Game Setup APIs before creating Game Flow.
        </p>
      </header>

      <div className="dev-game-setup-grid">
        <PlayerCountPanel setup={setup} />
        <FactionSelectionOrderPanel setup={setup} />
        <FactionChoicePanel setup={setup} />
        <TurnOrderPanel setup={setup} />
        <SetupSummaryPanel setup={setup} onStartGame={onStartGame} />
      </div>
    </main>
  );
}

export function DevGamePageGameContent({ engine }) {
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const canRoll = engine.turnState?.phase === TURN_PHASES.WAITING_FOR_ROLL;
  const rollControlsDisabled = !canRoll || isDiceRolling;
  const isAbilityDecision = engine.pendingDecision?.type === DECISION_TYPES.OPTIONAL_ABILITY_ACTIVATION;

  return (
    <main className="dev-game-page dev-game-page--game">
      <section className="dev-game-stage" aria-label="Game screen">
        <div className="dev-game-stage__side">
          <header className="dev-game-hero dev-game-hero--game">
            <p className="dev-game-kicker">Engine integration lab</p>
            <h1>Dev Game Engine</h1>
            <p>
              Temporary controls for observing a real engine-driven match. No board clicks, no manual destinations.
            </p>
          </header>
          <CurrentTurnIndicator
            gameState={engine.gameState}
            turnState={engine.turnState}
            currentPlayer={engine.currentPlayer}
          />
          <GameDice
            disabled={rollControlsDisabled}
            value={engine.turnState?.currentRoll}
            onRoll={engine.registerRoll}
            onRollingChange={setIsDiceRolling}
          />
        </div>

        <div className="dev-game-board-focus">
          <GameBoard
            gameState={engine.gameState}
            turnState={engine.turnState}
            currentPlayer={engine.currentPlayer}
            availableActions={engine.availableActions}
            availableDecisionActions={isAbilityDecision ? [] : engine.availableDecisionActions}
            onExecuteAction={engine.executeAction}
            onExecuteDecision={engine.executeDecision}
          />
        </div>
      </section>

      {isAbilityDecision && (
        <AbilityDecisionModal
          gameState={engine.gameState}
          pendingDecision={engine.pendingDecision}
          availableDecisionActions={engine.availableDecisionActions}
          onSelectActionId={engine.executeDecision}
        />
      )}

      <section className="dev-game-debug-section" aria-label="Development tools">
        <header className="dev-game-debug-header">
          <p className="dev-game-kicker">Development controls</p>
          <h2>Debug Panels</h2>
        </header>

        <div className="dev-game-layout">
          <div className="dev-game-column">
            <RollControls disabled={rollControlsDisabled} onRoll={engine.registerRoll} />
            <GameStatusPanel
              gameState={engine.gameState}
              turnState={engine.turnState}
              currentPlayer={engine.currentPlayer}
              availableActions={engine.availableActions}
              pendingDecision={engine.pendingDecision}
              availableDecisionActions={engine.availableDecisionActions}
            />
            <LastEventsPanel events={engine.lastEvents} gameState={engine.gameState} />
          </div>

          <div className="dev-game-column dev-game-column-wide">
            <AvailableActionsPanel
              actions={engine.availableActions}
              gameState={engine.gameState}
              onExecuteAction={engine.executeAction}
            />
            <DecisionActionsPanel
              pendingDecision={engine.pendingDecision}
              actions={engine.availableDecisionActions}
              gameState={engine.gameState}
              onExecuteDecision={engine.executeDecision}
            />
            <PositionsPanel gameState={engine.gameState} />
          </div>
        </div>
      </section>
    </main>
  );
}

export function DevGamePageContent({ session }) {
  if (session.mode === LOCAL_DEV_GAME_MODES.SETUP) {
    return <DevGameSetupContent setup={session.setup} onStartGame={session.startGame} />;
  }

  return <DevGamePageGameContent engine={session.game} />;
}

function DevGamePage() {
  const session = useLocalDevGameSession();

  return <DevGamePageContent session={session} />;
}

export default DevGamePage;
