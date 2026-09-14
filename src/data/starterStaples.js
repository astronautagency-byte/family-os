export const STAPLE_PACKS = {
  Essentials: [['Eggs',1,'dozen'],['Bread',1,'loaf'],['Rice',1,'kg'],['Flour',1,'kg'],['Milk',2,'L'],['Butter',1,'pack'],['Olive oil',1,'bottle']],
  'Plant-based': [['Oat milk',1,'L'],['Chickpeas',2,'can'],['Lentils',1,'bag'],['Tofu',2,'pack'],['Oats',1,'bag']],
  Mediterranean: [['Pasta',1,'pack'],['Canned tomatoes',2,'can'],['Chickpeas',2,'can'],['Olive oil',1,'bottle'],['Garlic',1,'each']],
  'South Asian': [['Basmati rice',1,'kg'],['Lentils',1,'bag'],['Cumin',1,'jar'],['Turmeric',1,'jar'],['Chickpeas',2,'can']],
  'East Asian': [['Rice',1,'kg'],['Soy sauce',1,'bottle'],['Noodles',1,'pack'],['Tofu',2,'pack'],['Sesame oil',1,'bottle']],
};
export function mergeStarterStaples(existing, additions) {
  const seen=new Set(existing.map(item=>item.name.trim().toLowerCase()));
  return [...existing,...additions.filter(item=>{const key=item.name.trim().toLowerCase();if(seen.has(key))return false;seen.add(key);return true;})];
}
