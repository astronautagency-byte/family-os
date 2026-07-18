import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PublishCommand, SNSClient } from "npm:@aws-sdk/client-sns@3";
import { GetAccountCommand, SendEmailCommand, SESv2Client } from "npm:@aws-sdk/client-sesv2@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

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
    const diagnostic = [record.name, record.code, record.Code, record.__type, record.$fault]
      .filter((value) => typeof value === "string" && value.trim() && value.trim() !== "{}")
      .join(" · ");
    if (diagnostic) return diagnostic;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through to the stable user-facing message.
    }
  }
  return "Invitation delivery failed unexpectedly. Please try again.";
}

const escapeHtml = (value = "") => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

async function findAuthUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  // `profiles` can briefly lag behind Auth (or contain a legacy/orphaned row),
  // so it is not a reliable way to decide between an invite and a magic link.
  // The Admin API is the source of truth for whether this email can receive OTP.
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
}

function invitationEmail({
  actionLink,
  appOrigin: _appOrigin,
  householdName,
  inviterName,
}: {
  actionLink: string;
  appOrigin: string;
  householdName: string;
  inviterName: string;
}) {
  const safeHome = escapeHtml(householdName);
  const safeInviter = escapeHtml(inviterName);
  const logoUrl = "https://fam-os.app/brand/famos-icon-transparent.png";
  const preheader = `${safeInviter} invited you to join ${safeHome} on FamOS.`;
  const text = `${inviterName} invited you to join ${householdName} on FamOS.

Share calendars, tasks, meals, grocery lists and family chat in one private home.

Join your home: ${actionLink}

This secure invitation expires in 7 days. If you were not expecting it, you can ignore this email.

FamOS — Families Run Better on FamOS`;

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f5ff">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
          <tr>
            <td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
              <img src="${logoUrl}" width="88" height="78" alt="FamOS logo" style="display:block;margin:0 auto 8px;border:0">
              <div style="font-size:24px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
              <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6457d9">Families run better on FamOS</div>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 32px 12px;text-align:center">
              <h1 style="margin:0;font-size:30px;line-height:1.15;letter-spacing:-.03em;color:#19172b">You’re invited home</h1>
              <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
                <strong style="color:#19172b">${safeInviter}</strong> invited you to join
                <strong style="color:#19172b">${safeHome}</strong> on FamOS.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
                <tr><td style="padding:20px;font-size:14px;line-height:1.7;color:#5d5970;text-align:center">
                  Keep calendars, tasks, meals, grocery lists and family conversations together in one private home.
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 32px 34px">
              <a href="${escapeHtml(actionLink)}" style="display:inline-block;min-width:220px;padding:16px 24px;border-radius:999px;background:#5b4fd6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:750">Join ${safeHome}</a>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#918ca4">This secure invitation expires in 7 days.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #eee9fa;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
              This invitation was sent because a FamOS member entered this email address. Only accept if you recognize the inviter. FamOS will never ask for your password by email.<br>
              <a href="https://fam-os.app/privacy" style="color:#6457d9">Privacy</a> · <a href="https://fam-os.app/terms" style="color:#6457d9">Terms</a> · <a href="mailto:support@fam-os.app" style="color:#6457d9">Support</a><br>
              © 2026 FamOS. All rights reserved.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const requestId = crypto.randomUUID();
  let stage = "initialization";
  let invitationSaved = false;
  let partialSms: { requested: boolean; sent: boolean; message: string } | null = null;
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("You must be signed in to invite family members.");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FAMOS_FROM_EMAIL") || "FamOS <invites@fam-os.app>";
    const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const awsRegion = Deno.env.get("AWS_REGION") || "ca-central-1";
    const hasAwsMessaging = Boolean(awsAccessKeyId && awsSecretAccessKey);
    let awsEmailEnabled = false;
    if (hasAwsMessaging) {
      try {
        const account = await new SESv2Client({
          region: awsRegion,
          credentials: { accessKeyId: awsAccessKeyId!, secretAccessKey: awsSecretAccessKey! },
        }).send(new GetAccountCommand({}));
        awsEmailEnabled = Boolean(account.ProductionAccessEnabled && account.SendingEnabled);
      } catch (error) {
        console.warn(JSON.stringify({
          event: "family_invitation_ses_status_unavailable",
          requestId,
          message: error?.message || String(error),
        }));
      }
    }

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    stage = "session validation";
    const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !user) throw new Error("Your session has expired. Please sign in again.");

    const { email, phone, name, householdId, redirectTo } = await request.json();
    if (!email?.trim() || !householdId) throw new Error("Email and household are required.");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = String(phone || "").replace(/[^\d+]/g, "");
    const invitedName = String(name || "").trim().slice(0, 120);
    if (normalizedPhone && !/^\+?\d{10,15}$/.test(normalizedPhone)) throw new Error("Enter the mobile number with country code, for example +1 416 555 0123.");
    if (normalizedEmail === user.email?.toLowerCase()) throw new Error("Invite another family member, not yourself.");

    stage = "household authorization";
    const [{ data: membership }, { data: household }, { data: inviterProfile }] = await Promise.all([
      admin.from("household_members").select("role").eq("household_id", householdId).eq("user_id", user.id).maybeSingle(),
      admin.from("households").select("name").eq("id", householdId).maybeSingle(),
      admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    ]);
    if (!membership) throw new Error("Only members of this home can send invitations.");

    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const { data: activeInvite, error: activeInviteError } = await admin
      .from("household_invitations")
      .select("household_id, households(name)")
      .ilike("email", normalizedEmail)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (activeInviteError) throw activeInviteError;
    if (activeInvite && activeInvite.household_id !== householdId) {
      throw new Error(`This email already has an active invitation to ${activeInvite.households?.name || "another FamOS home"}. Revoke that invitation before inviting them elsewhere.`);
    }

    const invitationPayload = {
      household_id: householdId,
      email: normalizedEmail,
      ...(invitedName ? { invited_name: invitedName } : {}),
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      invited_by: user.id,
      accepted_at: null,
      expires_at: expiresAt,
    };
    stage = "saving the pending invitation";
    let { error: invitationError } = await admin.from("household_invitations").upsert(invitationPayload, { onConflict: "household_id,email" });
    if (invitationError && /invited_name|phone|schema cache|column/i.test(invitationError.message || "")) {
      const { phone: _phone, invited_name: _invitedName, ...legacyPayload } = invitationPayload;
      ({ error: invitationError } = await admin.from("household_invitations").upsert(legacyPayload, { onConflict: "household_id,email" }));
    }
    if (invitationError) throw invitationError;
    invitationSaved = true;

    stage = "checking the invited account";
    const existingAuthUser = await findAuthUserByEmail(admin, normalizedEmail);
    const appOrigin = new URL(redirectTo || "https://fam-os.app").origin;
    const callbackUrl = existingAuthUser ? `${appOrigin}/signin` : `${appOrigin}/signin?invite=1`;
    const householdName = household?.name || "your family home";
    const inviterName = inviterProfile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "A family member";
    console.log(JSON.stringify({
      event: "family_invitation_started",
      requestId,
      existingAccount: Boolean(existingAuthUser),
      emailProvider: resendKey ? "resend" : hasAwsMessaging ? "aws_ses" : "supabase_smtp",
      awsEmailStatusConfirmed: awsEmailEnabled,
      smsRequested: Boolean(normalizedPhone),
      awsRegion,
    }));
    const sms = { requested: Boolean(normalizedPhone), sent: false, message: "" };
    partialSms = sms;
    const sendSupabaseEmail = async () => {
      if (existingAuthUser) {
        const deliveryClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const { error } = await deliveryClient.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: false, emailRedirectTo: callbackUrl },
        });
        if (error) throw error;
      } else {
        const { error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo: callbackUrl });
        if (error) throw error;
      }
    };
    if (normalizedPhone) {
      stage = "sending the invitation SMS";
      const textbeltKey = Deno.env.get("TEXTBELT_API_KEY");
      if (!awsAccessKeyId || !awsSecretAccessKey) {
        if (!textbeltKey) {
          sms.message = "No SMS provider is configured yet";
        } else {
          const joinUrl = `${appOrigin}/signin?invited=1&email=${encodeURIComponent(normalizedEmail)}`;
          try {
            const textbeltResponse = await fetch("https://textbelt.com/text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone: normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`,
                message: `${inviterName} invited you to ${householdName} on FamOS. Join here: ${joinUrl} Reply STOP to opt out.`,
                key: textbeltKey,
              }),
            });
            const textbeltResult = await textbeltResponse.json();
            sms.sent = Boolean(textbeltResponse.ok && textbeltResult?.success);
            sms.message = sms.sent ? "" : textbeltResult?.error || "The SMS provider did not accept the message";
          } catch (error) {
            sms.message = error?.message || "The SMS provider could not be reached";
          }
        }
      } else {
        const joinUrl = `${appOrigin}/signin?invited=1&email=${encodeURIComponent(normalizedEmail)}`;
        try {
          const sns = new SNSClient({
            region: awsRegion,
            credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey },
          });
          const attributes: Record<string, { DataType: string; StringValue: string }> = {
            "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
          };
          const senderId = Deno.env.get("AWS_SNS_SENDER_ID");
          if (senderId) attributes["AWS.SNS.SMS.SenderID"] = { DataType: "String", StringValue: senderId };
          const result = await sns.send(new PublishCommand({
            PhoneNumber: normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`,
            Message: `${inviterName} invited you to ${householdName} on FamOS. Join your family home: ${joinUrl} Reply STOP to opt out.`,
            MessageAttributes: attributes,
          }));
          sms.sent = Boolean(result.MessageId);
          sms.message = sms.sent ? "" : "Amazon SNS did not return a message ID";
          console.log(JSON.stringify({ event: "family_invitation_sms", requestId, sent: sms.sent }));
        } catch (error) {
          const awsMessage = errorMessage(error);
          sms.message = /needs a subscription|can't determine whether.*sandbox|PinpointSmsVoiceV2/i.test(awsMessage)
            ? `Amazon SMS onboarding is incomplete in ${awsRegion}. Activate AWS End User Messaging SMS in that region, verify a sandbox destination, and try again.`
            : /authorization|not authorized|accessdenied/i.test(awsMessage)
              ? "The FamOS AWS key is missing sns:Publish permission."
              : awsMessage || "Amazon SNS did not accept the message";
          console.error(JSON.stringify({
            event: "family_invitation_sms_failed",
            requestId,
            errorName: error instanceof Error ? error.name : "Error",
            message: sms.message,
          }));
        }
      }
    }

    // Keep invitations functional while the custom sender is being configured.
    // Supabase sends either an invite for a new Auth account or a sign-in OTP
    // for an existing account. Once RESEND_API_KEY is present, the branded
    // FamOS template below becomes the delivery path automatically.
    if (!resendKey && !hasAwsMessaging) {
      stage = "sending the Supabase invitation email";
      await sendSupabaseEmail();
      console.log(JSON.stringify({ event: "family_invitation_email", requestId, provider: "supabase_smtp", sent: true }));
      return json({
        sent: true,
        existingAccount: Boolean(existingAuthUser),
        pending: true,
        provider: "supabase",
        sms,
      });
    }

    const linkType = existingAuthUser ? "magiclink" : "invite";
    stage = "creating the secure invitation link";
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: linkType,
      email: normalizedEmail,
      options: { redirectTo: callbackUrl },
    });
    if (linkError || !linkData?.properties?.action_link) throw linkError || new Error("Could not create a secure invitation link.");

    const content = invitationEmail({
      actionLink: linkData.properties.action_link,
      appOrigin,
      householdName,
      inviterName,
    });
    let emailId = "";
    let provider = "aws_ses";
    if (resendKey) {
      stage = "sending the Resend invitation email";
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [normalizedEmail],
          subject: `${inviterName} invited you to ${householdName} on FamOS`,
          html: content.html,
          text: content.text,
          tags: [{ name: "category", value: "household-invitation" }],
        }),
      });
      const emailResult = await emailResponse.json();
      if (!emailResponse.ok) throw new Error(emailResult?.message || "The invitation was saved, but the branded email could not be sent.");
      emailId = emailResult.id;
      provider = "resend";
    } else {
      stage = "sending the Amazon SES invitation email";
      const ses = new SESv2Client({
        region: awsRegion,
        credentials: { accessKeyId: awsAccessKeyId!, secretAccessKey: awsSecretAccessKey! },
      });
      try {
        const emailResult = await ses.send(new SendEmailCommand({
          FromEmailAddress: fromEmail,
          Destination: { ToAddresses: [normalizedEmail] },
          Content: {
            Simple: {
              Subject: { Data: `${inviterName} invited you to ${householdName} on FamOS`, Charset: "UTF-8" },
              Body: {
                Html: { Data: content.html, Charset: "UTF-8" },
                Text: { Data: content.text, Charset: "UTF-8" },
              },
            },
          },
        }));
        emailId = emailResult.MessageId || "";
        if (!emailId) throw new Error("Amazon SES did not return a message ID.");
      } catch (sesError) {
        const sesMessage = errorMessage(sesError);
        console.warn(JSON.stringify({ event: "family_invitation_ses_fallback", requestId, message: sesMessage }));
        try {
          await sendSupabaseEmail();
        } catch (fallbackError) {
          throw new Error(`Amazon SES: ${sesMessage}. Supabase email fallback: ${errorMessage(fallbackError)}`);
        }
        return json({
          sent: true,
          existingAccount: Boolean(existingAuthUser),
          pending: true,
          provider: "supabase_fallback",
          providerWarning: sesMessage,
          sms,
        });
      }
    }
    console.log(JSON.stringify({ event: "family_invitation_email", requestId, provider, sent: true }));

    return json({
      sent: true,
      existingAccount: Boolean(existingAuthUser),
      pending: true,
      emailId,
      provider,
      sms,
    });
  } catch (error) {
    const detail = errorMessage(error);
    const message = `Invitation failed during ${stage}: ${detail}`;
    console.error(JSON.stringify({
      event: "family_invitation_failed",
      requestId,
      errorName: error instanceof Error ? error.name : "Error",
      message,
    }));
    if (invitationSaved) {
      return json({
        sent: false,
        pending: true,
        emailError: message,
        sms: partialSms,
        requestId,
      });
    }
    return json({ error: message, requestId }, 400);
  }
});
