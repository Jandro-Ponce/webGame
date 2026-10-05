import React from 'react';

export function DizzyCharacterStatus({ effect }) {
  return (
    <span
      className="character-status character-status--dizzy"
      data-character-status-type={effect.type}
      data-character-status-id={effect.id}
      aria-hidden="true"
    >
      <span className="character-status__dizzy-frame" />
      <span className="character-status__dizzy-icon">&#128165;</span>
    </span>
  );
}

export default DizzyCharacterStatus;