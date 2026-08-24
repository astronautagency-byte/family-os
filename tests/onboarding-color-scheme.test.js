import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const auth = fs.readFileSync(new URL("../src/pages/Auth.jsx", import.meta.url), "utf8");
const authContext = fs.readFileSync(new URL("../src/context/AuthContext.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("onboarding receives the persisted personal colour scheme", () => {
  assert.match(app, /<HouseholdOnboarding colorScheme=\{colorScheme\} onColorSchemeChange=\{setColorScheme\}/);
});

test("mobile sign-up keeps its branding compact so the form starts above the fold", () => {
  assert.match(css, /\.minimal-auth-logo \{ width:88px; height:88px; margin-bottom:16px; \}/);
  assert.match(css, /\.minimal-auth-title \{[\s\S]*?margin-bottom:16px;/);
});

test("revised owner onboarding includes the requested setup stages", () => {
  assert.match(auth, /Create your family/);
  assert.match(auth, /Home address/);
  assert.match(auth, /What keeps your family busy\?/);
  assert.match(auth, /Bring in your schedule/);
  assert.match(auth, /Build My FamOS/);
  assert.match(auth, /Unlock Full FamOS/);
  assert.match(auth, /Start My 30-Day Free Trial/);
});

test("family interests and schedule sources are persisted", () => {
  assert.match(auth, /REVISED_INTERESTS = \["Sports", "Outdoors", "School"/);
  assert.match(auth, /REVISED_SCHEDULE_SOURCES/);
  assert.match(auth, /onboardingInterests: familyInterests/);
  assert.match(auth, /onboardingScheduleSources: scheduleSources/);
  assert.match(authContext, /onboarding_family/);
  assert.match(authContext, /onboarding_interests/);
});

test("trial messaging keeps Core available and uses hosted Stripe checkout", () => {
  assert.match(auth, /your household can stay on FamOS Core/);
  assert.match(auth, /create-checkout-session/);
  assert.match(auth, /You won’t be charged today/);
  assert.match(app, /TrialConfirmationModal/);
});
