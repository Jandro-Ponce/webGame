import { useState } from 'react';
import { completeGameSetup } from '../engine';
import { useGameEngine } from './useGameEngine';
import { useGameSetup } from './useGameSetup';

export const LOCAL_DEV_GAME_MODES = Object.freeze({
  SETUP: 'setup',
  GAME: 'game',
});

export function useLocalDevGameSession({ shuffle, pick } = {}) {
  const [mode, setMode] = useState(LOCAL_DEV_GAME_MODES.SETUP);
  const setup = useGameSetup({ shuffle, pick });
  const game = useGameEngine();

  function startGame() {
    const { gameState } = completeGameSetup({ setupState: setup.setupState });

    game.startGame({ gameState });
    setMode(LOCAL_DEV_GAME_MODES.GAME);
  }

  return {
    mode,
    setup,
    game,
    startGame,
  };
}

export default useLocalDevGameSession;
