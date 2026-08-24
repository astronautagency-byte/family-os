import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const admin = fs.readFileSync(new URL("../src/pages/Admin.jsx", import.meta.url), "utf8");
const analytics = fs.readFileSync(new URL("../supabase/functions/admin-stripe-analytics/index.ts", import.meta.url), "utf8");
const portal = fs.readFileSync(new URL("../supabase/functions/admin-stripe-portal/index.ts", import.meta.url), "utf8");
const promotions = fs.readFileSync(new URL("../supabase/functions/admin-stripe-promotions/index.ts", import.meta.url), "utf8");

test("admin revenue loads live Stripe subscriptions, invoices, and calculations", () => {
  assert.match(admin, /admin-stripe-analytics/);
  assert.match(admin, /Stripe billing intelligence/);
  assert.match(analytics, /subscriptions\.list/);
  assert.match(analytics, /invoices\.list/);
  assert.match(analytics, /mrrCents/);
  assert.match(analytics, /netCollectedCents/);
  assert.match(analytics, /outstandingCents/);
});

test("Stripe promotions create real coupons and can be archived", () => {
  assert.match(admin, /admin-stripe-promotions/);
  assert.match(promotions, /stripe\.coupons\.create/);
  assert.match(promotions, /promotionCodes\.create/);
  assert.match(promotions, /promotionCodes\.update/);
  assert.match(promotions, /admin_audit_log/);
});

test("Stripe management remains server-side and admin-only", () => {
  assert.match(portal, /admin_users/);
  assert.match(portal, /billingPortal\.sessions\.create/);
  assert.match(portal, /admin_audit_log/);
  assert.doesNotMatch(admin, /STRIPE_SECRET_KEY/);
});
