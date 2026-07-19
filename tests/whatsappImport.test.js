import test from "node:test";
import assert from "node:assert/strict";
import { parseWhatsAppExport } from "../src/lib/whatsappImport.js";

test("parses iPhone WhatsApp exports and multiline messages", () => {
  const result = parseWhatsAppExport(`[7/18/26, 1:05:00 PM] Alex: Grocery list is ready
Please grab milk
[7/18/26, 1:06:00 PM] Sam: On it`);
  assert.equal(result.length, 2);
  assert.equal(result[0].sender, "Alex");
  assert.equal(result[0].text, "Grocery list is ready\nPlease grab milk");
});

test("parses Android WhatsApp exports", () => {
  const result = parseWhatsAppExport("7/18/26, 1:05 PM - Alex: Dinner at six");
  assert.equal(result.length, 1);
  assert.equal(result[0].text, "Dinner at six");
});
