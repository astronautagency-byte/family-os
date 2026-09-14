export function safeRecipeUrl(value) {
 try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export const emptyRecipeDraft=()=>({title:'',ingredients:'',instructions:'',servings:'',readyInMinutes:'',sourceUrl:'',sourceName:'',thumbnail:'',notes:''});
export function recipeToDraft(recipe={}) {
 return {...emptyRecipeDraft(),...recipe,ingredients:(recipe.ingredients || []).map(i=>typeof i==='string'?i:i.original || [i.quantity,i.unit,i.name].filter(Boolean).join(' ')).join('\n'),instructions:(recipe.instructions || []).join('\n')};
}
export function draftToRecipe(draft) {
 const lines=text=>String(text || '').split('\n').map(s=>s.trim()).filter(Boolean);
 const result={title:draft.title.trim(),ingredients:lines(draft.ingredients),instructions:lines(draft.instructions),sourceUrl:safeRecipeUrl(draft.sourceUrl),sourceName:String(draft.sourceName || '').slice(0,200),thumbnail:safeRecipeUrl(draft.thumbnail),notes:draft.notes || '',source:'Recipe Book',servings:draft.servings?Number(draft.servings):null,readyInMinutes:draft.readyInMinutes?Number(draft.readyInMinutes):null};
 if(!result.title || !result.ingredients.length || !result.instructions.length)throw Error('Add a title, ingredients, and cooking steps before saving.');
 for(const key of ['servings','readyInMinutes'])if(result[key]!==null&&(!Number.isFinite(result[key])||result[key]<=0))throw Error('Servings and cooking time must be positive numbers, or left blank.');
 return result;
}
export function readRecipePhotos(files) {
 if(files.length>3)throw Error('Choose up to three photos per recipe.');
 for(const file of files){
  if(/heic|heif/i.test(file.type+' '+file.name))throw Error('This HEIC photo cannot be read here. Export it as JPEG or upload a screenshot of the recipe.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose JPEG, PNG, or WebP recipe photos.');
  if(file.size>20000000)throw Error('Choose photos under 20 MB each.');
 }
 return Promise.all(files.map(prepareRecipePhoto));
}
async function prepareRecipePhoto(file) {
 const source=URL.createObjectURL(file);
 try {
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not read this photo. Try a JPEG export or a screenshot.'));image.src=source;});
  if(!image.naturalWidth||!image.naturalHeight)throw Error('This photo appears to be empty.');
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d');
  if(!context)throw Error('Photo preparation is unavailable in this browser.');
  let edge=2400;
  for(let attempt=0;attempt<4;attempt++){
   const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.9,.8,.7]){
    const result=canvas.toDataURL('image/jpeg',quality);
    if(result.length<=1300000)return result;
   }
   edge=Math.round(edge*.8);
  }
  throw Error('This photo is still too large. Crop it to the recipe text and retry.');
 }finally{URL.revokeObjectURL(source);}
}
