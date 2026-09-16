import ConfirmAction from './ConfirmAction';
import RecipeThumbnail from './RecipeThumbnail';
import {useHouseholdFeatures} from '../context/HouseholdFeaturesContext';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {useFamily} from '../context/FamilyContext';
import {todayISO} from '../lib/dates';
import {supabase} from '../lib/supabase';
import {BookOpen,Link2 as Link,ImagePlus,Search,ChefHat,CalendarPlus,Pencil,ScanLine as ScanText,Bookmark,ListChecks,Trash2,ExternalLink} from "./icons";
import {Modal,PrimaryButton,SecondaryButton} from './ui';
import {emptyRecipeDraft,recipeToDraft,draftToRecipe,readRecipePhotos,safeRecipeUrl} from '../lib/recipeImport';
import './RecipeBook.css';
const InlineRecipeBook=({children})=><div className="p-5">{children}</div>;
export default function RecipeBook({onClose,onCook,standalone=false}){
 const {user,household}=useAuth();
 const {features}=useHouseholdFeatures();
 const Shell=standalone?InlineRecipeBook:Modal;
 const {meals=[],setMealForSlot}=useFamily();
 const [deleting,setDeleting]=useState(null),[deleteError,setDeleteError]=useState(''),[preparing,setPreparing]=useState(false);
 const [editingId,setEditingId]=useState(null);
 const editorRef=useRef(null);
 useEffect(()=>{if(editingId)editorRef.current?.querySelector('input')?.focus();},[editingId]);
 const [plan,setPlan]=useState(null),[planDate,setPlanDate]=useState(todayISO()),[planSlot,setPlanSlot]=useState('dinner');
 const [recipes,setRecipes]=useState([]),[draft,setDraft]=useState(null),[url,setUrl]=useState(''),[photos,setPhotos]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState(''),[loaded,setLoaded]=useState(false);
 useEffect(()=>{let cancelled=false;if(!household?.id){setError('Sign in to a household to use Recipe Book.');return;}
 supabase.from('household_recipes').select('*').eq('household_id',household.id).order('created_at',{ascending:false}).then(({data,error})=>{if(cancelled)return;if(error)setError('Recipe Book could not load. It may need its database update.');else{setRecipes(data || []);setLoaded(true);}});return()=>{cancelled=true;};},[household?.id]);
 async function extract(){setBusy(true);setError('');try{
  const {data,error}=await supabase.functions.invoke('import-recipe',{body:photos.length?{photos}:{url}});
  if(error){let message='Import failed. Your source is still here; retry or enter the recipe manually.';try{message=(await error.context.json()).error || message;}catch{}throw Error(message);}
  if(data?.error)throw Error(data.error);setDraft(recipeToDraft(data.recipe));
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 async function save(){setBusy(true);setError('');try{
  const recipe=draftToRecipe(draft);
  if(recipes.some(r=>r.id!==editingId&&r.title.trim().toLowerCase()===recipe.title.toLowerCase()))throw Error('A recipe with this name is already in your book. Give this version a distinct name before saving.');
  const payload={title:recipe.title,recipe:{...recipe,sourcePhotos:photos}};
  const query=editingId?supabase.from('household_recipes').update(payload).eq('id',editingId).eq('household_id',household.id).eq('created_by',user.id):supabase.from('household_recipes').insert({household_id:household.id,created_by:user.id,...payload});
  const {data,error}=await query.select().single();if(error)throw error;
  setRecipes(current=>editingId?current.map(row=>row.id===editingId?data:row):[data,...current]);if(editingId)setPlan(current=>current?.id===editingId?data:current);setEditingId(null);setDraft(null);setPhotos([]);setUrl('');
 }catch(e){setError(e.message || 'Could not save. Your recipe is still here.');}finally{setBusy(false);}}
 async function deleteRecipe(){
  if(!deleting||busy)return;
  setBusy(true);setDeleteError('');
  try{
   const {data,error}=await supabase.from('household_recipes').delete().eq('id',deleting.id).eq('household_id',household.id).eq('created_by',user.id).select('id');
   if(error)throw error;
   if(!data?.length)throw Error('This recipe could not be deleted. Only the person who added it can delete it.');
   setRecipes(rows=>rows.filter(row=>row.id!==deleting.id));
   if(plan?.id===deleting.id)setPlan(null);
   setDeleting(null);
  }catch(e){setDeleteError(e.message || 'Could not delete this recipe. Please retry.');}finally{setBusy(false);}
 }
 const visible=recipes.filter(r=>(r.title+' '+(r.recipe.ingredients || []).join(' ')).toLowerCase().includes(search.toLowerCase()));
 return <Shell open title="Recipe Book" onClose={()=>!busy&&!preparing&&onClose?.()}><div className="recipe-book">
  <header className="recipe-book-welcome"><span><BookOpen size={18}/> YOUR FAMILY RECIPE BOOK</span><h3>Your family’s next favourite.</h3><p>Turn a link or a recipe photo into something you can cook again.</p>{household?.role==='owner'&&features.family_packs!==false&&<a href="/packs?kind=recipes">Share recipes with another family</a>}</header>
  {error&&<p role="alert">{error}</p>}
  {preparing&&<p role="status">Preparing photos…</p>}
  {loaded&&<fieldset disabled={busy||preparing}>
   {features.meals&&plan&&<section><h3>Plan {plan.title}</h3><label>Date<input type="date" value={planDate} onChange={e=>setPlanDate(e.target.value)}/></label><label>Meal<select value={planSlot} onChange={e=>setPlanSlot(e.target.value)}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label><PrimaryButton onClick={async()=>{setBusy(true);setError('');try{if(!planDate)throw Error('Choose a date.');if(meals.some(m=>m.date===planDate&&m.slot===planSlot))throw Error('That meal slot already has a plan. Choose another slot or edit it in Meal Plan.');const {sourcePhotos,...snapshot}=plan.recipe;await setMealForSlot(planDate,planSlot,{title:plan.title,notes:'From Recipe Book',recipeSnapshot:snapshot,cookIds:[]});setPlan(null);}catch(e){setError(e.message);}finally{setBusy(false);}}}>Add to meal plan</PrimaryButton><SecondaryButton onClick={()=>setPlan(null)}>Cancel planning</SecondaryButton></section>}
   {!draft?<section className="recipe-book-import"><h3><BookOpen size={20}/> Add a recipe</h3>
    <label><span className="recipe-book-label"><Link size={16}/> Recipe webpage URL</span><input type="url" placeholder="https://…" value={url} onChange={e=>{setUrl(e.target.value);setPhotos([]);}}/></label>
    <label className="recipe-book-upload"><span className="recipe-book-label"><ImagePlus size={18}/> Upload recipe photos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={async e=>{const files=[...e.target.files];e.target.value='';if(!files.length)return;setError('');setPhotos([]);setUrl('');setPreparing(true);try{setPhotos(await readRecipePhotos(files));}catch(error){setError(error.message);}finally{setPreparing(false);}}}/></label>
    <p className="recipe-book-note">Up to 3 JPEG, PNG, or WebP photos, 20 MB each. We resize them automatically. For HEIC, export as JPEG or use a screenshot. Photos are sent to our AI provider when you choose “Import and review.” Saved resized copies are visible only to your household.</p>
    <div className="recipe-book-photos">{photos.map((photo,i)=><img key={i} src={photo} alt={`Recipe source page ${i+1}`}/>)}</div>
    <div className="recipe-book-actions"><PrimaryButton disabled={!url&&!photos.length} onClick={extract}><ScanText size={18}/>{busy?'Reading recipe…':'Import and review'}</PrimaryButton><SecondaryButton onClick={()=>{setDraft(emptyRecipeDraft());setError('');}}><Pencil size={17}/> Enter manually</SecondaryButton></div>
   </section>:<section><h3><ScanText size={20}/> Review before saving</h3><p className="recipe-book-note">Check every quantity, temperature, and step against the original. Missing or unclear details must be corrected before cooking.</p>
    {safeRecipeUrl(draft.sourceUrl)&&<a href={safeRecipeUrl(draft.sourceUrl)} target="_blank" rel="noopener noreferrer">View original recipe</a>}
    <div className="recipe-book-photos">{photos.map((photo,i)=><img key={i} src={photo} alt={`Original recipe page ${i+1}`}/>)}</div>
    <form ref={editorRef} onSubmit={e=>{e.preventDefault();save();}}>
     <label>Recipe name<input required maxLength="200" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
     <div className="recipe-book-actions"><label>Servings<input type="number" min="1" value={draft.servings || ''} onChange={e=>setDraft({...draft,servings:e.target.value})}/></label><label>Total minutes<input type="number" min="1" value={draft.readyInMinutes || ''} onChange={e=>setDraft({...draft,readyInMinutes:e.target.value})}/></label></div>
     <label>Ingredients — one per line, including quantities<textarea required rows="7" value={draft.ingredients} onChange={e=>setDraft({...draft,ingredients:e.target.value})}/></label>
     <label>Cooking steps — one per line<textarea required rows="8" value={draft.instructions} onChange={e=>setDraft({...draft,instructions:e.target.value})}/></label>
     <label>Notes and unclear details<textarea rows="3" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
     <div className="recipe-book-actions"><PrimaryButton type="submit"><Bookmark size={17}/> {editingId?'Save changes':'Save to Recipe Book'}</PrimaryButton><SecondaryButton type="button" onClick={()=>{setDraft(null);if(editingId){setEditingId(null);setPhotos([]);}}}>{editingId?'Cancel editing':'Back to source'}</SecondaryButton></div>
    </form>
   </section>}
   <section><h3><BookOpen size={20}/> Your recipes</h3><label><span className="recipe-book-label"><Search size={16}/> Find a recipe</span><input type="search" placeholder="Search by name or ingredient" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    {!visible.length&&<p>{recipes.length?'No recipes match your search.':'Your family’s recipe collection starts here.'}</p>}
    <div className="recipe-book-grid">{visible.map(row=><article key={row.id}><RecipeThumbnail recipe={row.recipe}/><span className="recipe-book-category"><BookOpen size={16}/> FAMILY RECIPE</span><h4>{row.title}</h4>{safeRecipeUrl(row.recipe.sourceUrl)&&<a className="recipe-book-source" href={safeRecipeUrl(row.recipe.sourceUrl)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>{row.recipe.sourceName || new URL(row.recipe.sourceUrl).hostname}</a>}<p className="recipe-book-meta"><ListChecks size={15}/>{row.recipe.ingredients?.length || 0} ingredients{row.recipe.readyInMinutes?` · ${row.recipe.readyInMinutes} min`:''}</p><div className="recipe-book-card-actions"><SecondaryButton onClick={()=>{onClose?.();onCook({...row.recipe,id:row.id});}}><ChefHat size={17}/> Open recipe</SecondaryButton>{features.meals&&<SecondaryButton onClick={()=>setPlan(row)}><CalendarPlus size={17}/> Plan meal</SecondaryButton>}{row.created_by===user?.id&&<><SecondaryButton onClick={()=>{setEditingId(row.id);setDraft(recipeToDraft({...row.recipe,title:row.title}));setPhotos(row.recipe.sourcePhotos||[]);setError('');}}><Pencil size={16}/> Edit recipe</SecondaryButton><SecondaryButton className="recipe-book-delete" onClick={()=>{setDeleting(row);setDeleteError('');}}><Trash2 size={16}/> Delete recipe</SecondaryButton></>}</div>{row.recipe.sourcePhotos?.length>0&&<details><summary>Original photos</summary><div className="recipe-book-photos">{row.recipe.sourcePhotos.map((p,i)=><img key={i} src={p} alt={`Source page ${i+1}`}/>)}</div></details>}</article>)}</div>
   </section>
  </fieldset>}
 <ConfirmAction open={!!deleting} onClose={()=>{setDeleting(null);setDeleteError('');}} onConfirm={deleteRecipe} busy={busy} title="Delete recipe?" confirmLabel="Delete recipe" copy={<>{`Remove “${deleting?.title || ''}” from your family's Recipe Book? This cannot be undone. Meals already planned from it keep their saved copy.`}{deleteError&&<span role="alert">{deleteError}</span>}</>}/>
 </div></Shell>;
}
