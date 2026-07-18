import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("You must be signed in to remove a family member.");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Your session has expired. Please sign in again.");

    const { targetUserId } = await request.json();
    if (!targetUserId) throw new Error("Choose a family member to remove.");
    if (targetUserId === user.id) throw new Error("The master owner cannot remove themselves.");

    const { data: ownerMembership, error: membershipError } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!ownerMembership) throw new Error("Your household membership could not be found.");

    const { data: household, error: householdError } = await admin
      .from("households")
      .select("id, created_by")
      .eq("id", ownerMembership.household_id)
      .maybeSingle();
    if (householdError) throw householdError;
    if (!household || household.created_by !== user.id) {
      throw new Error("Only the master owner can remove family members.");
    }

    const { data: targetMembership, error: targetMembershipError } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", household.id)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetMembershipError) throw targetMembershipError;
    if (!targetMembership) throw new Error("That person is no longer a member of this household.");

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", targetUserId)
      .maybeSingle();

    // This table was added after the original household schema. Ignore only
    // compatibility errors so older projects can still remove memberships.
    const profileCleanup = await admin
      .from("household_member_profiles")
      .delete()
      .eq("household_id", household.id)
      .eq("user_id", targetUserId);
    if (
      profileCleanup.error
      && !/does not exist|schema cache|household_member_profiles/i.test(profileCleanup.error.message || "")
    ) {
      throw profileCleanup.error;
    }

    const { error: removalError } = await admin
      .from("household_members")
      .delete()
      .eq("household_id", household.id)
      .eq("user_id", targetUserId);
    if (removalError) throw removalError;

    if (targetProfile?.email) {
      const { error: invitationCleanupError } = await admin
        .from("household_invitations")
        .delete()
        .eq("household_id", household.id)
        .ilike("email", targetProfile.email);
      if (invitationCleanupError) throw invitationCleanupError;
    }

    return respond({ removed: true, targetUserId });
  } catch (error) {
    return respond({ error: error.message || "Could not remove this family member." }, 400);
  }
});
