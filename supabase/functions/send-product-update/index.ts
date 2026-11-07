// Product-update mail is paused until recipient consent, sender identification,
// and unsubscribe handling are implemented and verified. In-app updates remain
// available; this endpoint deliberately sends no email for any caller.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
Deno.serve((request) => request.method === "OPTIONS"
  ? new Response("ok", {headers})
  : new Response(JSON.stringify({error:"Product update emails are paused. Publish an in-app update instead."}), {status:503, headers}));
