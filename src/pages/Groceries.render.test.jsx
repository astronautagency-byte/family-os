import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
import Groceries from './Groceries';
const state=vi.hoisted(()=>({groceries:[],lists:[],add:vi.fn(),toggle:vi.fn()}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({groceries:state.groceries,groceryLists:state.lists,meals:[],members:[],memberById:{},refreshData:vi.fn(),addGrocery:state.add,toggleGrocery:state.toggle})}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({household:null,user:null})}));
vi.mock('../hooks/useKitchenInventory',()=>({default:()=>({items:[]})}));
vi.mock('../components/NativeAdBanner',()=>({default:()=>null}));
afterEach(()=>{cleanup();state.groceries=[];state.lists=[];state.add.mockReset();});
it('offers checked items to buy again and reports failed saves',async()=>{
 state.groceries=[{id:'milk',name:'Milk',category:'Dairy & Eggs',quantity:1,unit:'L',checked:true,assigneeIds:[]}];
 state.toggle.mockResolvedValue(false);
 render(<Groceries/>);
 fireEvent.click(screen.getByText('Saved staples'));
 fireEvent.click(screen.getByRole('button',{name:'Milk'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Could not add'));
 expect(state.toggle).toHaveBeenCalledWith('milk');
});
it('renders Shopping with an empty household list',()=>{
 render(<Groceries/>);
 expect(screen.getByText('Your shopping list is ready')).toBeDefined();
});
it('renders a populated shopping list',()=>{
 state.groceries=[{id:'milk',name:'Milk',category:'Dairy & Eggs',quantity:1,unit:'L',checked:false,assigneeIds:[]}];
 render(<Groceries/>);
 expect(screen.getAllByText('Milk').length).toBeGreaterThan(0);
});
it('keeps list reset available in the shopping options',()=>{
 state.groceries=[{id:'milk',name:'Milk',category:'Dairy & Eggs',quantity:1,unit:'L',checked:false,assigneeIds:[]}];
 render(<Groceries/>);
 fireEvent.click(screen.getByText('Shopping options'));
 fireEvent.click(screen.getByRole('button',{name:'Reset shopping'}));
 expect(screen.getByRole('dialog')).toBeDefined();
});
it('offers a truthful manual handoff for the current shopping list',()=>{
 state.groceries=[{id:'milk',name:'Milk',category:'Dairy & Eggs',quantity:1,unit:'L',checked:false,assigneeIds:[]}];
 render(<Groceries/>);
 fireEvent.click(screen.getByText('Shopping options')); fireEvent.click(screen.getByRole('button',{name:/Shop for delivery/}));
 expect(screen.getByRole('dialog')).toBeDefined();
 expect(screen.getByLabelText('Grocery list export text').value).toContain('Milk');
 expect(screen.getByText(/Cart Assistant availability varies/)).toBeDefined();
 expect(screen.getByRole('link',{name:/Open Uber Eats/}).getAttribute('href')).toContain('ubereats.com');
});

it('copies the list for a user-initiated Uber Eats handoff',async()=>{
 state.groceries=[{id:'milk',name:'Milk',quantity:2,unit:'L',checked:false,assigneeIds:[]}];
 const writeText=vi.fn().mockResolvedValue(); Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
 render(<Groceries/>); fireEvent.click(screen.getByText('Shopping options')); fireEvent.click(screen.getByRole('button',{name:/Shop for delivery/}));
 fireEvent.click(screen.getByRole('button',{name:/Copy shopping list/}));
 await waitFor(()=>expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Milk')));
 expect(screen.getByRole('status').textContent).toContain('List copied');
});

it('quick-adds to the selected list and retains the entry if saving fails', async () => {
 state.lists=[{id:'weekend',name:'Weekend groceries'}];
 state.add.mockRejectedValueOnce(new Error('Could not save')).mockResolvedValueOnce(undefined);
 render(<Groceries/>);
 fireEvent.change(screen.getByLabelText('Shopping list'), {target:{value:'weekend'}});
 const input=screen.getByRole('textbox',{name:'Shopping item'});
 fireEvent.change(input,{target:{value:'Lemons'}});
 fireEvent.click(screen.getByRole('button',{name:'Add',exact:true}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('Could not save'));
 expect(input.value).toBe('Lemons');
 fireEvent.click(screen.getByRole('button',{name:'Add',exact:true}));
 await waitFor(()=>expect(input.value).toBe(''));
 expect(state.add).toHaveBeenLastCalledWith({name:'Lemons',quantity:1,unit:'',listId:'weekend'});
});
