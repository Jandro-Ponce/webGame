import React from 'react';

function createCurvePoints(cell) {
  const { x, y, width, height } = cell;

  return {
    first: `M ${x + (width * 0.08)} ${y + (height * 0.82)} C ${x + (width * 0.28)} ${y + (height * 0.38)}, ${x + (width * 0.62)} ${y + (height * 0.72)}, ${x + (width * 0.92)} ${y + (height * 0.16)}`,
    second: `M ${x + (width * 0.12)} ${y + (height * 0.22)} C ${x + (width * 0.42)} ${y + (height * 0.58)}, ${x + (width * 0.64)} ${y + (height * 0.28)}, ${x + (width * 0.88)} ${y + (height * 0.78)}`,
    third: `M ${x + (width * 0.03)} ${y + (height * 0.58)} C ${x + (width * 0.2)} ${y + (height * 0.5)}, ${x + (width * 0.3)} ${y + (height * 0.18)}, ${x + (width * 0.5)} ${y + (height * 0.06)}`,
    fourth: `M ${x + (width * 0.46)} ${y + (height * 0.96)} C ${x + (width * 0.58)} ${y + (height * 0.7)}, ${x + (width * 0.78)} ${y + (height * 0.78)}, ${x + (width * 0.98)} ${y + (height * 0.42)}`,
    fifth: `M ${x + (width * 0.02)} ${y + (height * 0.34)} C ${x + (width * 0.22)} ${y + (height * 0.24)}, ${x + (width * 0.48)} ${y + (height * 0.48)}, ${x + (width * 0.62)} ${y + (height * 0.94)}`,
    branch: `M ${x + (width * 0.36)} ${y + (height * 0.51)} Q ${x + (width * 0.22)} ${y + (height * 0.7)}, ${x + (width * 0.08)} ${y + (height * 0.67)}`,
  };
}

export function VinesTerrainEffect({ effect, cell, positionKey, instanceId }) {
  const inset = Math.min(cell.width, cell.height) * 0.055;
  const radius = Math.min(cell.width, cell.height) * 0.13;
  const curves = createCurvePoints(cell);
  const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const clipId = `terrain-vines-clip-${safeInstanceId}`;
  const gradientId = `terrain-vines-gradient-${safeInstanceId}`;
  const glowId = `terrain-vines-glow-${safeInstanceId}`;

  return (
    <g
      className="terrain-effect terrain-effect--vines"
      data-terrain-effect-type={effect.type}
      data-terrain-position-key={positionKey}
      data-terrain-source-character-id={effect.source?.sourceCharacterId}
      pointerEvents="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8cf5aa" stopOpacity="0.3" />
          <stop offset="48%" stopColor="#2fd36f" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#08743b" stopOpacity="0.44" />
        </linearGradient>
        <filter
          id={glowId}
          x="-45%"
          y="-45%"
          width="190%"
          height="190%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feFlood floodColor="#42ed83" floodOpacity="0.7" result="glowColor" />
          <feComposite in="glowColor" in2="blur" operator="in" result="softGlow" />
          <feMerge>
            <feMergeNode in="softGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={clipId}>
          <rect
            x={cell.x + inset}
            y={cell.y + inset}
            width={cell.width - (inset * 2)}
            height={cell.height - (inset * 2)}
            rx={radius}
          />
        </clipPath>
      </defs>
      <rect
        className="terrain-effect__vines-glow"
        x={cell.x + inset}
        y={cell.y + inset}
        width={cell.width - (inset * 2)}
        height={cell.height - (inset * 2)}
        rx={radius}
        fill={`url(#${gradientId})`}
        filter={`url(#${glowId})`}
      />
      <rect
        className="terrain-effect__vines-wash"
        x={cell.x + inset}
        y={cell.y + inset}
        width={cell.width - (inset * 2)}
        height={cell.height - (inset * 2)}
        rx={radius}
        fill={`url(#${gradientId})`}
        data-terrain-cell-x={cell.x}
        data-terrain-cell-y={cell.y}
        data-terrain-cell-width={cell.width}
        data-terrain-cell-height={cell.height}
      />
      <g clipPath={`url(#${clipId})`}>
        <path className="terrain-effect__vine terrain-effect__vine--primary" d={curves.first} />
        <path className="terrain-effect__vine terrain-effect__vine--secondary" d={curves.second} />
        <path className="terrain-effect__vine terrain-effect__vine--tertiary" d={curves.third} />
        <path className="terrain-effect__vine terrain-effect__vine--fourth" d={curves.fourth} />
        <path className="terrain-effect__vine terrain-effect__vine--fifth" d={curves.fifth} />
        <path className="terrain-effect__vine terrain-effect__vine--branch" d={curves.branch} />
        <path className="terrain-effect__vine-energy terrain-effect__vine-energy--primary" d={curves.first} />
        <path className="terrain-effect__vine-energy terrain-effect__vine-energy--secondary" d={curves.second} />
        <path className="terrain-effect__vine-energy terrain-effect__vine-energy--third" d={curves.third} />
        <g className="terrain-effect__leaf-sway terrain-effect__leaf-sway--first">
          <ellipse
            className="terrain-effect__leaf"
            cx={cell.x + (cell.width * 0.31)}
            cy={cell.y + (cell.height * 0.47)}
            rx={Math.max(3, cell.width * 0.075)}
            ry={Math.max(2, cell.height * 0.045)}
            transform={`rotate(-28 ${cell.x + (cell.width * 0.31)} ${cell.y + (cell.height * 0.47)})`}
          />
        </g>
        <g className="terrain-effect__leaf-sway terrain-effect__leaf-sway--second">
          <ellipse
            className="terrain-effect__leaf terrain-effect__leaf--pale"
            cx={cell.x + (cell.width * 0.7)}
            cy={cell.y + (cell.height * 0.55)}
            rx={Math.max(3, cell.width * 0.075)}
            ry={Math.max(2, cell.height * 0.045)}
            transform={`rotate(32 ${cell.x + (cell.width * 0.7)} ${cell.y + (cell.height * 0.55)})`}
          />
        </g>
        <g className="terrain-effect__leaf-sway terrain-effect__leaf-sway--third">
          <ellipse
            className="terrain-effect__leaf terrain-effect__leaf--small"
            cx={cell.x + (cell.width * 0.24)}
            cy={cell.y + (cell.height * 0.34)}
            rx={Math.max(2.6, cell.width * 0.06)}
            ry={Math.max(1.8, cell.height * 0.037)}
            transform={`rotate(48 ${cell.x + (cell.width * 0.24)} ${cell.y + (cell.height * 0.34)})`}
          />
        </g>
        <g className="terrain-effect__leaf-sway terrain-effect__leaf-sway--fourth">
          <ellipse
            className="terrain-effect__leaf terrain-effect__leaf--pale terrain-effect__leaf--small"
            cx={cell.x + (cell.width * 0.78)}
            cy={cell.y + (cell.height * 0.7)}
            rx={Math.max(2.6, cell.width * 0.06)}
            ry={Math.max(1.8, cell.height * 0.037)}
            transform={`rotate(-42 ${cell.x + (cell.width * 0.78)} ${cell.y + (cell.height * 0.7)})`}
          />
        </g>
        <circle
          className="terrain-effect__vine-sprout terrain-effect__vine-sprout--first"
          cx={cell.x + (cell.width * 0.19)}
          cy={cell.y + (cell.height * 0.7)}
          r={Math.max(1.8, cell.width * 0.027)}
        />
        <circle
          className="terrain-effect__vine-sprout terrain-effect__vine-sprout--second"
          cx={cell.x + (cell.width * 0.57)}
          cy={cell.y + (cell.height * 0.45)}
          r={Math.max(1.5, cell.width * 0.022)}
        />
        <circle
          className="terrain-effect__vine-sprout terrain-effect__vine-sprout--third"
          cx={cell.x + (cell.width * 0.81)}
          cy={cell.y + (cell.height * 0.3)}
          r={Math.max(1.4, cell.width * 0.02)}
        />
      </g>
      <rect
        className="terrain-effect__vines-border"
        x={cell.x + inset}
        y={cell.y + inset}
        width={cell.width - (inset * 2)}
        height={cell.height - (inset * 2)}
        rx={radius}
      />
    </g>
  );
}

export default VinesTerrainEffect;
