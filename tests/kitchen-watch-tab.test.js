import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("../src/components/BottomNav.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/KitchenWatch.jsx", import.meta.url), "utf8");
const groceries = readFileSync(new URL("../src/pages/Groceries.jsx", import.meta.url), "utf8");
const topbar = readFileSync(new URL("../src/components/AppTopBar.jsx", import.meta.url), "utf8");

test("Kitchen Watch is its own routed primary tab", () => {
  assert.match(app, /const KitchenWatch = lazy/);
  assert.match(app, /tab === "kitchen" && <KitchenWatch/);
  assert.match(nav, /id: "kitchen", label: "Kitchen"/);
  assert.match(groceries, /\{false && <><section className="kitchen-inventory-card"/);
});

test("Kitchen Watch preserves freshness, purchase review and replacement workflows", () => {
  assert.match(page, /What’s at home/);
  assert.match(page, /Put fresh purchases away/);
  assert.match(page, /Use first/);
  assert.match(page, /Use soon/);
  assert.match(page, /Expired/);
  assert.match(page, /Replace/);
  assert.match(page, /Start watching/);
});

test("Kitchen expiry reminders route directly to Kitchen Watch", () => {
  assert.match(topbar, /tab:"kitchen"/);
  assert.match(topbar, /Use it soon or add a replacement/);
});
