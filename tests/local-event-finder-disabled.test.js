import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const calendar = readFileSync(resolve(root, "src/pages/Calendar.jsx"), "utf8");

test("local event finder is removed from the active Calendar surface", () => {
  assert.match(calendar, /const LOCAL_EVENT_FINDER_ENABLED = false/);
  assert.match(calendar, /LOCAL_EVENT_FINDER_ENABLED && <button[^>]+[\s\S]{0,1800}aria-label="Discover local events"/);
  assert.match(calendar, /LOCAL_EVENT_FINDER_ENABLED && <Modal open=\{discovering\}/);
});
