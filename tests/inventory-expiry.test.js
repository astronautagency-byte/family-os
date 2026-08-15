import { test } from "node:test";
import assert from "node:assert/strict";
import { expiringInventory, inventoryExpiryStatus } from "../src/lib/inventoryExpiry.js";

const now = new Date(2026, 7, 15, 9);

test("inventory expiry reminders distinguish expired, today and soon", () => {
  assert.equal(inventoryExpiryStatus({ expiresOn: "2026-08-14", quantity: 1 }, now).state, "expired");
  assert.equal(inventoryExpiryStatus({ expiresOn: "2026-08-15", quantity: 1 }, now).label, "Use today");
  assert.equal(inventoryExpiryStatus({ expiresOn: "2026-08-17", quantity: 1 }, now).label, "Use within 2 days");
  assert.equal(inventoryExpiryStatus({ expiresOn: "2026-08-20", quantity: 1 }, now), null);
});

test("expired inventory sorts before items expiring soon", () => {
  const result = expiringInventory([
    { id: "soon", name: "Milk", expiresOn: "2026-08-17", quantity: 1 },
    { id: "old", name: "Spinach", expiresOn: "2026-08-14", quantity: 1 },
  ], now);
  assert.deepEqual(result.map((item) => item.id), ["old", "soon"]);
});
