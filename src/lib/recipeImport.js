export const emptyRecipeDraft=()=>({title:'',ingredients:'',instructions:'',servings:'',readyInMinutes:'',sourceUrl:'',notes:''});
export function recipeToDraft(recipe={}) {
 return {...emptyRecipeDraft(),...recipe,ingredients:(recipe.ingredients || []).map(i=>typeof i==='string'?i:i.original || [i.quantity,i.unit,i.name].filter(Boolean).join(' ')).join('\n'),instructions:(recipe.instructions || []).join('\n')};
}
export function draftToRecipe(draft) {
 const lines=text=>String(text || '').split('\n').map(s=>s.trim()).filter(Boolean);
 const result={title:draft.title.trim(),ingredients:lines(draft.ingredients),instructions:lines(draft.instructions),sourceUrl:draft.sourceUrl || '',notes:draft.notes || '',source:'Recipe Book',servings:draft.servings?Number(draft.servings):null,readyInMinutes:draft.readyInMinutes?Number(draft.readyInMinutes):null};
 if(!result.title || !result.ingredients.length || !result.instructions.length)throw Error('Add a title, ingredients, and cooking steps before saving.');
 for(const key of ['servings','readyInMinutes'])if(result[key]!==null&&(!Number.isFinite(result[key])||result[key]<=0))throw Error('Servings and cooking time must be positive numbers, or left blank.');
 return result;
}
export function readRecipePhotos(files) {
 if(files.length>3)throw Error('Choose up to three photos per recipe.');
 return Promise.all(files.map(file=>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1000000)throw Error('Use JPEG, PNG, or WebP photos under 1 MB each.');
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read this photo.'));reader.readAsDataURL(file);});
 }));
}
