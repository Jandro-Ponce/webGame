import React from 'react';

export function TrapTerrainEffect({ effect, cell, positionKey, instanceId }) {
  const inset = Math.min(cell.width, cell.height) * 0.055;
  const radius = Math.min(cell.width, cell.height) * 0.13;
  const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const clipId = `terrain-trap-clip-${safeInstanceId}`;
  const gradientId = `terrain-trap-gradient-${safeInstanceId}`;
  const glowId = `terrain-trap-glow-${safeInstanceId}`;
  const left = cell.x + inset;
  const top = cell.y + inset;
  const width = cell.width - (inset * 2);
  const height = cell.height - (inset * 2);
  const toothCenters = [0.2, 0.4, 0.6, 0.8];

  return (
    <g
      className="terrain-effect terrain-effect--trap"
      data-terrain-effect-type={effect.type}
      data-terrain-position-key={positionKey}
      data-terrain-source-character-id={effect.source?.sourceCharacterId}
      pointerEvents="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8e8e8" stopOpacity="0.55" />
          <stop offset="48%" stopColor="#9a9a9a" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#4a4a4a" stopOpacity="0.4" />
        </linearGradient>
        <filter
          id={glowId}
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur" />
          <feFlood floodColor="#ffad4d" floodOpacity="0.58" result="glowColor" />
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
        className="terrain-effect__trap-glow"
        x={left}
        y={top}
        width={width}
        height={height}
        rx={radius}
        fill={`url(#${gradientId})`}
        filter={`url(#${glowId})`}
      />
      <rect
        className="terrain-effect__trap-wash"
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
      <g className="terrain-effect__trap-mechanism" clipPath={`url(#${clipId})`}>
        <ellipse
          className="terrain-effect__trap-arming-ring"
          cx={cell.x + (cell.width * 0.5)}
          cy={cell.y + (cell.height * 0.5)}
          rx={Math.max(7, cell.width * 0.29)}
          ry={Math.max(5, cell.height * 0.22)}
        />
        <g className="terrain-effect__trap-plate">
          <ellipse
            cx={cell.x + (cell.width * 0.5)}
            cy={cell.y + (cell.height * 0.5)}
            rx={Math.max(4, cell.width * 0.16)}
            ry={Math.max(3, cell.height * 0.12)}
          />
          <ellipse
            cx={cell.x + (cell.width * 0.5)}
            cy={cell.y + (cell.height * 0.5)}
            rx={Math.max(2, cell.width * 0.08)}
            ry={Math.max(1.5, cell.height * 0.06)}
          />
        </g>
        <g className="terrain-effect__trap-teeth terrain-effect__trap-jaw terrain-effect__trap-jaw--upper">
          {toothCenters.map((center) => (
            <polygon
              key={`upper-${center}`}
              className="terrain-effect__trap-tooth"
              points={`${left + (width * (center - 0.085))},${top + (height * 0.16)} ${left + (width * (center + 0.085))},${top + (height * 0.16)} ${left + (width * center)},${top + (height * 0.49)}`}
            />
          ))}
        </g>
        <g className="terrain-effect__trap-teeth terrain-effect__trap-jaw terrain-effect__trap-jaw--lower">
          {toothCenters.map((center) => (
            <polygon
              key={`lower-${center}`}
              className="terrain-effect__trap-tooth"
              points={`${left + (width * (center - 0.085))},${top + (height * 0.84)} ${left + (width * (center + 0.085))},${top + (height * 0.84)} ${left + (width * center)},${top + (height * 0.51)}`}
            />
          ))}
        </g>
        <path
          className="terrain-effect__trap-spark terrain-effect__trap-spark--left"
          d={`M ${left + (width * 0.12)} ${top + (height * 0.34)} l ${width * 0.08} ${-height * 0.08}`}
        />
        <path
          className="terrain-effect__trap-spark terrain-effect__trap-spark--right"
          d={`M ${left + (width * 0.82)} ${top + (height * 0.7)} l ${width * 0.08} ${height * 0.06}`}
        />
      </g>
      <rect
        className="terrain-effect__trap-border"
        x={left}
        y={top}
        width={width}
        height={height}
        rx={radius}
      />
    </g>
  );
}

export default TrapTerrainEffect;
