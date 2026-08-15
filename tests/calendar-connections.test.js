import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const settings = fs.readFileSync(new URL("../src/pages/Settings.jsx", import.meta.url), "utf8");
const context = fs.readFileSync(new URL("../src/context/FamilyContext.jsx", import.meta.url), "utf8");

test("settings shows connected calendar count and per-calendar privacy", () => {
  assert.match(settings, /Connected calendars/);
  assert.match(settings, /Private/);
  assert.match(settings, /Shared/);
  assert.match(settings, /selectedGoogleCalendarIds\.length \+ calendarFeeds\.length/);
});

test("calendar connections are limited to five in the data layer", () => {
  const guards = context.match(/selectedGoogleCalendarIds\.length \+ calendarFeeds\.length >= 5/g) || [];
  assert.ok(guards.length >= 3, "Google selection, feed URL, and file import must all enforce the limit");
  assert.match(context, /You can connect up to 5 calendars/);
});

test("additional feeds persist a household visibility choice", () => {
  assert.match(context, /sharedWithHousehold: false/);
  assert.match(context, /toggleCalendarFeedSharing/);
});
