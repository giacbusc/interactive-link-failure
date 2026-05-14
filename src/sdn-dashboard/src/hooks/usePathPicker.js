import { useState, useCallback } from "react";
import { postPolicy } from "../api/controller";

/**
 * State machine for the Manual path picker.
 *
 *   off → idle → picking → ready → applying → applied → off
 *                                                 \→ off (on cancel)
 *
 * Returns:
 *   mode: current state
 *   sequence: list of selected nodes (alternating: host, switch, switch, ..., host)
 *   start(): enter picker (called by AlgorithmSelector when user clicks Manual)
 *   stop(): exit picker (called by Cancel or Dijkstra button)
 *   clickHost(host) / clickSwitch(sw): build the path
 *   apply(): POST /policy
 *   isInPath(node): helper for components
 */
export function usePathPicker({ topology, onToast }) {
  const [mode, setMode] = useState("off");
  const [sequence, setSequence] = useState([]);

  const stop = useCallback(() => {
    setMode("off");
    setSequence([]);
  }, []);

  const start = useCallback(() => {
    setMode("idle");
    setSequence([]);
  }, []);

  // Lookup of links keyed by undirected endpoint pair.
  const findLink = useCallback(
    (idA, idB) => {
      if (!topology) return null;
      return (
        topology.dataLinks.find(
          (l) =>
            (l.from === idA && l.to === idB) ||
            (l.from === idB && l.to === idA)
        ) || null
      );
    },
    [topology]
  );

  const clickHost = useCallback(
    (host) => {
      if (mode === "off") return;

      if (mode === "idle") {
        setSequence([host]);
        setMode("picking");
        onToast(
          `Starting path from ${host.label}. Click switches in order, then the other host.`,
          "info"
        );
        return;
      }

      if (mode === "picking" || mode === "ready") {
        const first = sequence[0];
        if (host.id === first.id) {
          onToast("Same host clicked — selection cancelled", "info");
          stop();
          return;
        }
        const last = sequence[sequence.length - 1];
        const lastId = last.dpid ?? last.id;
        if (!findLink(lastId, host.id)) {
          const lastLabel = last.label || `Switch ${last.slot}`;
          onToast(
            `No direct link between ${lastLabel} and ${host.label}`,
            "error"
          );
          return;
        }
        setSequence([...sequence, host]);
        setMode("ready");
      }
    },
    [mode, sequence, findLink, stop, onToast]
  );

  const clickSwitch = useCallback(
    (sw) => {
      if (mode !== "picking" && mode !== "ready") return;

      // If we're already in "ready" (final host clicked), clicking
      // a switch does nothing — the user must Cancel or Apply.
      if (mode === "ready") {
        onToast(
          "Path is complete. Click Apply, or Cancel to start over.",
          "info"
        );
        return;
      }

      // Reject if already in sequence
      if (sequence.some((el) => el.dpid === sw.dpid)) {
        onToast(`Switch ${sw.slot} is already in the path`, "error");
        return;
      }

      // Need a link from the last element to this switch
      const last = sequence[sequence.length - 1];
      const lastId = last.dpid ?? last.id;
      if (!findLink(lastId, sw.dpid)) {
        const lastLabel = last.label || `Switch ${last.slot}`;
        onToast(
          `No direct link between ${lastLabel} and Switch ${sw.slot}`,
          "error"
        );
        return;
      }

      setSequence([...sequence, sw]);
    },
    [mode, sequence, findLink, onToast]
  );

  const apply = useCallback(async () => {
    if (mode !== "ready") return;
    setMode("applying");

    const srcHost = sequence[0];
    const dstHost = sequence[sequence.length - 1];
    const switches = sequence.slice(1, -1);

    // Build the body: list of inter-switch links along the path.
    const policyPath = [];
    for (let i = 0; i < switches.length - 1; i++) {
      const a = switches[i];
      const b = switches[i + 1];
      const link = findLink(a.dpid, b.dpid);
      if (!link) {
        onToast("Internal error: link disappeared while applying", "error");
        setMode("ready");
        return;
      }
      if (link.from === a.dpid) {
        policyPath.push({
          src_dpid: link.from,
          src_port: link.src_port,
          dst_dpid: link.to,
          dst_port: link.dst_port,
        });
      } else {
        policyPath.push({
          src_dpid: link.to,
          src_port: link.dst_port,
          dst_dpid: link.from,
          dst_port: link.src_port,
        });
      }
    }

    try {
      await postPolicy(srcHost.mac, dstHost.mac, policyPath);
      setMode("applied");
      onToast(
        `Path installed from ${srcHost.label} to ${dstHost.label}`,
        "success"
      );
      setTimeout(() => stop(), 1200);
    } catch (e) {
      onToast(`Failed to install path: ${e.message}`, "error");
      setMode("ready");
    }
  }, [mode, sequence, findLink, stop, onToast]);

  const isInPath = useCallback(
    (node) => sequence.some((el) => (el.dpid ?? el.id) === (node.dpid ?? node.id)),
    [sequence]
  );

  return {
    mode,
    sequence,
    start,
    stop,
    clickHost,
    clickSwitch,
    apply,
    isInPath,
  };
}