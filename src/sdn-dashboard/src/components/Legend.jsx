import { Circle } from "lucide-react";
import { COLORS } from "../theme";

export default function Legend() {
  return (
    <footer
      className="mx-4 mb-4 px-6 py-3 rounded-lg flex items-center justify-center gap-8 text-sm"
      style={{
        backgroundColor: COLORS.sidebar,
        border: `1px solid ${COLORS.ink}`,
      }}
    >
      <div className="flex items-center gap-2">
        <svg width="32" height="2">
          <line
            x1={0}
            y1={1}
            x2={32}
            y2={1}
            stroke={COLORS.linkFailed}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </svg>
        <span style={{ color: COLORS.ink }}>Failed Link</span>
      </div>

      <div className="flex items-center gap-2">
        <Circle size={12} fill={COLORS.ok} stroke="none" />
        <span style={{ color: COLORS.ink }}>Port Up</span>
      </div>

      <div className="flex items-center gap-2">
        <Circle size={12} fill={COLORS.error} stroke="none" />
        <span style={{ color: COLORS.ink }}>Port Down</span>
      </div>

      <div className="flex items-center gap-2">
        <Circle size={12} fill={COLORS.warning} stroke="none" />
        <span style={{ color: COLORS.ink }}>Congested</span>
      </div>
    </footer>
  );
}
