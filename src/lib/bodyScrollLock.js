const LOCK_STATE_KEY = "__famosBodyScrollLockState";

const getLockState = () => {
  if (typeof window === "undefined") return { count: 0, originalOverflow: "" };
  if (!window[LOCK_STATE_KEY]) {
    window[LOCK_STATE_KEY] = { count: 0, originalOverflow: "" };
  }
  return window[LOCK_STATE_KEY];
};

export function lockBodyScroll() {
  if (typeof document === "undefined") return () => {};
  const state = getLockState();
  if (state.count === 0) {
    state.originalOverflow = document.body.style.overflow === "hidden"
      ? ""
      : document.body.style.overflow;
    document.body.dataset.scrollLocked = "true";
  }
  state.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count = Math.max(0, state.count - 1);
    if (state.count === 0) {
      delete document.body.dataset.scrollLocked;
      document.body.style.overflow = state.originalOverflow;
      state.originalOverflow = "";
    }
  };
}
