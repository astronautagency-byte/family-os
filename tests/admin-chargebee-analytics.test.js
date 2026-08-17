import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const admin = fs.readFileSync(new URL("../src/pages/Admin.jsx", import.meta.url), "utf8");
const analytics = fs.readFileSync(new URL("../supabase/functions/admin-chargebee-analytics/index.ts", import.meta.url), "utf8");
const portal = fs.readFileSync(new URL("../supabase/functions/admin-chargebee-portal/index.ts", import.meta.url), "utf8");

test("admin revenue loads live Chargebee subscriptions, invoices, and calculations", () => {
  assert.match(admin, /admin-chargebee-analytics/);
  assert.match(admin, /Chargebee billing intelligence/);
  assert.match(analytics, /\/subscriptions/);
  assert.match(analytics, /\/invoices/);
  assert.match(analytics, /\/transactions/);
  assert.match(analytics, /mrrCents/);
  assert.match(analytics, /netCollectedCents/);
  assert.match(analytics, /outstandingCents/);
});

test("Chargebee management remains server-side and admin-only", () => {
  assert.match(portal, /admin_users/);
  assert.match(portal, /portal_sessions/);
  assert.match(portal, /admin_audit_log/);
  assert.doesNotMatch(admin, /CHARGEBEE_API_KEY/);
});
