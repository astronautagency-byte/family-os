import {it,expect} from 'vitest';
import {draftToRecipe,recipeToDraft,readRecipePhotos} from './recipeImport';
it('preserves ingredient fractions and does not invent missing times',()=>{
 const recipe=draftToRecipe(recipeToDraft({title:'Pancakes',ingredients:['1½ cups flour','2 eggs'],instructions:['Mix.','Cook.']}));
 expect(recipe.ingredients[0]).toBe('1½ cups flour');expect(recipe.readyInMinutes).toBeNull();expect(recipe.servings).toBeNull();
});
it('requires usable recipe content',()=>{expect(()=>draftToRecipe({title:'Empty'})).toThrow('ingredients');});
it('preserves source metadata through review and saving',()=>{
 const recipe=draftToRecipe(recipeToDraft({title:'Pancakes',ingredients:['1 cup flour'],instructions:['Mix'],sourceUrl:'https://example.com/pancakes',sourceName:'Example Kitchen',thumbnail:'https://example.com/pancakes.jpg'}));
 expect(recipe.sourceName).toBe('Example Kitchen');expect(recipe.thumbnail).toBe('https://example.com/pancakes.jpg');expect(recipe.sourceUrl).toBe('https://example.com/pancakes');
});
it('does not retain executable source links',()=>{
 const recipe=draftToRecipe(recipeToDraft({title:'Food',ingredients:['Flour'],instructions:['Mix'],sourceUrl:'javascript:alert(1)',thumbnail:'data:text/html,unsafe'}));
 expect(recipe.sourceUrl).toBe('');expect(recipe.thumbnail).toBe('');
});
it('rejects unsupported photos and excessive file counts',async()=>{
 expect(()=>readRecipePhotos([{}, {}, {}, {}])).toThrow('three');
  expect(()=>readRecipePhotos([new File(['data'],'test.gif',{type:'image/gif'})])).toThrow('JPEG');
  expect(()=>readRecipePhotos([new File(['data'],'test.heic',{type:'image/heic'})])).toThrow('screenshot');
});
