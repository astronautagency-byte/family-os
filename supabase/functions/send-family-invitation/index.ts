import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("You must be signed in to invite family members.");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Your session has expired. Please sign in again.");
    const { email, householdId, redirectTo } = await request.json();
    if (!email?.trim() || !householdId) throw new Error("Email and household are required.");
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === user.email?.toLowerCase()) throw new Error("Invite another family member, not yourself.");
    const { data: membership } = await admin.from("household_members").select("role").eq("household_id", householdId).eq("user_id", user.id).maybeSingle();
    if (!membership || membership.role !== "owner") throw new Error("Only the family owner can send invitations.");
    const { error: invitationError } = await admin.from("household_invitations").upsert({
      household_id: householdId, email: normalizedEmail, invited_by: user.id, accepted_at: null,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }, { onConflict: "household_id,email" });
    if (invitationError) throw invitationError;
    const { error: emailError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo });
    if (emailError && !emailError.message.toLowerCase().includes("already")) throw emailError;
    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
