import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import FamilyJoin from '../FamilyJoin';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{rpc}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('requests owner approval with a pasted code and shows server failure truthfully',async()=>{
 rpc.mockResolvedValue({data:{error:'Code is invalid or expired.'}});
 render(<FamilyJoin/>);
 fireEvent.change(screen.getByLabelText('Family code'),{target:{value:'abcde-12345'}});
 fireEvent.click(screen.getByRole('button',{name:'Request to join'}));
 await screen.findByRole('alert');
 expect(rpc).toHaveBeenCalledWith('family_join',{action:'request',payload:{household_id:undefined,code:'ABCDE-12345'}});
 expect(screen.queryByText('Request sent.')).toBeNull();
});
it('shows the owner a new code only after the server confirms it',async()=>{
 rpc.mockResolvedValue({data:{id:'code',code:'ABCDE-12345',expires_at:'2026-11-26T12:00:00Z'}});
 render(<FamilyJoin householdId="home" isOwner/>);
 fireEvent.click(screen.getByRole('button',{name:'Create code'}));
 await screen.findByText('ABCDE-12345');
 expect(rpc).toHaveBeenCalledWith('family_join',{action:'create',payload:{household_id:'home'}});
});
it('refreshes account invitations after checking approval',async()=>{
 rpc.mockResolvedValue({data:{requests:[{status:'approved'}]}});const refresh=vi.fn();
 render(<FamilyJoin onRefresh={refresh}/>);fireEvent.click(screen.getByRole('button',{name:'Check approval'}));
 await waitFor(()=>expect(refresh).toHaveBeenCalledOnce());
});
