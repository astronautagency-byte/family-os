const ids = [
  'apple','orange','cherries','lemon','pear','banana','grapes','watermelon',
  'broccoli','carrot','garlic','onion','potato','tomato','pepper','eggplant',
  'avocado','lettuce','cucumber','mushroom','strawberry','pineapple','pumpkin','corn',
  'milk','eggs','cheese','butter','yogurt','bread','croissant','sandwich',
  'steak','chicken','fish','shrimp','bacon','sausage','can','pasta',
  'rice','cookie','cereal','juice','frozen','cleaning','baby','pet',
];
// Optical boundaries account for natural spacing in the original generated atlas.
const xs = [0,190,370,550,730,910,1090,1270,1448];
const ys = [0,212,385,555,723,884,1086];
export const GROCERY_ICONS = Object.fromEntries(ids.map((id, index) => {
  const col = index % 8, row = Math.floor(index / 8);
  return [id, { id, viewBox: `${xs[col]} ${ys[row]} ${xs[col + 1] - xs[col]} ${ys[row + 1] - ys[row]}` }];
}));
export const GROCERY_CATEGORY_ICONS = {
  Produce:'carrot', Bakery:'bread', 'Deli & Prepared Foods':'sandwich',
  'Dairy & Eggs':'milk', 'Meat & Seafood':'steak', 'Breakfast & Cereal':'cereal',
  Pantry:'rice', 'Canned & Jarred':'can', 'Pasta, Rice & Grains':'pasta',
  'Condiments & Sauces':'can', 'Spices & Baking':'rice', 'Snacks & Candy':'cookie',
  Beverages:'juice', 'International Foods':'rice', Frozen:'frozen',
  'Beer, Wine & Spirits':'juice', 'Health & Personal Care':'cleaning',
  Baby:'baby', 'Pet Supplies':'pet', 'Household & Cleaning':'cleaning',
  'Paper & Disposable':'cereal', Household:'cleaning', Other:'cereal',
};
const aliases = {
  cherries:['cherry'], eggs:['egg'], potato:['potatoes'], tomato:['tomatoes'],
  strawberry:['strawberries'], fish:['salmon','tuna','cod','tilapia'],
  chicken:['turkey','drumstick'], steak:['beef','pork','ham'],
  cheese:['cheddar','mozzarella','parmesan'], yogurt:['yoghurt'],
  bread:['bagel','toast','bun','buns'], pasta:['spaghetti','macaroni','noodles'],
  juice:['water','soda','lemonade'], cleaning:['detergent','soap','cleaner'],
  pet:['dog food','cat food'], baby:['formula'], cookie:['cookies','biscuits'],
  pepper:['capsicum'], lettuce:['salad','spinach'], can:['beans','chickpeas'],
};
const matchers = ids.map(id => [id, new RegExp(`\\b(?:${[id, `${id}s`, ...(aliases[id] || [])].join('|')})\\b`, 'i')]);
export function groceryIllustrationKind(name = '', category = '') {
  const text = String(name || '');
  if (/\b(dog food|cat food|pet food)\b/i.test(text)) return 'pet';
  if (/\b(baby formula|baby bottle)\b/i.test(text)) return 'baby';
  return matchers.find(([, pattern]) => pattern.test(text))?.[0] || GROCERY_CATEGORY_ICONS[category] || 'cereal';
}
