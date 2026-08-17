import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const admin = readFileSync(resolve(root, "src/pages/Admin.jsx"), "utf8");
const css = readFileSync(resolve(root, "src/admin.css"), "utf8");
const passwordEmail = readFileSync(resolve(root, "supabase/functions/send-password-email/index.ts"), "utf8");

test("admin login offers secure password recovery", () => {
  assert.match(admin, /Forgot password\?/);
  assert.match(admin, /send-password-email/);
  assert.match(admin, /admin_reset/);
  assert.match(passwordEmail, /admin\?recovery=1/);
  assert.match(passwordEmail, /not_active_admin/);
  assert.match(passwordEmail, /resetPasswordForEmail/);
  assert.doesNotMatch(passwordEmail, /password_email_relayed/);
  assert.match(passwordEmail, /configuredFromEmail\.includes\(`@\$\{FAMOS_MAIL_DOMAIN\}`\)/);
  assert.match(passwordEmail, /reply_to: "support@fam-os\.app"/);
  assert.match(admin, /If that admin account exists/);
});

test("admin console consumes the shared personalized design system", () => {
  assert.match(admin, /familyos:theme/);
  assert.match(admin, /familyos:color-scheme/);
  assert.match(admin, /data-color-scheme=\{colorScheme\}/);
  assert.match(css, /background:var\(--color-surface\);color:var\(--color-ink\);border-right:1px solid var\(--color-border\)/);
  assert.match(css, /\.admin-detail-title\{background:var\(--color-accent-soft\)\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(admin, /#7155df|#4f8fc9|#d58a35|#388b73|#d36b83/);
});

test("admin operations support scrolling, flexible statistics, promotions and provider refunds", () => {
  assert.doesNotMatch(admin, /admin-shell famos-noscroll/);
  assert.match(admin, /Statistics period/);
  assert.match(admin, /value="730"/);
  assert.match(admin, /admin_list_promo_codes/);
  assert.match(admin, /admin_apply_promo_code/);
  assert.match(admin, /admin-chargebee-refund/);
});
