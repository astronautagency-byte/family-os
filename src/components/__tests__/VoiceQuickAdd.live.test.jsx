import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import VoiceQuickAdd from '../VoiceQuickAdd';
const mocks=vi.hoisted(()=>({callbacks:null,grocery:vi.fn(),rpc:vi.fn(),live:{connected:true,start:vi.fn(),stop:vi.fn(),reply:vi.fn()}}));
vi.mock('../AiPrivacyGate',()=>({default:({children})=>children}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:'test-user'},session:{access_token:'test-token'}})}));
vi.mock('../../context/FamilyContext',()=>({useFamily:()=>({addGrocery:mocks.grocery})}));
vi.mock('../../lib/supabase',()=>({supabase:{rpc:(...args)=>mocks.rpc(...args)},invokeEdgeFunction:vi.fn()}));
vi.mock('../../lib/miaLive',()=>({createMiaLive:callbacks=>{mocks.callbacks=callbacks;return mocks.live;}}));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllEnvs();mocks.callbacks=null;});
async function open(){
 vi.stubEnv('VITE_MIA_REALTIME','true');mocks.rpc.mockResolvedValue({data:{accepted:true}});
 render(<VoiceQuickAdd/>);fireEvent.click(screen.getByRole('button',{name:'Talk to Mia, voice assistant'}));
 fireEvent.click(screen.getByRole('button',{name:'Start talking'}));await waitFor(()=>expect(mocks.live.start).toHaveBeenCalledWith('test-token'));
}
it('reviews a spoken correction, saves the corrected quantity only after yes, and keeps live voice connected',async()=>{
 await open();
 act(()=>mocks.callbacks.onUserText('Add lemons to my shopping list'));
 act(()=>{expect(mocks.callbacks.onProposal({type:'add_grocery',args:{name:'lemons',quantity:1}})).toMatchObject({prepared:true});});
 expect(mocks.grocery).not.toHaveBeenCalled();expect(screen.getByLabelText('Quantity').value).toBe('1');
 act(()=>mocks.callbacks.onUserText('Actually make that two lemons'));
 act(()=>mocks.callbacks.onProposal({type:'add_grocery',args:{name:'lemons',quantity:2}}));
 expect(screen.getByLabelText('Quantity').value).toBe('2');expect(mocks.grocery).not.toHaveBeenCalled();
 await act(async()=>mocks.callbacks.onUserText('yes please'));
 expect(mocks.grocery).toHaveBeenCalledExactlyOnceWith({name:'lemons',quantity:2,unit:''});
 expect(mocks.live.reply).toHaveBeenCalledWith('Done. I added lemons to your shopping list.');
 expect(mocks.live.stop).not.toHaveBeenCalled();
});
it('cancels a pending addition without saving and stops the live session when the panel closes',async()=>{
 await open();act(()=>mocks.callbacks.onUserText('Add lemons to my shopping list'));
 act(()=>mocks.callbacks.onProposal({type:'add_grocery',args:{name:'lemons'}}));
 act(()=>mocks.callbacks.onUserText('no'));
 expect(mocks.grocery).not.toHaveBeenCalled();expect(screen.queryByLabelText('Shopping item')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Close dialog',exact:true}));expect(mocks.live.stop).toHaveBeenCalledTimes(1);
});
