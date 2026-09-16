export const PACK_KINDS = {tasks:'Task list', routines:'Routines', recipes:'Recipes', meals:'Meal plan'};
export const PACK_CADENCES = ['daily','weekdays','weekly','monthly'];
export const PACK_TOKEN = /^[a-f0-9]{64}$/;
export function packLink(token) {
  // Fragment keeps the bearer token out of HTTP access logs and referrers.
  return `${window.location.origin}/packs#${token}`;
}
export function publicSource(value) {
  try { const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash ? u.href : ''; } catch { return ''; }
}
const cleanText=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const lines=value=>Array.isArray(value)?value.filter(x=>typeof x==='string').map(x=>cleanText(x,1000)).filter(Boolean).slice(0,60):[];
export function cleanPackRecipe(recipe={}) {
  return {ingredients:lines(recipe.ingredients),instructions:lines(recipe.instructions),
    servings:Number.isFinite(Number(recipe.servings))&&Number(recipe.servings)>0?Math.min(Number(recipe.servings),1000):null,
    readyInMinutes:Number.isFinite(Number(recipe.readyInMinutes))&&Number(recipe.readyInMinutes)>0?Math.min(Number(recipe.readyInMinutes),10000):null,
    sourceUrl:publicSource(recipe.sourceUrl),sourceName:cleanText(recipe.sourceName,200)};
}
export function cleanPack(pack) {
  if(!Object.hasOwn(PACK_KINDS,pack?.kind)) throw Error('Choose a pack type.');
  const title=cleanText(pack.title,80);
  if(!title) throw Error('Give your pack a name.');
  if(!Array.isArray(pack.items)||!pack.items.length||pack.items.length>30) throw Error('Choose 1–30 items.');
  return {version:1,kind:pack.kind,title,items:pack.items.map(item=>{
    const result={title:cleanText(item.title,200)};
    if(!result.title) throw Error('Every item needs a name.');
    if(pack.kind==='routines') {
      if(!PACK_CADENCES.includes(item.cadence)) throw Error('Choose a supported repeat schedule.');
      result.cadence=item.cadence;
      result.steps=lines(item.steps).slice(0,12);
    }
    if(pack.kind==='recipes') {
      result.recipe=cleanPackRecipe(item.recipe);
      if(!result.recipe.ingredients.length||!result.recipe.instructions.length) throw Error('Each recipe needs ingredients and steps.');
    }
    if(pack.kind==='meals') {
      if(!Number.isInteger(item.day)||item.day<0||item.day>13||!['breakfast','lunch','dinner'].includes(item.slot)) throw Error('Choose a day and meal slot within two weeks.');
      result.day=item.day;result.slot=item.slot;
      if(item.recipe?.ingredients?.length&&item.recipe?.instructions?.length) result.recipe=cleanPackRecipe(item.recipe);
    }
    return result;
  })};
}
export function packCandidates(kind, rows) {
  const dates=rows.map(r=>r.meal_date).filter(Boolean).sort();
  return rows.filter(r=>kind!=='routines'||PACK_CADENCES.includes(r.recurrence?.replace('routine:',''))).map(row=>({
    id:row.id,title:row.title,
    ...(kind==='routines'?{cadence:row.recurrence.replace('routine:',''),steps:[]}:{}),
    ...(kind==='recipes'?{recipe:cleanPackRecipe(row.recipe)}:{}),
    ...(kind==='meals'?{day:Math.round((Date.parse(row.meal_date)-Date.parse(dates[0]))/86400000),slot:row.slot,recipe:row.recipe_snapshot?cleanPackRecipe(row.recipe_snapshot):undefined}:{}),
  })).filter(r=>kind!=='meals'||r.day<=13);
}
