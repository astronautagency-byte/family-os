import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import RewardBank from '../RewardBank';
const mocks=vi.hoisted(()=>({role:'owner',id:'parent',rpc:vi.fn(),rows:{settings:[{enabled:true}],accounts:[{child_id:'kid',balance:10}],rewards:[{id:'movie',title:'Movie night',kind:'experience',cost:8,details:'Popcorn included'}],chores:[],redemptions:[],ledger:[]}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:mocks.id},household:{id:'home',role:mocks.role}})}));
vi.mock('../../context/FamilyContext',()=>({useFamily:()=>({members:[{id:'kid',name:'Katie',initials:'K'}],memberById:{kid:{id:'kid',name:'Katie',initials:'K'}},tasks:[]})}));
vi.mock('../../lib/supabase',()=>({supabase:{from:table=>({select:()=>({eq:async()=>({data:mocks.rows[table.replace('rewardbank_','')]})})}),rpc:(...args)=>mocks.rpc(...args)}}));
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.role='owner';mocks.id='parent';});
it('shows parent setup and approvals',async()=>{
 render(<RewardBank onClose={()=>{}}/>);
 expect(await screen.findByText('Assign a chore score')).toBeDefined();
 expect(screen.getByLabelText('Enable RewardBank for this household').checked).toBe(true);
 expect(screen.getByText('Movie night')).toBeDefined();
});
it('lets a child request an affordable reward without exposing parent controls',async()=>{
 mocks.role='member';mocks.id='kid';mocks.rpc.mockResolvedValue({error:null});
 render(<RewardBank onClose={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Request reward'}));
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('rewardbank_command',{h:'home',action:'redeem',payload:{reward_id:'movie'}}));
 expect(screen.queryByText('Create a reward')).toBeNull();
 expect(screen.queryByText('Assign a chore score')).toBeNull();
});
it('surfaces rejected commands without claiming points were spent',async()=>{
 mocks.role='member';mocks.id='kid';mocks.rpc.mockResolvedValue({error:{message:'Not enough available points'}});
 render(<RewardBank onClose={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Request reward'}));
 expect((await screen.findByRole('alert')).textContent).toContain('Not enough');
});
