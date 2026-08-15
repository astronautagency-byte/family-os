import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const groceries = readFileSync(new URL("../src/pages/Groceries.jsx", import.meta.url), "utf8");
const meals = readFileSync(new URL("../src/pages/Meals.jsx", import.meta.url), "utf8");

test("kitchen inventory supports direct logging and an expiry lifecycle", () => {
  assert.match(groceries, /Add an expiring item/);
  assert.match(groceries, /Use by or best before/);
  assert.match(groceries, /inventoryExpiryStatus/);
  assert.match(groceries, /Used up/);
  assert.match(groceries, /Replace/);
});

test("kitchen inventory launches meal ideas using what is at home", () => {
  assert.match(groceries, /Find meal ideas/);
  assert.match(groceries, /inventoryItems\.length > 0/);
  assert.match(groceries, /kitchenOnly:\s*true/);
  assert.match(meals, /Boolean\(intent\.kitchenOnly\)/);
});

test("kitchen inventory has one clear manual add path", () => {
  assert.match(groceries, /> Add expiring item</);
  assert.doesNotMatch(groceries, /Add your first item/);
  assert.match(groceries, /Checked shopping items also appear here for a quick review/);
});

test("kitchen inventory behaves like a practical food tracker", () => {
  assert.match(groceries, /Use first/);
  assert.match(groceries, /Search item, brand or category/);
  assert.match(groceries, /Needs date/);
  assert.match(groceries, /changeInventoryQuantity/);
  assert.match(groceries, /Brand \(optional\)/);
  assert.match(groceries, /INVENTORY_CATEGORIES\.map/);
  assert.match(groceries, /Pet Supplies/);
  assert.match(groceries, /Beverages/);
  assert.match(groceries, /Durable household supplies stay on the Shopping list/);
  assert.match(groceries, /!inventoryDraft\.expiresOn/);
});
