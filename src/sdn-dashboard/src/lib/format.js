// Formatting helpers for displayed values.

/**
 * Format a bits-per-second number into a {value, unit} pair suitable for
 * the MetricCard. Picks bps / Kbps / Mbps / Gbps automatically.
 *
 * Examples:
 *   formatBitrate(null)        → { value: "—",   unit: ""     }
 *   formatBitrate(0)           → { value: "0",   unit: "bps"  }
 *   formatBitrate(950)         → { value: "950", unit: "bps"  }
 *   formatBitrate(12_500)      → { value: "12.5", unit: "Kbps"}
 *   formatBitrate(2_345_000)   → { value: "2.35", unit: "Mbps"}
 */
export function formatBitrate(bps) {
  if (bps == null || !Number.isFinite(bps)) return { value: "—", unit: "" };
  if (bps < 0) return { value: "0", unit: "bps" };
  if (bps < 1000) return { value: bps.toFixed(0), unit: "bps" };
  if (bps < 1_000_000) return { value: (bps / 1000).toFixed(1), unit: "Kbps" };
  if (bps < 1_000_000_000)
    return { value: (bps / 1_000_000).toFixed(2), unit: "Mbps" };
  return { value: (bps / 1_000_000_000).toFixed(2), unit: "Gbps" };
}
