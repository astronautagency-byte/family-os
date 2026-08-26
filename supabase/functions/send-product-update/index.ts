// Sends product update emails to all active users and marks the update as sent.
//
// Env secrets needed:
//   RESEND_API_KEY           — Resend API key for email delivery
//   SUPABASE_URL              — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await request.json();
    const { updateId } = body;
    if (!updateId) return respond({ error: "updateId is required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const FAMOS_MAIL_DOMAIN = Deno.env.get("FAMOS_MAIL_DOMAIN") || "mail.fam-os.app";
    const fromEmail = Deno.env.get("FAMOS_FROM_EMAIL") || `FamOS <noreply@${FAMOS_MAIL_DOMAIN}>`;

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch the update
    const { data: update, error: updateError } = await admin
      .from("product_updates")
      .select("*")
      .eq("id", updateId)
      .single();
    if (updateError || !update) return respond({ error: "Update not found" }, 404);

    // Fetch all users with email
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, email")
      .not("email", "is", null);
    if (profilesError) return respond({ error: profilesError.message }, 500);

    const users = (profiles || []).filter((p: any) => p.email);
    if (!users.length) return respond({ sent: 0, message: "No users to notify" });

    const categoryLabel = update.category === "feature" ? "New feature" : update.category === "fix" ? "Bug fix" : "Product update";
    const appUrl = "https://home.fam-os.app";

    let sent = 0;
    let failed = 0;

    // Send in batches of 50 to avoid rate limits
    for (let i = 0; i < users.length; i += 50) {
      const batch = users.slice(i, i + 50);
      const results = await Promise.allSettled(
        batch.map(async (user: any) => {
          if (!resendKey) return;
          const htmlBody = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#17171f;max-width:560px;margin:0 auto;padding:40px 20px;">
<div style="text-align:center;margin-bottom:24px;"><img src="https://fam-os.app/icons/famos-app-icon.png" alt="FamOS" width="48" height="48" style="border-radius:12px;" /></div>
<p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#7952e8;margin:0 0 8px;">${categoryLabel}</p>
<h1 style="font-size:24px;font-weight:700;margin:0 0 16px;letter-spacing:-0.03em;">${update.title}</h1>
<p style="font-size:15px;line-height:1.6;color:#55525d;margin:0 0 16px;">${update.summary}</p>
${update.body ? `<div style="font-size:14px;line-height:1.6;color:#55525d;margin:0 0 24px;padding:16px;background:#f9f8ff;border-radius:12px;">${update.body.replace(/\n/g, "<br/>")}</div>` : ""}
${update.link_url ? `<a href="${update.link_url}" style="display:inline-block;padding:12px 20px;background:#7952e8;color:white;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;">${update.link_label || "Learn more"}</a>` : ""}
<hr style="border:none;border-top:1px solid #e8e5f0;margin:32px 0 16px;" />
<p style="font-size:12px;color:#999;text-align:center;">You're receiving this because you have a FamOS account. <a href="${appUrl}/settings" style="color:#7952e8;">Manage notifications</a></p>
</body></html>`;

          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: fromEmail,
              to: [user.email],
              subject: `[FamOS] ${update.title}`,
              html: htmlBody,
              tags: [{ name: "category", value: "product-update" }, { name: "update_id", value: updateId }],
            }),
          });
          if (!response.ok) throw new Error(`Resend failed: ${response.status}`);
          return user.id;
        })
      );
      sent += results.filter((r) => r.status === "fulfilled").length;
      failed += results.filter((r) => r.status === "rejected").length;
    }

    // Mark as published
    await admin.from("product_updates").update({ published_at: new Date().toISOString() }).eq("id", updateId);

    return respond({ sent, failed, total: users.length });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Failed to send update" }, 500);
  }
});
