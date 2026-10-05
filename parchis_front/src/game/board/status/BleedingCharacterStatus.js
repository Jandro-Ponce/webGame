import React from 'react';

export function BleedingCharacterStatus({ effect }) {
  const remaining = effect.data?.remainingTurns ?? 3;

  return (
    <span
      className="character-status character-status--bleeding"
      data-character-status-type={effect.type}
      data-character-status-id={effect.id}
      aria-hidden="true"
    >
      <span className="character-status__bleeding-frame" />
      <span className="character-status__bleeding-icon">&#128293;</span>
      <span className="character-status__bleeding-count">{remaining}</span>
    </span>
  );
}

export default BleedingCharacterStatus;