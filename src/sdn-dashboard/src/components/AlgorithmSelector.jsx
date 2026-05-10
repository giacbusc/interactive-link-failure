import { COLORS } from "../theme";

const ALGORITHMS = ["Dijkstra", "Static", "Manual"];

export default function AlgorithmSelector({ selected, onChange }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold" style={{ color: COLORS.ink }}>
        Algorithm
      </h2>
      <div className="flex gap-2">
        {ALGORITHMS.map((alg) => {
          const active = selected === alg;
          return (
            <button
              key={alg}
              onClick={() => onChange(alg)}
              className="px-4 py-1.5 rounded-full text-sm transition-all"
              style={{
                backgroundColor: active ? COLORS.ink : "transparent",
                color: active ? COLORS.white : COLORS.ink,
                border: `1px solid ${COLORS.ink}`,
              }}
            >
              {alg}
            </button>
          );
        })}
      </div>
    </section>
  );
}
