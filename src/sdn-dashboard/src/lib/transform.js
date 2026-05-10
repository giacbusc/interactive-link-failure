// Pure transformations between the controller's REST responses and the
// shape the GUI components expect. Kept as pure functions so they can be
// unit-tested without React.
//
// Layout decisions (positions, slot assignment) live in `layout.js`.
// This file only handles the data-shape conversion.

import {
  CONTROLLER_POSITION,
  SWITCH_SLOTS,
  SWITCH_DPID_TO_SLOT,
  HOST_SLOTS,
  classifyHost,
  hostLabel,
} from "./layout";

// -- Topology -----------------------------------------------------------

/**
 * Convert a /topology response to the shape TopologyView expects.
 * Returns null if input is null (still loading).
 *
 * The layout is fixed: every switch DPID has a predetermined slot, and
 * the two hosts have predetermined left/right positions. Only entities
 * that appear in the API response are rendered — everything else is
 * simply absent.
 *
 * Defensive: handles both "switches: [int]" (current backend) and the
 * proposed "switches: [{dpid, ports}]" enriched shape.
 */
export function transformTopology(api) {
  if (!api) return null;

  // -- Switches: project DPIDs onto fixed slots --------------------------

  const rawSwitches = api.switches || [];
  const switches = [];
  for (const s of rawSwitches) {
    const dpid = typeof s === "number" ? s : s.dpid;
    const slot = SWITCH_DPID_TO_SLOT[dpid];
    if (slot == null) {
      // Unmapped DPID: skip rather than overlap an existing slot.
      // Extend SWITCH_DPID_TO_SLOT in layout.js to add support.
      console.warn(`Unmapped switch DPID ${dpid} — skipping`);
      continue;
    }
    const pos = SWITCH_SLOTS[slot];
    switches.push({
      dpid,
      label: `Switch ${dpid}`,
      x: pos.x,
      y: pos.y,
      slot,
    });
  }

  // -- Hosts: each MAC goes to its dedicated client/server slot ---------
  //
  // Two hosts on the same switch is now correct: they end up in two
  // different slots (left / right of the canvas) regardless of which
  // switch they attach to.

  const rawHosts = api.hosts || [];
  const hostsBySlot = {};
  for (const h of rawHosts) {
    const slot = classifyHost(h.mac);
    if (hostsBySlot[slot]) {
      // More than one MAC mapped to the same role. Keep the first and
      // warn — better than overlap. The lab demo only has two Pis so
      // this should not happen in practice.
      console.warn(
        `Multiple hosts mapped to slot "${slot}", keeping ${hostsBySlot[slot].mac}, ignoring ${h.mac}`
      );
      continue;
    }
    hostsBySlot[slot] = h;
  }

  const hosts = Object.entries(hostsBySlot).map(([slot, h]) => {
    const pos = HOST_SLOTS[slot];
    const { label, subtitle } = hostLabel(slot);
    return {
      id: h.mac,
      label,
      subtitle,
      kind: slot,
      attachedTo: h.dpid,
      x: pos.x,
      y: pos.y,
    };
  });

  // -- Links -------------------------------------------------------------

  // Control plane: synthetic, controller is logically connected to every
  // switch the API reports.
  const controlLinks = switches.map((s) => ({ from: "ctrl", to: s.dpid }));

  // Data plane: only links whose endpoints are known to us. If the
  // backend reports a link to an unmapped DPID we drop it so we don't
  // draw lines into the void.
  const knownDpids = new Set(switches.map((s) => s.dpid));
  const switchLinks = (api.links || [])
    .filter(
      (l) => knownDpids.has(l.src_dpid) && knownDpids.has(l.dst_dpid)
    )
    .map((l) => ({
      from: l.src_dpid,
      to: l.dst_dpid,
      src_port: l.src_port,
      dst_port: l.dst_port,
    }));

  const hostLinks = hosts
    .filter((h) => knownDpids.has(h.attachedTo))
    .map((h) => ({ from: h.attachedTo, to: h.id }));

  return {
    controller: CONTROLLER_POSITION,
    switches,
    hosts,
    controlLinks,
    dataLinks: [...switchLinks, ...hostLinks],
    spanning_tree: api.spanning_tree || [],
  };
}

// -- Throughput interpolation -------------------------------------------

/**
 * Sum tx_bytes + rx_bytes across every (switch, port) in the stats
 * response. Each byte traversing a link is counted twice (tx on the
 * sender's port, rx on the receiver's port), which is why
 * `computeThroughputBps` divides the delta by 2 before converting to bps.
 */
export function aggregateBytes(statsResponse) {
  if (!statsResponse?.switches) return 0;
  return statsResponse.switches.reduce(
    (acc, sw) =>
      acc +
      (sw.ports || []).reduce(
        (a, p) => a + (p.tx_bytes || 0) + (p.rx_bytes || 0),
        0
      ),
    0
  );
}

/**
 * Compute aggregate network throughput in bits/second from two
 * consecutive snapshots.
 *
 *   prev / curr: { timestamp: seconds, totalBytes: number }
 *
 * Returns null when there is no previous snapshot, or when the delta is
 * negative (counter wrap or controller restart).
 */
export function computeThroughputBps(prev, curr) {
  if (!prev || !curr) return null;
  if (prev.timestamp == null || curr.timestamp == null) return null;
  const dt = curr.timestamp - prev.timestamp;
  if (dt <= 0) return null;
  const dBytes = (curr.totalBytes - prev.totalBytes) / 2;
  if (dBytes < 0) return null;
  return (dBytes * 8) / dt;
}
