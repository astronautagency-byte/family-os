import { useEffect, useRef, useState, useCallback } from "react";
import { LoaderCircle } from "lucide-react";

const PULL_THRESHOLD = 72;
const PULL_RESISTANCE = 0.55;

export function usePullToRefresh({ onRefresh, threshold = PULL_THRESHOLD, horizontalGuard = 14 } = {}) {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  const draggingRef = useRef(false);
  const horizontalLockRef = useRef(false);
  const startRef = useRef(null);
  const lastDragRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const hostRef = useRef(null);

  useEffect(() => {
    const isInteractiveOrHorizontal = (target) => {
      if (!(target instanceof Element)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag === "BUTTON") return false;
      let el = target;
      while (el && el !== document.body) {
        if (el.dataset && el.dataset.pullIgnore !== undefined) return true;
        if (el.scrollWidth > el.clientWidth + 4) return true;
        el = el.parentElement;
      }
      return false;
    };

    const getScrollContainer = () => {
      return hostRef.current || document.scrollingElement || document.documentElement;
    };

    const down = (event) => {
      if (refreshing) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (isInteractiveOrHorizontal(event.target)) return;
      const container = getScrollContainer();
      const scrollTopAtTop = container.scrollTop <= 0;
      if (!scrollTopAtTop) return;
      
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

    const handleTouchMove = (event) => {
      // Only prevent default when actively pulling down at the top of the
      // scroll container. This preserves native scroll momentum for normal
      // vertical scrolling while still allowing the pull-to-refresh gesture.
      if (draggingRef.current && event.cancelable) {
        const container = getScrollContainer();
        if (container.scrollTop <= 0) {
          event.preventDefault();
        }
      }
    };

    const container = getScrollContainer();
    container.addEventListener("pointerdown", down, { passive: true });
    container.addEventListener("pointermove", move, { passive: false });
    container.addEventListener("pointerup", up, { passive: true });
    container.addEventListener("pointercancel", cancel, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("pointerdown", down);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("pointercancel", cancel);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, [threshold, horizontalGuard, refreshing]);

  return { dragY, refreshing, hostRef };
}

export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const { dragY, refreshing, hostRef } = usePullToRefresh({ onRefresh });
  
  return (
    <div
      ref={hostRef}
      data-pull-top
      className={`pull-to-refresh-host ${className}`.trim()}
      style={{ transform: dragY ? `translate3d(0, ${dragY}px, 0)` : 'none' }}
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