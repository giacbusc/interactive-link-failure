import { COLORS } from "../theme";
import AlgorithmSelector from "./AlgorithmSelector";
import MetricsGrid from "./MetricsGrid";
import EventList from "./EventList";

export default function Sidebar({
  algorithm,
  setAlgorithm,
  throughputBps,
  events,
}) {
  return (
    <aside
      className="w-72 flex-shrink-0 p-6 space-y-7 overflow-y-auto"
      style={{ backgroundColor: COLORS.sidebar }}
    >
      <AlgorithmSelector selected={algorithm} onChange={setAlgorithm} />
      <MetricsGrid throughputBps={throughputBps} />
      <EventList events={events} />
    </aside>
  );
}
