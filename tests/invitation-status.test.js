import { test } from "node:test";
import assert from "node:assert/strict";

// Mirrors the helpers in supabase/functions/send-family-invitation/index.ts.
// If you change the regex or semantics, change BOTH files.
function isSandboxRecipientError(message = "") {
  if (!message) return false;
  return /Email address is not verified|MailFromDomainNotVerified|MailFromDomainNotVerifiedException/i.test(message);
}

function parseRateLimitSeconds(message = "") {
  if (!message) return null;
  const match = /after\s+(\d+)\s+second/i.exec(message);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 600 ? seconds : null;
}

test("isSandboxRecipientError matches AWS SES sandbox rejection copy", () => {
  const samples = [
    "Amazon SES: Email address is not verified. The following identities failed the check in region CA-CENTRAL-1: kat.vorobiev@gmail.com.",
    "MessageRejected: Email address is not verified for recipient lily@example.com",
    "SES MailFromDomainNotVerifiedException: sender-domain not verified",
    "failure: MailFromDomainNotVerified — ask the operator to verify the domain in SES",
  ];
  for (const message of samples) {
    assert.equal(isSandboxRecipientError(message), true, `expected match for: ${message}`);
  }
});

test("isSandboxRecipientError ignores non-sandbox SES failures", () => {
  const samples = [
    "Amazon SES: Daily sending quota exceeded.",
    "Amazon SES: Account throttled. Try again later.",
    "503 Slow Down — service temporarily unavailable",
    "AWS SNS publish failed with message-rejected",
    "Supabase email fallback: For security purposes, you can only request this after 59 seconds.",
  ];
  for (const message of samples) {
    assert.equal(isSandboxRecipientError(message), false, `expected no match for: ${message}`);
  }
});

test("isSandboxRecipientError returns false for null / empties", () => {
  assert.equal(isSandboxRecipientError(""), false);
  assert.equal(isSandboxRecipientError(null), false);
  assert.equal(isSandboxRecipientError(undefined), false);
});

test("parseRateLimitSeconds extracts the seconds Supabase prints in its cooldown copy", () => {
  assert.equal(parseRateLimitSeconds("For security purposes, you can only request this after 59 seconds."), 59);
  assert.equal(parseRateLimitSeconds("you can only request this after 7 seconds."), 7);
  assert.equal(parseRateLimitSeconds("You can only request a new password reset after 60 seconds."), 60);
  assert.equal(parseRateLimitSeconds("rate-limited: please try after 1 second."), 1);
});

test("parseRateLimitSeconds returns null for non-rate-limit messages", () => {
  assert.equal(parseRateLimitSeconds("Email address is not verified."), null);
  assert.equal(parseRateLimitSeconds(""), null);
  assert.equal(parseRateLimitSeconds(null), null);
  assert.equal(parseRateLimitSeconds("Invalid login credentials"), null);
});

test("parseRateLimitSeconds rejects out-of-range tails (security guard)", () => {
  assert.equal(parseRateLimitSeconds("please try again after 9999 seconds."), null);
  assert.equal(parseRateLimitSeconds("after -5 seconds please"), null);
});

test("sandbox regex + rate-limit parser are mutually exclusive classifiers", () => {
  const sesSandbox = "Amazon SES: Email address is not verified. The following identities failed the check in region CA-CENTRAL-1: kat.vorobiev@gmail.com.";
  assert.equal(isSandboxRecipientError(sesSandbox), true);
  assert.equal(parseRateLimitSeconds(sesSandbox), null);

  const supabaseCooldown = "Supabase email fallback: For security purposes, you can only request this after 59 seconds.";
  assert.equal(isSandboxRecipientError(supabaseCooldown), false);
  assert.equal(parseRateLimitSeconds(supabaseCooldown), 59);
});
