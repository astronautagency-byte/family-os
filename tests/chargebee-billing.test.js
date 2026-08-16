import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FREE_FEATURES, PREMIUM_FEATURES } from "../src/data/billingCatalog.js";

const migration = readFileSync(new URL("../supabase/migrations/202608150006_chargebee_feature_billing.sql", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../supabase/functions/chargebee-checkout/index.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../supabase/functions/chargebee-webhook/index.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("calendar, tasks, shopping, chat and kitchen watch remain free", () => {
  assert.deepEqual(FREE_FEATURES, ["calendar", "tasks", "groceries", "chat", "kitchen"]);
  assert.match(migration, /feature_key in \('calendar', 'tasks', 'groceries', 'chat', 'kitchen'\)/);
});

test("every premium household module costs $4.99 monthly", () => {
  assert.equal(PREMIUM_FEATURES.length, 3);
  PREMIUM_FEATURES.forEach((feature) => assert.equal(feature.priceCents, 499));
});

test("Chargebee checkout is owner-only and keys remain server-side", () => {
  assert.match(checkout, /Only the household owner can change billing/);
  assert.match(checkout, /CHARGEBEE_ITEM_FREE_BASE/);
  assert.doesNotMatch(app, /CHARGEBEE_API_KEY/);
});

test("webhooks are authenticated, re-fetched and drive server entitlements", () => {
  assert.match(webhook, /CHARGEBEE_WEBHOOK_AUTH/);
  assert.match(webhook, /events\/\$\{encodeURIComponent\(eventId\)\}/);
  assert.match(webhook, /upsert_from_chargebee/);
  assert.match(migration, /has_household_feature/);
});

test("premium navigation is guarded by household entitlements", () => {
  assert.match(app, /get_my_entitlements/);
  assert.match(app, /FeaturePaywall/);
  assert.match(app, /chargebee-checkout/);
});
