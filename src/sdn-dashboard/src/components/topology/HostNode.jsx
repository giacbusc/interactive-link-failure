import { COLORS } from "../../theme";

export default function HostNode({ host, onClick, highlighted }) {
  const isClient = host.kind === "client";
  const accent = isClient ? COLORS.ok : COLORS.metricThroughput;

  return (
    <g
      transform={`translate(${host.x}, ${host.y})`}
      onClick={() => onClick && onClick(host)}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <rect
        x={-55}
        y={-30}
        width={110}
        height={60}
        rx={6}
        fill={COLORS.white}
        stroke={highlighted ? COLORS.info : COLORS.ink}
        strokeWidth={highlighted ? 2 : 1}
      />
      <text
        x={0}
        y={-12}
        textAnchor="middle"
        fontSize={12}
        fill={COLORS.ink}
        style={{ pointerEvents: "none" }}
      >
        {host.label}
      </text>
      <text
        x={0}
        y={2}
        textAnchor="middle"
        fontSize={10}
        fill={COLORS.inkSoft}
        style={{ pointerEvents: "none" }}
      >
        {host.subtitle}
      </text>

      <g
        transform="translate(-40, 12)"
        style={{ pointerEvents: "none" }}
      >
        {isClient ? (
          <polygon points="0,0 10,5 0,10" fill={accent} />
        ) : (
          <polygon points="0,0 10,0 5,10" fill={accent} />
        )}
        <rect
          x={14}
          y={2}
          width={60}
          height={6}
          rx={3}
          fill={accent}
          opacity={0.85}
        />
      </g>
    </g>
  );
}