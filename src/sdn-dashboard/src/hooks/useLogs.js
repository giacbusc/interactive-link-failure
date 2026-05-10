import { useState, useEffect } from "react";
import { fetchLogs } from "../api/controller";

// Polling cadence — log lines are short and the endpoint is cheap, so
// we can poll faster than topology to feel responsive when events
// happen (link down, host moved, etc.).
const POLL_MS = 3000;

// How many lines to request from the controller. We then keep only the
// most recent N for display in the sidebar.
const REQUEST_LINES = 50;
const DISPLAY_LINES = 12;

const LEVEL_TO_SEVERITY = {
  CRITICAL: "error",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
  DEBUG: "info",
};

function formatTime(iso) {
  // "2025-12-01T14:30:05.123+00:00" → "14:30:05"
  if (!iso) return "??:??:??";
  try {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  } catch {
    return "??:??:??";
  }
}

/**
 * React hook: polls the controller's /logs endpoint and exposes a list
 * of event-like entries shaped for <EventList/>.
 *
 * Returns:
 *   - logs    : array of { id, time, text, severity }, newest first
 *   - error   : last error message, or null
 *
 * The hook fails silently on transient errors (the controller might be
 * restarting, a Mininet test might be cleaning up); the previously
 * fetched list stays on screen until the next successful tick.
 */
export function useLogs(level = "INFO") {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetchLogs(level, REQUEST_LINES);
        if (cancelled) return;

        const entries = res.entries || [];
        const items = entries
          .slice(-DISPLAY_LINES)
          .reverse()
          .map((e, i) => ({
            id: `${e.timestamp}-${i}`,
            time: formatTime(e.timestamp),
            text: e.message,
            severity: LEVEL_TO_SEVERITY[e.level] || "info",
          }));

        setLogs(items);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [level]);

  return { logs, error };
}
