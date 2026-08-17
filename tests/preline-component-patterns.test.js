import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../src/components/ui.jsx", import.meta.url), "utf8");
const tasks = readFileSync(new URL("../src/pages/Tasks.jsx", import.meta.url), "utf8");
const kitchen = readFileSync(new URL("../src/pages/KitchenWatch.jsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/pages/Settings.jsx", import.meta.url), "utf8");

test("shared FamOS components cover the supplied Preline interaction patterns", () => {
  assert.match(ui, /export function Switch/);
  assert.match(ui, /role="switch"/);
  assert.match(ui, /export function MenuDropdown/);
  assert.match(ui, /export function CircularProgress/);
  assert.match(ui, /export function Badge/);
  assert.match(ui, /export function AvatarCircles/);
  assert.match(ui, /export function DateField/);
  assert.match(ui, /export function ProgressBar/);
});

test("reference screens consume the shared patterns", () => {
  assert.match(tasks, /<AvatarStack/);
  assert.match(tasks, /<Badge tone="accent"/);
  assert.match(kitchen, /<CircularProgress/);
  assert.match(settings, /<MenuDropdown/);
});
