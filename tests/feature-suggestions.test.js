import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const settings = readFileSync(resolve(root, "src/pages/Settings.jsx"), "utf8");
const admin = readFileSync(resolve(root, "src/pages/Admin.jsx"), "utf8");
const edge = readFileSync(resolve(root, "supabase/functions/send-support-message/index.ts"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/202608150002_feature_suggestions.sql"), "utf8");

test("Settings submits feature suggestions through the reviewed support pipeline", () => {
  assert.match(settings, /Suggest a feature/);
  assert.match(settings, /category:\s*"feature"/);
  assert.match(settings, /supportForm === "feature"/);
  assert.match(settings, /TextAreaField/);
});

test("feature suggestions are accepted and visible in the admin inbox", () => {
  assert.match(edge, /\[Feature Idea\]/);
  assert.match(migration, /'feature'/);
  assert.match(admin, /Feature ideas/);
  assert.match(admin, /Feature idea/);
});
