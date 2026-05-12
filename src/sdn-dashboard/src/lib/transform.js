import {
  CONTROLLER_POSITION,
  SWITCH_SLOTS,
  SWITCH_DPID_TO_SLOT,
  HOST_SLOTS,
  classifyHost,
  hostLabel,
} from "./layout";

export function transformTopology(api) {
  if (!api) return null;

  // -- Switches --

  const rawSwitches = api.switches || [];
  const switches = [];
  for (const s of rawSwitches) {
    const isObj = typeof s === "object";
    const dpid = isObj ? s.dpid : s;
    const slot = SWITCH_DPID_TO_SLOT[dpid];
    if (slot == null) {
      console.warn(`Unmapped switch DPID ${dpid} — skipping`);
      continue;
    }
    const pos = SWITCH_SLOTS[slot];
    switches.push({
      dpid,
      slot,
      label: `Switch ${slot}`,
      x: pos.x,
      y: pos.y,
      // Optional metadata from the enriched API response. Will populate
      // the details panel when the user clicks the switch.
      vendor: isObj ? s.vendor : undefined,
      hw_desc: isObj ? s.hw_desc : undefined,
      sw_desc: isObj ? s.sw_desc : undefined,
      num_ports: isObj ? s.num_ports : undefined,
      main_table: isObj ? s.main_table : undefined,
    });
  }

  const switchPosByDpid = Object.fromEntries(
    switches.map((s) => [s.dpid, { x: s.x, y: s.y, slot: s.slot }])
  );

  // -- Hosts --

  const rawHosts = api.hosts || [];
  const hostsBySlot = {};
  for (const h of rawHosts) {
    const slot = classifyHost(h.mac);
    if (hostsBySlot[slot]) {
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
      mac: h.mac,
      ips: h.ips || [],
      label,
      subtitle,
      kind: slot,
      attachedTo: h.dpid,
      attachedPort: h.port,   // NEW — needed for edge-port throughput
      x: pos.x,
      y: pos.y,
    };
  });

  // -- Links --

  const knownDpids = new Set(switches.map((s) => s.dpid));

  const controlLinks = switches.map((s) => ({ from: "ctrl", to: s.dpid }));

  const switchLinks = (api.links || [])
    .filter((l) => knownDpids.has(l.src_dpid) && knownDpids.has(l.dst_dpid))
    .map((l) => ({
      from: l.src_dpid,
      to: l.dst_dpid,
      src_port: l.src_port,
      dst_port: l.dst_port,
      kind: "switch-switch",
    }));

  const hostLinks = hosts
    .filter((h) => knownDpids.has(h.attachedTo))
    .map((h) => ({
      from: h.attachedTo,
      to: h.id,
      src_port: h.attachedPort,
      kind: "host",
    }));

  return {
    controller: CONTROLLER_POSITION,
    switches,
    hosts,
    controlLinks,
    dataLinks: [...switchLinks, ...hostLinks],
    spanning_tree: api.spanning_tree || [],
  };
}

// -- Throughput interpolation (NEW: edge-port only) ----------------------

/**
 * Sum tx_bytes ONLY on edge ports (host-facing). Each byte transmitted
 * by the network to a host is counted once here, so the resulting
 * throughput represents the user-visible stream rate (not the
 * link-replicated aggregate of before).
 */
export function aggregateEdgeBytes(statsResponse, edgePortSet) {
  if (!statsResponse?.switches) return 0;
  let total = 0;
  for (const sw of statsResponse.switches) {
    for (const p of sw.ports || []) {
      const key = `${sw.dpid}:${p.port_no}`;
      if (edgePortSet.has(key)) {
        // tx_bytes from the switch perspective = bytes delivered to host
        total += p.tx_bytes || 0;
      }
    }
  }
  return total;
}

/**
 * Compute throughput in bps from two snapshots of edge-port bytes.
 * Returns null on first sample / counter wrap / clock skew.
 */
export function computeThroughputBps(prev, curr) {
  if (!prev || !curr) return null;
  if (prev.timestamp == null || curr.timestamp == null) return null;
  const dt = curr.timestamp - prev.timestamp;
  if (dt <= 0) return null;
  const dBytes = curr.totalBytes - prev.totalBytes;
  if (dBytes < 0) return null;
  return (dBytes * 8) / dt;
}

/**
 * Build the Set of "dpid:port_no" strings for every edge port in the
 * current topology. Pass this to aggregateEdgeBytes.
 */
export function buildEdgePortSet(topology) {
  if (!topology?.hosts) return new Set();
  const set = new Set();
  for (const h of topology.hosts) {
    if (h.attachedTo != null && h.attachedPort != null) {
      set.add(`${h.attachedTo}:${h.attachedPort}`);
    }
  }
  return set;
}

// -- Path matching helpers (for green highlight) -------------------------

/**
 * Given the response from GET /path/{src}/{dst} (which contains
 * `hops: [{dpid, in_port, out_port}, ...]` plus src_mac / dst_mac),
 * decide whether a specific data-link is part of the active path.
 *
 * Works for both switch-switch links and switch-host edge links.
 */
export function linkInActivePath(link, activePath) {
  if (!activePath?.hops?.length) return false;
  const hops = activePath.hops;

  // 1) Switch-switch links: any pair of consecutive hops with matching dpids
  for (let i = 0; i < hops.length - 1; i++) {
    const a = hops[i].dpid;
    const b = hops[i + 1].dpid;
    if (
      (link.from === a && link.to === b) ||
      (link.from === b && link.to === a)
    ) {
      return true;
    }
  }

  // 2) Host-to-first-switch
  const first = hops[0];
  if (
    (link.from === activePath.src_mac && link.to === first.dpid) ||
    (link.from === first.dpid && link.to === activePath.src_mac)
  ) {
    return true;
  }

  // 3) Last-switch-to-host
  const last = hops[hops.length - 1];
  if (
    (link.from === last.dpid && link.to === activePath.dst_mac) ||
    (link.from === activePath.dst_mac && link.to === last.dpid)
  ) {
    return true;
  }

  return false;
}