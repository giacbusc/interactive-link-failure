import { COLORS } from "../../theme";

const PORT_COLOR = {
  up: COLORS.ok,
  down: COLORS.error,
  congested: COLORS.warning,
};

export default function SwitchNode({ sw, selected, onClick }) {
  return (
    <g
      transform={`translate(${sw.x}, ${sw.y})`}
      onClick={() => onClick && onClick(sw)}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={-50}
        y={-22}
        width={100}
        height={44}
        rx={6}
        fill={COLORS.white}
        stroke={selected ? COLORS.info : COLORS.ink}
        strokeWidth={selected ? 2 : 1}
      />
      <text
        x={0}
        y={5}
        textAnchor="middle"
        fontSize={13}
        fill={COLORS.ink}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {sw.label}
      </text>

      {sw.ports && (
        <g transform={`translate(${-(sw.ports.length * 12) / 2 + 6}, 35)`}>
          {sw.ports.map((p, i) => (
            <circle
              key={i}
              cx={i * 12}
              cy={0}
              r={4}
              fill={PORT_COLOR[p.state] || COLORS.inkSoft}
            />
          ))}
        </g>
      )}
    </g>
  );
}