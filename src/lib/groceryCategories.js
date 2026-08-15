const CATEGORY_RULES = [
  ["Produce", /\b(apple|apples|banana|bananas|berry|berries|blueberry|blueberries|strawberry|strawberries|raspberry|raspberries|grape|grapes|orange|oranges|lemon|lemons|lime|limes|avocado|avocados|tomato|tomatoes|lettuce|spinach|kale|broccoli|carrot|carrots|celery|pepper|peppers|onion|onions|potato|potatoes|cucumber|cucumbers|mushroom|mushrooms|cilantro|parsley|garlic|ginger|zucchini|courgette|cabbage|corn|peas)\b/i],
  ["Bakery", /\b(bread|sourdough|bagel|bagels|bun|buns|roll|rolls|croissant|croissants|muffin|muffins|pita|naan|tortilla|tortillas)\b/i],
  ["Dairy & Eggs", /\b(milk|cream|half and half|cheese|cheddar|mozzarella|parmesan|yogurt|yoghurt|butter|eggs?|cottage cheese|sour cream|cream cheese)\b/i],
  ["Meat & Seafood", /\b(chicken|beef|steak|pork|turkey|ham|bacon|sausage|salmon|tuna|shrimp|prawn|prawns|fish|cod|lamb|ground meat|ground beef|ground turkey)\b/i],
  ["Breakfast & Cereal", /\b(cereal|granola|oatmeal|oats|pancake mix|waffles|waffle|breakfast bars?)\b/i],
  ["Canned & Jarred", /\b(canned|can of|jar of|tomato sauce|pickles|olives|jam|jelly|chickpeas|black beans|kidney beans|soup can)\b/i],
  ["Pasta, Rice & Grains", /\b(pasta|spaghetti|penne|fusilli|macaroni|rice|quinoa|couscous|noodles|ramen|grain|grains)\b/i],
  ["Condiments & Sauces", /\b(ketchup|mustard|mayo|mayonnaise|hot sauce|bbq sauce|barbecue sauce|soy sauce|salsa|dressing|vinaigrette|marinade|pesto|oyster sauce)\b/i],
  ["Spices & Baking", /\b(flour|sugar|starch|cornstarch|baking soda|baking powder|yeast|vanilla|cinnamon|spice|spices|salt|pepper|chocolate chips)\b/i],
  ["Frozen", /\b(frozen|ice cream|popsicles|frozen pizza|frozen peas|frozen berries)\b/i],
  ["Beverages", /\b(water|sparkling water|juice|soda|pop|coffee|tea|kombucha|sports drink|drink|beverage)\b/i],
  ["Household & Cleaning", /\b(dish soap|dishwasher|detergent|laundry|cleaner|cleaning|bleach|spray|sponges|sponge|trash bags|garbage bags)\b/i],
  ["Paper & Disposable", /\b(paper towels|toilet paper|tissues|napkins|paper plates|paper cups|foil|plastic wrap|parchment)\b/i],
  ["Pantry", /\b(oil|olive oil|sesame oil|vinegar|beans|lentils|peanut butter|almond butter|honey|maple syrup|broth|stock)\b/i],
];

export function categorizeGroceryItem(name = "", fallback = "Other") {
  const explicit = String(fallback || "").trim();
  if (explicit && explicit !== "Other") return explicit;
  const normalized = String(name || "").replace(/[_-]+/g, " ").trim();
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(normalized))?.[0] || explicit || "Other";
}

