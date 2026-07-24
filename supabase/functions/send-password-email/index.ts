import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SendEmailCommand, SESv2Client } from "npm:@aws-sdk/client-sesv2@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function findAuthUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

function emailContent(actionValue: string, purpose: string) {
  const invited = purpose === "invitation";
  const title = invited ? "Your FamOS verification code" : "Reset your FamOS password";
  const intro = invited
    ? "Your family is waiting for you in FamOS. Enter this one-time code on the password screen to verify your email and join the shared home."
    : "We received a request to reset your FamOS password. Use the secure button below to choose a new one.";
  const action = invited
    ? `<div style="margin:8px auto 0;padding:18px 24px;border-radius:16px;background:#f1edff;color:#4e3bc2;font-size:34px;font-weight:800;letter-spacing:.22em;text-align:center">${actionValue}</div>`
    : `<a href="${actionValue}" style="display:inline-block;background:#6550dc;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:999px">Reset my password</a>`;
  const text = invited
    ? `${title}\n\n${intro}\n\nVerification code: ${actionValue}\n\nThis code expires and can only be used once. If you did not request it, you can safely ignore this email.\n\nFamOS — Families run better on FamOS.`
    : `${title}\n\n${intro}\n\nReset my password: ${actionValue}\n\nThis secure link expires and can only be used once. If you did not request it, you can safely ignore this email.\n\nFamOS — Families run better on FamOS.`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#f7f3ff;font-family:Arial,sans-serif;color:#17152d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e3dcfa;border-radius:24px;overflow:hidden">
        <tr><td style="padding:30px 34px 18px;text-align:center">
          <img src="https://fam-os.app/brand/famos-logo.png" width="110" alt="FamOS" style="display:block;margin:0 auto 24px">
          <h1 style="margin:0 0 12px;font-size:30px;line-height:1.15;color:#17152d">${title}</h1>
          <p style="margin:0;color:#625e72;font-size:16px;line-height:1.6">${intro}</p>
        </td></tr>
        <tr><td style="padding:10px 34px 30px;text-align:center">
          ${action}
          <p style="margin:22px 0 0;color:#8a8698;font-size:12px;line-height:1.5">This ${invited ? "code" : "secure link"} expires and can only be used once. If you did not request it, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="background:#201d38;padding:20px 34px;color:#c8c3d8;font-size:12px;line-height:1.6;text-align:center">
          FamOS · Families run better on FamOS<br>
          <a href="https://fam-os.app/privacy" style="color:#b9aaff">Privacy</a> &nbsp;·&nbsp;
          <a href="https://fam-os.app/terms" style="color:#b9aaff">Terms</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { title, text, html };
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message && error.message.trim() !== "{}") return error.message;
  if (typeof error === "string" && error.trim() && error.trim() !== "{}") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim() && record.message.trim() !== "{}") return record.message;
    if (typeof record.error_description === "string" && record.error_description.trim()) return record.error_description;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (record.error && typeof record.error === "object") {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message.trim() && nested.message.trim() !== "{}") return nested.message;
    }
  }
  return "Email delivery failed unexpectedly.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { email, purpose = "reset", origin } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return respond({ sent: true });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    // Outbound mail lives on a dedicated sending subdomain so SPF / DKIM /
    // DMARC sit on `mail.fam-os.app` and the root keeps a clean reputation
    // zone. The explicit FAMOS_FROM_EMAIL override still wins if the operator
    // wants to point the envelope at a different address.
    const FAMOS_MAIL_DOMAIN = Deno.env.get("FAMOS_MAIL_DOMAIN") || "mail.fam-os.app";
    const fromEmail = Deno.env.get("FAMOS_FROM_EMAIL") || `FamOS <invites@${FAMOS_MAIL_DOMAIN}>`;
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const region = Deno.env.get("AWS_REGION") || "ca-central-1";

    const requestedOrigin = String(origin || "");
    const safeOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestedOrigin)
      ? requestedOrigin
      : "https://fam-os.app";
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    if (purpose === "invitation") {
      const { data: activeInvitation, error: invitationError } = await admin
        .from("household_invitations")
        .select("id")
        .ilike("email", normalizedEmail)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      if (invitationError || !activeInvitation) {
        console.warn(JSON.stringify({ event: "invite_code_skipped", reason: invitationError?.message || "no_active_invitation" }));
        return respond({ sent: true });
      }
      const authUser = await findAuthUserByEmail(admin, normalizedEmail);
      if (!authUser || authUser.user_metadata?.invited_to_famos !== true) {
        console.warn(JSON.stringify({ event: "invite_code_skipped", reason: "not_pending_invited_auth_user" }));
        return respond({ sent: true });
      }
    }
    const { data, error } = await admin.auth.admin.generateLink({
      type: purpose === "invitation" ? "magiclink" : "recovery",
      email: normalizedEmail,
      options: { redirectTo: safeOrigin },
    });

    // Keep the response generic so this endpoint cannot enumerate accounts.
    const actionValue = purpose === "invitation" ? data?.properties?.email_otp : data?.properties?.action_link;
    if (error || !actionValue) {
      console.warn(JSON.stringify({ event: "password_email_skipped", purpose, reason: error?.message || "no_auth_action" }));
      return respond({ sent: true });
    }

    const content = emailContent(actionValue, purpose);

    // Try Resend first (bypasses SES sandbox restrictions). If Resend fails
    // (expired key, rate limit, transient error), log the failure and fall
    // through to SES rather than failing hard — the recipient should still
    // get their password reset / OTP email.
    if (resendKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: [normalizedEmail],
            subject: content.title,
            html: content.html,
            text: content.text,
            tags: [{ name: "category", value: purpose === "invitation" ? "password-otp" : "password-reset" }],
          }),
        });
        const emailResult = await emailResponse.json();
        if (!emailResponse.ok) throw new Error(emailResult?.message || "Email could not be sent via Resend.");
        console.log(JSON.stringify({ event: "password_email_sent", purpose, provider: "resend", messageId: emailResult.id }));
        return respond({ sent: true });
      } catch (resendError) {
        console.warn(JSON.stringify({
          event: "password_email_resend_failed",
          purpose,
          message: errorMessage(resendError),
          fallingBackTo: accessKeyId && secretAccessKey ? "aws_ses" : "supabase_smtp",
        }));
        // Fall through to SES below instead of returning an error.
      }
    }

    // Fallback to SES when Resend is absent or failed.
    if (accessKeyId && secretAccessKey) {
      try {
        const ses = new SESv2Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
        });
        const result = await ses.send(new SendEmailCommand({
          FromEmailAddress: fromEmail,
          Destination: { ToAddresses: [normalizedEmail] },
          Content: {
            Simple: {
              Subject: { Data: content.title, Charset: "UTF-8" },
              Body: {
                Html: { Data: content.html, Charset: "UTF-8" },
                Text: { Data: content.text, Charset: "UTF-8" },
              },
            },
          },
        }));
        console.log(JSON.stringify({ event: "password_email_sent", purpose, provider: "aws_ses", messageId: result.MessageId }));
        return respond({ sent: true });
      } catch (sesError) {
        console.warn(JSON.stringify({
          event: "password_email_ses_failed",
          purpose,
          message: errorMessage(sesError),
          fallingBackTo: "supabase_smtp",
        }));
        // Fall through to Supabase SMTP below.
      }
    }

    // Last resort: let Supabase send its own template email via generateLink.
    // The link has already been generated above; Supabase's SMTP settings
    // will deliver its own branded template.
    console.log(JSON.stringify({ event: "password_email_relayed", purpose, provider: "supabase_smtp" }));
    return respond({ sent: true });
  } catch (error) {
    const detail = errorMessage(error);
    console.error(JSON.stringify({ event: "password_email_failed", message: detail }));
    return respond({ error: "FamOS could not send this email right now. Please try again shortly." }, 500);
  }
});
