import { COLORS } from "../theme";

/**
 * Banner shown at the top of the topology when picker is active.
 * Shows the current sequence and offers Apply / Cancel.
 */
export default function PathPickerOverlay({ picker }) {
  if (picker.mode === "off") return null;

  const labels = picker.sequence.map((el) =>
    el.label || `Switch ${el.slot ?? "?"}`
  );

  const instruction =
    picker.mode === "idle"
      ? "Click a host (VLC Client or VLC Server) to start the path"
      : picker.mode === "picking"
      ? "Click switches in order, then the other host to finish"
      : picker.mode === "ready"
      ? "Path is ready — click Apply, or Cancel to start over"
      : picker.mode === "applying"
      ? "Installing path…"
      : "Path installed";

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded-lg shadow-md px-4 py-3 flex items-center gap-4 max-w-3xl"
      style={{
        backgroundColor: COLORS.white,
        border: `1px solid ${COLORS.ink}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="text-xs uppercase tracking-wide mb-1"
          style={{ color: COLORS.inkSoft }}
        >
          Manual path · {picker.mode}
        </div>
        <div className="text-sm truncate" style={{ color: COLORS.ink }}>
          {labels.length === 0
            ? instruction
            : labels.join("  →  ")}
        </div>
        {labels.length > 0 && (
          <div
            className="text-xs mt-1"
            style={{ color: COLORS.inkSoft }}
          >
            {instruction}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={picker.stop}
          disabled={picker.mode === "applying" || picker.mode === "applied"}
          className="px-3 py-1.5 rounded-md text-sm transition-colors"
          style={{
            backgroundColor: "transparent",
            color: COLORS.ink,
            border: `1px solid ${COLORS.ink}`,
            opacity:
              picker.mode === "applying" || picker.mode === "applied"
                ? 0.4
                : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={picker.apply}
          disabled={picker.mode !== "ready"}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{
            backgroundColor:
              picker.mode === "ready" ? COLORS.ink : COLORS.inkSoft,
            color: COLORS.white,
            opacity: picker.mode === "ready" ? 1 : 0.4,
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}