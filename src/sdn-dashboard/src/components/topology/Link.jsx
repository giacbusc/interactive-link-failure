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

export default function Link({ p1, p2, kind = "data" }) {
  if (!p1 || !p2) return null;

  const size1 = kind === "control" ? CONTROLLER_SIZE : sizeOf(p1);
  const size2 = sizeOf(p2);

  // Tag the controller endpoint so layout helpers can identify it.
  const annotated1 = kind === "control" ? { ...p1, kind: "controller" } : p1;

  const d = linkPath(annotated1, size1, p2, size2);

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
      <path
        d={d}
        fill="none"
        stroke={COLORS.linkFailed}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
    );
  }

  return (
    <path
      d={d}
      fill="none"
      stroke={COLORS.linkColor}
      strokeWidth={1}
    />
  );
}