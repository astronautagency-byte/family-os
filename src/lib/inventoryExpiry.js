const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────
// Smart Expiry Date Suggestions — Based on USDA FoodSafety.gov guidelines
// and typical household storage practices
// ─────────────────────────────────────────────────────────────────────────

// Shelf life database: category → { fridge, freezer, pantry } (in days)
// Sources: USDA FoodKeeper, FoodSafety.gov, FDA guidelines
const SHELF_LIFE_DB = {
  // Dairy & Eggs
  "milk": { fridge: 7, freezer: 90, pantry: 0 },
  "cream": { fridge: 7, freezer: 60, pantry: 0 },
  "yogurt": { fridge: 14, freezer: 60, pantry: 0 },
  "cheese": { fridge: 21, freezer: 180, pantry: 0 },
  "butter": { fridge: 90, freezer: 365, pantry: 0 },
  "eggs": { fridge: 35, freezer: 0, pantry: 0 },
  "cream cheese": { fridge: 14, freezer: 60, pantry: 0 },
  "sour cream": { fridge: 14, freezer: 0, pantry: 0 },
  "cottage cheese": { fridge: 10, freezer: 0, pantry: 0 },
  "half and half": { fridge: 7, freezer: 60, pantry: 0 },
  
  // Meat & Seafood
  "chicken": { fridge: 2, freezer: 270, pantry: 0 },
  "chicken breast": { fridge: 2, freezer: 270, pantry: 0 },
  "chicken thigh": { fridge: 2, freezer: 270, pantry: 0 },
  "ground beef": { fridge: 2, freezer: 120, pantry: 0 },
  "beef steak": { fridge: 5, freezer: 365, pantry: 0 },
  "pork": { fridge: 3, freezer: 180, pantry: 0 },
  "pork chops": { fridge: 3, freezer: 180, pantry: 0 },
  "sausage": { fridge: 2, freezer: 60, pantry: 0 },
  "bacon": { fridge: 7, freezer: 30, pantry: 0 },
  "ham": { fridge: 7, freezer: 60, pantry: 0 },
  "turkey": { fridge: 2, freezer: 270, pantry: 0 },
  "fish": { fridge: 2, freezer: 180, pantry: 0 },
  "salmon": { fridge: 2, freezer: 180, pantry: 0 },
  "shrimp": { fridge: 2, freezer: 180, pantry: 0 },
  "tuna": { fridge: 2, freezer: 180, pantry: 0 },
  "deli meat": { fridge: 5, freezer: 60, pantry: 0 },
  "hot dogs": { fridge: 14, freezer: 60, pantry: 0 },
  
  // Produce - Vegetables
  "lettuce": { fridge: 7, freezer: 0, pantry: 0 },
  "spinach": { fridge: 5, freezer: 60, pantry: 0 },
  "kale": { fridge: 7, freezer: 60, pantry: 0 },
  "broccoli": { fridge: 7, freezer: 365, pantry: 0 },
  "cauliflower": { fridge: 7, freezer: 365, pantry: 0 },
  "carrots": { fridge: 30, freezer: 365, pantry: 14 },
  "celery": { fridge: 14, freezer: 0, pantry: 0 },
  "cucumber": { fridge: 7, freezer: 0, pantry: 0 },
  "tomatoes": { fridge: 7, freezer: 60, pantry: 5 },
  "bell peppers": { fridge: 14, freezer: 365, pantry: 0 },
  "onions": { fridge: 30, freezer: 365, pantry: 60 },
  "potatoes": { fridge: 0, freezer: 0, pantry: 30 },
  "sweet potatoes": { fridge: 0, freezer: 0, pantry: 21 },
  "garlic": { fridge: 30, freezer: 365, pantry: 60 },
  "ginger": { fridge: 21, freezer: 180, pantry: 0 },
  "mushrooms": { fridge: 7, freezer: 365, pantry: 0 },
  "zucchini": { fridge: 7, freezer: 365, pantry: 0 },
  "corn": { fridge: 5, freezer: 365, pantry: 0 },
  "green beans": { fridge: 7, freezer: 365, pantry: 0 },
  "asparagus": { fridge: 5, freezer: 365, pantry: 0 },
  "cabbage": { fridge: 14, freezer: 365, pantry: 0 },
  "brussels sprouts": { fridge: 7, freezer: 365, pantry: 0 },
  
  // Produce - Fruits
  "apples": { fridge: 45, freezer: 365, pantry: 14 },
  "bananas": { fridge: 7, freezer: 60, pantry: 5 },
  "oranges": { fridge: 21, freezer: 0, pantry: 14 },
  "lemons": { fridge: 21, freezer: 0, pantry: 14 },
  "limes": { fridge: 21, freezer: 0, pantry: 14 },
  "grapes": { fridge: 10, freezer: 60, pantry: 0 },
  "strawberries": { fridge: 7, freezer: 60, pantry: 0 },
  "blueberries": { fridge: 10, freezer: 60, pantry: 0 },
  "raspberries": { fridge: 5, freezer: 60, pantry: 0 },
  "blackberries": { fridge: 5, freezer: 60, pantry: 0 },
  "avocado": { fridge: 5, freezer: 60, pantry: 3 },
  "peaches": { fridge: 5, freezer: 60, pantry: 3 },
  "plums": { fridge: 7, freezer: 60, pantry: 3 },
  "cherries": { fridge: 10, freezer: 60, pantry: 0 },
  "pineapple": { fridge: 5, freezer: 60, pantry: 0 },
  "mango": { fridge: 7, freezer: 60, pantry: 3 },
  "watermelon": { fridge: 7, freezer: 0, pantry: 7 },
  "cantaloupe": { fridge: 5, freezer: 0, pantry: 3 },
  "berries": { fridge: 7, freezer: 60, pantry: 0 },
  "fruit": { fridge: 7, freezer: 60, pantry: 5 },
  
  // Bakery & Bread
  "bread": { fridge: 14, freezer: 180, pantry: 7 },
  "bagels": { fridge: 7, freezer: 180, pantry: 5 },
  "tortillas": { fridge: 14, freezer: 180, pantry: 7 },
  "pita bread": { fridge: 14, freezer: 180, pantry: 5 },
  "croissants": { fridge: 5, freezer: 60, pantry: 2 },
  "muffins": { fridge: 7, freezer: 90, pantry: 3 },
  "baguette": { fridge: 3, freezer: 90, pantry: 2 },
  
  // Deli & Prepared Foods
  "hummus": { fridge: 7, freezer: 0, pantry: 0 },
  "salsa": { fridge: 14, freezer: 60, pantry: 0 },
  "guacamole": { fridge: 3, freezer: 60, pantry: 0 },
  "dips": { fridge: 7, freezer: 0, pantry: 0 },
  "prepared salads": { fridge: 3, freezer: 0, pantry: 0 },
  "leftovers": { fridge: 4, freezer: 60, pantry: 0 },
  "soup": { fridge: 5, freezer: 90, pantry: 0 },
  "pizza": { fridge: 4, freezer: 60, pantry: 0 },
  
  // Condiments & Sauces
  "ketchup": { fridge: 365, freezer: 0, pantry: 365 },
  "mustard": { fridge: 365, freezer: 0, pantry: 365 },
  "mayonnaise": { fridge: 60, freezer: 0, pantry: 0 },
  "salad dressing": { fridge: 60, freezer: 0, pantry: 0 },
  "soy sauce": { fridge: 365, freezer: 0, pantry: 730 },
  "hot sauce": { fridge: 365, freezer: 0, pantry: 365 },
  "worcestershire sauce": { fridge: 365, freezer: 0, pantry: 730 },
  "bbq sauce": { fridge: 60, freezer: 0, pantry: 120 },
  "tomato sauce": { fridge: 7, freezer: 180, pantry: 120 },
  "pasta sauce": { fridge: 7, freezer: 180, pantry: 120 },
  "jam": { fridge: 180, freezer: 365, pantry: 365 },
  "jelly": { fridge: 180, freezer: 365, pantry: 365 },
  "peanut butter": { fridge: 180, freezer: 0, pantry: 365 },
  "olive oil": { fridge: 0, freezer: 0, pantry: 365 },
  "vegetable oil": { fridge: 0, freezer: 0, pantry: 365 },
  "vinegar": { fridge: 0, freezer: 0, pantry: 730 },
  
  // Beverages
  "juice": { fridge: 10, freezer: 90, pantry: 0 },
  "orange juice": { fridge: 10, freezer: 90, pantry: 0 },
  "almond milk": { fridge: 7, freezer: 90, pantry: 0 },
  "oat milk": { fridge: 7, freezer: 0, pantry: 0 },
  "soy milk": { fridge: 7, freezer: 90, pantry: 0 },
  "coconut milk": { fridge: 7, freezer: 90, pantry: 0 },
  "coffee": { fridge: 0, freezer: 0, pantry: 365 },
  "tea": { fridge: 0, freezer: 0, pantry: 365 },
  
  // Frozen Foods
  "frozen vegetables": { fridge: 0, freezer: 365, pantry: 0 },
  "frozen fruit": { fridge: 0, freezer: 365, pantry: 0 },
  "frozen pizza": { fridge: 0, freezer: 180, pantry: 0 },
  "frozen meals": { fridge: 0, freezer: 180, pantry: 0 },
  "ice cream": { fridge: 0, freezer: 120, pantry: 0 },
  
  // Grains & Dry Goods
  "rice": { fridge: 0, freezer: 0, pantry: 365 },
  "pasta": { fridge: 0, freezer: 0, pantry: 730 },
  "cereal": { fridge: 0, freezer: 0, pantry: 180 },
  "oats": { fridge: 0, freezer: 0, pantry: 365 },
  "flour": { fridge: 0, freezer: 365, pantry: 365 },
  "sugar": { fridge: 0, freezer: 0, pantry: 730 },
  "breadcrumbs": { fridge: 0, freezer: 0, pantry: 365 },
  "granola": { fridge: 0, freezer: 0, pantry: 180 },
  "crackers": { fridge: 0, freezer: 0, pantry: 180 },
  "chips": { fridge: 0, freezer: 0, pantry: 30 },
  
  // Canned Foods
  "canned vegetables": { fridge: 0, freezer: 0, pantry: 730 },
  "canned beans": { fridge: 0, freezer: 0, pantry: 730 },
  "canned tomatoes": { fridge: 0, freezer: 0, pantry: 730 },
  "canned fruit": { fridge: 0, freezer: 0, pantry: 545 },
  "canned tuna": { fridge: 0, freezer: 0, pantry: 730 },
  "canned chicken": { fridge: 0, freezer: 0, pantry: 730 },
  "canned soup": { fridge: 0, freezer: 0, pantry: 730 },
  "canned coconut milk": { fridge: 0, freezer: 0, pantry: 730 },
  
  // Dairy Alternatives & Specialty
  "tofu": { fridge: 7, freezer: 365, pantry: 0 },
  "tempeh": { fridge: 14, freezer: 180, pantry: 0 },
  "seitan": { fridge: 7, freezer: 180, pantry: 0 },
  "nutritional yeast": { fridge: 0, freezer: 0, pantry: 365 },
  
  // Herbs & Spices (fresh)
  "fresh herbs": { fridge: 7, freezer: 90, pantry: 0 },
  "cilantro": { fridge: 7, freezer: 90, pantry: 0 },
  "parsley": { fridge: 7, freezer: 90, pantry: 0 },
  "basil": { fridge: 5, freezer: 90, pantry: 0 },
  "mint": { fridge: 7, freezer: 90, pantry: 0 },
  "green onions": { fridge: 10, freezer: 90, pantry: 0 },
  
  // Nuts & Seeds
  "nuts": { fridge: 90, freezer: 365, pantry: 90 },
  "peanuts": { fridge: 90, freezer: 365, pantry: 90 },
  "almonds": { fridge: 90, freezer: 365, pantry: 90 },
  "walnuts": { fridge: 90, freezer: 365, pantry: 90 },
  "cashews": { fridge: 90, freezer: 365, pantry: 90 },
  "seeds": { fridge: 90, freezer: 365, pantry: 90 },
  "chia seeds": { fridge: 90, freezer: 365, pantry: 365 },
  "flax seeds": { fridge: 90, freezer: 365, pantry: 365 },
  "hemp seeds": { fridge: 90, freezer: 365, pantry: 90 },
  
  // Beverages (alcoholic)
  "beer": { fridge: 180, freezer: 0, pantry: 180 },
  "wine": { fridge: 14, freezer: 0, pantry: 365 },
  "white wine": { fridge: 7, freezer: 0, pantry: 0 },
  "red wine": { fridge: 5, freezer: 0, pantry: 0 },
  "champagne": { fridge: 3, freezer: 0, pantry: 0 },
  "spirits": { fridge: 0, freezer: 0, pantry: 3650 },
};

// Category-based fallback shelf life (in days for fridge)
const CATEGORY_SHELF_LIFE = {
  "Produce": { fridge: 7, freezer: 60, pantry: 5 },
  "Dairy & Eggs": { fridge: 14, freezer: 60, pantry: 0 },
  "Meat & Seafood": { fridge: 3, freezer: 180, pantry: 0 },
  "Bakery": { fridge: 10, freezer: 180, pantry: 5 },
  "Deli & Prepared Foods": { fridge: 5, freezer: 60, pantry: 0 },
  "Condiments": { fridge: 90, freezer: 0, pantry: 365 },
  "Beverages": { fridge: 10, freezer: 90, pantry: 0 },
  "Frozen": { fridge: 0, freezer: 180, pantry: 0 },
  "Grains & Dry Goods": { fridge: 0, freezer: 0, pantry: 365 },
  "Canned Foods": { fridge: 0, freezer: 0, pantry: 730 },
  "Herbs & Spices": { fridge: 7, freezer: 90, pantry: 365 },
  "Nuts & Seeds": { fridge: 90, freezer: 365, pantry: 90 },
  "Other": { fridge: 7, freezer: 60, pantry: 14 },
};

/**
 * Get smart expiry date suggestion based on item name, category, and location
 * @param {string} itemName - The name of the item
 * @param {string} category - The category of the item
 * @param {string} location - Where it's stored (fridge, freezer, pantry)
 * @returns {{ days: number, source: string, label: string } | null}
 */
export function suggestExpiryDate(itemName, category, location = "fridge") {
  if (!itemName) return null;
  
  const normalizedName = itemName.toLowerCase().trim();
  const normalizedCategory = category || "Other";
  
  // Try exact match first
  let shelfLife = SHELF_LIFE_DB[normalizedName];
  
  // Try partial match if no exact match
  if (!shelfLife) {
    for (const [key, value] of Object.entries(SHELF_LIFE_DB)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        shelfLife = value;
        break;
      }
    }
  }
  
  // Fall back to category-based suggestion
  if (!shelfLife) {
    shelfLife = CATEGORY_SHELF_LIFE[normalizedCategory] || CATEGORY_SHELF_LIFE["Other"];
  }
  
  if (!shelfLife) return null;
  
  const days = shelfLife[location] || shelfLife.fridge || 7;
  if (days === 0) return null;
  
  // Determine source of suggestion
  let source = "category";
  if (SHELF_LIFE_DB[normalizedName]) {
    source = "exact";
  } else if (shelfLife !== CATEGORY_SHELF_LIFE[normalizedCategory]) {
    source = "partial";
  }
  
  // Generate human-readable label
  let label;
  if (days === 1) {
    label = "Use tomorrow";
  } else if (days <= 7) {
    label = `Use within ${days} days`;
  } else if (days <= 30) {
    label = `Good for ${Math.round(days / 7)} weeks`;
  } else if (days <= 365) {
    const months = Math.round(days / 30);
    label = `Good for ${months} month${months === 1 ? "" : "s"}`;
  } else {
    const years = Math.round(days / 365);
    label = `Good for ${years} year${years === 1 ? "" : "s"}`;
  }
  
  return { days, source, label };
}

/**
 * Get suggested expiry date as a Date object
 * @param {string} itemName - The name of the item
 * @param {string} category - The category of the item  
 * @param {string} location - Where it's stored (fridge, freezer, pantry)
 * @returns {Date | null}
 */
export function getSuggestedExpiryDate(itemName, category, location = "fridge") {
  const suggestion = suggestExpiryDate(itemName, category, location);
  if (!suggestion) return null;
  
  const now = new Date();
  const suggested = new Date(now);
  suggested.setDate(suggested.getDate() + suggestion.days);
  return suggested;
}

/**
 * Get shelf life info for display purposes
 * @param {string} itemName - The name of the item
 * @param {string} category - The category of the item
 * @returns {{ fridge: number, freezer: number, pantry: number } | null}
 */
export function getShelfLifeInfo(itemName, category) {
  const normalizedName = itemName.toLowerCase().trim();
  const normalizedCategory = category || "Other";
  
  // Try exact match
  let shelfLife = SHELF_LIFE_DB[normalizedName];
  
  // Try partial match
  if (!shelfLife) {
    for (const [key, value] of Object.entries(SHELF_LIFE_DB)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        shelfLife = value;
        break;
      }
    }
  }
  
  // Fall back to category
  if (!shelfLife) {
    shelfLife = CATEGORY_SHELF_LIFE[normalizedCategory] || CATEGORY_SHELF_LIFE["Other"];
  }
  
  return shelfLife || null;
}

// Normalize any supported expiry serialization to a local-noon Date for the
// calendar day it represents. Accepts the Postgres/DateField bare date
// (YYYY-MM-DD) plus full ISO datetimes and timestamps that older app
// versions and legacy local caches left behind. Anything unparseable
// returns null so callers can fall back to "no date" behavior.
export function toLocalDay(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  }
  const text = String(value);
  // Bare date (Postgres date / DateField) — local calendar day.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (bare) return new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]), 12);
  // Full ISO datetimes: the calendar day is the date part of the string
  // itself, regardless of timezone — a "2026-08-25T00:00:00Z" legacy value
  // must stay Aug 25 even where that instant is the 24th locally.
  const iso = /^(\d{4})-(\d{2})-(\d{2})T/.exec(text);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
  return null;
}

// Whole calendar days between expiry and today (negative when already past).
export function daysUntilExpiry(expiresOn, now = new Date()) {
  const expiry = toLocalDay(expiresOn);
  if (!expiry) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((expiry.getTime() - today.getTime()) / DAY_MS);
}

export function inventoryExpiryStatus(item, now = new Date(), warningDays = 3) {
  const days = daysUntilExpiry(item?.expiresOn, now);
  if (days === null || Number(item?.quantity || 0) <= 0) return null;
  if (days <= 0) return { state: "expired", days, label: "Passed", urgency: 0 };
  if (days <= warningDays) return { state: "soon", days, label: `Use within ${days} day${days === 1 ? "" : "s"}`, urgency: 2 + days };
  return null;
}

// Shelf-life progress toward expiry: 0% on the day the item was added, 100%
// once the expiry day arrives. Percent measures elapsed time from when the
// item entered the kitchen (or a 7-day window when the add date is unknown),
// so the fill grows as the item ages, matching the "X days left" label
// rendered next to it.
export function inventoryExpiryProgress(item, now = new Date()) {
  const expiry = toLocalDay(item?.expiresOn);
  if (!expiry) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const added = item?.createdAt ? new Date(item.createdAt) : null;
  const validAdded = added && !Number.isNaN(added.getTime()) && added < expiry;
  const start = validAdded
    ? new Date(added.getFullYear(), added.getMonth(), added.getDate(), 12)
    : new Date(expiry.getTime() - 7 * DAY_MS);
  const total = Math.max(DAY_MS, expiry.getTime() - start.getTime());
  const elapsed = Math.max(0, today.getTime() - start.getTime());
  const percent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  const rawDaysRemaining = Math.round((expiry.getTime() - today.getTime()) / DAY_MS);
  const daysRemaining = rawDaysRemaining <= 0 ? -1 : rawDaysRemaining;
  return { percent, remainingPercent: 100 - percent, daysRemaining };
}

export function expiringInventory(items, now = new Date(), warningDays = 3) {
  return (items || [])
    .map((item) => ({ ...item, expiry: inventoryExpiryStatus(item, now, warningDays) }))
    .filter((item) => item.expiry)
    .sort((left, right) => left.expiry.urgency - right.expiry.urgency || left.name.localeCompare(right.name));
}