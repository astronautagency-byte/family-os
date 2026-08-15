export const SHARED_RECIPE_KEY = "famos:shared-recipe:v1";

const RECIPE_HINT = /\b(recipe|ingredients?|directions?|instructions?|servings?|prep time|cook time)\b/i;
const RECIPE_HOST = /(allrecipes|foodnetwork|epicurious|seriouseats|bonappetit|nytimes|simplyrecipes|tasty|delish|spoonacular|budgetbytes|recipetineats)/i;

export function classifySharedContent({ title = "", text = "", url = "" } = {}) {
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { /* plain text share */ }
  return RECIPE_HINT.test(`${title} ${text}`) || RECIPE_HOST.test(hostname) ? "recipe" : "list";
}

export function sharedRecipeTitle({ title = "", text = "", url = "" } = {}) {
  const cleanTitle = String(title).trim();
  if (cleanTitle && !/^https?:\/\//i.test(cleanTitle)) return cleanTitle;
  const cleanText = String(text).replace(url, "").trim();
  if (cleanText && cleanText.length <= 120) return cleanText;
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "Shared recipe";
    return decodeURIComponent(slug).replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch { return "Shared recipe"; }
}
