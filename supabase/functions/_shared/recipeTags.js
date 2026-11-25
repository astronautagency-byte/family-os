export const DIETARY_RECIPE_TAGS = ['Vegan', 'Vegetarian', 'Gluten-free', 'Dairy-free', 'Nut-free', 'Egg-free', 'Pescatarian', 'High-protein'];
const canonical = new Map(DIETARY_RECIPE_TAGS.map(tag => [tag.toLowerCase().replace(/[\s_-]/g, ''), tag]));
export function normalizeRecipeTags(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;]/) : [];
  const seen = new Set();
  return values.flatMap(value => {
    if (typeof value !== 'string') return [];
    const clean = value.replace(/\p{Cc}/gu, '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!clean) return [];
    const tag = canonical.get(clean.toLowerCase().replace(/[\s_-]/g, '')) || clean;
    if (seen.has(tag.toLowerCase()) || seen.size >= 20) return [];
    seen.add(tag.toLowerCase());
    return [tag];
  });
}
export function recipeTags(recipe = {}) {
  // An explicit saved selection (including []) overrides imported metadata.
  if (Object.prototype.hasOwnProperty.call(recipe, 'tags')) return normalizeRecipeTags(recipe.tags);
  return normalizeRecipeTags([
    ...normalizeRecipeTags(recipe.diets),
    ...normalizeRecipeTags(recipe.dietaryTags),
    ...[['vegan', 'Vegan'], ['vegetarian', 'Vegetarian'], ['glutenFree', 'Gluten-free'], ['dairyFree', 'Dairy-free']]
      .filter(([flag]) => recipe[flag] === true).map(([, tag]) => tag),
  ]);
}
