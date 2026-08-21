import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const featureData = readFileSync(resolve(root, "src/data/featureData.js"), "utf8");
const landing = readFileSync(resolve(root, "src/pages/Landing.jsx"), "utf8");

test("public product catalog surfaces Today and Family settings alongside core modules", () => {
  const marketingIds = featureData.match(/export const MARKETING_FEATURE_IDS = \[([\s\S]*?)\];/)?.[1] || "";
  for (const id of ["today", "meals", "calendar", "fam-ai", "tasks", "chat", "shopping", "family"]) {
    assert.match(marketingIds, new RegExp(`"${id}"`));
  }
});

test("website describes the newest working household workflows", () => {
  const websiteCopy = `${featureData}\n${landing}`;
  for (const phrase of [
    "Kitchen inventory",
    "Use-it-soon reminders",
    "Photos and quick scans",
    "Imports you approve",
    "Personal colour schemes",
    "Spoonacular recipes",
    "Private/shared calendars",
  ]) assert.match(websiteCopy, new RegExp(phrase, "i"));
});

test("calendar marketing stays within the shipped five-feed scope", () => {
  assert.doesNotMatch(featureData, /Local event discovery|Discover things to do nearby|as many calendars as you use/i);
  assert.match(featureData, /Connect up to five/);
});
