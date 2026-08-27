import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-origin, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Parse SendGrid inbound webhook form data
    const contentType = req.headers.get("content-type") || "";
    let from = "", subject = "", text = "", html = "", envelope = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      from = formData.get("from") as string || "";
      subject = formData.get("subject") as string || "";
      text = formData.get("text") as string || "";
      html = formData.get("html") as string || "";
      envelope = formData.get("envelope") as string || "";
    } else {
      const body = await req.text();
      const params = new URLSearchParams(body);
      from = params.get("from") || "";
      subject = params.get("subject") || "";
      text = params.get("text") || "";
      html = params.get("html") || "";
      envelope = params.get("envelope") || "";
    }

    // Extract email token from the "to" address
    // Format: add-{token}@fam-os.app or family-{token}@fam-os.app
    let toAddress = "";
    try {
      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        toAddress = (formData.get("to") as string) || "";
      } else {
        const params = new URLSearchParams(await req.text());
        toAddress = params.get("to") || "";
      }
    } catch { /* already parsed */ }

    // Also check envelope for the actual recipient
    if (!toAddress && envelope) {
      try {
        const envData = JSON.parse(envelope);
        if (envData.recipients?.length) {
          toAddress = envData.recipients[0];
        }
      } catch { /* ignore */ }
    }

    // Extract token from address (format: add-{token}@... or family-{token}@...)
    const tokenMatch = toAddress.match(/(?:add|family)-([a-f0-9]+)/i);
    if (!tokenMatch) {
      return new Response(JSON.stringify({ error: "Invalid forwarding address" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const token = tokenMatch[1];

    // Resolve token to household
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: household, error: hErr } = await supabase
      .rpc("resolve_email_token", { token })
      .single();

    if (hErr || !household) {
      return new Response(JSON.stringify({ error: "Unknown forwarding address" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const householdId = household as string;

    // Strip HTML to plain text for AI parsing
    const plainText = text || html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Get household members for context
    const { data: members } = await supabase
      .from("household_members")
      .select("name, email")
      .eq("household_id", householdId);

    const memberNames = (members || []).map((m: any) => m.name).join(", ");

    // Use xAI to parse the email into structured items
    const xaiKey = Deno.env.get("XAI_API_KEY") || Deno.env.get("GROK_API_KEY");
    let parsedItems: any[] = [];

    if (xaiKey && plainText.length > 10) {
      const systemPrompt = `You are an email parser for a family management app called FamOS.
Given an email, extract actionable items. Return ONLY a JSON array (no markdown, no extra text) of objects.
Each object has:
- "type": one of "event", "task", "shopping", "note"
- "title": short description
- "details": any extra context (date, time, location, quantity, etc.)

Rules:
- Calendar invites, appointments, event announcements → type "event" (include date/time/location if present)
- Shopping lists, product links, deals, "need to buy" items → type "shopping"
- To-dos, deadlines, reminders, action items → type "task"
- General info, newsletters, announcements → type "note"
- If nothing actionable, return an empty array []
- Keep titles concise (under 60 chars)
- Use ISO 8601 for dates (YYYY-MM-DD) and times (HH:MM) if known
- Include relevant details but be concise`;

    const userMessage = `From: ${from}\nSubject: ${subject}\n\nMembers: ${memberNames}\n\n${plainText.slice(0, 3000)}`;

      try {
        const aiRes = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${xaiKey}`,
          },
          body: JSON.stringify({
            model: "grok-3-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.1,
            max_tokens: 1000,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "[]";
          // Extract JSON from possible markdown code block
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            parsedItems = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiErr) {
        console.error("xAI parsing error:", aiErr);
      }
    }

    // Save to email_inbox
    const { error: insertErr } = await supabase.from("email_inbox").insert({
      household_id: householdId,
      from_email: from,
      subject: subject || "(no subject)",
      body_text: plainText.slice(0, 5000),
      body_html: html?.slice(0, 10000) || null,
      parsed_items: parsedItems,
      status: "pending",
    });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save email" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Send push notification to household members
    try {
      const { data: householdMembers } = await supabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", householdId);

      if (householdMembers?.length) {
        const userIds = householdMembers.map((m: any) => m.user_id);
        const { data: tokens } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth_token")
          .in("user_id", userIds);

        if (tokens?.length) {
          const itemCount = parsedItems.length;
          const title = subject || "New email received";
          const body = itemCount > 0
            ? `FamOS found ${itemCount} item${itemCount === 1 ? "" : "s"} to review`
            : "Open to view";

          // Send push to each token (best effort)
          for (const sub of tokens) {
            try {
              const pushPayload = {
                title,
                body,
                icon: "/brand/famos-icon.png",
                badge: "/brand/famos-icon.png",
                data: { url: "/today", type: "email_inbox" },
              };
              // Store notification for in-app display
              await supabase.from("notifications").insert({
                user_id: sub.auth_token ? userIds.find((_: string, i: number) => tokens[i] === sub) : userIds[0],
                household_id: householdId,
                title,
                body,
                type: "email_inbox",
                url: "/today",
              });
            } catch (_) { /* skip failed push */ }
          }
        }
      }
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    return new Response(JSON.stringify({ ok: true, parsed: parsedItems.length }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Parse error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
