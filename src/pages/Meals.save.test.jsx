import {it,expect,vi,afterEach} from 'vitest';
import {render,fireEvent,screen,waitFor,cleanup,act} from '@testing-library/react';
import Meals from './Meals';
const mocks=vi.hoisted(()=>({save:vi.fn(),family:{members:[],memberById:{},meals:[],groceries:[],refreshData:async()=>{}}}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({...mocks.family,setMealForSlot:mocks.save})}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({household:null,user:null,householdProfileExtra:null})}));
vi.mock('../hooks/useKitchenInventory',()=>({default:()=>({items:[],ingredientNames:[],removeItem:vi.fn()})}));
vi.mock('../components/NativeAdBanner',()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
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
