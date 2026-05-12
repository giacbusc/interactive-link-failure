import { useState, useEffect } from "react";
import { fetchPath } from "../api/controller";

const POLL_MS = 3000;

/**
 * Polls /path/{src_mac}/{dst_mac} and returns the current active path.
 * Returns null if either MAC is missing (e.g. hosts not learned yet) or
 * if the controller has no path between them.
 */
export function usePath(srcMac, dstMac) {
  const [path, setPath] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!srcMac || !dstMac) {
      setPath(null);
      return;
    }
    let cancelled = false;

    const tick = async () => {
      try {
        const data = await fetchPath(srcMac, dstMac);
        if (cancelled) return;
        setPath(data);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setPath(null);
        setError(e.message);
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [srcMac, dstMac]);

  return { path, error };
}