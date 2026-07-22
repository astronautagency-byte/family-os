import { test } from "node:test";
import assert from "node:assert/strict";
import { recipeSearchProfileForMeal, normaliseDietaryPreferences } from "../src/data/recipeBox.js";

const expectString = (value) => assert.equal(typeof value, "string", `expected string, got ${typeof value} (${value})`);

test("recipeSearchProfileForMeal returns a dietary string even with no preferences (no ReferenceError)", () => {
  const profile = recipeSearchProfileForMeal("Spinach and feta scramble", "breakfast", {});
  expectString(profile.dietary);
  assert.equal(profile.dietary, "", "empty restrictions should serialise to an empty string");
});

test("recipeSearchProfileForMeal joins normalised restrictions into dietary string", () => {
  const profile = recipeSearchProfileForMeal("Chicken tikka", "dinner", { restrictions: ["Vegetarian", "Gluten-free"] });
  assert.equal(profile.dietary, "Vegetarian Gluten-free");
  assert.deepEqual(profile.dietaryRestrictions, ["Vegetarian", "Gluten-free"]);
});

test("recipeSearchProfileForMeal accepts a meal object too (variant signature)", () => {
  const profile = recipeSearchProfileForMeal({ title: "Tofu stir-fry", slot: "dinner" }, "dinner", { restrictions: ["Vegan"] });
  expectString(profile.dietary);
  assert.equal(profile.query, "Tofu stir-fry");
  assert.equal(profile.mealType, "dinner");
  assert.equal(profile.dietary, "Vegan");
});

test("recipeSearchProfileForMeal splits compound titles into ingredient hints", () => {
  const profile = recipeSearchProfileForMeal("Chicken with rice and broccoli", "dinner", {});
  assert.match(profile.ingredients, /chicken/i);
  assert.match(profile.ingredients, /rice/i);
  assert.match(profile.ingredients, /broccoli/i);
  assert.equal(profile.dietary, "");
});

test("normaliseDietaryPreferences strips empties and dedupes", () => {
  const result = normaliseDietaryPreferences({ restrictions: ["Vegan", "Vegan", "  ", "", "Gluten-free", "Vegan"] });
  assert.deepEqual(result.restrictions, ["Vegan", "Gluten-free"]);
  assert.equal(result.avoidIngredients, "");
  assert.equal(result.notes, "");
});

test("normaliseDietaryPreferences accepts both avoidIngredients and the legacy avoid alias", () => {
  const a = normaliseDietaryPreferences({ avoidIngredients: "peanuts, cilantro" });
  const b = normaliseDietaryPreferences({ avoid: "peanuts, cilantro" });
  assert.equal(a.avoidIngredients, "peanuts, cilantro");
  assert.equal(b.avoidIngredients, "peanuts, cilantro");
});

test("normaliseDietaryPreferences accepts both notes and the legacy dietaryNotes alias", () => {
  const a = normaliseDietaryPreferences({ notes: "quick weeknight dinners" });
  const b = normaliseDietaryPreferences({ dietaryNotes: "quick weeknight dinners" });
  assert.equal(a.notes, "quick weeknight dinners");
  assert.equal(b.notes, "quick weeknight dinners");
});

test("recipeSearchProfileForMeal never throws undefined for any field name (regression: 'dietary is not defined')", () => {
  const inputs = [
    [{}, { restrictions: [] }],
    [{}, { restrictions: ["Vegetarian"] }],
    [{}, { avoidIngredients: "peanuts" }],
    [{}, { notes: "weeknight" }],
    [{}, null],
    [{}, undefined],
  ];
  for (const [meal, pref] of inputs) {
    const profile = recipeSearchProfileForMeal(meal, "dinner", pref);
    for (const key of ["query", "ingredients", "mealType", "dietary", "dietaryRestrictions", "avoidIngredients", "dietaryNotes"]) {
      assert.ok(key in profile, `result is missing required key "${key}" for pref=${JSON.stringify(pref)}`);
      assert.notEqual(profile[key], undefined, `result.${key} is undefined for pref=${JSON.stringify(pref)}`);
    }
  }
});
