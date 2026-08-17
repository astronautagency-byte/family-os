import { test } from "node:test";
import assert from "node:assert/strict";
import { expiringInventory, inventoryExpiryProgress, inventoryExpiryStatus } from "../src/lib/inventoryExpiry.js";

const now = new Date(2026, 7, 15, 9);

test("inventory expiry reminders distinguish expired, today and soon", () => {
  assert.equal(inventoryExpiryStatus({ expiresOn: "2026-08-14", quantity: 1 }, now).state, "expired");
  assert.equal(inventoryExpiryStatus({ expiresOn: "2026-08-15", quantity: 1 }, now).label, "Passed");
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

test("expiry progress fills as the expiry date approaches", () => {
  const early = inventoryExpiryProgress({ expiresOn: "2026-08-20", createdAt: "2026-08-10T12:00:00Z" }, new Date(2026, 7, 12, 9));
  const late = inventoryExpiryProgress({ expiresOn: "2026-08-20", createdAt: "2026-08-10T12:00:00Z" }, new Date(2026, 7, 19, 9));
  assert.ok(late.percent > early.percent);
  assert.equal(late.daysRemaining, 1);
});
