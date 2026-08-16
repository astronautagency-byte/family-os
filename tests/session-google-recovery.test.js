import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("session restoration never references the auth-listener-only nextSession variable", () => {
  const source = read("src/context/AuthContext.jsx");
  assert.match(source, /loadedAccountUserIdRef\.current = data\.session\?\.user\?\.id \?\? null/);
  assert.doesNotMatch(source, /getSession\(\)[\s\S]{0,700}loadedAccountUserIdRef\.current = nextSession/);
});

test("expired Google Calendar connections use the forced OAuth reconnect path", () => {
  const family = read("src/context/FamilyContext.jsx");
  const settings = read("src/pages/Settings.jsx");
  const calendar = read("src/pages/Calendar.jsx");
  assert.match(family, /const reconnectGoogleCalendar = async \(\) =>/);
  assert.match(family, /await forceReconnectGoogle\(\)/);
  assert.match(settings, /\? reconnectGoogleCalendar : syncGoogleCalendarNow/);
  assert.match(calendar, /onClick=\{reconnectGoogleCalendar\}>Reconnect Google Calendar/);
});

test("the app self-recovers once from stale PWA assets", () => {
  const boundary = read("src/components/ErrorBoundary.jsx");
  assert.match(boundary, /failed to fetch dynamically imported module/i);
  assert.match(boundary, /failed to load module script/i);
  assert.match(boundary, /load failed/i);
  assert.match(boundary, /family-os:asset-recovery/);
  assert.match(boundary, /window\.caches\.delete/);
  assert.match(boundary, /30_000/);
  assert.match(boundary, /window\.location\.reload\(\)/);
});

test("page failures stay inside the signed-in shell and record a diagnostic fingerprint", () => {
  const boundary = read("src/components/ErrorBoundary.jsx");
  const app = read("src/App.jsx");
  const vite = read("vite.config.js");
  assert.match(boundary, /famos:recent-crash:v1/);
  assert.match(boundary, /resetKey/);
  assert.match(app, /<ErrorBoundary resetKey=\{tab\}/);
  assert.match(app, /Return to Today/);
  assert.match(app, /resetKey=\{`famai-\$\{famAiOpen\}`\}/);
  assert.match(vite, /cleanupOutdatedCaches:\s*true/);
});
