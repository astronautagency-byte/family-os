import { it,expect,vi,afterEach } from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import GuestHelperPortal from './GuestHelperPortal';
const call=vi.hoisted(()=>vi.fn());
vi.mock('../lib/familyHelpers',()=>({guestHelperCall:call,RESOURCE_LABELS:{tasks:'Task list'}}));
afterEach(()=>{cleanup();sessionStorage.clear();window.history.replaceState(null,'','/helpers');vi.clearAllMocks();});
it('opens an invitation by passcode without calling account sign-in',async()=>{
 const token='a'.repeat(64);window.history.replaceState(null,'',`/helpers#invite=${token}&guest=1`);
 call.mockImplementation(async(action)=>action==='login'?{secret:'b'.repeat(64)}:{family:'Sample family',expires_at:new Date(Date.now()+3600000).toISOString(),resources:[{grant_id:'g',kind:'tasks',name:'Cleaning',permission:'view',items:[{id:'i',title:'Vacuum',done:false}]}]});
 render(<GuestHelperPortal/>);
 expect(screen.queryByLabelText('Email')).toBeNull();expect(window.location.hash).toBe('');
 fireEvent.change(screen.getByLabelText('Passcode'),{target:{value:'9876543210'}});fireEvent.click(screen.getByRole('button',{name:'Open shared space'}));
 await waitFor(()=>expect(screen.getByText('Vacuum')).toBeDefined());
 expect(call).toHaveBeenCalledWith('login',{token,passcode:'9876543210'});
 expect(screen.queryByRole('checkbox')).toBeNull();
 expect(sessionStorage.getItem('famos:guest-helper')).not.toContain('9876543210');
 fireEvent.click(screen.getByRole('button',{name:'End session'}));await waitFor(()=>expect(screen.getByLabelText('Passcode')).toBeDefined());
});
it('does not reuse another family’s session when a new invitation opens',()=>{
 sessionStorage.setItem('famos:guest-helper',JSON.stringify({token:'a'.repeat(64),secret:'b'.repeat(64)}));window.history.replaceState(null,'',`/helpers#invite=${'c'.repeat(64)}&guest=1`);
 render(<GuestHelperPortal/>);expect(screen.getByLabelText('Passcode')).toBeDefined();expect(call).not.toHaveBeenCalled();
});
