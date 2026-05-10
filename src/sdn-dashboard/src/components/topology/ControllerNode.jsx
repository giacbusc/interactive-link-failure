import { COLORS } from "../../theme";

export default function ControllerNode({ ctrl }) {
  return (
    <g transform={`translate(${ctrl.x}, ${ctrl.y})`}>
      <rect
        x={-65}
        y={-22}
        width={130}
        height={44}
        rx={6}
        fill={COLORS.white}
        stroke={COLORS.ink}
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      <text
        x={0}
        y={5}
        textAnchor="middle"
        fontSize={13}
        fontWeight={500}
        fill={COLORS.ink}
      >
        SDN Controller
      </text>
    </g>
  );
}
