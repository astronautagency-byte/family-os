import {useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {useFamily} from '../context/FamilyContext';
import {todayISO} from '../lib/dates';
import {supabase} from '../lib/supabase';
import {Modal,PrimaryButton,SecondaryButton} from './ui';
import {emptyRecipeDraft,recipeToDraft,draftToRecipe,readRecipePhotos} from '../lib/recipeImport';
import './RecipeBook.css';
export default function RecipeBook({onClose,onCook}){
 const {user,household}=useAuth();
 const {meals=[],setMealForSlot}=useFamily();
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
  if(recipes.some(r=>r.title.trim().toLowerCase()===recipe.title.toLowerCase()))throw Error('A recipe with this name is already in your book. Give this version a distinct name before saving.');
  const {data,error}=await supabase.from('household_recipes').insert({household_id:household.id,created_by:user.id,title:recipe.title,recipe:{...recipe,sourcePhotos:photos}}).select().single();if(error)throw error;
  setRecipes(current=>[data,...current]);setDraft(null);setPhotos([]);setUrl('');
 }catch(e){setError(e.message || 'Could not save. Your recipe is still here.');}finally{setBusy(false);}}
 const visible=recipes.filter(r=>(r.title+' '+(r.recipe.ingredients || []).join(' ')).toLowerCase().includes(search.toLowerCase()));
 return <Modal open title="Recipe Book" onClose={()=>!busy&&onClose()}><div className="recipe-book">
  <header className="recipe-book-welcome"><span>KEEP THE GOOD ONES</span><h3>Your family’s next favourite.</h3><p>Turn a link or a recipe photo into something you can cook again.</p></header>
  {error&&<p role="alert">{error}</p>}
  {loaded&&<fieldset disabled={busy}>
   {plan&&<section><h3>Plan {plan.title}</h3><label>Date<input type="date" value={planDate} onChange={e=>setPlanDate(e.target.value)}/></label><label>Meal<select value={planSlot} onChange={e=>setPlanSlot(e.target.value)}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label><PrimaryButton onClick={async()=>{setBusy(true);setError('');try{if(!planDate)throw Error('Choose a date.');if(meals.some(m=>m.date===planDate&&m.slot===planSlot))throw Error('That meal slot already has a plan. Choose another slot or edit it in Meal Plan.');const {sourcePhotos,...snapshot}=plan.recipe;await setMealForSlot(planDate,planSlot,{title:plan.title,notes:'From Recipe Book',recipeSnapshot:snapshot,cookIds:[]});setPlan(null);}catch(e){setError(e.message);}finally{setBusy(false);}}}>Add to meal plan</PrimaryButton><SecondaryButton onClick={()=>setPlan(null)}>Cancel planning</SecondaryButton></section>}
   {!draft?<section className="recipe-book-import"><h3>Add a recipe</h3>
    <label>Recipe webpage URL<input type="url" placeholder="https://…" value={url} onChange={e=>{setUrl(e.target.value);setPhotos([]);}}/></label>
    <label>Or upload recipe photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={async e=>{setError('');try{setPhotos(await readRecipePhotos([...e.target.files]));setUrl('');}catch(error){setError(error.message);}e.target.value='';}}/></label>
    <p className="recipe-book-note">Up to 3 photos, 1 MB each. Photos are sent to our AI provider when you choose “Import and review.” Saved originals are visible only to your household.</p>
    <div className="recipe-book-photos">{photos.map((photo,i)=><img key={i} src={photo} alt={`Recipe source page ${i+1}`}/>)}</div>
    <div className="recipe-book-actions"><PrimaryButton disabled={!url&&!photos.length} onClick={extract}>{busy?'Reading recipe…':'Import and review'}</PrimaryButton><SecondaryButton onClick={()=>{setDraft(emptyRecipeDraft());setError('');}}>Enter manually</SecondaryButton></div>
   </section>:<section><h3>Review before saving</h3><p className="recipe-book-note">Check every quantity, temperature, and step against the original. Missing or unclear details must be corrected before cooking.</p>
    {draft.sourceUrl&&<a href={draft.sourceUrl} target="_blank" rel="noopener noreferrer">View original recipe</a>}
    <div className="recipe-book-photos">{photos.map((photo,i)=><img key={i} src={photo} alt={`Original recipe page ${i+1}`}/>)}</div>
    <form onSubmit={e=>{e.preventDefault();save();}}>
     <label>Recipe name<input required maxLength="200" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
     <div className="recipe-book-actions"><label>Servings<input type="number" min="1" value={draft.servings || ''} onChange={e=>setDraft({...draft,servings:e.target.value})}/></label><label>Total minutes<input type="number" min="1" value={draft.readyInMinutes || ''} onChange={e=>setDraft({...draft,readyInMinutes:e.target.value})}/></label></div>
     <label>Ingredients — one per line, including quantities<textarea required rows="7" value={draft.ingredients} onChange={e=>setDraft({...draft,ingredients:e.target.value})}/></label>
     <label>Cooking steps — one per line<textarea required rows="8" value={draft.instructions} onChange={e=>setDraft({...draft,instructions:e.target.value})}/></label>
     <label>Notes and unclear details<textarea rows="3" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
     <div className="recipe-book-actions"><PrimaryButton type="submit">Save to Recipe Book</PrimaryButton><SecondaryButton type="button" onClick={()=>setDraft(null)}>Back to source</SecondaryButton></div>
    </form>
   </section>}
   <section><h3>Your recipes</h3><label>Find a recipe<input type="search" placeholder="Search by name or ingredient" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    {!visible.length&&<p>{recipes.length?'No recipes match your search.':'Your family’s recipe collection starts here.'}</p>}
    <div className="recipe-book-grid">{visible.map(row=><article key={row.id}><span className="recipe-book-category">FAMILY RECIPE</span><h4>{row.title}</h4><p>{row.recipe.ingredients?.length || 0} ingredients{row.recipe.readyInMinutes?` · ${row.recipe.readyInMinutes} min`:''}</p><SecondaryButton onClick={()=>{onClose();onCook({...row.recipe,id:row.id});}}>Open recipe</SecondaryButton><SecondaryButton onClick={()=>setPlan(row)}>Plan meal</SecondaryButton>{row.recipe.sourcePhotos?.length>0&&<details><summary>Original photos</summary><div className="recipe-book-photos">{row.recipe.sourcePhotos.map((p,i)=><img key={i} src={p} alt={`Source page ${i+1}`}/>)}</div></details>}</article>)}</div>
   </section>
  </fieldset>}
 </div></Modal>;
}
