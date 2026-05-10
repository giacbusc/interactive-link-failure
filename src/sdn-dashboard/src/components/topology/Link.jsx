import { COLORS } from "../../theme";
import {
  SWITCH_SIZE,
  HOST_SIZE,
  CONTROLLER_SIZE,
  linkEndpoints,
} from "../../lib/layout";

/**
 * Resolve the bounding-box size of an endpoint based on what kind of
 * node it is. We pass the actual endpoint object (with its position
 * fields) and look up the size from its shape.
 */
function sizeOf(node, kind) {
  // The controller is the only node addressed by the magic id "ctrl".
  // Hosts are objects produced by transformTopology with a `kind` field
  // ("client" / "server"). Anything else is a switch.
  if (node === undefined) return SWITCH_SIZE;
  if (kind === "controller") return CONTROLLER_SIZE;
  if (node.kind === "client" || node.kind === "server") return HOST_SIZE;
  return SWITCH_SIZE;
}

export default function Link({ p1, p2, kind = "data" }) {
  if (!p1 || !p2) return null;

  // For control links, p1 is the controller; for data links it's a switch.
  const size1 = kind === "control" ? CONTROLLER_SIZE : sizeOf(p1);
  const size2 = sizeOf(p2);

  const { a, b } = linkEndpoints(p1, size1, p2, size2);

  if (kind === "control") {
    return (
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={COLORS.controlLink}
        strokeWidth={1}
        strokeDasharray="2 3"
      />
    );
  }

  if (kind === "failed") {
    return (
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={COLORS.linkFailed}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
    );
  }

  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={COLORS.linkColor}
      strokeWidth={1}
    />
  );
}
