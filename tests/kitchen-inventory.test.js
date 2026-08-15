import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hook = readFileSync(new URL("../src/hooks/useKitchenInventory.js", import.meta.url), "utf8");
const groceries = readFileSync(new URL("../src/pages/Groceries.jsx", import.meta.url), "utf8");
const meals = readFileSync(new URL("../src/pages/Meals.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/202608150001_kitchen_inventory.sql", import.meta.url), "utf8");

test("inventory supports household-scoped fridge, freezer and pantry storage", () => {
  assert.match(migration, /household_id uuid not null/);
  assert.match(migration, /location in \('fridge','freezer','pantry'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(hook, /famos:kitchen-inventory:v1/);
});

test("purchased groceries require an explicit location and expiry date", () => {
  assert.match(groceries, /Just bought/);
  for (const location of ["fridge", "freezer", "pantry"]) assert.match(groceries, new RegExp(`openInventoryDraft\\(item, "${location}"\\)`));
  assert.match(groceries, /Use by or best before/);
  assert.match(groceries, /!inventoryDraft\.expiresOn/);
});

test("Cook Mode reviews inventory consumption before removal", () => {
  assert.match(meals, /nothing changes until you confirm/i);
  assert.match(meals, /consumeSelection/);
  assert.match(meals, /removeInventoryItem/);
});
