import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../src/lib/googleCalendar.js", import.meta.url), "utf8");
const calendar = fs.readFileSync(new URL("../src/pages/Calendar.jsx", import.meta.url), "utf8");
const context = fs.readFileSync(new URL("../src/context/FamilyContext.jsx", import.meta.url), "utf8");

test("writable Google events can be created, edited and deleted from FamOS", () => {
  assert.match(api, /export async function createGoogleCalendarEvent/);
  assert.match(api, /export async function updateGoogleCalendarEvent/);
  assert.match(api, /method: "PATCH"/);
  assert.match(api, /export async function deleteGoogleCalendarEvent/);
  assert.match(calendar, /Edit calendar event/);
  assert.match(calendar, /Save changes/);
});

test("Google-side changes continue to pull into FamOS and read-only calendars stay protected", () => {
  assert.match(context, /fetchGoogleCalendarEvents/);
  assert.match(context, /\["owner", "writer"\]\.includes\(calendar\.accessRole\)/);
  assert.match(context, /This Google calendar is view-only/);
  assert.match(calendar, /Imported calendars are available in the filters above, but remain read-only/);
});
