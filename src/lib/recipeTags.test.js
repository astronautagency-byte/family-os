import {expect,it} from 'vitest';
import {normalizeRecipeTags,recipeTags} from '../../supabase/functions/_shared/recipeTags.js';
import {draftToRecipe,recipeToDraft} from './recipeImport';
it('normalizes and deduplicates dietary tags without accepting malformed entries',()=>{
 expect(normalizeRecipeTags([' vegan ','VEGAN','gluten free','Gluten-free',null,12,'dairy_free',''])).toEqual(['Vegan','Gluten-free','Dairy-free']);
 expect(normalizeRecipeTags('Vegan; gluten-free, Egg-free')).toEqual(['Vegan','Gluten-free','Egg-free']);
});
it('uses only explicit source metadata and preserves a deliberately empty selection',()=>{
 expect(recipeTags({diets:['gluten free'],vegan:true,vegetarian:true})).toEqual(['Gluten-free','Vegan','Vegetarian']);
 expect(recipeTags({title:'Tofu and rice',ingredients:['Rice','Tofu']})).toEqual([]);
 expect(recipeTags({tags:[],vegan:true,diets:['gluten free']})).toEqual([]);
});
it('preserves and removes tags through the complete recipe draft round trip',()=>{
 const draft=recipeToDraft({title:'Soup',ingredients:['Water'],instructions:['Simmer'],tags:['vegan','gluten-free']});
 expect(draftToRecipe(draft).tags).toEqual(['Vegan','Gluten-free']);
 expect(draftToRecipe({...draft,tags:[]}).tags).toEqual([]);
});
it('bounds imported tags and keeps older untagged recipes usable',()=>{
 expect(normalizeRecipeTags(Array.from({length:30},(_,i)=>'x'.repeat(80)+i))).toHaveLength(1);
 expect(normalizeRecipeTags(Array.from({length:30},(_,i)=>'Tag '+i))).toHaveLength(20);
 expect(recipeToDraft().tags).toEqual([]);
});
