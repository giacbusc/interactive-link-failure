import { COLORS } from "../../theme";

export default function HostNode({ host }) {
  const isClient = host.kind === "client";
  const accent = isClient ? COLORS.ok : COLORS.metricThroughput;

  return (
    <g transform={`translate(${host.x}, ${host.y})`}>
      <rect
        x={-55}
        y={-30}
        width={110}
        height={60}
        rx={6}
        fill={COLORS.white}
        stroke={COLORS.ink}
        strokeWidth={1}
      />
      <text x={0} y={-12} textAnchor="middle" fontSize={12} fill={COLORS.ink}>
        {host.label}
      </text>
      <text
        x={0}
        y={2}
        textAnchor="middle"
        fontSize={10}
        fill={COLORS.inkSoft}
      >
        {host.subtitle}
      </text>

      {/* Status bar (play / download icon + filled bar) */}
      <g transform="translate(-40, 12)">
        {isClient ? (
          // Play triangle (▶)
          <polygon points="0,0 10,5 0,10" fill={accent} />
        ) : (
          // Download arrow (↓)
          <polygon points="0,0 10,0 5,10" fill={accent} />
        )}
        <rect x={14} y={2} width={60} height={6} rx={3} fill={accent} opacity={0.85} />
      </g>
    </g>
  );
}
