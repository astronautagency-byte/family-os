import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,within,waitFor} from '@testing-library/react';
import RecipeBook from '../RecipeBook';
const mocks=vi.hoisted(()=>({remove:vi.fn(),invoke:vi.fn(),insert:vi.fn(),update:vi.fn(),read:vi.fn(),row:{id:'recipe',created_by:'alex',title:'Pancakes',recipe:{ingredients:['Flour'],instructions:['Mix'],readyInMinutes:15,sourceUrl:'https://example.com/pancakes',sourceName:'Example Kitchen',thumbnail:'https://example.com/photo.jpg'}}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:'alex'},household:{id:'home'}})}));
vi.mock('../../context/FamilyContext',()=>({useFamily:()=>({meals:[],setMealForSlot:vi.fn()})}));
vi.mock('../../lib/recipeImport',async importOriginal=>({...await importOriginal(),readRecipePhotos:(...args)=>mocks.read(...args)}));
vi.mock('../../lib/supabase',()=>({supabase:{functions:{invoke:(...args)=>mocks.invoke(...args)},from:()=>({
 select:()=>({eq:()=>({order:async()=>({data:[mocks.row]})})}),
 delete:()=>{const chain={eq:vi.fn(()=>chain),select:()=>mocks.remove()};return chain;},
 update:payload=>{mocks.update(payload);const chain={eq:()=>chain,select:()=>({single:async()=>({data:{...mocks.row,...payload}})})};return chain;},
 insert:payload=>{mocks.insert(payload);return {select:()=>({single:async()=>({data:{id:'new',...payload}})})};}
})}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('edits the saved household copy without inserting another recipe',async()=>{
 render(<RecipeBook onClose={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Edit recipe'}));
 expect(screen.getByLabelText('Recipe name')).toHaveValue('Pancakes');
 fireEvent.change(screen.getByLabelText('Ingredients — one per line, including quantities'),{target:{value:'2 cups flour'}});
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Save changes'})).toBeNull());
 expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({recipe:expect.objectContaining({ingredients:['2 cups flour'],sourceUrl:'https://example.com/pancakes'})}));
 expect(mocks.insert).not.toHaveBeenCalled();
});
it('uses labelled inputs, source links, thumbnails and shared icon actions',async()=>{
 const onCook=vi.fn(),onClose=vi.fn();render(<RecipeBook onCook={onCook} onClose={onClose}/>);
 const open=await screen.findByRole('button',{name:'Open recipe'});
 expect(open.querySelector('svg')).not.toBeNull();
 expect(screen.getByRole('button',{name:'Plan meal'}).querySelector('svg')).not.toBeNull();
 expect(screen.getByLabelText('Recipe webpage URL')).toBeDefined();
 expect(screen.getByLabelText('Upload recipe photos')).toBeDefined();
 expect(screen.getByRole('link',{name:'Example Kitchen'}).href).toBe('https://example.com/pancakes');
 expect(document.querySelector('.recipe-book-thumbnail img').src).toBe('https://example.com/photo.jpg');
 fireEvent.click(open);expect(onCook).toHaveBeenCalled();expect(onClose).toHaveBeenCalled();
});
it('deletes only after confirmation and removes the saved card',async()=>{
 mocks.remove.mockResolvedValue({data:[{id:'recipe'}]});
 render(<RecipeBook onClose={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Delete recipe'}));
 expect(mocks.remove).not.toHaveBeenCalled();
 fireEvent.click(within(screen.getByRole('dialog',{name:'Delete recipe?'})).getByRole('button',{name:'Delete recipe'}));
 await waitFor(()=>expect(screen.queryByText('Pancakes')).toBeNull());
 expect(mocks.remove).toHaveBeenCalledOnce();
});
it('keeps recipes visible if deletion fails',async()=>{
 mocks.remove.mockResolvedValue({error:{message:'Permission denied'}});
 render(<RecipeBook onClose={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Delete recipe'}));
 fireEvent.click(within(screen.getByRole('dialog',{name:'Delete recipe?'})).getByRole('button',{name:'Delete recipe'}));
 expect((await screen.findByRole('alert')).textContent).toBe('Permission denied');
 expect(screen.getByText('Pancakes')).toBeDefined();
});
it('prepares a photo, imports it for review, and saves the recipe',async()=>{
 mocks.read.mockResolvedValue(['data:image/jpeg;base64,AAAA']);
 mocks.invoke.mockResolvedValue({data:{recipe:{title:'Soup',ingredients:['2 cups water'],instructions:['Simmer'],sourceUrl:'',notes:''}}});
 render(<RecipeBook onClose={()=>{}}/>);
 await screen.findByRole('button',{name:'Open recipe'});
 fireEvent.change(screen.getByLabelText('Upload recipe photos'),{target:{files:[new File(['x'],'recipe.png',{type:'image/png'})]}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Import and review'}).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Import and review'}));
 expect((await screen.findByLabelText('Recipe name')).value).toBe('Soup');
 expect(mocks.invoke).toHaveBeenCalledWith('import-recipe',{body:{photos:['data:image/jpeg;base64,AAAA']}});
 fireEvent.click(screen.getByRole('button',{name:'Save to Recipe Book'}));
 await screen.findByText('Soup');
 expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({recipe:expect.objectContaining({ingredients:['2 cups water'],sourcePhotos:['data:image/jpeg;base64,AAAA']})}));
});
