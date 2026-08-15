import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const groceries = readFileSync(new URL("../src/pages/Groceries.jsx", import.meta.url), "utf8");
const meals = readFileSync(new URL("../src/pages/Meals.jsx", import.meta.url), "utf8");

test("kitchen inventory supports direct logging and an expiry lifecycle", () => {
  assert.match(groceries, /Add to kitchen inventory/);
  assert.match(groceries, /Use by \(optional\)/);
  assert.match(groceries, /inventoryExpiryStatus/);
  assert.match(groceries, /Used up/);
  assert.match(groceries, /Replace/);
});

test("kitchen inventory launches meal ideas using what is at home", () => {
  assert.match(groceries, /Cook with what’s here/);
  assert.match(groceries, /kitchenOnly:\s*true/);
  assert.match(meals, /Boolean\(intent\.kitchenOnly\)/);
});

test("kitchen inventory behaves like a practical food tracker", () => {
  assert.match(groceries, /Use first/);
  assert.match(groceries, /Search food, brand or category/);
  assert.match(groceries, /Needs date/);
  assert.match(groceries, /changeInventoryQuantity/);
  assert.match(groceries, /Brand \(optional\)/);
  assert.match(groceries, /GROCERY_CATEGORIES\.map/);
});
