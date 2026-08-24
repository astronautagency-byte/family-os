import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// 1x1 transparent GIF pixel
const PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getClientInfo(request: Request) {
  return {
    user_agent: request.headers.get("user-agent") || "",
    ip_address:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route: /track-email-event/open/:eventId
    if (path.includes("/open/")) {
      const eventId = path.split("/open/")[1]?.split("?")[0];
      if (!eventId) {
        return new Response(PIXEL, {
          headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
        });
      }

      // Record the open event (best-effort, non-blocking)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const clientInfo = getClientInfo(request);

      // Look up the email record to get household/user IDs
      const { data: emailRecord } = await admin
        .from("onboarding_emails")
        .select("id, household_id, user_id, email_type")
        .eq("id", eventId)
        .maybeSingle();

      if (emailRecord) {
        // Check if we already have an open for this email (deduplicate pixel loads)
        const { data: existingOpen } = await admin
          .from("onboarding_email_events")
          .select("id")
          .eq("email_id", eventId)
          .eq("event_type", "open")
          .limit(1)
          .maybeSingle();

        if (!existingOpen) {
          await admin.from("onboarding_email_events").insert({
            email_id: eventId,
            household_id: emailRecord.household_id,
            user_id: emailRecord.user_id,
            email_type: emailRecord.email_type,
            event_type: "open",
            user_agent: clientInfo.user_agent,
            ip_address: clientInfo.ip_address || null,
          });
          console.log(
            JSON.stringify({
              event: "email_opened",
              email_id: eventId,
              email_type: emailRecord.email_type,
            })
          );
        }
      }

      return new Response(PIXEL, {
        headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
      });
    }

    // Route: /track-email-event/click/:eventId?url=<encoded_url>
    if (path.includes("/click/")) {
      const eventId = path.split("/click/")[1]?.split("?")[0];
      const destinationUrl = url.searchParams.get("url");

      if (!eventId || !destinationUrl) {
        return new Response("Missing parameters", { status: 400 });
      }

      // Validate the destination URL is on a known domain
      let dest: URL;
      try {
        dest = new URL(destinationUrl);
      } catch {
        return new Response("Invalid URL", { status: 400 });
      }
      const allowedHosts = [
        "home.fam-os.app",
        "fam-os.app",
        "localhost",
        "127.0.0.1",
      ];
      if (!allowedHosts.includes(dest.hostname)) {
        return new Response("URL not on an allowed domain", { status: 403 });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const clientInfo = getClientInfo(request);

      const { data: emailRecord } = await admin
        .from("onboarding_emails")
        .select("id, household_id, user_id, email_type")
        .eq("id", eventId)
        .maybeSingle();

      if (emailRecord) {
        // Record every click (not deduplicated — multiple clicks are meaningful)
        await admin.from("onboarding_email_events").insert({
          email_id: eventId,
          household_id: emailRecord.household_id,
          user_id: emailRecord.user_id,
          email_type: emailRecord.email_type,
          event_type: "click",
          link_url: destinationUrl,
          user_agent: clientInfo.user_agent,
          ip_address: clientInfo.ip_address || null,
        });
        console.log(
          JSON.stringify({
            event: "email_clicked",
            email_id: eventId,
            email_type: emailRecord.email_type,
            url: destinationUrl,
          })
        );
      }

      // 302 redirect to the destination
      return Response.redirect(destinationUrl, 302);
    }

    return new Response("Not found", { status: 404 });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "email_tracking_error",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );
    // Still return a pixel so the email client doesn't show a broken image
    return new Response(PIXEL, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
    });
  }
});
