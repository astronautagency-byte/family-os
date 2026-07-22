import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

const PULL_THRESHOLD = 72;
const PULL_RESISTANCE = 0.55; // multiplier on raw dragY, so the page resists over-stretching

// Pull-to-refresh hook. Returns `{ dragY, refreshing }` so the wrapper can
// animate the pointer-driven offset and show a small status indicator while
// the underlying promise is in flight.
export function usePullToRefresh({ onRefresh, threshold = PULL_THRESHOLD, horizontalGuard = 14 } = {}) {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  const draggingRef = useRef(false);
  const horizontalLockRef = useRef(false);
  const startRef = useRef(null);
  const lastDragRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Bail-out heuristic: ignore touches that originate on form controls,
    // horizontally-scrolling surfaces (Calendar day strip, tab strips), or
    // any element opted out via `data-pull-ignore`.
    const isInteractiveOrHorizontal = (target) => {
      if (!(target instanceof Element)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag === "BUTTON") return false; // buttons still scroll vertically; let the gesture through
      let el = target;
      while (el && el !== document.body) {
        if (el.dataset && el.dataset.pullIgnore !== undefined) return true;
        if (el.scrollWidth > el.clientWidth + 4) return true;
        el = el.parentElement;
      }
      return false;
    };
    const down = (event) => {
      if (refreshing) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (isInteractiveOrHorizontal(event.target)) return;
      const scrolling = document.scrollingElement || document.documentElement;
      const scrollTopAtTop = scrolling.scrollTop <= 0;
      if (!scrollTopAtTop) {
        const innerTop = document.querySelector("[data-pull-top]");
        if (!innerTop || innerTop.scrollTop > 0) return;
      }
      startRef.current = { x: event.clientX, y: event.clientY };
      draggingRef.current = false;
      horizontalLockRef.current = false;
      lastDragRef.current = 0;
    };
    const move = (event) => {
      const start = startRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!draggingRef.current) {
        if (dy < 4) return;
        // If the very first 14 px of movement is mostly horizontal, let the
        // user scroll horizontally (Calendar day strip) instead.
        if (Math.abs(dx) > Math.abs(dy) + horizontalGuard) {
          horizontalLockRef.current = true;
          startRef.current = null;
          return;
        }
        draggingRef.current = true;
      }
      if (horizontalLockRef.current) return;
      if (dy <= 0) {
        setDragY(0);
        lastDragRef.current = 0;
        return;
      }
      const raw = Math.min(dy, threshold * 2.4);
      const resisted = raw * PULL_RESISTANCE;
      lastDragRef.current = resisted;
      setDragY(resisted);
    };
    const finishDrag = async (released) => {
      const wasDragging = draggingRef.current;
      draggingRef.current = false;
      startRef.current = null;
      if (!wasDragging) return;
      if (released >= threshold) {
        setRefreshing(true);
        setDragY(0);
        try {
          const task = onRefreshRef.current && onRefreshRef.current();
          if (task && typeof task.then === "function") await task;
        } finally {
          setRefreshing(false);
          lastDragRef.current = 0;
        }
      } else {
        setDragY(0);
        lastDragRef.current = 0;
      }
    };
    const up = () => {
      horizontalLockRef.current = false;
      finishDrag(lastDragRef.current);
    };
    const cancel = () => {
      horizontalLockRef.current = false;
      startRef.current = null;
      draggingRef.current = false;
      lastDragRef.current = 0;
      setDragY(0);
    };
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerup", up, { passive: true });
    document.addEventListener("pointercancel", cancel, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
    };
  }, [threshold, horizontalGuard, refreshing]);

  return { dragY, refreshing };
}

export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const { dragY, refreshing } = usePullToRefresh({ onRefresh });
  const transformStyle = dragY ? { transform: `translate3d(0, ${dragY}px, 0)` } : undefined;
  return (
    <div
      data-pull-top
      className={`pull-to-refresh-host ${className}`.trim()}
      style={transformStyle}
      aria-busy={refreshing || undefined}
    >
      {refreshing && (
        <div className="pull-to-refresh-indicator" role="status" aria-live="polite">
          <LoaderCircle size={20} className="animate-spin" />
        </div>
      )}
      {children}
    </div>
  );
}
