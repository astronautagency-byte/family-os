import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import RecipeBook from '../RecipeBook';
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:'alex'},household:{id:'home'}})}));
vi.mock('../../context/FamilyContext',()=>({useFamily:()=>({meals:[],setMealForSlot:vi.fn()})}));
vi.mock('../../lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({order:async()=>({data:[{id:'recipe',title:'Pancakes',recipe:{ingredients:['Flour'],instructions:['Mix'],readyInMinutes:15}}]})})})})}}));
afterEach(cleanup);
it('uses labelled inputs and shared icon actions in recipe cards',async()=>{
 const onCook=vi.fn(),onClose=vi.fn();render(<RecipeBook onCook={onCook} onClose={onClose}/>);
 const open=await screen.findByRole('button',{name:'Open recipe'});
 expect(open.querySelector('svg')).not.toBeNull();
 expect(screen.getByRole('button',{name:'Plan meal'}).querySelector('svg')).not.toBeNull();
 expect(screen.getByLabelText('Recipe webpage URL')).toBeDefined();
 expect(screen.getByLabelText('Upload recipe photos')).toBeDefined();
 expect(open.parentElement.className).toBe('recipe-book-card-actions');
 fireEvent.click(open);expect(onCook).toHaveBeenCalled();expect(onClose).toHaveBeenCalled();
});
