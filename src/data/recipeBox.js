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

// Simple relevance-scored ingredient matching — no external API needed.
export function suggestByIngredients(input, limit = 8, mealType = "dinner") {
  const terms = input
    .toLowerCase()
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (terms.length === 0) return [];

  const scored = RECIPE_BOX.filter((recipe) => (recipe.mealTypes || ["lunch", "dinner"]).includes(mealType)).map((recipe) => {
    let score = 0;
    for (const term of terms) {
      if (recipe.tags.some((tag) => tag.includes(term) || term.includes(tag))) score += 1;
    }
    return { ...recipe, score };
  }).filter((r) => r.score > 0);

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.slice(0, limit);
}

export function recipesByCuisine(cuisine, mealType = "dinner") {
  return RECIPE_BOX.filter((r) => r.cuisine === cuisine && (r.mealTypes || ["lunch", "dinner"]).includes(mealType));
}
