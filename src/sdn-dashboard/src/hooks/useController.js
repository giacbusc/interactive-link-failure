import { useState, useEffect, useRef } from "react";
import { fetchTopology, fetchPortStats } from "../api/controller";
import {
  transformTopology,
  aggregateEdgeBytes,
  computeThroughputBps,
  buildEdgePortSet,
} from "../lib/transform";

const TOPOLOGY_POLL_MS = 2000;
const STATS_POLL_MS = 5000;

export function useController() {
  const [topology, setTopology] = useState(null);
  const [throughputBps, setThroughputBps] = useState(null);
  const [controllerUp, setControllerUp] = useState(false);
  const [error, setError] = useState(null);

  const prevStatsRef = useRef(null);
  const topologyRef = useRef(null);  // mirror of `topology` for the stats loop

  // ---- Topology polling -------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const api = await fetchTopology();
        if (cancelled) return;
        const t = transformTopology(api);
        topologyRef.current = t;
        setTopology(t);
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

  // ---- Stats polling (drives throughput) ------------------------------
  //
  // We sum tx_bytes only on edge ports (host-facing). The set of edge
  // ports is derived from the latest topology snapshot.

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const api = await fetchPortStats();
        if (cancelled) return;

        const edgePorts = buildEdgePortSet(topologyRef.current);
        const curr = {
          timestamp: Date.now() / 1000,
          totalBytes: aggregateEdgeBytes(api, edgePorts),
        };
        const bps = computeThroughputBps(prevStatsRef.current, curr);
        if (bps !== null) setThroughputBps(bps);
        prevStatsRef.current = curr;
      } catch {
        // ignored — keep the previous throughput on screen
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