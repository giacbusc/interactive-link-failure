import { Circle } from "lucide-react";
import { COLORS } from "../theme";

const SEVERITY_COLOR = {
  error: COLORS.error,
  warning: COLORS.warning,
  ok: COLORS.ok,
  info: COLORS.info,
};

function EventItem({ event }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Circle
        size={10}
        fill={SEVERITY_COLOR[event.severity] || COLORS.info}
        stroke="none"
        className="flex-shrink-0 mt-1"
      />
      <span
        className="font-mono text-xs flex-shrink-0"
        style={{ color: COLORS.inkSoft }}
      >
        {event.time}
      </span>
      <span className="break-words" style={{ color: COLORS.ink }}>
        {event.text}
      </span>
    </div>
  );
}

export default function EventList({ events }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold" style={{ color: COLORS.ink }}>
        Events
      </h2>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="text-sm italic" style={{ color: COLORS.inkSoft }}>
            No events yet.
          </p>
        ) : (
          events.map((ev) => <EventItem key={ev.id || ev.time} event={ev} />)
        )}
      </div>
    </section>
  );
}
