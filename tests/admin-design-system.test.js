import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const admin = readFileSync(resolve(root, "src/pages/Admin.jsx"), "utf8");
const css = readFileSync(resolve(root, "src/admin.css"), "utf8");

test("admin login offers secure password recovery", () => {
  assert.match(admin, /Forgot password\?/);
  assert.match(admin, /resetPasswordForEmail/);
  assert.match(admin, /admin\?recovery=1/);
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

