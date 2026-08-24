import { supabase } from "./supabase";

/**
 * Onboarding lifecycle email schedule.
 * Each entry maps an email_type to the number of days after onboarding completion
 * when it should be sent.
 */
const LIFECYCLE_SCHEDULE = {
  welcome: 0,
  day1_quick_wins: 1,
  day3_tips: 3,
  day7_recap: 7,
  day14_missing: 14,
  day21_nudge: 21,
  day28_final: 28,
};

/**
 * Check which lifecycle emails are due and send them.
 * Safe to call on every app mount — it no-ops if no emails are due.
 *
 * @param {string} householdId
 * @param {string} userId
 * @param {string} completedAt - ISO timestamp of onboarding completion
 * @param {string} householdName
 * @param {string} userFirstName
 */
export async function checkAndSendLifecycleEmails({
  householdId,
  userId,
  completedAt,
  householdName,
  userFirstName,
}) {
  if (!householdId || !userId || !completedAt || !supabase) return;

  const completedDate = new Date(completedAt);
  const now = new Date();
  const daysSinceCompletion = Math.floor(
    (now.getTime() - completedDate.getTime()) / 86400000
  );

  // Determine which emails are due
  const dueTypes = Object.entries(LIFECYCLE_SCHEDULE)
    .filter(([, days]) => daysSinceCompletion >= days)
    .map(([type]) => type);

  if (!dueTypes.length) return;

  // Check which have already been sent
  const { data: sentEmails } = await supabase
    .from("onboarding_emails")
    .select("email_type, status")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .in("email_type", dueTypes)
    .in("status", ["sent", "sending"]);

  const sentTypes = new Set(
    (sentEmails || []).map((e) => e.email_type)
  );

  // Find the most recent email type that hasn't been sent
  // Only send ONE email per mount to avoid flooding
  const unsentDue = dueTypes
    .filter((type) => !sentTypes.has(type))
    .sort((a, b) => LIFECYCLE_SCHEDULE[b] - LIFECYCLE_SCHEDULE[a]);

  if (!unsentDue.length) return;

  // Send the most recently due unsent email
  const emailType = unsentDue[0];

  try {
    await supabase.functions.invoke("send-onboarding-email", {
      body: {
        user_id: userId,
        household_id: householdId,
        email_type: emailType,
        household_name: householdName,
        user_first_name: userFirstName,
      },
    });
  } catch (error) {
    // Lifecycle email failures should never block the app
    console.warn("Lifecycle email failed:", error);
  }
}

/**
 * Send the welcome email immediately after onboarding completes.
 */
export async function sendWelcomeEmail({
  householdId,
  userId,
  householdName,
  userFirstName,
}) {
  if (!householdId || !userId || !supabase) return;

  try {
    await supabase.functions.invoke("send-onboarding-email", {
      body: {
        user_id: userId,
        household_id: householdId,
        email_type: "welcome",
        household_name: householdName,
        user_first_name: userFirstName,
      },
    });
  } catch (error) {
    console.warn("Welcome email failed:", error);
  }
}
