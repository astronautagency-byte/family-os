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
    const { email } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Enter the email address that received the FamOS invitation.");
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // This is the authorization boundary: disabling public signups remains
    // effective. The service role creates an Auth account only for an exact,
    // active household invitation that was issued by an existing member.
    const { data: invitation, error: invitationError } = await admin
      .from("household_invitations")
      .select("id, invited_name, phone")
      .ilike("email", normalizedEmail)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (invitationError) throw invitationError;

    // Use the same generic response for missing invitations so this endpoint
    // does not disclose whether arbitrary email addresses have FamOS accounts.
    if (!invitation) return respond({ ready: true, invited: false });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (profileError) throw profileError;

    // A profile means this email already completed FamOS registration. A stale
    // or duplicate pending invitation must never turn an existing member back
    // into a first-time password-setup flow.
    if (profile) {
      return respond({ ready: true, invited: false, existingAccount: true });
    }

    if (!profile) {
      const { error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {
          invited_to_famos: true,
          ...(invitation.invited_name ? { display_name: invitation.invited_name } : {}),
          ...(invitation.phone ? { phone: invitation.phone } : {}),
        },
      });
      if (createError && !/already.*registered|already exists/i.test(createError.message || "")) {
        throw createError;
      }
    }

    return respond({ ready: true, invited: true });
  } catch (error) {
    return respond({ error: error.message || "Could not prepare the invited account." }, 400);
  }
});
