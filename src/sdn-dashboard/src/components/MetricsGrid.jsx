import { Gauge, AlertTriangle } from "lucide-react";
import { COLORS } from "../theme";
import { formatBitrate } from "../lib/format";

function MetricCard({ label, value, unit, valueColor, icon: Icon }) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col"
      style={{
        backgroundColor: COLORS.white,
        border: `1px solid ${COLORS.ink}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={12} style={{ color: COLORS.inkSoft }} />}
        <span className="text-xs" style={{ color: COLORS.inkSoft }}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold" style={{ color: valueColor }}>
          {value}
        </span>
        {unit && (
          <span className="text-xs" style={{ color: valueColor }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Metrics shown in the sidebar. Latency and Packet Loss have been
 * removed (the controller cannot measure them with the current API).
 *
 * Throughput is computed in src/hooks/useController.js by interpolating
 * two consecutive /stats/ports snapshots.
 *
 * Faults will be wired up as soon as the team adds the corresponding
 * endpoint — see TODO in `useController`.
 */
export default function MetricsGrid({ throughputBps }) {
  const tp = formatBitrate(throughputBps);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold" style={{ color: COLORS.ink }}>
        Metrics
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Throughput"
          value={tp.value}
          unit={tp.unit}
          valueColor={COLORS.metricThroughput}
          icon={Gauge}
        />
        <MetricCard
          label="Faults"
          value="—"
          unit=""
          valueColor={COLORS.metricFaults}
          icon={AlertTriangle}
        />
      </div>
    </section>
  );
}
