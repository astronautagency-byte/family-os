import { supabase, supabaseKey, supabaseUrl } from "./supabase";
import { clearDesktopAuthState, getDesktopHandoffRequest } from "./desktopRuntime";

async function callDesktopHandoff(body, accessToken = "") {
  if (!supabaseUrl || !supabaseKey) throw new Error("FamOS authentication is not configured.");
  let response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/desktop-auth-handoff`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Desktop sign-in could not reach FamOS: ${error?.message || "network error"}`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Desktop authentication failed (${response.status}).`);
  return payload;
}

export async function createDesktopAuthHandoff(state, activeSession) {
  const session = activeSession || (await supabase?.auth.getSession())?.data?.session;
  if (!session?.access_token || !session?.refresh_token) throw new Error("Your sign-in session is not ready yet. Please try again.");
  return callDesktopHandoff({ action: "create", state, refresh_token: session.refresh_token }, session.access_token);
}

export async function redeemDesktopAuthHandoff(code, state) {
  return callDesktopHandoff({ action: "redeem", code, state });
}

export async function finishDesktopAuthHandoff(activeSession) {
  const request = getDesktopHandoffRequest();
  if (!request) return false;
  const handoff = await createDesktopAuthHandoff(request.state, activeSession);
  const callback = new URL(request.callback);
  callback.searchParams.set("code", handoff.code);
  callback.searchParams.set("state", request.state);
  clearDesktopAuthState();
  window.location.replace(callback.toString());
  return true;
}
