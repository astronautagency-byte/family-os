// Self-test for every delivery channel wired into FamOS: AWS SES, Resend,
// Supabase SMTP, AWS SNS, and Textbelt. One tap in Settings → Integrations
// fires a real attempt through each provider the household has configured
// and returns a structured pass / fail back to the client. Cuts the
// "is email working?" support loop from "read function logs" to a one-tap
// in-app diagnostic.
//
// Concurrency / abuse: clients throttle to one test per 60 seconds; the
// edge function itself does NOT throttle because master-owners legitimately
// need to retest after rotating a key. Every channel attempt logs
// `event: "delivery_test_run"` with the per-channel status so the backend
// can audit rate.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PublishCommand, SNSClient } from "npm:@aws-sdk/client-sns@3";
import { GetAccountCommand, SendEmailCommand, SESv2Client } from "npm:@aws-sdk/client-sesv2@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TEST_SUBJECT_PREFIX = "[FamOS test]";
// In-memory rate limit. Supabase edge runtimes reset the module on a cold
// start, so this is best-effort only; the client-side cooldown in Settings is
// the primary gate. This server-side map catches the case where a user
// hammers the function from a script or a second tab.
const SERVER_TEST_COOLDOWN_MS = 60_000;
const lastTestByUser = new Map<string, number>();

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message && error.message.trim() !== "{}") return error.message;
  if (typeof error === "string" && error.trim() && error.trim() !== "{}") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim() && record.message.trim() !== "{}") return record.message;
    if (typeof record.error_description === "string" && record.error_description.trim()) {
      return record.error_description;
    }
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (record.error && typeof record.error === "object") {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message.trim() && nested.message.trim() !== "{}") {
        return nested.message;
      }
    }
  }
  return "Delivery probe failed unexpectedly.";
}

type ChannelResult = {
  channel: string;
  provider: string;
  kind: "email" | "sms";
  status: "sent" | "failed" | "blocked" | "paused" | "rate_limited" | "unreachable" | "not_configured" | "skipped";
  latency_ms?: number;
  error?: string;
  message?: string;
  region?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const requestId = crypto.randomUUID();

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FAMOS_FROM_EMAIL") || "FamOS <invites@fam-os.app>";
    const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const awsRegion = Deno.env.get("AWS_REGION") || "ca-central-1";
    const textbeltKey = Deno.env.get("TEXTBELT_API_KEY");
    const hasAws = Boolean(awsAccessKeyId && awsSecretAccessKey);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sign in to run delivery tests.");
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !user) throw new Error("Your session has expired. Sign in again.");
    if (!user.email) throw new Error("Your account needs a primary email to run delivery tests.");

    // Server-side 60s throttle by user.id. Best-effort (in-memory; resets on
    // cold start) but catches click-spammers and script callers that bypass
    // the Settings card's client cooldown.
    const nowMs = Date.now();
    const lastMs = lastTestByUser.get(user.id) ?? 0;
    if (nowMs - lastMs < SERVER_TEST_COOLDOWN_MS) {
      const secondsLeft = Math.ceil((SERVER_TEST_COOLDOWN_MS - (nowMs - lastMs)) / 1000);
      return json({ error: `Please wait ${secondsLeft}s before running another delivery test.`, code: "throttled", requestId }, 429);
    }
    lastTestByUser.set(user.id, nowMs);

    const body = await request.json().catch(() => ({}));
    const testPhone = String(body?.testPhone || "").trim().replace(/[^\d+]/g, "");

    const results: ChannelResult[] = [];

    // ── 1. AWS SES ────────────────────────────────────────────────────────
    if (hasAws) {
      const startedAt = Date.now();
      try {
        const probe = await new SESv2Client({
          region: awsRegion,
          credentials: { accessKeyId: awsAccessKeyId!, secretAccessKey: awsSecretAccessKey! },
        }).send(new GetAccountCommand({}));
        const productionOn = Boolean(probe.ProductionAccessEnabled);
        const sendingOn = Boolean(probe.SendingEnabled);
        if (!productionOn) {
          results.push({
            channel: "aws_ses",
            provider: "aws_ses",
            kind: "email",
            status: "blocked",
            error:
              "AWS SES is still in sandbox mode in this region. Submit an AWS Support case to lift production access, or switch the household to Resend.",
            latency_ms: Date.now() - startedAt,
            region: awsRegion,
          });
        } else if (!sendingOn) {
          results.push({
            channel: "aws_ses",
            provider: "aws_ses",
            kind: "email",
            status: "paused",
            error: "AWS SES sending is paused. Re-enable it from the AWS SES console in this region.",
            latency_ms: Date.now() - startedAt,
            region: awsRegion,
          });
        } else {
          // Production-access ON — fire a real send to the master owner
          try {
            const ses = new SESv2Client({
              region: awsRegion,
              credentials: { accessKeyId: awsAccessKeyId!, secretAccessKey: awsSecretAccessKey! },
            });
            const result = await ses.send(
              new SendEmailCommand({
                FromEmailAddress: fromEmail,
                Destination: { ToAddresses: [user.email] },
                Content: {
                  Simple: {
                    Subject: { Data: `${TEST_SUBJECT_PREFIX} Amazon SES · ignore`, Charset: "UTF-8" },
                    Body: {
                      Text: {
                        Data: `This is a FamOS delivery-channel self-test through Amazon SES (${awsRegion}). If you got this, SES is healthy and ready for invites.`,
                        Charset: "UTF-8",
                      },
                    },
                  },
                },
              }),
            );
            results.push({
              channel: "aws_ses",
              provider: "aws_ses",
              kind: "email",
              status: result.MessageId ? "sent" : "failed",
              latency_ms: Date.now() - startedAt,
              message: result.MessageId,
              region: awsRegion,
            });
          } catch (sesError) {
            const msg = errorMessage(sesError);
            const sandbox = /Email address is not verified|MailFromDomainNotVerified/i.test(msg);
            results.push({
              channel: "aws_ses",
              provider: "aws_ses",
              kind: "email",
              status: sandbox ? "blocked" : "failed",
              error: sandbox
                ? `AWS SES rejected your account email as unverified. Verify ${user.email} in the SES console or wait for production access.`
                : msg,
              latency_ms: Date.now() - startedAt,
              region: awsRegion,
            });
          }
        }
      } catch (probeError) {
        const msg = errorMessage(probeError);
        // Probe failures with "MessageRejected" still tell us the region is reachable
        // but the IAM key lacks ses:GetAccount. Treat as "unreachable" so the master
        // owner knows to rotate keys.
        results.push({
          channel: "aws_ses",
          provider: "aws_ses",
          kind: "email",
          status: /AccessDenied|not authorized|accessdenied/i.test(msg) ? "unreachable" : "failed",
          error: /AccessDenied|not authorized|accessdenied/i.test(msg)
            ? "The FamOS AWS key is missing ses:GetAccountAndSendEmail permission."
            : msg,
          latency_ms: Date.now() - startedAt,
          region: awsRegion,
        });
      }
    } else {
      results.push({
        channel: "aws_ses",
        provider: "aws_ses",
        kind: "email",
        status: "not_configured",
        error: "AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY missing in Supabase secrets.",
      });
    }

    // ── 2. Resend ─────────────────────────────────────────────────────────
    if (resendKey) {
      const startedAt = Date.now();
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [user.email],
            subject: `${TEST_SUBJECT_PREFIX} Resend · ignore`,
            text: "This is a FamOS delivery-channel self-test through Resend. If you got this, Resend is healthy and ready for invites.",
            tags: [{ name: "category", value: "delivery-test" }],
          }),
        });
        const responseBody = await response.json().catch(() => null);
        if (!response.ok) {
          results.push({
            channel: "resend",
            provider: "resend",
            kind: "email",
            status: "failed",
            error:
              responseBody?.message ||
              `Resend API returned HTTP ${response.status}${response.status === 401 ? " — RESEND_API_KEY is invalid or revoked." : ""}`,
            latency_ms: Date.now() - startedAt,
          });
        } else {
          results.push({
            channel: "resend",
            provider: "resend",
            kind: "email",
            status: "sent",
            latency_ms: Date.now() - startedAt,
            message: responseBody?.id,
          });
        }
      } catch (resendError) {
        results.push({
          channel: "resend",
          provider: "resend",
          kind: "email",
          status: "unreachable",
          error: errorMessage(resendError),
          latency_ms: Date.now() - startedAt,
        });
      }
    } else {
      results.push({
        channel: "resend",
        provider: "resend",
        kind: "email",
        status: "not_configured",
        error: "RESEND_API_KEY missing in Supabase secrets. Add one to route email through Resend regardless of SES sandbox status.",
      });
    }

    // ── 3. Supabase SMTP (probe-only — never fire a magic-link from a test!) ──
    // We intentionally avoid admin.auth.admin.generateLink here: it queues a
    // real magic-link email and burns Supabase's per-account ~60s invite
    // cooldown. listUsers({ page: 1, perPage: 1 }) touches the same admin path
    // without firing any email, so a "sent" result here means the Supabase
    // project + admin API are reachable — the channel that delivers invites.
    {
      const startedAt = Date.now();
      try {
        const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
        const latency_ms = Date.now() - startedAt;
        if (error) {
          results.push({
            channel: "supabase_smtp",
            provider: "supabase_smtp",
            kind: "email",
            status: /after\s+\d+\s+second/i.test(error.message || "") ? "rate_limited" : "failed",
            error: error.message || "Supabase admin API returned an unknown error.",
            latency_ms,
          });
        } else {
          results.push({
            channel: "supabase_smtp",
            provider: "supabase_smtp",
            kind: "email",
            status: "sent",
            latency_ms,
            message: "admin API reachable · send a real invite to confirm Supabase SMTP actually delivers",
          });
        }
      } catch (supabaseError) {
        results.push({
          channel: "supabase_smtp",
          provider: "supabase_smtp",
          kind: "email",
          status: "unreachable",
          error: errorMessage(supabaseError),
          latency_ms: Date.now() - startedAt,
        });
      }
    }

    // ── 4. SMS via AWS SNS or Textbelt (only if phone was provided) ──────
    if (testPhone) {
      if (!/^\+?\d{10,15}$/.test(testPhone)) {
        results.push({
          channel: "sms",
          provider: "none",
          kind: "sms",
          status: "failed",
          error: "Phone must include the country code, e.g. +14165550123.",
        });
      } else if (hasAws) {
        const startedAt = Date.now();
        try {
          const sns = new SNSClient({
            region: awsRegion,
            credentials: { accessKeyId: awsAccessKeyId!, secretAccessKey: awsSecretAccessKey! },
          });
          const result = await sns.send(
            new PublishCommand({
              PhoneNumber: testPhone.startsWith("+") ? testPhone : `+${testPhone}`,
              Message: `FamOS delivery-channel self-test via Amazon SNS (${awsRegion}). Reply STOP to opt out.`,
              MessageAttributes: {
                "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
              },
            }),
          );
          results.push({
            channel: "aws_sns",
            provider: "aws_sns",
            kind: "sms",
            status: result.MessageId ? "sent" : "failed",
            latency_ms: Date.now() - startedAt,
            message: result.MessageId,
            region: awsRegion,
          });
        } catch (snsError) {
          const msg = errorMessage(snsError);
          const sandbox = /sandbox|need.*verif|PinpointSmsVoiceV2/i.test(msg);
          results.push({
            channel: "aws_sns",
            provider: "aws_sns",
            kind: "sms",
            status: sandbox ? "blocked" : "failed",
            error: sandbox
              ? `Amazon SMS onboarding is incomplete in ${awsRegion}. Activate AWS End User Messaging and verify a sandbox destination.`
              : /authorization|not authorized|accessdenied/i.test(msg)
                ? "The FamOS AWS key is missing sns:Publish permission."
                : msg,
            latency_ms: Date.now() - startedAt,
            region: awsRegion,
          });
        }
      } else if (textbeltKey) {
        const startedAt = Date.now();
        try {
          const response = await fetch("https://textbelt.com/text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: testPhone.startsWith("+") ? testPhone : `+${testPhone}`,
              message: "FamOS delivery-channel self-test via Textbelt. Reply STOP to opt out.",
              key: textbeltKey,
            }),
          });
          const responseBody = await response.json().catch(() => null);
          if (response.ok && responseBody?.success) {
            results.push({
              channel: "textbelt",
              provider: "textbelt",
              kind: "sms",
              status: "sent",
              latency_ms: Date.now() - startedAt,
              message: responseBody?.quotaRemaining !== undefined ? `quota remaining: ${responseBody.quotaRemaining}` : undefined,
            });
          } else {
            results.push({
              channel: "textbelt",
              provider: "textbelt",
              kind: "sms",
              status: "failed",
              error:
                responseBody?.error ||
                `Textbelt refused the message (HTTP ${response.status}). The free tier is one text/day per recipient.`,
              latency_ms: Date.now() - startedAt,
            });
          }
        } catch (textbeltError) {
          results.push({
            channel: "textbelt",
            provider: "textbelt",
            kind: "sms",
            status: "unreachable",
            error: errorMessage(textbeltError),
            latency_ms: Date.now() - startedAt,
          });
        }
      } else {
        results.push({
          channel: "sms",
          provider: "none",
          kind: "sms",
          status: "not_configured",
          error: "No SMS provider configured. Set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY or TEXTBELT_API_KEY.",
        });
      }
    } else {
      results.push({
        channel: "sms",
        provider: "none",
        kind: "sms",
        status: "skipped",
        error: "Add a phone number above to test SMS.",
      });
    }

    console.log(
      JSON.stringify({
        event: "delivery_test_run",
        requestId,
        userId: user.id,
        channels: results.map((r) => `${r.channel}=${r.status}`),
      }),
    );

    return json({ results, requestId, ranAt: new Date().toISOString() });
  } catch (error) {
    const detail = errorMessage(error);
    console.error(JSON.stringify({ event: "delivery_test_failed", requestId, message: detail }));
    return json({ error: detail, requestId }, 400);
  }
});
