import test from "node:test";
import assert from "node:assert/strict";
import { classifySharedContent, sharedRecipeTitle } from "../src/lib/sharedContent.js";

test("recognises known recipe shares and preserves ordinary lists", () => {
  assert.equal(classifySharedContent({ url: "https://www.allrecipes.com/recipe/123/pasta" }), "recipe");
  assert.equal(classifySharedContent({ text: "Recipe ingredients and cooking instructions" }), "recipe");
  assert.equal(classifySharedContent({ text: "Milk\nEggs\nDish soap" }), "list");
});

test("builds a useful review title from a shared recipe URL", () => {
  assert.equal(sharedRecipeTitle({ url: "https://example.com/recipes/sheet-pan-fajitas" }), "Sheet Pan Fajitas");
  assert.equal(sharedRecipeTitle({ title: "Grandma's soup", url: "https://example.com" }), "Grandma's soup");
});
