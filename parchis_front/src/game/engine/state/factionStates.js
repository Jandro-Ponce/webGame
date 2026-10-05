export function isInitialExitAvailable({ state, factionId }) {
  return state.factionStatesById?.[factionId]?.initialExitAvailable === true;
}

export function getPendingInitialExit({ state, factionId }) {
  return state.factionStatesById?.[factionId]?.pendingInitialExit || null;
}

export function beginPendingInitialExit({ state, factionId, firstCharacterId }) {
  if (!isInitialExitAvailable({ state, factionId })) {
    throw new Error(`Initial exit is not available for faction: ${factionId}`);
  }
  if (getPendingInitialExit({ state, factionId })) {
    throw new Error(`Initial exit is already pending for faction: ${factionId}`);
  }

  return {
    ...state,
    factionStatesById: {
      ...state.factionStatesById,
      [factionId]: {
        ...state.factionStatesById[factionId],
        pendingInitialExit: { roll: 5, firstCharacterId },
      },
    },
  };
}

export function consumeInitialExit({ state, factionId }) {
  if (!isInitialExitAvailable({ state, factionId })) {
    throw new Error(`Initial exit is not available for faction: ${factionId}`);
  }

  return {
    ...state,
    factionStatesById: {
      ...state.factionStatesById,
      [factionId]: {
        ...state.factionStatesById[factionId],
        initialExitAvailable: false,
        pendingInitialExit: null,
      },
    },
  };
}
