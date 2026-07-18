import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sign in is required.");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    if (!privateKey || !publicKey) throw new Error("Web Push is not configured.");

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Your session has expired.");

    const { householdId, targetUserIds = [], notification } = await request.json();
    if (!householdId || !notification?.title) throw new Error("Household and notification are required.");
    const { data: senderMembership } = await admin.from("household_members").select("user_id").eq("household_id", householdId).eq("user_id", user.id).maybeSingle();
    if (!senderMembership) throw new Error("You do not belong to this household.");

    const { data: memberships, error: membershipError } = await admin.from("household_members").select("user_id").eq("household_id", householdId);
    if (membershipError) throw membershipError;
    const householdUsers = (memberships || []).map((item) => item.user_id).filter((id) => id !== user.id);
    const recipients = targetUserIds.length ? householdUsers.filter((id) => targetUserIds.includes(id)) : householdUsers;
    if (!recipients.length) return Response.json({ sent: 0 }, { headers: corsHeaders });

    const { data: subscriptions, error: subscriptionError } = await admin.from("push_subscriptions").select("id,subscription").in("user_id", recipients);
    if (subscriptionError) throw subscriptionError;
    webpush.setVapidDetails("mailto:support@fam-os.app", publicKey, privateKey);
    let sent = 0;
    await Promise.all((subscriptions || []).map(async (record) => {
      try {
        await webpush.sendNotification(record.subscription, JSON.stringify(notification), { TTL: 86400, urgency: "normal" });
        sent += 1;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", record.id);
        else console.error("Push delivery failed", error);
      }
    }));
    return Response.json({ sent }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
  }
});
