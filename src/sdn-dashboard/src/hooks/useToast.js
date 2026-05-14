import { useState, useCallback, useRef } from "react";

/**
 * Lightweight toast notification state. Use `push(message, severity)`
 * to show a toast; it auto-dismisses after `autoDismissMs` (default 4s).
 * Pass autoDismissMs=0 to make it sticky.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const nextIdRef = useRef(1);

  const push = useCallback(
    (message, severity = "info", autoDismissMs = 4000) => {
      const id = nextIdRef.current++;
      setToasts((curr) => [...curr, { id, message, severity, autoDismissMs }]);
      return id;
    },
    []
  );

  const dismiss = useCallback((id) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}