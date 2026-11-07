// Rank only recipes already returned by the filtered search. No household
// history is sent to the recipe provider and no dietary filters are bypassed.
const STOP = new Set(['the','and','with','for','from','free','recipe','easy','homemade','family','style','a','of','in','on','to','or','meal','dinner','lunch','breakfast']);
const words = (text) => new Set(String(text || '').toLowerCase().match(/[a-z]{3,}/g)?.filter(word => !STOP.has(word)) || []);
const titleKey = (text) => String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function rankMealIdeas(recipes, { saved = [], planned = [], cooked = [] } = {}) {
  const signals = [
    ...saved.map(item => ({ title: item.title, weight: 3, reason: 'Similar to a saved recipe' })),
    ...cooked.map(item => ({ title: item.title, weight: 2, reason: 'Similar to a meal you cooked' })),
    ...planned.map(item => ({ title: item.title, weight: 1, reason: 'Similar to a planned meal' })),
  ].filter(item => titleKey(item.title));
  return recipes.map((recipe, index) => {
    const candidate = words(recipe.title);
    let score = 0, reason = '';
    for (const signal of signals) {
      const source = words(signal.title);
      const shared = [...candidate].filter(word => source.has(word)).length;
      const match = titleKey(recipe.title) === titleKey(signal.title) ? 3 : shared >= 2 ? 2 : shared === 1 && candidate.size <= 3 && source.size <= 3 ? 1 : 0;
      const value = match * signal.weight;
      if (value > score) { score = value; reason = signal.reason; }
    }
    return { recipe, index, score, reason };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
}
