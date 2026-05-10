import { useState, useEffect, useRef } from "react";
import { fetchTopology, fetchPortStats } from "../api/controller";
import {
  transformTopology,
  aggregateBytes,
  computeThroughputBps,
} from "../lib/transform";

// Topology poll cadence — fast enough that link-failure animations feel
// reactive in the GUI, slow enough to not hammer the controller.
const TOPOLOGY_POLL_MS = 2000;

// Stats poll cadence — aligned with the controller's own StatsCollector
// (which polls switches every 5s), so we never read a snapshot that
// hasn't moved since last time.
const STATS_POLL_MS = 5000;

/**
 * React hook: drives the dashboard's live state from the controller's
 * REST API. Polls /topology and /stats/ports independently and exposes:
 *
 *   - topology       : transformed topology ready for <TopologyView/>,
 *                      or null while loading / when the controller is down
 *   - throughputBps  : aggregate network throughput in bits/second,
 *                      computed by interpolating two stats snapshots
 *   - controllerUp   : true when the last /topology call succeeded
 *   - error          : human-readable last error from /topology, or null
 *
 * Both polling loops are independent: a transient stats failure does not
 * mark the controller as down.
 */
export function useController() {
  const [topology, setTopology] = useState(null);
  const [throughputBps, setThroughputBps] = useState(null);
  const [controllerUp, setControllerUp] = useState(false);
  const [error, setError] = useState(null);

  // We keep the previous stats snapshot in a ref (not state) because we
  // only need it to compute the next throughput value — re-rendering when
  // it changes would be wasteful.
  const prevStatsRef = useRef(null);

  // ---- Topology polling -------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const api = await fetchTopology();
        if (cancelled) return;
        setTopology(transformTopology(api));
        setControllerUp(true);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setControllerUp(false);
        setError(e.message);
      }
    };

    tick();
    const id = setInterval(tick, TOPOLOGY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ---- Stats polling (drives throughput) -------------------------------

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const api = await fetchPortStats();
        if (cancelled) return;

        const curr = {
          timestamp: Date.now() / 1000,
          totalBytes: aggregateBytes(api),
        };
        const bps = computeThroughputBps(prevStatsRef.current, curr);
        if (bps !== null) setThroughputBps(bps);
        prevStatsRef.current = curr;
      } catch {
        // Keep going. If /stats/ports is down (e.g. 503 because the first
        // stats reply hasn't arrived yet), we just leave the previous
        // throughput on screen until we recover.
      }
    };

    tick();
    const id = setInterval(tick, STATS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { topology, throughputBps, controllerUp, error };
}
