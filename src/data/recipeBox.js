// A small local "recipe box" used to power two meal-planning shortcuts:
//  1. Suggest meals based on ingredients you already have
//  2. Browse quick-add meal ideas by food culture / cuisine
// This is static, curated data — no external API calls, so it works fully offline.

export const CUISINES = [
  "Italian",
  "Mexican",
  "Indian",
  "Japanese",
  "Chinese",
  "Mediterranean",
  "American Comfort",
  "Thai",
];

export const RECIPE_BOX = [
  { id: "b1", title: "Cheese and herb omelette", cuisine: "American Comfort", mealTypes: ["breakfast"], tags: ["eggs", "cheese", "herbs", "butter"] },
  { id: "b2", title: "Egg and avocado toast", cuisine: "American Comfort", mealTypes: ["breakfast"], tags: ["eggs", "avocado", "bread"] },
  { id: "b3", title: "Breakfast burritos", cuisine: "Mexican", mealTypes: ["breakfast"], tags: ["eggs", "tortillas", "cheese", "beans", "salsa"] },
  { id: "b4", title: "Spinach and feta scramble", cuisine: "Mediterranean", mealTypes: ["breakfast"], tags: ["eggs", "spinach", "feta"] },
  { id: "b5", title: "Banana oat pancakes", cuisine: "American Comfort", mealTypes: ["breakfast"], tags: ["banana", "oats", "eggs", "milk"] },
  { id: "b6", title: "Yogurt berry breakfast bowl", cuisine: "Mediterranean", mealTypes: ["breakfast"], tags: ["yogurt", "berries", "granola", "honey"] },
  { id: "l1", title: "Egg salad sandwiches", cuisine: "American Comfort", mealTypes: ["lunch"], tags: ["eggs", "bread", "mayonnaise", "celery"] },
  { id: "l2", title: "Mediterranean chickpea salad", cuisine: "Mediterranean", mealTypes: ["lunch"], tags: ["chickpeas", "cucumber", "tomato", "feta"] },
  { id: "r1", title: "Spaghetti aglio e olio", cuisine: "Italian", tags: ["spaghetti", "garlic", "olive oil", "parmesan", "chili flakes"] },
  { id: "r2", title: "Margherita pizza", cuisine: "Italian", tags: ["pizza dough", "tomato", "mozzarella", "basil"] },
  { id: "r3", title: "Chicken parmesan", cuisine: "Italian", tags: ["chicken", "breadcrumbs", "parmesan", "tomato", "mozzarella"] },
  { id: "r4", title: "Mushroom risotto", cuisine: "Italian", tags: ["rice", "mushroom", "parmesan", "onion", "butter"] },
  { id: "r5", title: "Caprese salad", cuisine: "Italian", tags: ["tomato", "mozzarella", "basil", "olive oil"] },

  { id: "r6", title: "Chicken tacos", cuisine: "Mexican", tags: ["chicken", "tortillas", "onion", "cilantro", "lime"] },
  { id: "r7", title: "Beef burrito bowl", cuisine: "Mexican", tags: ["ground beef", "rice", "black beans", "cheese", "salsa"] },
  { id: "r8", title: "Veggie quesadillas", cuisine: "Mexican", tags: ["tortillas", "cheese", "bell pepper", "onion"] },
  { id: "r9", title: "Turkey chili", cuisine: "Mexican", tags: ["ground turkey", "black beans", "tomato", "onion", "chili powder"] },
  { id: "r10", title: "Shrimp fajitas", cuisine: "Mexican", tags: ["shrimp", "bell pepper", "onion", "tortillas", "lime"] },

  { id: "r11", title: "Chicken tikka masala", cuisine: "Indian", tags: ["chicken", "yogurt", "tomato", "cream", "garam masala"] },
  { id: "r12", title: "Chana masala", cuisine: "Indian", tags: ["chickpeas", "tomato", "onion", "garlic", "ginger"] },
  { id: "r13", title: "Vegetable biryani", cuisine: "Indian", tags: ["rice", "mixed vegetables", "onion", "yogurt", "spices"] },
  { id: "r14", title: "Dal tadka", cuisine: "Indian", tags: ["lentils", "onion", "tomato", "garlic", "cumin"] },

  { id: "r15", title: "Chicken teriyaki bowl", cuisine: "Japanese", tags: ["chicken", "rice", "soy sauce", "broccoli", "ginger"] },
  { id: "r16", title: "Salmon onigiri", cuisine: "Japanese", tags: ["salmon", "rice", "nori", "soy sauce"] },
  { id: "r17", title: "Miso soup + rice", cuisine: "Japanese", tags: ["tofu", "miso paste", "rice", "green onion"] },
  { id: "r18", title: "Yaki udon", cuisine: "Japanese", tags: ["udon noodles", "cabbage", "carrot", "soy sauce", "chicken"] },

  { id: "r19", title: "Beef and broccoli", cuisine: "Chinese", tags: ["beef", "broccoli", "soy sauce", "garlic", "rice"] },
  { id: "r20", title: "Fried rice", cuisine: "Chinese", tags: ["rice", "eggs", "peas", "carrot", "soy sauce"] },
  { id: "r21", title: "Kung pao chicken", cuisine: "Chinese", tags: ["chicken", "peanuts", "bell pepper", "soy sauce", "chili"] },
  { id: "r22", title: "Vegetable dumplings", cuisine: "Chinese", tags: ["cabbage", "carrot", "dumpling wrappers", "soy sauce"] },

  { id: "r23", title: "Greek chicken bowls", cuisine: "Mediterranean", tags: ["chicken", "cucumber", "tomato", "feta", "rice"] },
  { id: "r24", title: "Falafel wraps", cuisine: "Mediterranean", tags: ["chickpeas", "tortillas", "cucumber", "tomato", "yogurt"] },
  { id: "r25", title: "Baked salmon + veggies", cuisine: "Mediterranean", tags: ["salmon", "zucchini", "tomato", "olive oil", "lemon"] },
  { id: "r26", title: "Greek salad", cuisine: "Mediterranean", tags: ["cucumber", "tomato", "feta", "olives", "onion"] },

  { id: "r27", title: "Sheet-pan chicken fajitas", cuisine: "American Comfort", tags: ["chicken", "bell pepper", "onion", "tortillas"] },
  { id: "r28", title: "Baked mac and cheese", cuisine: "American Comfort", tags: ["pasta", "cheese", "milk", "butter"] },
  { id: "r29", title: "Sunday roast chicken", cuisine: "American Comfort", tags: ["chicken", "potatoes", "carrot", "onion"] },
  { id: "r30", title: "Turkey meatloaf", cuisine: "American Comfort", tags: ["ground turkey", "breadcrumbs", "egg", "ketchup"] },
  { id: "r31", title: "Grilled cheese + tomato soup", cuisine: "American Comfort", tags: ["bread", "cheese", "tomato", "butter"] },
  { id: "r32", title: "BBQ pulled pork", cuisine: "American Comfort", tags: ["pork", "bbq sauce", "buns", "coleslaw"] },

  { id: "r33", title: "Green curry chicken", cuisine: "Thai", tags: ["chicken", "coconut milk", "green curry paste", "bell pepper", "rice"] },
  { id: "r34", title: "Pad thai", cuisine: "Thai", tags: ["rice noodles", "shrimp", "eggs", "peanuts", "bean sprouts"] },
  { id: "r35", title: "Thai basil beef", cuisine: "Thai", tags: ["beef", "basil", "chili", "garlic", "rice"] },
  { id: "r36", title: "Coconut lentil soup", cuisine: "Thai", tags: ["lentils", "coconut milk", "carrot", "ginger"] },
];

const DIETARY_BLOCKLISTS = {
  vegetarian: ["chicken", "beef", "pork", "turkey", "shrimp", "salmon", "bacon", "meat", "fish"],
  vegan: ["chicken", "beef", "pork", "turkey", "shrimp", "salmon", "bacon", "meat", "fish", "egg", "eggs", "cheese", "milk", "yogurt", "feta", "mozzarella", "parmesan", "cream", "butter", "honey"],
  "gluten-free": ["bread", "breadcrumbs", "pasta", "spaghetti", "noodles", "udon", "tortillas", "buns", "pizza dough", "flour", "dumpling wrappers"],
  "dairy-free": ["cheese", "milk", "yogurt", "feta", "mozzarella", "parmesan", "cream", "butter"],
  "nut-free": ["peanut", "peanuts", "almond", "cashew", "walnut", "pecan", "nuts"],
  "shellfish-free": ["shrimp", "prawn", "crab", "lobster", "shellfish"],
  "low sugar": ["honey", "sugar", "syrup"],
};

const normalizeRestriction = (value = "") => String(value).trim().toLowerCase();

export function normaliseDietaryPreferences(preferences = {}) {
  const restrictions = Array.isArray(preferences.restrictions)
    ? preferences.restrictions.map(normalizeRestriction).filter(Boolean)
    : [];
  return {
    restrictions: [...new Set(restrictions)],
    avoidIngredients: String(preferences.avoidIngredients || preferences.avoid || "").trim(),
    notes: String(preferences.notes || preferences.dietaryNotes || "").trim(),
  };
}

const recipeSearchText = (recipe = {}) => [
  recipe.title,
  recipe.cuisine,
  ...(recipe.tags || []),
  ...(recipe.ingredients || []),
].join(" ").toLowerCase();

const avoidedTerms = (preferences = {}) => normaliseDietaryPreferences(preferences).avoidIngredients
  .split(/[,\n]/)
  .map((term) => term.trim().toLowerCase())
  .filter(Boolean);

export function recipeMatchesDiet(recipe = {}, preferences = {}) {
  const diet = normaliseDietaryPreferences(preferences);
  const searchable = recipeSearchText(recipe);
  const avoided = avoidedTerms(diet);
  if (avoided.some((term) => searchable.includes(term))) return false;

  return diet.restrictions.every((restriction) => {
    const blocked = DIETARY_BLOCKLISTS[restriction] || [];
    return !blocked.some((term) => searchable.includes(term));
  });
}

export function filterRecipesForDiet(recipes = [], preferences = {}) {
  return recipes.filter((recipe) => recipeMatchesDiet(recipe, preferences));
}

// Simple relevance-scored ingredient matching — no external API needed.
export function suggestByIngredients(input, limit = 8, mealType = "dinner", dietaryPreferences = {}) {
  const terms = input
    .toLowerCase()
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (terms.length === 0) return [];

  const pool = filterRecipesForDiet(
    RECIPE_BOX.filter((recipe) => (recipe.mealTypes || ["lunch", "dinner"]).includes(mealType)),
    dietaryPreferences,
  );

  const scored = pool.map((recipe) => {
    let score = 0;
    for (const term of terms) {
      if (recipe.tags.some((tag) => tag.includes(term) || term.includes(tag))) score += 1;
    }
    return { ...recipe, score };
  }).filter((r) => r.score > 0);

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.slice(0, limit);
}

export function recipesByCuisine(cuisine, mealType = "dinner", dietaryPreferences = {}) {
  return filterRecipesForDiet(
    RECIPE_BOX.filter((r) => r.cuisine === cuisine && (r.mealTypes || ["lunch", "dinner"]).includes(mealType)),
    dietaryPreferences,
  );
}

export function findRecipeByTitle(title = "") {
  const normalized = title.toLowerCase().trim();
  if (!normalized) return null;
  return RECIPE_BOX.find((recipe) => recipe.title.toLowerCase() === normalized)
    || RECIPE_BOX.find((recipe) => normalized.includes(recipe.title.toLowerCase()) || recipe.title.toLowerCase().includes(normalized))
    || null;
}

const RECIPE_API_CUISINES = {
  "American Comfort": "american",
  Chinese: "chinese",
  Italian: "italian",
  Japanese: "japanese",
  Mexican: "mexican",
  Thai: "thai",
};

const titleCaseIngredient = (tag = "") => tag.replace(/\b\w/g, (letter) => letter.toUpperCase());

const uniqueList = (items = []) => [...new Set(items.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean))];

const RECIPE_DETAIL_OVERRIDES = {
  "salmon onigiri": {
    readyInMinutes: 25,
    servings: 4,
    ingredients: [
      "2 cups warm cooked short-grain rice",
      "1 cup cooked salmon, flaked",
      "4 nori sheets or strips",
      "1 tablespoon soy sauce",
      "1 teaspoon toasted sesame seeds",
      "A pinch of salt",
    ],
    instructions: [
      "Flake the salmon into a bowl, then season it with soy sauce and sesame seeds.",
      "Wet your hands and rub a tiny pinch of salt across your palms so the rice does not stick.",
      "Scoop warm rice into one palm, press a small dent in the centre, and add the salmon filling.",
      "Cover with a little more rice, then gently press into a triangle or rounded parcel.",
      "Wrap with nori just before eating so it stays crisp.",
    ],
  },
  "miso soup + rice": {
    readyInMinutes: 20,
    servings: 4,
    ingredients: [
      "4 cups dashi or light vegetable broth",
      "3 tablespoons miso paste",
      "200 g tofu, cubed",
      "2 green onions, sliced",
      "2 cups cooked rice",
      "Optional: wakame or spinach",
    ],
    instructions: [
      "Warm the broth in a pot until steaming, but do not let it boil hard.",
      "Whisk the miso paste with a ladle of warm broth in a small bowl until smooth.",
      "Stir the loosened miso back into the pot, then add tofu and greens.",
      "Heat gently for 2 to 3 minutes so the tofu warms through.",
      "Serve the soup with warm rice on the side.",
    ],
  },
  "kung pao chicken": {
    readyInMinutes: 30,
    servings: 4,
    ingredients: [
      "1 lb chicken, cut into bite-size pieces",
      "2 bell peppers, chopped",
      "2 cloves garlic, minced",
      "1 tablespoon soy sauce",
      "1 tablespoon rice vinegar",
      "1/3 cup roasted peanuts",
      "Cooked rice, for serving",
    ],
    instructions: [
      "Whisk soy sauce, rice vinegar, and a splash of water into a quick sauce.",
      "Cook the chicken in a hot pan until browned and cooked through.",
      "Add bell peppers and garlic, then stir-fry until the vegetables are just tender.",
      "Pour in the sauce and toss until glossy.",
      "Finish with peanuts and serve over warm rice.",
    ],
  },
};

export function recipeSearchProfileForMeal(mealOrTitle = "", fallbackSlot = "dinner", dietaryPreferences = {}) {
  const title = typeof mealOrTitle === "string" ? mealOrTitle : mealOrTitle?.title || "";
  const slot = typeof mealOrTitle === "string" ? fallbackSlot : mealOrTitle?.slot || fallbackSlot;
  const recipe = findRecipeByTitle(title);
  const cleanTitle = title
    .replace(/\s+/g, " ")
    .replace(/\b(open|pick)\s+(breakfast|lunch|dinner|something|slot)\b/gi, "")
    .trim();

  const sideSplit = cleanTitle.split(/\s*[+&]\s*|\s+with\s+/i).map((part) => part.trim()).filter(Boolean);
  const canonicalQuery = recipe?.title?.includes("+") ? sideSplit[0] : recipe?.title || sideSplit[0] || cleanTitle;
  const ingredients = uniqueList((recipe?.tags || groceryItemsForMealTitle(title).map((item) => item.name)).map(titleCaseIngredient));
  const cuisine = RECIPE_API_CUISINES[recipe?.cuisine] || (/greek|falafel|chickpea|feta/i.test(cleanTitle) ? "greek" : "");
  const mealType = /soup/i.test(canonicalQuery) ? "soup"
    : slot === "breakfast" ? "breakfast"
      : slot === "lunch" || slot === "dinner" ? "main"
        : "";

  const alternateQueries = uniqueList([
    cleanTitle,
    cleanTitle.replace(/\s*[+&]\s*/g, " "),
    cleanTitle.replace(/\s+and\s+/gi, " "),
    sideSplit.length > 1 ? sideSplit.join(" ") : "",
    recipe?.cuisine && canonicalQuery ? `${recipe.cuisine} ${canonicalQuery}` : "",
    ingredients.length >= 2 ? `${canonicalQuery} ${ingredients.slice(0, 2).join(" ")}` : "",
  ]);

  const diet = normaliseDietaryPreferences(dietaryPreferences);

  return {
    query: cleanTitle,
    canonicalQuery,
    alternateQueries,
    ingredients,
    cuisine,
    mealType,
    searchIn: "both",
    dietaryPreferences: diet,
    dietaryRestrictions: diet.restrictions,
    avoidIngredients: diet.avoidIngredients,
    dietaryNotes: diet.notes,
  };
}

export function groceryItemsForMealTitle(title = "") {
  const recipe = findRecipeByTitle(title);
  return (recipe?.tags || []).map((tag) => ({
    name: titleCaseIngredient(tag),
    category: /chicken|beef|pork|salmon|shrimp|turkey|tofu/i.test(tag) ? "Meat & Seafood"
      : /egg|eggs/i.test(tag) ? "Dairy & Eggs"
      : /rice|pasta|spaghetti|noodles|bread|tortillas|buns|oats/i.test(tag) ? "Pantry"
        : /milk|cheese|yogurt|feta|mozzarella|parmesan|cream|butter/i.test(tag) ? "Dairy & Eggs"
          : /tomato|cucumber|onion|broccoli|pepper|carrot|zucchini|spinach|basil|cilantro|lime|lemon|potatoes/i.test(tag) ? "Produce"
            : "Other",
    quantity: 1,
    unit: "",
  }));
}

export function recipeDetailForTitle(title = "") {
  const recipe = findRecipeByTitle(title);
  if (!recipe) return null;
  const override = RECIPE_DETAIL_OVERRIDES[recipe.title.toLowerCase()];
  const ingredients = override?.ingredients || recipe.tags.map((tag) => tag.replace(/\b\w/g, (letter) => letter.toUpperCase()));
  return {
    ...recipe,
    ingredients,
    readyInMinutes: override?.readyInMinutes || (recipe.mealTypes?.includes("breakfast") ? 15 : 35),
    servings: override?.servings || 4,
    instructions: override?.instructions || [
      "Prep the ingredients and set out what you need.",
      `Cook the main ingredients for ${recipe.title.toLowerCase()} until tender and warmed through.`,
      "Season to taste, add sides if needed, and serve family-style.",
    ],
  };
}

export function suggestMealsFromGroceries(groceries = [], limit = 4, mealType = "dinner", dietaryPreferences = {}) {
  const input = groceries
    .filter((item) => !item.checked)
    .map((item) => item.name)
    .join(", ");
  return suggestByIngredients(input, limit, mealType, dietaryPreferences);
}

export function groceryItemsForMealPlan(meals = [], existingGroceries = []) {
  const existing = new Set(existingGroceries.filter((item) => !item.checked).map((item) => item.name.toLowerCase()));
  const seen = new Set(existing);
  return meals
    .filter((meal) => meal.title)
    .flatMap((meal) => groceryItemsForMealTitle(meal.title))
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
