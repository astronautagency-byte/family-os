import { supabase, supabaseUrl, supabaseKey } from './supabase';

export const HELPER_PRESETS = { nanny: 'Nanny / babysitter', housekeeping: 'Housekeeping', custom: 'Other trusted helper' };
export const HELP_SERVICES = { nanny: 'Nanny', babysitting: 'Babysitter', housekeeping: 'Cleaner' };
export const RESOURCE_LABELS = { family_calendar: 'Family calendar', calendar: 'Calendar', event: 'Event', tasks: 'Task list', groceries: 'Shopping list', custom: 'Shared list' };

export async function helperCall(action, payload = {}, householdId) {
  if (!supabase) throw new Error('Sign in to use Family helpers.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) throw new Error('Please sign in again.');
  const expectedUserId = sessionData.session.user?.id;
  if (!expectedUserId) throw new Error('Please sign in again.');
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${householdId ? (action==='invite'&&payload.mode==='passcode'?'invite_helper_passcode':'family_helpers') : 'helper_portal'}`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${sessionData.session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(householdId ? { action, h: householdId, payload } : { action, payload }),
  });
  const data = await response.json();
  const { data: currentData, error: currentError } = await supabase.auth.getSession();
  if (currentError || currentData.session?.user?.id !== expectedUserId) throw new Error('Account changed. Please reopen your shared space.');
  const error = response.ok ? null : data;
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) throw new Error('Family helpers is not available on this server yet. Please try again after the update.');
    throw new Error(error.message || 'Could not update helper access.');
  }
  return data;
}
export function helperInvitationUrl(token) {
  // Native invitations also target the canonical HTTPS app, never tauri://.
  const origin = /^https?:$/.test(window.location.protocol) ? window.location.origin : 'https://home.fam-os.app';
  return `${origin}/helpers#invite=${encodeURIComponent(token)}`;
}
export function localDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
export function defaultAccessExpiry(request) {
  return request ? new Date(new Date(request.ends_at).getTime() + 6 * 3600000).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();
}

export async function guestHelperCall(action, payload={}) {
  const r=await fetch(`${supabaseUrl}/functions/v1/helper-passcode`,{method:'POST',cache:'no-store',headers:{apikey:supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Helper access unavailable');return data;
}
export async function sendHelperSms(id,token,passcode) {
  const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('Sign in as the family owner');
  const r=await fetch(`${supabaseUrl}/functions/v1/send-helper-invitation`,{method:'POST',headers:{apikey:supabaseKey,Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({id,token,passcode})});
  const result=await r.json();if(!r.ok)throw Error(result.error||'Could not send SMS');return result;
}
