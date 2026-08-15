import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const family = readFileSync(new URL("../src/context/FamilyContext.jsx", import.meta.url), "utf8");
const inventory = readFileSync(new URL("../src/hooks/useKitchenInventory.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/202608150003_private_household_broadcast.sql", import.meta.url), "utf8");

test("household changes use a private low-latency broadcast with a database fallback", () => {
  assert.match(family, /household:\$\{household\.id\}:changes/);
  assert.match(family, /config:\s*\{\s*private:\s*true/);
  assert.match(family, /postgres_changes/);
  for (const event of ["INSERT", "UPDATE", "DELETE"]) assert.match(family, new RegExp(`event: "${event}"`));
});

test("broadcast authorization is restricted to current household members", () => {
  assert.match(migration, /on realtime\.messages/);
  assert.match(migration, /hm\.user_id = auth\.uid\(\)/);
  assert.match(migration, /realtime\.topic\(\) = 'household:' \|\| hm\.household_id::text \|\| ':changes'/);
  assert.match(migration, /realtime\.broadcast_changes/);
});

test("kitchen inventory receives remote inserts, updates and deletes", () => {
  assert.match(inventory, /kitchen-inventory-remote-change/);
  assert.match(inventory, /table: "kitchen_inventory"/);
  assert.match(inventory, /payload\.eventType === "DELETE"/);
});
