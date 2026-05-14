import { useEffect } from "react";
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { COLORS } from "../theme";

const ICON = { error: AlertTriangle, success: CheckCircle, info: Info };
const COLOR = { error: COLORS.error, success: COLORS.ok, info: COLORS.info };

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (toast.autoDismissMs > 0) {
      const id = setTimeout(() => onDismiss(toast.id), toast.autoDismissMs);
      return () => clearTimeout(id);
    }
  }, [toast.id, toast.autoDismissMs, onDismiss]);

  const Icon = ICON[toast.severity] || Info;
  const color = COLOR[toast.severity] || COLORS.info;

  return (
    <div
      className="rounded-lg px-4 py-3 shadow-lg flex items-start gap-3 max-w-md animate-in"
      style={{
        backgroundColor: COLORS.white,
        borderLeft: `4px solid ${color}`,
      }}
    >
      <Icon
        size={18}
        style={{ color, flexShrink: 0, marginTop: 2 }}
      />
      <span
        className="text-sm flex-1"
        style={{ color: COLORS.ink }}
      >
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 rounded hover:bg-gray-100"
        style={{ color: COLORS.inkSoft }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}