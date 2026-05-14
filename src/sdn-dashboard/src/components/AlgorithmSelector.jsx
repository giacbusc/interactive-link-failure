import { COLORS } from "../theme";

/**
 * Algorithm chooser. Dijkstra and Manual are the two real options;
 * Static is left as a placeholder for a future feature.
 *
 * Props:
 *   current: "Dijkstra" | "Manual" | "Static" — what's effectively active
 *   onSelectDijkstra(): user wants to revert to default routing
 *   onSelectManual(): user wants to start the manual path picker
 */
export default function AlgorithmSelector({
  current,
  onSelectDijkstra,
  onSelectManual,
}) {
  const dijkstraActive = current === "Dijkstra";
  const manualActive = current === "Manual";

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold" style={{ color: COLORS.ink }}>
        Algorithm
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onSelectDijkstra}
          className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
          style={{
            backgroundColor: dijkstraActive ? COLORS.ok : "transparent",
            color: dijkstraActive ? COLORS.white : COLORS.ok,
            border: `1px solid ${COLORS.ok}`,
          }}
        >
          Dijkstra
        </button>
        <button
          disabled
          className="px-4 py-1.5 rounded-full text-sm transition-all cursor-not-allowed"
          style={{
            backgroundColor: "transparent",
            color: COLORS.inkSoft,
            border: `1px solid ${COLORS.inkSoft}`,
            opacity: 0.4,
          }}
          title="Coming soon"
        >
          Static
        </button>
        <button
          onClick={onSelectManual}
          className="px-4 py-1.5 rounded-full text-sm transition-all"
          style={{
            backgroundColor: manualActive ? COLORS.info : "transparent",
            color: manualActive ? COLORS.white : COLORS.info,
            border: `1px solid ${COLORS.info}`,
          }}
        >
          Manual
        </button>
      </div>
    </section>
  );
}