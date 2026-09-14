import {useState} from 'react';
import RecipeThumbnail from '../components/RecipeThumbnail';
import {safeRecipeUrl} from '../lib/recipeImport';
import RecipeBook from '../components/RecipeBook';
import PageHeader from '../components/PageHeader';
import {Modal} from '../components/ui';
import {BookOpen} from '../components/icons';
export default function RecipeBookPage(){
 const [recipe,setRecipe]=useState(null);
 return <><PageHeader title="Recipe Book" titleIcon={<BookOpen size={24}/>}/><RecipeBook standalone onCook={setRecipe}/>
 <Modal open={!!recipe} title={recipe?.title || 'Recipe'} onClose={()=>setRecipe(null)}>{recipe&&<div className="recipe-book"><RecipeThumbnail recipe={recipe}/>{safeRecipeUrl(recipe.sourceUrl)&&<a href={safeRecipeUrl(recipe.sourceUrl)} target="_blank" rel="noopener noreferrer">{recipe.sourceName || "View original recipe"}</a>}<h3>Ingredients</h3><ul>{(recipe.ingredients||[]).map((item,i)=><li key={i}>{typeof item==='string'?item:item.name}</li>)}</ul><h3>Steps</h3><ol>{(recipe.instructions||[]).map((item,i)=><li key={i}>{typeof item==='string'?item:item.step || item.text}</li>)}</ol>{recipe.notes&&<p>{recipe.notes}</p>}</div>}</Modal></>;
}
