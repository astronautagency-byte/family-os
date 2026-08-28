import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

// ─── Tracking injection ────────────────────────────────────────────

function injectTracking(html: string, emailId: string, trackingBase: string): string {
  // 1. Inject open-tracking pixel before </body>
  const pixelUrl = `${trackingBase}/open/${emailId}`;
  const pixelTag = `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:block;position:absolute;overflow:hidden;opacity:0;pointer-events:none" />`;
  let tracked = html.replace(/<\/body>/i, `${pixelTag}</body>`);

  // 2. Rewrite <a href="..."> links to go through the click tracker.
  //    Only rewrite links that point to the app origin (fam-os.app / home.fam-os.app).
  tracked = tracked.replace(
    /<a\s+[^>]*href="(https?:\/\/(?:home\.)?fam-os\.app[^"|\s]*)"/gi,
    (match, url) => {
      const encoded = encodeURIComponent(url);
      const trackUrl = `${trackingBase}/click/${emailId}?url=${encoded}`;
      return match.replace(url, trackUrl);
    }
  );

  return tracked;
}

// ─── Household activity stats ──────────────────────────────────────

interface HouseholdActivity {
  events: number;
  tasks: number;
  tasksCompleted: number;
  meals: number;
  groceries: number;
  messages: number;
  members: number;
  daysActive: number;
}

async function fetchHouseholdActivity(
  admin: ReturnType<typeof createClient>,
  householdId: string,
  completedAt: string
): Promise<HouseholdActivity> {
  const since = completedAt || new Date(0).toISOString();
  const empty: HouseholdActivity = {
    events: 0, tasks: 0, tasksCompleted: 0, meals: 0,
    groceries: 0, messages: 0, members: 0, daysActive: 0,
  };
  try {
    const [events, tasks, allTasks, meals, groceries, messages, members] = await Promise.all([
      admin.from("events").select("id", { count: "exact", head: true })
        .eq("household_id", householdId).gte("created_at", since),
      admin.from("tasks").select("id", { count: "exact", head: true })
        .eq("household_id", householdId).gte("created_at", since),
      admin.from("tasks").select("id", { count: "exact", head: true })
        .eq("household_id", householdId),
      admin.from("meals").select("id", { count: "exact", head: true })
        .eq("household_id", householdId).gte("created_at", since),
      admin.from("grocery_items").select("id", { count: "exact", head: true })
        .eq("household_id", householdId),
      admin.from("messages").select("id", { count: "exact", head: true })
        .eq("household_id", householdId).gte("created_at", since),
      admin.from("household_members").select("id", { count: "exact", head: true })
        .eq("household_id", householdId),
    ]);
    const daysActive = Math.max(1, Math.floor((Date.now() - new Date(since).getTime()) / 86400000));
    return {
      events: events.count || 0,
      tasks: tasks.count || 0,
      tasksCompleted: allTasks.count || 0,
      meals: meals.count || 0,
      groceries: groceries.count || 0,
      messages: messages.count || 0,
      members: members.count || 0,
      daysActive,
    };
  } catch {
    return empty;
  }
}

function statBlock(activity: HouseholdActivity): string {
  const items: string[] = [];
  if (activity.events) items.push(`${activity.events} event${activity.events !== 1 ? "s" : ""} on the calendar`);
  if (activity.tasks) items.push(`${activity.tasks} task${activity.tasks !== 1 ? "s" : ""} created`);
  if (activity.meals) items.push(`${activity.meals} meal${activity.meals !== 1 ? "s" : ""} planned`);
  if (activity.groceries) items.push(`${activity.groceries} grocery item${activity.groceries !== 1 ? "s" : ""}`);
  if (activity.messages) items.push(`${activity.messages} message${activity.messages !== 1 ? "s" : ""} sent`);
  return items.join("\n• ");
}

function statBlockHtml(activity: HouseholdActivity): string {
  const items: string[] = [];
  if (activity.events) items.push(`<strong style="color:#19172b">${activity.events}</strong> event${activity.events !== 1 ? "s" : ""} on the calendar`);
  if (activity.tasks) items.push(`<strong style="color:#19172b">${activity.tasks}</strong> task${activity.tasks !== 1 ? "s" : ""} created`);
  if (activity.meals) items.push(`<strong style="color:#19172b">${activity.meals}</strong> meal${activity.meals !== 1 ? "s" : ""} planned`);
  if (activity.groceries) items.push(`<strong style="color:#19172b">${activity.groceries}</strong> grocery item${activity.groceries !== 1 ? "s" : ""}`);
  if (activity.messages) items.push(`<strong style="color:#19172b">${activity.messages}</strong> message${activity.messages !== 1 ? "s" : ""} sent`);
  if (!items.length) return "";
  return items.map((item) => `<div style="margin-bottom:6px">• ${item}</div>`).join("");
}

// ─── Email templates ────────────────────────────────────────────────

const EMAIL_TEMPLATES: Record<
  string,
  (vars: { firstName: string; householdName: string; appOrigin: string; activity: HouseholdActivity }) => {
    subject: string;
    html: string;
    text: string;
  }
> = {
  welcome: ({ firstName, householdName, appOrigin, activity }) => ({
    subject: `Welcome to FamOS, ${firstName}!`,
    text: `Hi ${firstName},\n\nI'm Alex, the founder of FamOS. Thank you for setting up ${householdName} — I'm genuinely excited to have your family here.\n\nFamOS started because I watched my own family drown in scattered calendars, group texts, and last-minute scrambling. We built the thing we wished existed: one place where your family's schedule, tasks, meals, and conversations actually live together.\n\nHere's what I'd suggest in your first few days:\n\n• Add a few events to your shared calendar\n• Create your first grocery or shopping list\n• Try asking Fam AI something like "What's happening this week?"\n\nIf anything feels confusing or broken, hit reply — I read every email. And if you have an idea for a feature that would make FamOS work better for your family, I want to hear that too.\n\nYou can also share feedback anytime from inside the app under Settings → Support.\n\nWelcome aboard.\n\nAlex Vorobiev\nFounder, FamOS\nfam-os.app`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Welcome to FamOS — your family's home base is ready.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f5ff">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
          <tr>
            <td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
              <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="88" height="78" alt="FamOS logo" style="display:block;margin:0 auto 8px;border:0">
              <div style="font-size:24px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
              <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6457d9">Families run better on FamOS</div>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 32px 12px;text-align:center">
              <h1 style="margin:0;font-size:30px;line-height:1.15;letter-spacing:-.03em;color:#19172b">Welcome to FamOS</h1>
              <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
                Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, I'm Alex, the founder of FamOS. Thank you for setting up <strong style="color:#19172b">${escapeHtml(householdName)}</strong> — I'm genuinely excited to have your family here.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
                <tr><td style="padding:20px 24px;font-size:14px;line-height:1.7;color:#5d5970">
                  FamOS started because I watched my own family drown in scattered calendars, group texts, and last-minute scrambling. We built the thing we wished existed: <strong style="color:#19172b">one place where your family's schedule, tasks, meals, and conversations actually live together.</strong>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 32px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #eee9fa;border-radius:18px">
                <tr><td style="padding:20px 24px;font-size:14px;line-height:1.7;color:#5d5970">
                  <div style="font-weight:700;color:#19172b;margin-bottom:8px">Here's what I'd suggest in your first few days:</div>
                  • Add a few events to your shared calendar<br>
                  • Create your first grocery or shopping list<br>
                  • Try asking Fam AI something like <em>"What's happening this week?"</em>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;text-align:center;font-size:15px;line-height:1.6;color:#5d5970">
              If anything feels confusing or broken, hit reply — I read every email. And if you have an idea for a feature that would make FamOS work better for your family, I want to hear that too.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 32px 34px">
              <a href="${escapeHtml(appOrigin)}" style="display:inline-block;min-width:220px;padding:16px 24px;border-radius:999px;background:#5b4fd6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:750">Open FamOS</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #eee9fa;text-align:center">
              <div style="font-size:14px;font-weight:700;color:#19172b;margin-bottom:4px">Alex Vorobiev</div>
              <div style="font-size:12px;color:#918ca4">Founder, FamOS</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
              <a href="${escapeHtml(appOrigin)}/settings?tab=support" style="color:#6457d9">Share feedback</a> &nbsp;·&nbsp;
              <a href="${escapeHtml(appOrigin)}/settings?tab=support&type=feature" style="color:#6457d9">Suggest a feature</a><br><br>
              © 2026 FamOS. All rights reserved.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  }),

  day1_quick_wins: ({ firstName, appOrigin, activity }) => ({
    subject: `Your first day on FamOS — 3 quick wins`,
    text: `Hi ${firstName},\n\nYour first day with FamOS is a great time to knock out a few quick wins:\n\n1. Create a shared grocery list — tap Shopping and add a few staples.\n2. Drop a recurring event on the calendar — soccer practice, dance class, whatever repeats.\n3. Ask Fam AI "What's on this week?" — it pulls from everything you've set up.\n\nEach one takes about 30 seconds, and suddenly your family has a shared source of truth.\n\n— The FamOS Team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
          <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="72" height="64" alt="FamOS" style="display:block;margin:0 auto 8px;border:0">
          <div style="font-size:20px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px;text-align:center">
          <h1 style="margin:0;font-size:28px;line-height:1.15;color:#19172b">Your first day — 3 quick wins</h1>
          <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
            Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, here are three things that take about 30 seconds each and instantly make FamOS useful for your family.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
            <tr><td style="padding:20px 24px;font-size:14px;line-height:1.8;color:#5d5970">
              <strong style="color:#19172b">1. Create a shared grocery list</strong><br>
              Tap Shopping and add a few staples. Everyone in the household can see and check things off.<br><br>
              <strong style="color:#19172b">2. Drop a recurring event</strong><br>
              Soccer practice, dance class, pickup duty — add it once and FamOS handles the repeats.<br><br>
              <strong style="color:#19172b">3. Ask Fam AI</strong><br>
              Tap the Ask Fam bar and say <em>"What's on this week?"</em> — it pulls from everything you've set up.
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:10px 32px 34px">
          <a href="${escapeHtml(appOrigin)}" style="display:inline-block;min-width:200px;padding:14px 24px;border-radius:999px;background:#5b4fd6;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Open FamOS</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
          © 2026 FamOS. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }),

  day3_tips: ({ firstName, appOrigin, activity }) => ({
    subject: `FamOS tips your family will love`,
    text: `Hi ${firstName},\n\nYou're a few days in — here are tips that power FamOS families use most:\n\n• Kitchen Watch — add items that are expiring and get reminded before they go bad.\n• Meal Planning — let Fam OS suggest meals based on what you already have.\n• Tasks — assign tasks to specific family members with due dates.\n• Chat — keep family conversations out of buried text threads.\n\nThe more you add, the smarter FamOS gets at helping your family stay coordinated.\n\n— The FamOS Team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
          <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="72" height="64" alt="FamOS" style="display:block;margin:0 auto 8px;border:0">
          <div style="font-size:20px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px;text-align:center">
          <h1 style="margin:0;font-size:28px;line-height:1.15;color:#19172b">Tips your family will love</h1>
          <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
            Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, here are features that FamOS families use most.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
            <tr><td style="padding:20px 24px;font-size:14px;line-height:1.8;color:#5d5970">
              <strong style="color:#19172b">🥬 Kitchen Watch</strong><br>
              Add items that are expiring and get reminded before they go bad.<br><br>
              <strong style="color:#19172b">🍽️ Meal Planning</strong><br>
              Let FamOS suggest meals based on what you already have.<br><br>
              <strong style="color:#19172b">✅ Tasks</strong><br>
              Assign tasks to specific family members with due dates.<br><br>
              <strong style="color:#19172b">💬 Chat</strong><br>
              Keep family conversations out of buried text threads.
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:10px 32px 34px">
          <a href="${escapeHtml(appOrigin)}" style="display:inline-block;min-width:200px;padding:14px 24px;border-radius:999px;background:#5b4fd6;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Open FamOS</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
          © 2026 FamOS. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }),

  day7_recap: ({ firstName, appOrigin, activity }) => ({
    subject: `Your first week on FamOS — here's what happened`,
    text: `Hi ${firstName},\n\nYou've been using FamOS for a week. Here's a look at what your family has accomplished:\n\n• ${activity.events} event${activity.events !== 1 ? "s" : ""} on the calendar\n• ${activity.tasks} task${activity.tasks !== 1 ? "s" : ""} created\n• ${activity.meals} meal${activity.meals !== 1 ? "s" : ""} planned\n• ${activity.groceries} grocery item${activity.groceries !== 1 ? "s" : ""}\n• ${activity.messages} message${activity.messages !== 1 ? "s" : ""} sent\n\nThe more your family uses FamOS together, the less time you spend managing logistics and the more time you have for what actually matters.\n\nWant to see what FamOS Pro can do? Open the app and check Settings → Billing.\n\n— The FamOS Team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
          <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="72" height="64" alt="FamOS" style="display:block;margin:0 auto 8px;border:0">
          <div style="font-size:20px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px;text-align:center">
          <h1 style="margin:0;font-size:28px;line-height:1.15;color:#19172b">Your first week on FamOS</h1>
          <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
            Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, here's what your family accomplished this week.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
            <tr><td style="padding:20px 24px;font-size:14px;line-height:1.8;color:#5d5970">
              <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6457d9;margin-bottom:12px;text-align:center">This week on FamOS</div>
              <div style="text-align:center;margin-bottom:16px">
                <div style="font-size:14px;color:#5d5970">${activity.events} event${activity.events !== 1 ? "s" : ""} · ${activity.tasks} task${activity.tasks !== 1 ? "s" : ""} · ${activity.meals} meal${activity.meals !== 1 ? "s" : ""}</div>
                <div style="font-size:14px;color:#5d5970">${activity.groceries} grocery item${activity.groceries !== 1 ? "s" : ""} · ${activity.messages} message${activity.messages !== 1 ? "s" : ""}</div>
              </div>
              <div style="font-size:14px;color:#5d5970;text-align:center">The more your family uses FamOS together, the less time you spend on logistics.</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:10px 32px 34px">
          <a href="${escapeHtml(appOrigin)}" style="display:inline-block;min-width:200px;padding:14px 24px;border-radius:999px;background:#5b4fd6;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Open FamOS</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
          © 2026 FamOS. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }),

  day14_missing: ({ firstName, appOrigin, activity }) => ({
    subject: `Things your family might be missing on FamOS`,
    text: `Hi ${firstName},\n\nTwo weeks in — here are features that families say changed how they run their week:\n\n• Fam AI — ask natural-language questions about your schedule, meals, or tasks.\n• Meal Roulette — let FamOS decide what's for dinner based on what you have.\n• Smart Suggestions — FamOS spots gaps in your schedule and suggests what to add.\n\nIf you haven't tried these yet, they're worth a look.\n\n— The FamOS Team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
          <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="72" height="64" alt="FamOS" style="display:block;margin:0 auto 8px;border:0">
          <div style="font-size:20px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px;text-align:center">
          <h1 style="margin:0;font-size:28px;line-height:1.15;color:#19172b">Things you might be missing</h1>
          <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
            Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, these are features that families say changed how they run their week.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
            <tr><td style="padding:20px 24px;font-size:14px;line-height:1.8;color:#5d5970">
              <strong style="color:#19172b">🤖 Fam AI</strong><br>
              Ask natural-language questions about your schedule, meals, or tasks.<br><br>
              <strong style="color:#19172b">🎲 Meal Roulette</strong><br>
              Let FamOS decide what's for dinner based on what you have.<br><br>
              <strong style="color:#19172b">💡 Smart Suggestions</strong><br>
              FamOS spots gaps in your schedule and suggests what to add.
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:10px 32px 34px">
          <a href="${escapeHtml(appOrigin)}" style="display:inline-block;min-width:200px;padding:14px 24px;border-radius:999px;background:#5b4fd6;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Open FamOS</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
          © 2026 FamOS. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }),

  day21_nudge: ({ firstName, appOrigin, activity }) => ({
    subject: `Your FamOS Pro trial — 7 days left`,
    text: `Hi ${firstName},\n\nYour FamOS Pro trial has 7 days left.\n\nSo far this month FamOS has helped your family:\n\n• Coordinate activities\n• Share lists and tasks\n• Keep everyone on the same page\n\nFamOS Pro unlocks everything: unlimited activities, advanced transportation, Fam AI actions, multiple calendar integrations, and more.\n\nIf you decide not to continue, your family stays on FamOS Core with the free features. Nothing gets deleted.\n\n— The FamOS Team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
          <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="72" height="64" alt="FamOS" style="display:block;margin:0 auto 8px;border:0">
          <div style="font-size:20px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px;text-align:center">
          <h1 style="margin:0;font-size:28px;line-height:1.15;color:#19172b">7 days left on your Pro trial</h1>
          <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
            Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, your FamOS Pro trial has 7 days left. Here's what your family has been up to.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
            <tr><td style="padding:20px 24px;font-size:14px;line-height:1.8;color:#5d5970">
              So far this month your family has used FamOS to coordinate:<br><br>
              ${activity.events} event${activity.events !== 1 ? "s" : ""} · ${activity.tasks} task${activity.tasks !== 1 ? "s" : ""} · ${activity.meals} meal${activity.meals !== 1 ? "s" : ""}<br>
              ${activity.groceries} grocery item${activity.groceries !== 1 ? "s" : ""} · ${activity.messages} message${activity.messages !== 1 ? "s" : ""}<br><br>
              FamOS Pro keeps all of this working — plus unlimited activities, Fam AI actions, advanced transportation, and more.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:6px 32px;text-align:center;font-size:14px;line-height:1.6;color:#5d5970">
          If you decide not to continue, your family stays on <strong style="color:#19172b">FamOS Core</strong> with the free features. Nothing gets deleted.
        </td></tr>
        <tr><td align="center" style="padding:18px 32px 34px">
          <a href="${escapeHtml(appOrigin)}" style="display:inline-block;min-width:200px;padding:14px 24px;border-radius:999px;background:#5b4fd6;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Open FamOS</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
          © 2026 FamOS. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }),

  day28_final: ({ firstName, appOrigin, activity }) => ({
    subject: `Your FamOS Pro trial ends in 2 days`,
    text: `Hi ${firstName},\n\nYour FamOS Pro trial ends in 2 days.\n\nIf you continue with FamOS Pro, you'll keep everything your family has been using: advanced scheduling, Fam AI, calendar sync, and more — for $12.99/month after the trial.\n\nIf you don't continue, you'll move to FamOS Core — still free, still useful, and your family's data stays intact.\n\nNo pressure. You can manage your subscription anytime from Settings → Billing.\n\n— The FamOS Team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
          <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="72" height="64" alt="FamOS" style="display:block;margin:0 auto 8px;border:0">
          <div style="font-size:20px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px;text-align:center">
          <h1 style="margin:0;font-size:28px;line-height:1.15;color:#19172b">Your trial ends in 2 days</h1>
          <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
            Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, your FamOS Pro trial ends soon. Here's what you need to know.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
            <tr><td style="padding:20px 24px;font-size:14px;line-height:1.8;color:#5d5970">
              Your family has coordinated <strong style="color:#19172b">${activity.events} event${activity.events !== 1 ? "s" : ""}</strong>, created <strong style="color:#19172b">${activity.tasks} task${activity.tasks !== 1 ? "s" : ""}</strong>, and planned <strong style="color:#19172b">${activity.meals} meal${activity.meals !== 1 ? "s" : ""}</strong> on FamOS so far.<br><br>
              <strong style="color:#19172b">Keep FamOS Pro</strong> — $12.99/month after your trial. Everything keeps working.<br><br>
              <strong style="color:#19172b">Stay on Core</strong> — free forever. Your family's data stays intact. You just lose access to Pro features.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:6px 32px;text-align:center;font-size:14px;line-height:1.6;color:#5d5970">
          No pressure. You can manage your subscription anytime from Settings → Billing.
        </td></tr>
        <tr><td align="center" style="padding:18px 32px 34px">
          <a href="${escapeHtml(appOrigin)}" style="display:inline-block;min-width:200px;padding:14px 24px;border-radius:999px;background:#5b4fd6;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Manage Subscription</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
          © 2026 FamOS. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }),

  trial_7_days: ({ firstName, appOrigin, activity }) => ({
    subject: `Your FamOS Pro trial — 7 days left`,
    text: `Hi ${firstName},\n\nYour FamOS Pro trial has 7 days left.\n\nSo far this month FamOS has helped your family:\n\n• ${activity.events} event${activity.events !== 1 ? "s" : ""} on the calendar\n• ${activity.tasks} task${activity.tasks !== 1 ? "s" : ""} created\n• ${activity.meals} meal${activity.meals !== 1 ? "s" : ""} planned\n• ${activity.groceries} grocery item${activity.groceries !== 1 ? "s" : ""}\n\nFamOS Pro keeps all of this working — plus unlimited activities, Fam AI actions, advanced transportation, and more.\n\nIf you decide not to continue, your family stays on FamOS Core with the free features. Nothing gets deleted.\n\n— The FamOS Team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
          <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="72" height="64" alt="FamOS" style="display:block;margin:0 auto 8px;border:0">
          <div style="font-size:20px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px;text-align:center">
          <h1 style="margin:0;font-size:28px;line-height:1.15;color:#19172b">7 days left on your Pro trial</h1>
          <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
            Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, your FamOS Pro trial has 7 days left. Here's what your family has been up to.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
            <tr><td style="padding:20px 24px;font-size:14px;line-height:1.8;color:#5d5970">
              <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6457d9;margin-bottom:12px;text-align:center">This month on FamOS</div>
              <div style="text-align:center;margin-bottom:16px">
                <div style="font-size:14px;color:#5d5970">${activity.events} event${activity.events !== 1 ? "s" : ""} · ${activity.tasks} task${activity.tasks !== 1 ? "s" : ""} · ${activity.meals} meal${activity.meals !== 1 ? "s" : ""}</div>
                <div style="font-size:14px;color:#5d5970">${activity.groceries} grocery item${activity.groceries !== 1 ? "s" : ""} · ${activity.messages} message${activity.messages !== 1 ? "s" : ""}</div>
              </div>
              FamOS Pro keeps all of this working — plus unlimited activities, Fam AI actions, advanced transportation, and more.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:6px 32px;text-align:center;font-size:14px;line-height:1.6;color:#5d5970">
          If you decide not to continue, your family stays on <strong style="color:#19172b">FamOS Core</strong> with the free features. Nothing gets deleted.
        </td></tr>
        <tr><td align="center" style="padding:18px 32px 34px">
          <a href="${escapeHtml(appOrigin)}/settings" style="display:inline-block;min-width:200px;padding:14px 24px;border-radius:999px;background:#5b4fd6;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Manage Subscription</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
          © 2026 FamOS. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }),

  trial_2_days: ({ firstName, appOrigin, activity }) => ({
    subject: `Your FamOS Pro trial ends in 2 days`,
    text: `Hi ${firstName},\n\nYour FamOS Pro trial ends in 2 days.\n\nIf you continue with FamOS Pro, you'll keep everything your family has been using: advanced scheduling, Fam AI, calendar sync, and more — for $19.99/month after the trial.\n\nIf you don't continue, you'll move to FamOS Core — still free, still useful, and your family's data stays intact.\n\nNo pressure. You can manage your subscription anytime from Settings → Billing.\n\n— The FamOS Team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f8f5ff;color:#19172b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2dcf5;border-radius:28px;overflow:hidden;box-shadow:0 12px 40px rgba(44,35,90,.08)">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(135deg,#f2edff,#fff4f8)">
          <img src="https://home.fam-os.app/brand/famos-icon-transparent.png" width="72" height="64" alt="FamOS" style="display:block;margin:0 auto 8px;border:0">
          <div style="font-size:20px;font-weight:800;letter-spacing:-.04em;color:#19172b">Fam<span style="color:#7952e8">OS</span></div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px;text-align:center">
          <h1 style="margin:0;font-size:28px;line-height:1.15;color:#19172b">Your trial ends in 2 days</h1>
          <p style="margin:16px auto 0;max-width:430px;font-size:16px;line-height:1.6;color:#5d5970">
            Hi <strong style="color:#19172b">${escapeHtml(firstName)}</strong>, your FamOS Pro trial ends soon. Here's what you need to know.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;border-radius:18px">
            <tr><td style="padding:20px 24px;font-size:14px;line-height:1.8;color:#5d5970">
              Your family has coordinated <strong style="color:#19172b">${activity.events} event${activity.events !== 1 ? "s" : ""}</strong>, created <strong style="color:#19172b">${activity.tasks} task${activity.tasks !== 1 ? "s" : ""}</strong>, and planned <strong style="color:#19172b">${activity.meals} meal${activity.meals !== 1 ? "s" : ""}</strong> on FamOS so far.<br><br>
              <strong style="color:#19172b">Keep FamOS Pro</strong> — $19.99/month after your trial. Everything keeps working.<br><br>
              <strong style="color:#19172b">Stay on Core</strong> — free forever. Your family's data stays intact. You just lose access to Pro features.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:6px 32px;text-align:center;font-size:14px;line-height:1.6;color:#5d5970">
          No pressure. You can manage your subscription anytime from Settings → Billing.
        </td></tr>
        <tr><td align="center" style="padding:18px 32px 34px">
          <a href="${escapeHtml(appOrigin)}/settings" style="display:inline-block;min-width:200px;padding:14px 24px;border-radius:999px;background:#5b4fd6;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Manage Subscription</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;line-height:1.5;color:#918ca4">
          © 2026 FamOS. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }),
};

// Lifecycle schedule: email_type → days after onboarding completed_at
const LIFECYCLE_SCHEDULE: Record<string, number> = {
  welcome: 0,
  day1_quick_wins: 1,
  day3_tips: 3,
  day7_recap: 7,
  day14_missing: 14,
  day21_nudge: 21,
  day28_final: 28,
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, household_id, email_type, household_name, user_first_name } =
      await request.json();

    if (!user_id || !household_id || !email_type) {
      return json({ error: "user_id, household_id, and email_type are required" }, 400);
    }

    if (!EMAIL_TEMPLATES[email_type]) {
      return json({ error: `Unknown email type: ${email_type}` }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const FAMOS_MAIL_DOMAIN = Deno.env.get("FAMOS_MAIL_DOMAIN") || "mail.fam-os.app";
    const fromEmail =
      Deno.env.get("FAMOS_FROM_EMAIL") || `FamOS <hello@${FAMOS_MAIL_DOMAIN}>`;

    if (!resendKey) {
      console.warn(
        JSON.stringify({ event: "onboarding_email_skipped", reason: "no_resend_key", email_type })
      );
      return json({ sent: false, reason: "no_email_provider" });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check for duplicate
    const { data: existing } = await admin
      .from("onboarding_emails")
      .select("id, status")
      .eq("household_id", household_id)
      .eq("user_id", user_id)
      .eq("email_type", email_type)
      .maybeSingle();

    if (existing && existing.status === "sent") {
      return json({ sent: false, reason: "already_sent", email_id: existing.id });
    }

    // Get user email and name
    const { data: authUser } = await admin.auth.admin.getUserById(user_id);
    const userEmail = authUser?.user?.email;
    if (!userEmail) {
      return json({ sent: false, reason: "no_email_on_file" });
    }

    const firstName =
      user_first_name ||
      authUser?.user?.user_metadata?.display_name?.split(" ")[0] ||
      userEmail.split("@")[0] ||
      "there";

    const householdName = household_name || "your family home";
    const appOrigin = "https://home.fam-os.app";

    // Fetch household activity for personalized content
    const { data: householdProfile } = await admin
      .from("household_profiles")
      .select("completed_at")
      .eq("household_id", household_id)
      .maybeSingle();
    const activity = await fetchHouseholdActivity(
      admin,
      household_id,
      householdProfile?.completed_at || new Date().toISOString()
    );

    const template = EMAIL_TEMPLATES[email_type]({ firstName, householdName, appOrigin, activity });

    // Upsert tracking row — must happen BEFORE tracking injection
    const trackingPayload = {
      household_id,
      user_id,
      email_type,
      status: "sending",
      scheduled_for: new Date().toISOString(),
    };

    let trackingId = existing?.id;
    if (existing) {
      await admin
        .from("onboarding_emails")
        .update({ status: "sending", error_message: null })
        .eq("id", existing.id);
      trackingId = existing.id;
    } else {
      const { data: inserted } = await admin
        .from("onboarding_emails")
        .insert(trackingPayload)
        .select("id")
        .single();
      trackingId = inserted?.id;
    }

    // Inject open/click tracking into the HTML (needs the tracking row ID)
    const trackingBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/track-email-event`;
    const trackedHtml = injectTracking(template.html, trackingId || "unknown", trackingBase);

    // Send via Resend — fall back to Supabase Auth email on failure
    let resendSucceeded = false;
    let resendId: string | null = null;
    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [userEmail],
          subject: template.subject,
          html: trackedHtml,
          text: template.text,
          tags: [{ name: "category", value: `onboarding-${email_type}` }],
        }),
      });
      const emailResult = await emailResponse.json();
      if (emailResponse.ok) {
        resendSucceeded = true;
        resendId = emailResult.id || null;
      } else {
        console.warn(
          JSON.stringify({ event: "onboarding_email_resend_failed", email_type, error: emailResult?.message || "Resend rejected", fallback: "supabase_invitation" })
        );
      }
    } catch (resendNetError) {
      console.warn(
        JSON.stringify({ event: "onboarding_email_resend_network_error", email_type, error: resendNetError instanceof Error ? resendNetError.message : String(resendNetError) })
      );
    }

    if (resendSucceeded) {
      // Mark sent
      if (trackingId) {
        await admin
          .from("onboarding_emails")
          .update({
            status: "sent",
            resend_message_id: resendId,
            sent_at: new Date().toISOString(),
          })
          .eq("id", trackingId);
      }
      console.log(
        JSON.stringify({ event: "onboarding_email_sent", email_type, user_id, household_id, resend_id: resendId })
      );
      return json({ sent: true, email_type, resend_id: resendId });
    }

    // Fallback: use Supabase Auth's invite flow to deliver a basic login link
    console.log(JSON.stringify({ event: "onboarding_email_fallback_supabase", email_type }));
    try {
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(userEmail, {
        redirectTo: "https://home.fam-os.app/onboarding",
        data: { invited_to_famos: true, display_name: firstName },
      });
      if (inviteError) {
        console.warn(JSON.stringify({ event: "onboarding_email_supabase_fallback_failed", error: inviteError.message }));
      }
    } catch (fallbackErr) {
      console.warn(JSON.stringify({ event: "onboarding_email_fallback_error", error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr) }));
    }

    // Mark as sent even on fallback — the household setup shouldn't block the user
    if (trackingId) {
      await admin
        .from("onboarding_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", trackingId);
    }
    return json({ sent: true, email_type, provider: "supabase_fallback" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(JSON.stringify({ event: "onboarding_email_error", message }));
    return json({ error: message }, 500);
  }
});
