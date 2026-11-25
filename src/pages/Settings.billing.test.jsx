import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import Settings from './Settings';
vi.mock('../lib/distribution',()=>({IS_APP_STORE:true,IS_MAC_APP_STORE:true}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({configured:false,user:{id:'owner'},household:{name:'Sample family',created_by:'owner'},memberProfile:{role:'Parent'}})}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({members:[],memberById:{},meals:[],groceries:[],taskLists:[],googleClientId:'sample',googleCalendars:[],googleEvents:[],calendarFeeds:[],selectedGoogleCalendarIds:[],sharedGoogleCalendarIds:[]})}));
vi.mock('../components/EmailInbox',()=>({default:()=>null}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:vi.fn().mockResolvedValue({data:[],error:null}),functions:{invoke:vi.fn().mockResolvedValue({data:null,error:null})}}}));
it('native Settings retains a selectable billing tab and account status without web purchase offers',async()=>{
 window.matchMedia=vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 render(<Settings colorScheme="forest"/>);
 const tab=screen.getByRole('tab',{name:'Plan & billing'});fireEvent.click(tab);
 expect(tab).toHaveAttribute('aria-selected','true');
 await waitFor(()=>expect(screen.getByRole('heading',{name:'FamOS Core'})).toBeDefined());
 expect(screen.queryByRole('button',{name:'Manage billing'})).toBeNull();
 expect(screen.queryByText('Have a promo code?')).toBeNull();
 expect(screen.queryByText('$9.99')).toBeNull();
});
