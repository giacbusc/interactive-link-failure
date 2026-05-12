import { COLORS } from "../theme";
import { VIEWBOX } from "../lib/layout";
import { linkInActivePath } from "../lib/transform";
import SwitchNode from "./topology/SwitchNode";
import ControllerNode from "./topology/ControllerNode";
import HostNode from "./topology/HostNode";
import Link from "./topology/Link";

export default function TopologyView({
  topology,
  activePath,
  selectedSwitch,
  onSelectSwitch,
}) {
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
        {/* Control plane (drawn first, behind) */}
        {topology.controlLinks.map((l, i) => (
          <Link
            key={`c-${i}`}
            p1={positions[l.from]}
            p2={positions[l.to]}
            kind="control"
          />
        ))}

        {/* Data plane links — green if part of the active path */}
        {topology.dataLinks.map((l, i) => {
          let kind = l.status === "failed" ? "failed" : "data";
          if (kind !== "failed" && linkInActivePath(l, activePath)) {
            kind = "active";
          }
          return (
            <Link
              key={`d-${i}`}
              p1={positions[l.from]}
              p2={positions[l.to]}
              kind={kind}
            />
          );
        })}

        {/* Hosts */}
        {topology.hosts.map((h) => (
          <HostNode key={h.id} host={h} />
        ))}

        {/* Switches */}
        {topology.switches.map((sw) => (
          <SwitchNode
            key={sw.dpid}
            sw={sw}
            selected={selectedSwitch?.dpid === sw.dpid}
            onClick={() => onSelectSwitch(sw)}
          />
        ))}

        {/* Controller on top */}
        <ControllerNode ctrl={topology.controller} />
      </svg>
    </div>
  );
}