import { useState, useEffect } from "react";
import { fetchPolicy } from "../api/controller";

const POLL_MS = 2000;

/**
 * Polls /policy/{src}/{dst}. Returns the policy object or null if
 * none exists. The policy object has shape:
 *   { src_mac, dst_mac, state, path }
 * where state ∈ {"POLICY_ACTIVE", "POLICY_BROKEN", "UNSPECIFIED"}.
 *
 * On a 404 (no policy installed → controller falls back to Dijkstra),
 * we return null. Callers can use this as the signal for "default
 * routing".
 */
export function usePolicy(srcMac, dstMac) {
  const [policy, setPolicy] = useState(null);

  useEffect(() => {
    if (!srcMac || !dstMac) {
      setPolicy(null);
      return;
    }
    let cancelled = false;

    const tick = async () => {
      try {
        const data = await fetchPolicy(srcMac, dstMac);
        if (cancelled) return;
        // The controller may return {state: "UNSPECIFIED"} for "none".
        if (data?.state === "UNSPECIFIED") {
          setPolicy(null);
        } else {
          setPolicy(data);
        }
      } catch {
        if (cancelled) return;
        setPolicy(null); // 404 etc.
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [srcMac, dstMac]);

  return policy;
}