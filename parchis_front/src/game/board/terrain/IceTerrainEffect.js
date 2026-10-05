import React from 'react';

export function IceTerrainEffect({ effect, cell, positionKey, instanceId }) {
  const inset = Math.min(cell.width, cell.height) * 0.055;
  const radius = Math.min(cell.width, cell.height) * 0.13;
  const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const clipId = `terrain-ice-clip-${safeInstanceId}`;
  const gradientId = `terrain-ice-gradient-${safeInstanceId}`;
  const sheenId = `terrain-ice-sheen-${safeInstanceId}`;
  const glowId = `terrain-ice-glow-${safeInstanceId}`;
  const left = cell.x + inset;
  const top = cell.y + inset;
  const width = cell.width - (inset * 2);
  const height = cell.height - (inset * 2);

  return (
    <g
      className="terrain-effect terrain-effect--ice"
      data-terrain-effect-type={effect.type}
      data-terrain-position-key={positionKey}
      data-terrain-source-character-id={effect.source?.sourceCharacterId}
      pointerEvents="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e7fbff" stopOpacity="0.62" />
          <stop offset="46%" stopColor="#69d9f5" stopOpacity="0.48" />
          <stop offset="100%" stopColor="#2477c9" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="48%" stopColor="#d9fbff" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter
          id={glowId}
          x="-38%"
          y="-38%"
          width="176%"
          height="176%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
          <feFlood floodColor="#8cecff" floodOpacity="0.58" result="glowColor" />
          <feComposite in="glowColor" in2="blur" operator="in" result="softGlow" />
          <feMerge>
            <feMergeNode in="softGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={clipId}>
          <rect x={left} y={top} width={width} height={height} rx={radius} />
        </clipPath>
      </defs>
      <rect
        className="terrain-effect__ice-glow"
        x={left}
        y={top}
        width={width}
        height={height}
        rx={radius}
        fill={`url(#${gradientId})`}
        filter={`url(#${glowId})`}
      />
      <rect
        className="terrain-effect__ice-wash"
        x={left}
        y={top}
        width={width}
        height={height}
        rx={radius}
        fill={`url(#${gradientId})`}
        data-terrain-cell-x={cell.x}
        data-terrain-cell-y={cell.y}
        data-terrain-cell-width={cell.width}
        data-terrain-cell-height={cell.height}
      />
      <rect
        className="terrain-effect__ice-sheen"
        x={left - (width * 0.32)}
        y={top}
        width={width * 0.28}
        height={height}
        fill={`url(#${sheenId})`}
        clipPath={`url(#${clipId})`}
      />
      <g className="terrain-effect__ice-crystals" clipPath={`url(#${clipId})`}>
        <path className="terrain-effect__ice-prism terrain-effect__ice-prism--left" d={`M ${left + (width * 0.12)} ${top + (height * 0.78)} L ${left + (width * 0.42)} ${top + (height * 0.18)} L ${left + (width * 0.58)} ${top + (height * 0.72)}`} />
        <path className="terrain-effect__ice-prism terrain-effect__ice-prism--right" d={`M ${left + (width * 0.45)} ${top + (height * 0.84)} L ${left + (width * 0.7)} ${top + (height * 0.26)} L ${left + (width * 0.9)} ${top + (height * 0.7)}`} />
        <path className="terrain-effect__ice-frost" d={`M ${left + (width * 0.08)} ${top + (height * 0.24)} L ${left + (width * 0.24)} ${top + (height * 0.08)} M ${left + (width * 0.76)} ${top + (height * 0.92)} L ${left + (width * 0.93)} ${top + (height * 0.74)}`} />
      </g>
      <g className="terrain-effect__ice-sparkles" clipPath={`url(#${clipId})`}>
        <circle
          className="terrain-effect__ice-sparkle terrain-effect__ice-sparkle--first"
          cx={left + (width * 0.22)}
          cy={top + (height * 0.3)}
          r={Math.max(1.5, width * 0.025)}
        />
        <circle
          className="terrain-effect__ice-sparkle terrain-effect__ice-sparkle--second"
          cx={left + (width * 0.62)}
          cy={top + (height * 0.18)}
          r={Math.max(1.3, width * 0.021)}
        />
        <circle
          className="terrain-effect__ice-sparkle terrain-effect__ice-sparkle--third"
          cx={left + (width * 0.82)}
          cy={top + (height * 0.54)}
          r={Math.max(1.4, width * 0.023)}
        />
      </g>
      <rect
        className="terrain-effect__ice-border"
        x={left}
        y={top}
        width={width}
        height={height}
        rx={radius}
      />
    </g>
  );
}

export default IceTerrainEffect;
