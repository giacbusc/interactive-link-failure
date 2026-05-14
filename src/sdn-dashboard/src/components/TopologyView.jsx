import { COLORS } from "../theme";
import { VIEWBOX } from "../lib/layout";
import { linkInActivePath } from "../lib/transform";
import SwitchNode from "./topology/SwitchNode";
import ControllerNode from "./topology/ControllerNode";
import HostNode from "./topology/HostNode";
import Link from "./topology/Link";
import PathPickerOverlay from "./PathPickerOverlay";

export default function TopologyView({
  topology,
  activePath,
  selectedSwitch,
  onSelectSwitch,
  picker,
  onLinkClick,
}) {
  const positions = {
    ctrl: topology.controller,
    ...Object.fromEntries(topology.switches.map((s) => [s.dpid, s])),
    ...Object.fromEntries(topology.hosts.map((h) => [h.id, h])),
  };

  const inPickerMode = picker.mode !== "off";

  // Build a set of "candidate" link IDs: links from the last picker
  // element to any reachable neighbour. These get rendered in light blue.
  const candidateLinkIds = new Set();
  if (inPickerMode && picker.sequence.length > 0) {
    const last = picker.sequence[picker.sequence.length - 1];
    const lastId = last.dpid ?? last.id;
    topology.dataLinks.forEach((l, i) => {
      if (l.from === lastId || l.to === lastId) candidateLinkIds.add(i);
    });
  }

  // Picker-traversed links (between consecutive picker selections)
  const pickedLinkIds = new Set();
  for (let i = 0; i < picker.sequence.length - 1; i++) {
    const a = picker.sequence[i];
    const b = picker.sequence[i + 1];
    const aId = a.dpid ?? a.id;
    const bId = b.dpid ?? b.id;
    topology.dataLinks.forEach((l, idx) => {
      if (
        (l.from === aId && l.to === bId) ||
        (l.from === bId && l.to === aId)
      ) {
        pickedLinkIds.add(idx);
      }
    });
  }

  return (
    <div
      className="flex-1 m-4 rounded-lg relative overflow-hidden"
      style={{
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.ink}`,
      }}
    >
      <PathPickerOverlay picker={picker} />

      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {topology.controlLinks.map((l, i) => (
          <Link
            key={`c-${i}`}
            p1={positions[l.from]}
            p2={positions[l.to]}
            kind="control"
          />
        ))}

        {topology.dataLinks.map((l, i) => {
          let kind = l.status === "failed" ? "failed" : "data";
          if (pickedLinkIds.has(i)) kind = "candidate-selected";
          else if (candidateLinkIds.has(i)) kind = "candidate";
          else if (kind !== "failed" && linkInActivePath(l, activePath)) {
            kind = "active";
          }

          // Map non-standard kinds to the existing variants in Link.jsx,
          // using the "active" green visual but tinted blue via wrapper.
          // For simplicity, we render candidates with a custom path here
          // instead of extending Link with two new kinds.
          if (kind === "candidate-selected" || kind === "candidate") {
            return (
              <CandidateLink
                key={`d-${i}`}
                p1={positions[l.from]}
                p2={positions[l.to]}
                emphasised={kind === "candidate-selected"}
              />
            );
          }

          // Link is clickable for "fault" simulation only when not in
          // picker mode and only if it's a switch-switch link.
          const clickable =
            !inPickerMode &&
            typeof l.from === "number" &&
            typeof l.to === "number" &&
            kind !== "failed" &&
            onLinkClick;

          return (
            <Link
              key={`d-${i}`}
              p1={positions[l.from]}
              p2={positions[l.to]}
              kind={kind}
              onClick={clickable ? () => onLinkClick(l) : undefined}
            />
          );
        })}

        {topology.hosts.map((h) => {
          const isInPickerSeq = picker.isInPath(h);
          return (
            <HostNode
              key={h.id}
              host={h}
              highlighted={isInPickerSeq}
              onClick={inPickerMode ? picker.clickHost : undefined}
            />
          );
        })}

        {topology.switches.map((sw) => {
          const isInPickerSeq = picker.isInPath(sw);
          const onClick = inPickerMode
            ? () => picker.clickSwitch(sw)
            : () => onSelectSwitch(sw);
          return (
            <SwitchNode
              key={sw.dpid}
              sw={sw}
              selected={
                isInPickerSeq || selectedSwitch?.dpid === sw.dpid
              }
              onClick={onClick}
            />
          );
        })}

        <ControllerNode ctrl={topology.controller} />
      </svg>
    </div>
  );
}

// Inline component for picker candidate/selected links. Kept here to
// avoid bloating the Link.jsx variant list.
function CandidateLink({ p1, p2, emphasised }) {
  if (!p1 || !p2) return null;
  return (
    <line
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke={COLORS.linkCandidate}
      strokeWidth={emphasised ? 3.5 : 2}
      strokeDasharray={emphasised ? null : "6 4"}
      opacity={emphasised ? 0.9 : 0.6}
    />
  );
}