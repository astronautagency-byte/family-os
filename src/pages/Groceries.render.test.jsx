import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
import Groceries from './Groceries';
const state=vi.hoisted(()=>({groceries:[],toggle:vi.fn()}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({groceries:state.groceries,groceryLists:[],meals:[],members:[],memberById:{},refreshData:vi.fn(),addGrocery:vi.fn(),toggleGrocery:state.toggle})}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({household:null,user:null})}));
vi.mock('../hooks/useKitchenInventory',()=>({default:()=>({items:[]})}));
vi.mock('../components/NativeAdBanner',()=>({default:()=>null}));
afterEach(()=>{cleanup();state.groceries=[];});
it('offers checked items to buy again and reports failed saves',async()=>{
 state.groceries=[{id:'milk',name:'Milk',category:'Dairy & Eggs',quantity:1,unit:'L',checked:true,assigneeIds:[]}];
 state.toggle.mockResolvedValue(false);
 render(<Groceries/>);
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
 fireEvent.click(screen.getByText('More'));
 fireEvent.click(screen.getByRole('button',{name:'Reset shopping'}));
 expect(screen.getByRole('dialog')).toBeDefined();
});
it('offers a truthful manual handoff for the current shopping list',()=>{
 state.groceries=[{id:'milk',name:'Milk',category:'Dairy & Eggs',quantity:1,unit:'L',checked:false,assigneeIds:[]}];
 render(<Groceries/>);
 fireEvent.click(screen.getByRole('button',{name:/Shop for delivery/}));
 expect(screen.getByRole('dialog')).toBeDefined();
 expect(screen.getByLabelText('Grocery list export text').value).toContain('Milk');
 expect(screen.getByText(/Cart Assistant availability varies/)).toBeDefined();
 expect(screen.getByRole('link',{name:/Open Uber Eats/}).getAttribute('href')).toContain('ubereats.com');
});

it('copies the list for a user-initiated Uber Eats handoff',async()=>{
 state.groceries=[{id:'milk',name:'Milk',quantity:2,unit:'L',checked:false,assigneeIds:[]}];
 const writeText=vi.fn().mockResolvedValue(); Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
 render(<Groceries/>); fireEvent.click(screen.getByRole('button',{name:/Shop for delivery/}));
 fireEvent.click(screen.getByRole('button',{name:/Copy shopping list/}));
 await waitFor(()=>expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Milk')));
 expect(screen.getByRole('status').textContent).toContain('List copied');
});
