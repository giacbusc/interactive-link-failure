import { useEffect, useState } from "react";
import { COLORS } from "../theme";
import { fetchLogs } from "../api/controller";

const POLL_MS = 2000;
const LINES = 200;

const LEVEL_COLOR = {
  CRITICAL: "#C8312E",
  ERROR: "#C8312E",
  WARNING: "#E89A2C",
  INFO: "#1F1F1F",
  DEBUG: "#9CA3AF",
};

function formatTime(iso) {
  if (!iso) return "??:??:??";
  try {
    return new Date(iso).toTimeString().slice(0, 8);
  } catch {
    return "??:??:??";
  }
}

/**
 * Logs tab — full-screen view of the controller's ring-buffered log
 * store, fetched from GET /logs and refreshed every 2 s.
 *
 * Defaults to INFO level. Could be extended with a level dropdown if
 * useful in demos.
 */
export default function LogsView() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetchLogs("INFO", LINES);
        if (cancelled) return;
        setEntries(res.entries || []);
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
  }, []);

  return (
    <div
      className="flex-1 m-4 rounded-lg p-4 overflow-auto font-mono text-xs leading-relaxed"
      style={{
        backgroundColor: COLORS.white,
        border: `1px solid ${COLORS.ink}`,
        color: COLORS.ink,
      }}
    >
      {error && (
        <div className="mb-2" style={{ color: COLORS.error }}>
          # {error} — retrying…
        </div>
      )}
      {entries.length === 0 && !error && (
        <div style={{ color: COLORS.inkSoft }}>
          # waiting for controller logs…
        </div>
      )}
      {entries.map((e, i) => (
        <div key={i} className="whitespace-pre-wrap">
          <span style={{ color: COLORS.inkSoft }}>{formatTime(e.timestamp)}</span>
          {"  "}
          <span style={{ color: LEVEL_COLOR[e.level] || COLORS.ink }}>
            {(e.level || "INFO").padEnd(5)}
          </span>
          {"  "}
          <span style={{ color: COLORS.inkSoft }}>{e.logger}</span>
          {": "}
          <span>{e.message}</span>
        </div>
      ))}
    </div>
  );
}
