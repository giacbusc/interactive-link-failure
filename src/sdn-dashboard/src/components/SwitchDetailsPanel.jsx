import { X } from "lucide-react";
import { COLORS } from "../theme";

function formatDpid(dpid) {
  // 123917682136935 → "0x70:b3:d5:6c:fa:e7"
  if (dpid == null) return "—";
  const hex = dpid.toString(16).padStart(12, "0");
  const pairs = hex.match(/.{2}/g) || [];
  return `0x${pairs.join(":")}`;
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b last:border-b-0"
         style={{ borderColor: "#E5E5E0" }}>
      <span style={{ color: COLORS.inkSoft }}>{label}</span>
      <span className="font-mono text-xs" style={{ color: COLORS.ink }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/**
 * Floating details panel for a clicked switch. Positioned bottom-right
 * of the topology canvas. Closes on the X button.
 */
export default function SwitchDetailsPanel({ sw, onClose }) {
  return (
    <div
      className="absolute bottom-20 right-8 w-80 rounded-lg shadow-lg p-4"
      style={{
        backgroundColor: COLORS.white,
        border: `1px solid ${COLORS.ink}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold" style={{ color: COLORS.ink }}>
          {sw.label}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100"
          style={{ color: COLORS.inkSoft }}
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-0">
        <Row label="Slot" value={sw.slot} />
        <Row label="DPID" value={formatDpid(sw.dpid)} />
        <Row label="Vendor" value={sw.vendor} />
        <Row label="Hardware" value={sw.hw_desc} />
        <Row label="Software" value={sw.sw_desc} />
        <Row label="Ports" value={sw.num_ports} />
        <Row label="Main table" value={sw.main_table} />
      </div>
    </div>
  );
}