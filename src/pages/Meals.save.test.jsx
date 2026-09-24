import {it,expect,vi,afterEach} from 'vitest';
import {render,fireEvent,screen,waitFor,cleanup,act} from '@testing-library/react';
import Meals from './Meals';
import {todayISO} from '../lib/dates';
import {supabase} from '../lib/supabase';
vi.mock('../lib/supabase',()=>({supabase:{functions:{invoke:vi.fn()},from:vi.fn()},invokeEdgeFunction:vi.fn()}));
const mocks=vi.hoisted(()=>({save:vi.fn(),family:{members:[],memberById:{},meals:[],groceries:[],refreshData:async()=>{}}}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({...mocks.family,setMealForSlot:mocks.save})}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({household:{id:'home'},user:{id:'parent'},householdProfileExtra:null})}));
vi.mock('../hooks/useKitchenInventory',()=>({default:()=>({items:[],ingredientNames:[],removeItem:vi.fn()})}));
vi.mock('../components/NativeAdBanner',()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.family.members=[];mocks.family.memberById={};mocks.family.meals=[];});
it('does not show the cook-from-kitchen shortcut',()=>{
 render(<Meals/>);
 expect(screen.queryByRole('button',{name:/Cook from what you have/i})).toBeNull();
});
it('saves imported meal recipe details to the household Recipe Book',async()=>{
 const recipe={title:'Pasta',ingredients:['Pasta'],instructions:['Boil'],sourceUrl:'https://example.com/pasta'};
 mocks.family.meals=[{id:'meal',date:todayISO(),slot:'breakfast',title:'Pasta',cookIds:[],recipeSnapshot:recipe}];
 const insert=vi.fn().mockResolvedValue({error:null});
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),limit:vi.fn().mockResolvedValue({data:[],error:null}),insert};
 supabase.from.mockReturnValue(query);
 render(<Meals/>);
 fireEvent.click(screen.getByRole('button',{name:'Save recipe',exact:true}));
 await waitFor(()=>expect(insert).toHaveBeenCalledWith(expect.objectContaining({household_id:'home',created_by:'parent',recipe:expect.objectContaining(recipe)})));
 expect(await screen.findByText('Saved to Recipe Book.')).toBeDefined();
});
it('imports a recipe link and saves the snapshot into the selected slot',async()=>{
 const recipe={title:'Lemon pasta',ingredients:['200g pasta'],instructions:['Boil pasta.'],thumbnail:'https://example.com/pasta.jpg',sourceUrl:'https://example.com/recipe'};
 const invoke=vi.spyOn(supabase.functions,'invoke').mockResolvedValue({data:{recipe},error:null});
 mocks.save.mockResolvedValue(undefined);
 render(<Meals/>);
 fireEvent.click(document.querySelector('.meal-card-add-slot-btn'));
 fireEvent.change(screen.getByLabelText('Recipe URL (optional)'),{target:{value:recipe.sourceUrl}});
 fireEvent.click(screen.getByRole('button',{name:'Import recipe from link'}));
 await waitFor(()=>expect(screen.getByLabelText('What are we cooking?').value).toBe(recipe.title));
 expect(mocks.save).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Save meal'}));
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(todayISO(),'breakfast',expect.objectContaining({recipeSnapshot:recipe,thumbnail:recipe.thumbnail})));
 invoke.mockRestore();
});
it('shows each cook once per meal without duplicating avatars in the day header',()=>{
 const member={id:'alex',name:'Alex',initials:'A',color:'plum'};
 mocks.family.members=[member];mocks.family.memberById={alex:member};
 mocks.family.meals=[{id:'breakfast',date:todayISO(),slot:'breakfast',title:'Rice and chicken',cookIds:['alex','alex'],createdBy:'alex'}];
 render(<Meals/>);
 const card=screen.getByText('Rice and chicken').closest('.meal-card-new');
 expect(card.querySelectorAll('.meal-card-header .family-avatar').length).toBe(0);
 expect(card.querySelectorAll('.meal-card-slot-avatars .family-avatar').length).toBe(1);
 expect(screen.getByText('Added by Alex')).toBeDefined();
});
it('uses shared avatars and saves the selected cooks',async()=>{
  mocks.family.members=[
    {id:'alex',name:'Alex',initials:'AV',color:'green',avatarUrl:'/alex.png'},
    {id:'kat',name:'Kat',initials:'K',color:'purple'},
  ];
  mocks.save.mockResolvedValue(undefined);
  render(<Meals/>);
  fireEvent.click(document.querySelector('.page-add-button'));
  const alex=screen.getByRole('button',{name:'Alex'});
  const kat=screen.getByRole('button',{name:'Kat'});
  expect(alex.querySelector('.family-avatar img').getAttribute('src')).toBe('/alex.png');
  expect(kat.querySelector('.family-avatar').textContent).toBe('K');
  expect(alex.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(alex);
  fireEvent.click(kat);
  fireEvent.click(kat);
  expect(alex.getAttribute('aria-pressed')).toBe('true');
  expect(kat.getAttribute('aria-pressed')).toBe('false');
  fireEvent.change(screen.getByLabelText('What are we cooking?'),{target:{value:'Tacos'}});
  fireEvent.click(screen.getByRole('button',{name:'Save meal'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(expect.any(String),expect.any(String),expect.objectContaining({cookIds:['alex']})));
});
it('retains the editor and draft after a rejected save',async()=>{
  mocks.save.mockRejectedValue(new Error('Could not reach server'));
  render(<Meals/>);
  fireEvent.click(document.querySelector('.page-add-button'));
  fireEvent.change(screen.getByLabelText('What are we cooking?'),{target:{value:'Tacos'}});
  fireEvent.click(screen.getByRole('button',{name:'Save meal'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Could not reach server'));
  expect(screen.getByLabelText('What are we cooking?').value).toBe('Tacos');
});
it('does not close the editor until the save succeeds',async()=>{
  let resolve;mocks.save.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  render(<Meals/>);
  fireEvent.click(document.querySelector('.page-add-button'));
  fireEvent.change(screen.getByLabelText('What are we cooking?'),{target:{value:'Rice bowl'}});
  fireEvent.click(screen.getByRole('button',{name:'Save meal'}));
  expect(screen.getByRole('button',{name:'Saving…'}).disabled).toBe(true);
  expect(screen.getByRole('dialog')).toBeDefined();
  await act(async()=>resolve());
  await waitFor(()=>expect(screen.queryByLabelText('What are we cooking?')).toBeNull());
});
