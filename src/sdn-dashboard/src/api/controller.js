// Controller REST API client.
//
// API base resolution:
//   - In dev: Vite proxies /api → http://localhost:8080 (see vite.config.js)
//   - In prod / lab: set VITE_API_BASE in .env.local or env vars
//
// All endpoints below are documented in src/controller/backend/README.md
// of the controller repository.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function getJSON(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}`);
  }
  return res.json();
}

// ── Topology / paths / flows ────────────────────────────────────────────

export const fetchTopology = () => getJSON("/topology");
export const fetchPortStats = () => getJSON("/stats/ports");
export const fetchFlows = () => getJSON("/flows");
export const fetchPath = (srcMac, dstMac) =>
  getJSON(`/path/${srcMac}/${dstMac}`);

// ── Policies (CRUD) ─────────────────────────────────────────────────────

export const fetchPolicy = (srcMac, dstMac) =>
  getJSON(`/policy/${srcMac}/${dstMac}`);

export async function postPolicy(srcMac, dstMac, path) {
  const res = await fetch(`${API_BASE}/policy/${srcMac}/${dstMac}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`POST /policy → HTTP ${res.status}`);
  return res.json();
}

export async function deletePolicy(srcMac, dstMac) {
  const res = await fetch(`${API_BASE}/policy/${srcMac}/${dstMac}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`DELETE /policy → HTTP ${res.status}`);
  return res.json();
}

// ── Logs / events ───────────────────────────────────────────────────────
//
// /logs   → ring buffer of formatted log records, filterable by level
//           and trimmed by line count. Shape:
//             { level, lines, returned, entries: [{timestamp, level,
//               logger, message}, ...] }
//
// /events → cumulative counters keyed by event name (switch_connected,
//           link_down, host_added, …). Useful to drive the Faults card
//           once the team agrees on which counter represents "faults".

export const fetchLogs = (level = "INFO", lines = 50) =>
  getJSON(`/logs?level=${level}&lines=${lines}`);

export const fetchEvents = () => getJSON("/events");
