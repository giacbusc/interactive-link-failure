import { COLORS } from "../../theme";
import {
  SWITCH_SIZE,
  HOST_SIZE,
  CONTROLLER_SIZE,
  linkPath,
} from "../../lib/layout";

function sizeOf(node, kind) {
  if (node === undefined) return SWITCH_SIZE;
  if (kind === "controller") return CONTROLLER_SIZE;
  if (node.kind === "client" || node.kind === "server") return HOST_SIZE;
  return SWITCH_SIZE;
}

/**
 * Data-plane link. Variants:
 *   - data    : default, black line
 *   - active  : currently used by /path — green with halo
 *   - failed  : reported as down — red dashed
 *   - control : controller↔switch — grey dashed
 *
 * onClick (only for data-plane variants) lets the user simulate a
 * failure of this link (interpretation B in App.jsx).
 */
export default function Link({ p1, p2, kind = "data", onClick }) {
  if (!p1 || !p2) return null;

  const size1 = kind === "control" ? CONTROLLER_SIZE : sizeOf(p1);
  const size2 = sizeOf(p2);
  const annotated1 = kind === "control" ? { ...p1, kind: "controller" } : p1;
  const d = linkPath(annotated1, size1, p2, size2);

  // The clickable "hit area": invisible wider path drawn UNDER the
  // visible line, so clicking near it works even if the line is thin.
  const hitArea = onClick ? (
    <path
      d={d}
      fill="none"
      stroke="transparent"
      strokeWidth={14}
      style={{ cursor: "pointer", pointerEvents: "stroke" }}
      onClick={onClick}
    />
  ) : null;

  if (kind === "control") {
    return (
      <path
        d={d}
        fill="none"
        stroke={COLORS.controlLink}
        strokeWidth={1}
        strokeDasharray="2 3"
      />
    );
  }

  if (kind === "failed") {
    return (
      <g>
        {hitArea}
        <path
          d={d}
          fill="none"
          stroke={COLORS.linkFailed}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      </g>
    );
  }

  if (kind === "active") {
    return (
      <g>
        {hitArea}
        <path
          d={d}
          fill="none"
          stroke={COLORS.linkActive}
          strokeWidth={6}
          opacity={0.25}
        />
        <path
          d={d}
          fill="none"
          stroke={COLORS.linkActive}
          strokeWidth={2.5}
        />
      </g>
    );
  }

  return (
    <g>
      {hitArea}
      <path
        d={d}
        fill="none"
        stroke={COLORS.linkColor}
        strokeWidth={1}
      />
    </g>
  );
}