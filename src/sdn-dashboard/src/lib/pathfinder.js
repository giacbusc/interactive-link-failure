// BFS shortest path between two nodes in the topology, optionally
// avoiding specific links. Pure function, runs in the browser.

function linkKey(link) {
  const a = `${link.from}:${link.src_port ?? ""}`;
  const b = `${link.to}:${link.dst_port ?? ""}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Returns an array of link objects representing the shortest path from
 * srcMac to dstMac, or null if no path exists.
 *
 * topology: result of transformTopology — has switches, hosts, dataLinks
 * avoidLinks: links to exclude (used by the link-click "failure" flow)
 */
export function findShortestPath(topology, srcMac, dstMac, avoidLinks = []) {
  if (!topology || !srcMac || !dstMac) return null;

  const avoid = new Set(avoidLinks.map(linkKey));

  // Build adjacency: nodeId → [{neighbor, link}]
  const adj = new Map();
  for (const l of topology.dataLinks) {
    if (avoid.has(linkKey(l))) continue;
    if (!adj.has(l.from)) adj.set(l.from, []);
    if (!adj.has(l.to)) adj.set(l.to, []);
    adj.get(l.from).push({ neighbor: l.to, link: l });
    adj.get(l.to).push({ neighbor: l.from, link: l });
  }

  // BFS
  const visited = new Set([srcMac]);
  const queue = [[srcMac, []]];

  while (queue.length > 0) {
    const [node, pathLinks] = queue.shift();
    if (node === dstMac) return pathLinks;

    for (const { neighbor, link } of adj.get(node) || []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push([neighbor, [...pathLinks, link]]);
    }
  }

  return null;
}

/**
 * Convert a sequence of links (from findShortestPath) into the body
 * shape expected by POST /policy:
 *   [{src_dpid, src_port, dst_dpid, dst_port}, ...]
 *
 * Only inter-switch links are included; host-attached ports are
 * implicit (the controller derives them from src_mac / dst_mac).
 *
 * Each link is oriented so that src_dpid is the side closer to srcMac.
 */
export function pathLinksToPolicy(pathLinks, srcMac) {
  const oriented = [];
  let current = srcMac;

  for (const l of pathLinks) {
    const isSwitchSwitch =
      typeof l.from === "number" && typeof l.to === "number";

    if (isSwitchSwitch) {
      if (l.from === current) {
        oriented.push({
          src_dpid: l.from,
          src_port: l.src_port,
          dst_dpid: l.to,
          dst_port: l.dst_port,
        });
        current = l.to;
      } else {
        oriented.push({
          src_dpid: l.to,
          src_port: l.dst_port,
          dst_dpid: l.from,
          dst_port: l.src_port,
        });
        current = l.from;
      }
    } else {
      // host-edge link — just advance the cursor without emitting
      current = l.from === current ? l.to : l.from;
    }
  }

  return oriented;
}