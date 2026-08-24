import { supabase } from "./supabase";

/**
 * Trial expiry lifecycle email schedule.
 * Maps email types to days BEFORE trial ends when the email should be sent.
 */
const TRIAL_EXPIRY_SCHEDULE = {
  trial_7_days: 7,
  trial_2_days: 2,
};

/**
 * Check which trial expiry emails are due and send them.
 * Safe to call on every app mount — it no-ops if no emails are due.
 *
 * @param {string} householdId
 * @param {string} userId
 * @param {string} trialEndsAt - ISO timestamp of trial end
 * @param {string} householdName
 * @param {string} userFirstName
 */
export async function checkAndSendTrialExpiryEmails({
  householdId,
  userId,
  trialEndsAt,
  householdName,
  userFirstName,
}) {
  if (!householdId || !userId || !trialEndsAt || !supabase) return;

  const trialEnd = new Date(trialEndsAt);
  const now = new Date();
  const daysUntilTrialEnds = Math.ceil(
    (trialEnd.getTime() - now.getTime()) / 86400000
  );

  // Only send emails when trial is ending soon (within 7 days) and hasn't ended yet
  if (daysUntilTrialEnds > 7 || daysUntilTrialEnds < 0) return;

  // Determine which emails are due (trial ending in X days or fewer)
  const dueTypes = Object.entries(TRIAL_EXPIRY_SCHEDULE)
    .filter(([, days]) => daysUntilTrialEnds <= days)
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

  const sentTypes = new Set((sentEmails || []).map((e) => e.email_type));

  // Find the most critical unsent email (2 days before 7 days)
  const unsentDue = dueTypes
    .filter((type) => !sentTypes.has(type))
    .sort((a, b) => TRIAL_EXPIRY_SCHEDULE[b] - TRIAL_EXPIRY_SCHEDULE[a]);

  if (!unsentDue.length) return;

  // Send the most critical unsent email
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
    // Trial expiry email failures should never block the app
    console.warn("Trial expiry email failed:", error);
  }
}
