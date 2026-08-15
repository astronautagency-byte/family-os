import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const today = readFileSync(resolve(root, "src/pages/Today.jsx"), "utf8");
const css = readFileSync(resolve(root, "src/index.css"), "utf8");

test("Today uses a responsive semantic bento layout", () => {
  assert.match(today, /today-bento-grid/);
  assert.match(today, /today-bento-schedule/);
  assert.match(today, /today-bento-meal-grid/);
  assert.match(today, /today-bento-tasks/);
  assert.match(today, /today-bento-kitchen/);
  assert.match(today, /today-bento-messages/);
  assert.match(today, /today-weather-outlook/);
  assert.match(css, /\.today-bento-grid\{display:grid;grid-template-columns:repeat\(12/);
  assert.match(css, /today-meals-card\{grid-column:span 6/);
  assert.match(css, /today-bento-messages\{grid-column:span 7/);
  assert.match(css, /@media\(max-width:700px\)/);
});

test("Today fills empty states with useful kitchen and family context", () => {
  assert.match(today, /Your kitchen tracker is ready/);
  assert.match(today, /Latest messages/);
  assert.match(today, /\.filter\(\(message\) => !message\.broadcast/);
  assert.match(today, /weather\.daily\.slice\(0, 3\)/);
});

test("Today lets each user persist and rearrange home cards", () => {
  assert.match(today, /famos:today-card-order:v1/);
  assert.match(today, /Drag cards to rearrange them/);
  assert.match(today, /moveDashboardCard/);
  assert.match(today, /dashboardDragProps/);
  assert.match(today, /onDragStart/);
  assert.match(today, /onDrop/);
  assert.match(today, /dashboardPosition\("weather"\)/);
  assert.match(today, /dashboardPosition\("schedule"\)/);
  assert.match(today, /dashboardPosition\("meals"\)/);
  assert.match(today, /dashboardPosition\("groceries"\)/);
  assert.match(today, /dashboardPosition\("kitchen"\)/);
  assert.match(today, /dashboardPosition\("messages"\)/);
  assert.match(today, /dashboardPosition\("tasks"\)/);
  assert.match(css, /grid-auto-flow:row dense/);
  assert.match(css, /\.today-card-move-handle/);
});

test("bento motion is restrained and respects reduced motion", () => {
  assert.match(css, /@media\(prefers-reduced-motion:no-preference\)/);
  assert.match(css, /@keyframes today-bento-arrive\{from\{opacity:0;transform:translateY/);
  assert.doesNotMatch(css.match(/@keyframes today-bento-arrive[\s\S]*?\}\}/)?.[0] || "", /width|height|top:|left:/);
});
