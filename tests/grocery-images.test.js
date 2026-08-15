import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const groceries = readFileSync(new URL("../src/pages/Groceries.jsx", import.meta.url), "utf8");
const family = readFileSync(new URL("../src/context/FamilyContext.jsx", import.meta.url), "utf8");

test("grocery photo picker uses the configured Supabase client", () => {
  assert.match(groceries, /import \{ supabase \} from "\.\.\/lib\/supabase"/);
  assert.match(groceries, /uploadGroceryPhoto\(\{ householdId, file, supabase \}\)/);
  assert.match(groceries, /photoUrl = photoDraft\.remoteUrl/);
});

test("grocery cards prefer household photos then barcode product images", () => {
  assert.match(groceries, /item\.photoUrl \|\| item\.imageUrl/);
  assert.match(groceries, /<GroceryItemImage item=\{item\}/);
  assert.match(groceries, /\{item\.brand && <small/);
});

test("barcode metadata persists image and brand on grocery rows", () => {
  assert.match(family, /brand:\s*row\.brand/);
  assert.match(family, /imageUrl:\s*row\.image_url/);
  assert.match(family, /brand:\s*item\.brand/);
  assert.match(family, /image_url:\s*item\.imageUrl/);
});
