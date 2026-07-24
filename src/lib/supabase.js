import { createClient } from "@supabase/supabase-js";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Persist Supabase auth session in IndexedDB rather than localStorage.
// iOS Safari's 7-day ITP eviction policy aggressively targets localStorage
// (and client-set cookies) for PWAs that aren't opened regularly, kicking
// users out of the installed app. IndexedDB is treated as "true" app
// storage and tends to survive PWA eviction windows — far better fit for
// "stay signed in on the home-screen app until I sign out".

// One-shot migration: pick up any legacy Supabase session stashed under the
// old default key (`sb-<ref>-auth-token`) in localStorage, write it to the
// new IDB key, then remove the localStorage copy so we don't double-write.
// Idempotent — after the first deploy the localStorage slot is empty.
const LEGACY_SESSION_KEY_PREFIX = "sb-";
const NEW_SESSION_KEY = "famos-auth-session";
const migrateLegacySession = async () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = await idbGet(NEW_SESSION_KEY);
    if (existing) return;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(LEGACY_SESSION_KEY_PREFIX) || !key.includes("auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw);
        await idbSet(NEW_SESSION_KEY, value);
        window.localStorage.removeItem(key);
        return; // Migrated one — stop scanning.
      } catch { /* keep scanning */ }
    }
  } catch { /* IDB unavailable */ }
};
if (typeof window !== "undefined") {
  // Fire-and-forget; the auth client will pick it up on the first read.
  migrateLegacySession();
}

const sessionStorageAdapter = {
  getItem: async (key) => {
    try { return (await idbGet(key)) ?? null; }
    catch { return null; }
  },
  setItem: async (key, value) => {
    try { await idbSet(key, value); }
    catch { /* quota or private mode — let supabase fall back to in-memory */ }
  },
  removeItem: async (key) => {
    try { await idbDel(key); }
    catch { /* already gone */ }
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: sessionStorageAdapter,
        storageKey: NEW_SESSION_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function invokeEdgeFunction(name, body) {
  if (!supabase || !supabaseUrl || !supabaseKey) throw new Error("Supabase is not configured.");
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw sessionError || new Error("Your session has expired. Please sign in again.");
  let response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach the ${name} function${detail && detail !== "[object Object]" ? `: ${detail}` : ""}.`);
  }
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : payload?.error?.message || payload?.message || (typeof payload === "string" ? payload : "") || `${name} returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}
