// Tests for src/utils/passwordStrength — the shared validator used by every
// password-creation flow in the app. These guard against accidental
// regressions in the policy: a weakened length floor or a dropped
// breached-password deny-list would silently degrade security across all
// auth screens at once.
//
// Run: npm test (uses Node's built-in test runner under the hood).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_PASSWORD_LENGTH,
  passwordError,
  passwordHint,
  passwordScore,
  passwordScoreLabel,
} from "../src/utils/passwordStrength.js";

test("passwordError: empty input is rejected with the empty-state message", () => {
  assert.equal(passwordError(""), "Enter a password.");
  assert.equal(passwordError(null), "Enter a password.");
  assert.equal(passwordError(undefined), "Enter a password.");
});

test("passwordError: below the minimum length is rejected with the length message", () => {
  // Pick 9-char candidates that are not in the breach list — anything starting
  // with "123456" will trip the breach check before the length check.
  assert.equal(passwordError("a".repeat(MIN_PASSWORD_LENGTH - 1)), `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  assert.equal(passwordError("abcdefghi"), `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
});

test("passwordError: breached passwords are rejected regardless of letter case (length-10+ candidates)", () => {
  // Length-10+ breach candidates so the length floor passes first and the
  // breach check fires. Short variants like "password" (8 chars) hit the
  // length message first by design.
  assert.match(passwordError("password1234"), /widely used and unsafe/);
  assert.match(passwordError("PASSWORD1234"), /widely used and unsafe/);
  assert.match(passwordError("Password1234"), /widely used and unsafe/);
  assert.match(passwordError("qwerty123456789"), /widely used and unsafe/);
  assert.match(passwordError("summer2024hello"), /widely used and unsafe/);
});

test("passwordError: composition rules are advisory only — they do not block", () => {
  // All-lowercase, length>=floor, not in deny-list → valid.
  assert.equal(passwordError("igrewuponharrypotter"), null);
  // All-digits with 10+ chars is allowed at the gate level — the score will
  // still reflect the missing character variety. Composition never blocks.
  assert.equal(passwordError("918273645182"), null);
});

test("passwordError: a strong mixed password is allowed", () => {
  assert.equal(passwordError("Pencil-Bicycle-River-42"), null);
  assert.equal(passwordError("correct horse battery staple"), null);
});

test("passwordError: deny-list catches common substitutions (length-10+ candidates)", () => {
  assert.match(passwordError("administrator"), /widely used and unsafe/);
  assert.match(passwordError("password12345"), /widely used and unsafe/);
  assert.match(passwordError("admin12345seven"), /widely used and unsafe/);
  assert.match(passwordError("qwerty1234twelve"), /widely used and unsafe/);
});

test("passwordScore: 3-tier ladder — too short / weak / good / strong", () => {
  // Empty → 0
  assert.equal(passwordScore(""), 0);
  // 1–7 chars → still 0 (well under the floor)
  assert.equal(passwordScore("abc"), 0);
  assert.equal(passwordScore("abcdefg"), 0);
  // 8–9 chars → 1 (Weak). Just below the 10-char floor.
  assert.equal(passwordScore("abcdefgh"), 1);
  assert.equal(passwordScore("abcdefghi"), 1);
  // 10+ chars → at least 2 (Good)
  assert.equal(passwordScore("abcdefghij"), 2);
  assert.equal(passwordScore("a".repeat(20)), 2);
});

test("passwordScore: 4 character classes unlocks the Strong tier", () => {
  assert.equal(passwordScore("abcdefghij"), 2);                 // 1 class
  assert.equal(passwordScore("abcdefghij1"), 2);               // 2 classes
  assert.equal(passwordScore("abcdefghij1K"), 2);              // 3 classes
  assert.equal(passwordScore("abcdefghij1K!"), 3);             // 4 classes → Strong
});

test("passwordScoreLabel: matches the 3-tier labels", () => {
  assert.equal(passwordScoreLabel(""), "Too short");
  assert.equal(passwordScoreLabel("abc"), "Too short");
  assert.equal(passwordScoreLabel("abcdefgh"), "Weak");
  assert.equal(passwordScoreLabel("abcdefghi"), "Weak");
  assert.equal(passwordScoreLabel("abcdefghij"), "Good");
  assert.equal(passwordScoreLabel("abcdefghij1K!"), "Strong");
});

test("passwordHint: only length nudges; composition is no longer nagged", () => {
  // Below the floor → single length nudge, regardless of how short.
  assert.match(passwordHint("abc"), new RegExp(`${MIN_PASSWORD_LENGTH}\\+ characters`));
  assert.match(passwordHint("abcdefgh"), new RegExp(`${MIN_PASSWORD_LENGTH}\\+ characters`));
  // At or above the floor → no nudge. Composition rules are purely advisory
  // through the score label, not surfaced as a separate hint.
  assert.equal(passwordHint("abcdefghij"), null);
  assert.equal(passwordHint("abcdefghij1K!"), null);
});

test("happy path: a realistic user-typed password clears the policy", () => {
  const candidate = "Bramble-Forest-Quilt-91";
  assert.equal(passwordError(candidate), null);
  assert.equal(passwordScore(candidate), 3);
  assert.equal(passwordScoreLabel(candidate), "Strong");
});
