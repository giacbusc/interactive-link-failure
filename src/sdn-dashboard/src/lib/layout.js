// Fixed layout for the dashboard topology view.
//
// The lab demo has at most 6 switches and 2 hosts (the two Raspberry Pis).
// Every possible node has a fixed slot — the data layer only decides
// which slots are *active*. Inactive slots are not rendered.
// Fixed layout for the dashboard topology view.

export const VIEWBOX = { width: 800, height: 600 };

export const SWITCH_SIZE = { w: 100, h: 44 };
export const HOST_SIZE = { w: 110, h: 60 };
export const CONTROLLER_SIZE = { w: 130, h: 44 };

export const CONTROLLER_POSITION = { x: 400, y: 60 };

export const SWITCH_SLOTS = {
  1: { x: 250, y: 220 },
  2: { x: 400, y: 220 },
  3: { x: 550, y: 220 },
  4: { x: 250, y: 400 },
  5: { x: 400, y: 400 },
  6: { x: 550, y: 400 },
};

export const HOST_SLOTS = {
  client: { x: 90, y: 310 },
  server: { x: 710, y: 310 },
};

// Tower order: top of the rack → bottom of the rack maps to slot 1 → 5.
export const SWITCH_DPID_TO_SLOT = {
  // Mininet uses small numeric DPIDs (1, 2, 3) for linear/ring/full_mesh
  1: 1,
  2: 2,
  3: 3,
  // Add the lab DPIDs back here when you switch contexts:
  // 123917682136935: 1,
  // 123917682136955: 2,
  // 123917682136941: 3,
  // 123917682136938: 4,
  // 123917682136957: 5,
};

// Lab Raspberry Pi MACs. Update if hardware changes.
//const CLIENT_MAC = "b8:27:eb:c2:10:5d";  // 10.10.6.45
//const SERVER_MAC = "b8:27:eb:d6:d4:c6";  // 10.10.6.44

const CLIENT_MAC = "00:00:00:00:00:01";  // h1 in Mininet
const SERVER_MAC = "00:00:00:00:00:02";  // h2 in Mininet


export function classifyHost(mac) {
  if (!mac) return "client";
  const lower = mac.toLowerCase();
  if (lower === SERVER_MAC.toLowerCase()) return "server";
  if (lower === CLIENT_MAC.toLowerCase()) return "client";
  return "client";
}

export function hostLabel(slot) {
  return slot === "server"
    ? { label: "VLC Server", subtitle: "(Rasp. 2)" }
    : { label: "VLC Client", subtitle: "(Rasp. 1)" };
}

// --- Geometry helpers ------------------------------------------------------

function clipToBox(from, to, size) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: from.x, y: from.y };
  const hw = size.w / 2;
  const hh = size.h / 2;
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

export function linkEndpoints(p1, size1, p2, size2) {
  return { a: clipToBox(p1, p2, size1), b: clipToBox(p2, p1, size2) };
}

// --- Link routing (arcs over collinear nodes) ------------------------------

const LINK_OVERRIDES = {
  "switch:1-switch:3": { kind: "arc", arcOffset: -90 },
  "switch:4-switch:6": { kind: "arc", arcOffset: 90 },
};

function endpointKey(endpoint) {
  if (endpoint.kind === "controller") return "ctrl";
  if (endpoint.kind === "client" || endpoint.kind === "server") {
    return `host:${endpoint.kind}`;
  }
  if (endpoint.slot !== undefined) return `switch:${endpoint.slot}`;
  if (endpoint.dpid !== undefined) return `switch:${endpoint.dpid}`;
  return "unknown";
}

function overrideKey(p1, p2) {
  const k1 = endpointKey(p1);
  const k2 = endpointKey(p2);
  return k1 < k2 ? `${k1}-${k2}` : `${k2}-${k1}`;
}

export function linkPath(p1, size1, p2, size2) {
  const { a, b } = linkEndpoints(p1, size1, p2, size2);
  const override = LINK_OVERRIDES[overrideKey(p1, p2)];

  if (!override || override.kind !== "arc") {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }

  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const off = override.arcOffset;
  const cx = mx + px * off;
  const cy = my + py * off;

  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}