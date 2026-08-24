import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FREE_FEATURES, PLAN_FEATURES } from "../src/data/billingCatalog.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/202608230001_stripe_billing_cutover.sql");
const checkout = read("supabase/functions/create-checkout-session/index.ts");
const webhook = read("supabase/functions/stripe-webhook/index.ts");
const portal = read("supabase/functions/billing-portal/index.ts");
const settings = read("src/pages/Settings.jsx");
const app = read("src/App.jsx");

 test("core household tools remain free", () => {
  assert.deepEqual(FREE_FEATURES, ["calendar", "tasks", "groceries", "chat", "kitchen"]);
  assert.match(migration, /feature_key in \('calendar', 'tasks', 'groceries', 'chat', 'kitchen'\)/);
});

test("Plus and Pro match the published pricing catalog", () => {
  assert.deepEqual(PLAN_FEATURES.map((plan) => plan.id), ["plus", "pro"]);
  assert.equal(PLAN_FEATURES[0].priceCents, 1499);
  assert.equal(PLAN_FEATURES[0].priceYearlyCents, 14900);
  assert.equal(PLAN_FEATURES[1].priceCents, 1999);
  assert.equal(PLAN_FEATURES[1].priceYearlyCents, 19900);
});

test("Stripe checkout is owner-only, price-configured, and trial-aware", () => {
  assert.match(checkout, /Only the household owner can change billing/);
  assert.match(checkout, /STRIPE_PRICE_PLUS_MONTHLY/);
  assert.match(checkout, /STRIPE_PRICE_PRO_YEARLY/);
  assert.match(checkout, /trial_period_days: 30/);
  assert.match(checkout, /allow_promotion_codes: true/);
  assert.doesNotMatch(app, /STRIPE_SECRET_KEY/);
});

test("Stripe webhooks verify signatures and sync household entitlements", () => {
  assert.match(webhook, /constructEventAsync/);
  assert.match(webhook, /upsert_from_stripe/);
  assert.match(webhook, /famos_household_id/);
  assert.match(migration, /provider = 'stripe'/);
  assert.match(migration, /trial_ends_at/);
});

test("Stripe customer portal stays server-side and owner-scoped", () => {
  assert.match(portal, /stripe\.billingPortal\.sessions\.create/);
  assert.match(portal, /Only the household owner can manage billing/);
  assert.match(portal, /stripe_customer_id/);
});

test("billing upgrades use isolated progress states and Stripe-only client calls", () => {
  assert.match(settings, /const \[billingBusy, setBillingBusy\] = useState\(null\)/);
  assert.match(settings, /setBillingBusy\(feature\)/);
  assert.match(settings, /billingBusy === "plus" \? "Processing…"/);
  assert.match(settings, /billingBusy === "pro" \? "Processing…"/);
  assert.match(settings, /supabase\.functions\.invoke\("create-checkout-session"/);
  assert.match(settings, /supabase\.functions\.invoke\("billing-portal"/);
  assert.doesNotMatch(settings, /chargebee/i);
});

test("premium navigation is guarded by household entitlements", () => {
  assert.match(app, /get_my_entitlements/);
  assert.match(app, /FeaturePaywall/);
  assert.match(app, /create-checkout-session/);
});
