import test from 'node:test';
import assert from 'node:assert/strict';
import { rankMealIdeas } from '../src/lib/mealPersonalization.js';

test('prioritizes matching saved and cooked meals without changing the available filtered recipes', () => {
  const recipes = [{ title: 'Bean tacos' }, { title: 'Chicken noodle soup' }, { title: 'Lemon chicken' }];
  const ranked = rankMealIdeas(recipes, { saved: [{ title: 'Chicken noodle soup' }], cooked: [{ title: 'Lemon chicken' }] });
  assert.deepEqual(ranked.map(x => x.recipe.title), ['Chicken noodle soup', 'Lemon chicken', 'Bean tacos']);
  assert.equal(ranked[0].reason, 'Similar to a saved recipe');
  assert.equal(ranked[1].reason, 'Similar to a meal you cooked');
});

test('preserves provider order without matching history and handles missing data', () => {
  const recipes = [{ title: 'Pasta primavera' }, { title: 'Bean tacos' }];
  assert.deepEqual(rankMealIdeas(recipes, { planned: [{ title: 'Rice bowl' }] }).map(x => x.recipe), recipes);
  assert.deepEqual(rankMealIdeas([], {}), []);
});
