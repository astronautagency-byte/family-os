// useFeatureFlag — a single primitive per feature. Returns `[enabled, setEnabled]`.
//
// What this is for:
//   - admin kill-switch (flip "off" via Settings/Admin → reach into the same
//     localStorage key, dispatch the matching event, every instance on the
//     page reacts instantly with no re-render of the consumer's data fetch).
//   - per-household A/B testing: extend setEnabled later to write
//     household_id instead of "1"/"0"; the read path stays unchanged.
//   - shared by all soft-tier surfaces (Groceries, MealSuggestions, FamAI)
//     so flipping one global toggle effectively mutates them in unison.
//
// What this is NOT for:
//   - generic data fetching. The recipes/busy/error/refresh shape the user
//     described is realised per-surface by the consuming component — each
//     surface has a different fetcher signature (API-Ninjas vs in-memory
//     plan_meal actions), and centralising them would force a god hook.

import { useCallback, useEffect, useState } from "react";

const FEATURE_PREFIX = "famos:feature";
const EVENT_NAME = (key) => `${FEATURE_PREFIX}:${key}:change`;
const STORAGE_KEY = (key) => `${FEATURE_PREFIX}:${key}`;

const readFlagFromStorage = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY(key));
    if (stored === null) return fallback;
    return stored === "1" || stored === "true";
  } catch {
    return fallback;
  }
};

// Inlined so Rules-of-Hooks is satisfied — useCallback can ONLY run inside
// a React function component or another custom Hook function (i.e. one
// whose name starts with `use`). Defining the setter in a separate helper
// like `buildSetter` looks clean but trips the linter, so the setter lives
// directly inside `useFeatureFlag`.
export function useFeatureFlag(key, fallback = true) {
  // State setter is renamed so the public `setEnabled` below doesn't shadow
  // it in the same scope. Both writing to it: the public setter calls the
  // state setter directly to make the React state update synchronous with
  // the localStorage write + event dispatch, even before the event listener
  // runs (defensive — listener fires synchronously, but explicit is better
  // than implicit).
  const [enabled, setEnabledState] = useState(() => readFlagFromStorage(key, fallback));
  // Re-read on event. detail?.enabled is the source of truth the setter
  // dispatches; falling back to localStorage defends against other code
  // paths (browser extension, dev console, in-app Settings) writing the
  // same key without dispatching an event.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onChange = (event) => setEnabledState(event.detail?.enabled ?? readFlagFromStorage(key, fallback));
    window.addEventListener(EVENT_NAME(key), onChange);
    return () => window.removeEventListener(EVENT_NAME(key), onChange);
  }, [key, fallback]);
  // Public setter is referentially stable across re-renders (memoised by
  // `key`). Writes localStorage AND dispatches the same custom event so
  // every useFeatureFlag instance on the page reacts in lockstep — no
  // manual refresh needed.
  const setEnabled = useCallback((value) => {
    const nextValue = !!value;
    if (typeof window === "undefined") return nextValue;
    try {
      window.localStorage.setItem(STORAGE_KEY(key), nextValue ? "1" : "0");
    } catch {
      // Localstorage may be disabled (private mode, quota, sandboxed iframe).
      // We still dispatch so in-memory consumers update, but persistence is
      // silently dropped. Future: surface the failure through a toast.
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME(key), { detail: { enabled: nextValue } }));
    setEnabledState(nextValue);
    return nextValue;
  }, [key]);
  return [enabled, setEnabled];
}
