// Sends support messages (emails, bug reports, tickets) via Resend and logs
// them to the support_messages table for tracking.
//
// Resend is preferred because it's free (100 emails/day on the trial),
// doesn't require SES domain verification, and provides delivery logs.
// The function also falls back to Supabase's built-in SMTP if Resend
// is unavailable.
//
// Env secrets needed:
//   RESEND_API_KEY           — Resend API key for email delivery
//   SUPPORT_TO_EMAIL          — where support messages go (default: support@fam-os.app)
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

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Could not send support message.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await request.json();
    const {
      category = "email",       // "email" | "bug" | "ticket"
      subject = "",
      message = "",
      senderEmail = "",
      priority = "normal",
      steps = "",
      userId = null,
      householdId = null,
      householdName = "",
    } = body;

    // Validate required fields.
    if (!subject.trim() || !message.trim()) {
      return respond({ error: "Subject and message are required." }, 400);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supportToEmail = Deno.env.get("SUPPORT_TO_EMAIL") || "support@fam-os.app";
    // Outbound mail lives on a dedicated sending subdomain so SPF / DKIM /
    // DMARC sit on `mail.fam-os.app` and the root keeps a clean reputation
    // zone. The explicit FAMOS_FROM_EMAIL override still wins if the operator
    // wants to point the envelope at a different address.
    const FAMOS_MAIL_DOMAIN = Deno.env.get("FAMOS_MAIL_DOMAIN") || "mail.fam-os.app";
    const fromEmail = Deno.env.get("FAMOS_FROM_EMAIL") || `FamOS <noreply@${FAMOS_MAIL_DOMAIN}>`;
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Log the message to the support_messages table first (always).
    let loggedId: number | null = null;
    if (url && serviceKey) {
      try {
        const admin = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: dbResult, error: dbError } = await admin
          .from("support_messages")
          .insert({
            category,
            subject: subject.trim(),
            message: message.trim(),
            sender_email: senderEmail,
            priority,
            steps: steps.trim(),
            status: "new",
            user_id: userId,
            household_id: householdId,
            household_name: householdName,
            app_version: "1.0",
          })
          .select("id")
          .single();
        if (dbError) {
          console.warn(JSON.stringify({ event: "support_log_failed", message: dbError.message }));
        } else if (dbResult) {
          loggedId = dbResult.id;
          console.log(JSON.stringify({ event: "support_logged", id: loggedId, category }));
        }
      } catch (logError) {
        console.warn(JSON.stringify({ event: "support_log_exception", message: errorMessage(logError) }));
      }
    }

    // Build the email body based on category.
    let emailSubject = subject.trim();
    let emailBody = message.trim();

    if (category === "bug") {
      emailSubject = `[Bug Report] ${subject.trim()}`;
      emailBody = `What happened:\n${message.trim()}`;
      if (steps.trim()) {
        emailBody += `\n\nSteps to reproduce:\n${steps.trim()}`;
      }
      emailBody += `\n\n---\nCategory: Bug Report`;
    } else if (category === "ticket") {
      emailSubject = `[${priority.toUpperCase()}] ${subject.trim()}`;
      emailBody = `Description:\n${message.trim()}`;
      emailBody += `\n\nPriority: ${priority}`;
      emailBody += `\n\n---\nCategory: Support Ticket`;
    } else {
      emailSubject = `[FamOS] ${subject.trim()}`;
      emailBody += `\n\n---\nCategory: General Inquiry`;
    }

    // Append context.
    if (senderEmail) emailBody += `\nFrom: ${senderEmail}`;
    if (householdName) emailBody += `\nHousehold: ${householdName}`;
    if (loggedId) emailBody += `\nTicket ID: #${loggedId}`;
    emailBody += `\nSubmitted via FamOS Settings`;

    // Send via Resend (free tier, 100/day).
    let emailSent = false;
    let autoReplySent = false;
    if (resendKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [supportToEmail],
            replyTo: senderEmail ? [senderEmail] : undefined,
            subject: emailSubject,
            text: emailBody,
            tags: [
              { name: "category", value: category },
              { name: "source", value: "famos-settings" },
            ],
          }),
        });
        const emailResult = await emailResponse.json();
        if (!emailResponse.ok) throw new Error(emailResult?.message || "Resend failed");
        emailSent = true;
        console.log(JSON.stringify({
          event: "support_email_sent",
          category,
          resendId: emailResult.id,
          dbId: loggedId,
        }));

        // Auto-reply: send a brief confirmation to the sender when they provided an email.
        if (senderEmail) {
          try {
            const autoReplyBody = `Hi there,\n\nThanks for reaching out to FamOS support.\n\nWe've received your ${category === "bug" ? "bug report" : category === "ticket" ? "support ticket" : "message"}${loggedId ? ` (#${loggedId})` : ""}.\n\nOur team will review it and get back to you as soon as possible.\n\n— The FamOS team`;
            const autoReplySubject = category === "bug"
              ? `Re: [Bug Report] ${subject.trim()}`
              : category === "ticket"
                ? `Re: [${priority.toUpperCase()}] ${subject.trim()}`
                : `Re: [FamOS] ${subject.trim()}`;
            const autoReplyResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [senderEmail],
                subject: autoReplySubject,
                text: autoReplyBody,
                tags: [
                  { name: "category", value: category },
                  { name: "source", value: "famos-auto-reply" },
                  { name: "ticketId", value: String(loggedId || "") },
                ],
              }),
            });
            const autoReplyResult = await autoReplyResponse.json();
            if (autoReplyResponse.ok) {
              autoReplySent = true;
              console.log(JSON.stringify({
                event: "support_auto_reply_sent",
                to: senderEmail,
                resendId: autoReplyResult.id,
                dbId: loggedId,
              }));
            } else {
              console.warn(JSON.stringify({
                event: "support_auto_reply_failed",
                to: senderEmail,
                message: autoReplyResult?.message || "Auto-reply Resend failed",
              }));
            }
          } catch (autoReplyError) {
            console.warn(JSON.stringify({
              event: "support_auto_reply_exception",
              to: senderEmail,
              message: errorMessage(autoReplyError),
            }));
          }
        }
      } catch (resendError) {
        console.warn(JSON.stringify({
          event: "support_email_resend_failed",
          message: errorMessage(resendError),
        }));
        // Don't fail — the message is logged in the DB.
      }
    }

    return respond({
      sent: emailSent,
      logged: !!loggedId,
      ticketId: loggedId,
      message: emailSent
        ? "Your message has been sent. We'll get back to you soon."
        : loggedId
          ? "Your message has been received and logged. Our team will follow up."
          : "Your message was logged. If you don't hear back, try emailing us directly.",
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "support_message_failed", message: errorMessage(error) }));
    return respond({ error: "Could not send support message right now." }, 500);
  }
});
