import {it,expect} from 'vitest';
import {draftToRecipe,recipeToDraft,readRecipePhotos} from './recipeImport';
it('preserves ingredient fractions and does not invent missing times',()=>{
 const recipe=draftToRecipe(recipeToDraft({title:'Pancakes',ingredients:['1½ cups flour','2 eggs'],instructions:['Mix.','Cook.']}));
 expect(recipe.ingredients[0]).toBe('1½ cups flour');expect(recipe.readyInMinutes).toBeNull();expect(recipe.servings).toBeNull();
});
it('requires usable recipe content',()=>{expect(()=>draftToRecipe({title:'Empty'})).toThrow('ingredients');});
it('rejects unsupported photos and excessive file counts',async()=>{
 expect(()=>readRecipePhotos([{}, {}, {}, {}])).toThrow('three');
  expect(()=>readRecipePhotos([new File(['data'],'test.gif',{type:'image/gif'})])).toThrow('JPEG');
});
