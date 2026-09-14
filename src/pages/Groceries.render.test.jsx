import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import Groceries from './Groceries';
const state=vi.hoisted(()=>({groceries:[]}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({groceries:state.groceries,groceryLists:[],meals:[],members:[],memberById:{},refreshData:vi.fn(),addGrocery:vi.fn()})}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({household:null,user:null})}));
vi.mock('../hooks/useKitchenInventory',()=>({default:()=>({items:[]})}));
vi.mock('../components/NativeAdBanner',()=>({default:()=>null}));
afterEach(()=>{cleanup();state.groceries=[];});
it('renders Shopping with an empty household list',()=>{
 render(<Groceries/>);
 expect(screen.getByText('Your shopping list is ready')).toBeDefined();
});
it('renders a populated shopping list',()=>{
 state.groceries=[{id:'milk',name:'Milk',category:'Dairy & Eggs',quantity:1,unit:'L',checked:false,assigneeIds:[]}];
 render(<Groceries/>);
 expect(screen.getAllByText('Milk').length).toBeGreaterThan(0);
});
