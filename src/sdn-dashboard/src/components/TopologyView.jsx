import { useState } from "react";
import { COLORS } from "../theme";
import { VIEWBOX } from "../lib/layout";
import SwitchNode from "./topology/SwitchNode";
import ControllerNode from "./topology/ControllerNode";
import HostNode from "./topology/HostNode";
import Link from "./topology/Link";

export default function TopologyView({ topology }) {
  const [selected, setSelected] = useState(null);

  // Build a position lookup so links can resolve their endpoints by id.
  // Inactive switches/hosts (not present in the API response) are simply
  // absent from this map, and the corresponding link is skipped by
  // `Link` because its endpoint resolves to undefined.
  const positions = {
    ctrl: topology.controller,
    ...Object.fromEntries(topology.switches.map((s) => [s.dpid, s])),
    ...Object.fromEntries(topology.hosts.map((h) => [h.id, h])),
  };

  return (
    <div
      className="flex-1 m-4 rounded-lg relative overflow-hidden"
      style={{
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.ink}`,
      }}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Control plane (drawn first, behind everything) */}
        {topology.controlLinks.map((l, i) => (
          <Link
            key={`c-${i}`}
            p1={positions[l.from]}
            p2={positions[l.to]}
            kind="control"
          />
        ))}

        {/* Data plane links */}
        {topology.dataLinks.map((l, i) => (
          <Link
            key={`d-${i}`}
            p1={positions[l.from]}
            p2={positions[l.to]}
            kind={l.status === "failed" ? "failed" : "data"}
          />
        ))}

        {/* Hosts */}
        {topology.hosts.map((h) => (
          <HostNode key={h.id} host={h} />
        ))}

        {/* Switches */}
        {topology.switches.map((sw) => (
          <SwitchNode
            key={sw.dpid}
            sw={sw}
            selected={selected === sw.dpid}
            onClick={(s) => setSelected(s.dpid)}
          />
        ))}

        {/* Controller (drawn on top) */}
        <ControllerNode ctrl={topology.controller} />
      </svg>
    </div>
  );
}
