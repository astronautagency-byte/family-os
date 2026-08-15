import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const auth = fs.readFileSync(new URL("../src/pages/Auth.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("onboarding receives the persisted personal colour scheme", () => {
  assert.match(app, /<HouseholdOnboarding colorScheme=\{colorScheme\} onColorSchemeChange=\{setColorScheme\}/);
});

test("mobile sign-up keeps its branding compact so the form starts above the fold", () => {
  assert.match(css, /\.minimal-auth-logo \{ width:88px; height:88px; margin-bottom:16px; \}/);
  assert.match(css, /\.minimal-auth-title \{[\s\S]*?margin-bottom:16px;/);
});

test("owners and invited members both receive the scheme picker", () => {
  const uses = auth.match(/<OnboardingColourScheme/g) || [];
  assert.equal(uses.length, 2);
  assert.match(auth, /role="radiogroup" aria-label="Choose your app colour scheme"/);
  assert.match(auth, /This only changes your view, not anyone else’s/);
});

test("appearance is a focused optional step instead of crowding identity or calendar setup", () => {
  assert.match(auth, /\["Household", "Address", "Priorities", "Food", "Shopping", "Calendar", "Your look", "Notifications"\]/);
  assert.match(auth, /\["About you", "Food", "Calendar", "Your look"\]/);
  assert.match(auth, /props\.step === 6 && <><OnboardingColourScheme/);
  assert.match(auth, /step === 3 && <><OnboardingColourScheme/);
});
