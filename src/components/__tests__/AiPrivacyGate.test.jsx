import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import AiPrivacyGate from '../AiPrivacyGate';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));vi.mock('../../lib/supabase',()=>({supabase:{rpc:(...args)=>mocks.rpc(...args)}}));
afterEach(()=>{cleanup();mocks.rpc.mockReset();});
it('requires separate adult and processing choices before revealing AI',async()=>{
 mocks.rpc.mockResolvedValueOnce({data:{eligible:true,accepted:false}}).mockResolvedValueOnce({data:{eligible:true,accepted:true}});
 render(<AiPrivacyGate><p>AI controls</p></AiPrivacyGate>);await screen.findByText('Enable AI for my account');const button=screen.getByRole('button',{name:'Enable AI for my account'});expect(button.disabled).toBe(true);expect(screen.queryByText('AI controls')).toBeNull();
 fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older.'));expect(button.disabled).toBe(true);fireEvent.click(screen.getByLabelText(/I choose to enable/));fireEvent.click(button);await screen.findByText('AI controls');expect(mocks.rpc).toHaveBeenLastCalledWith('ai_privacy_choices',{action:'accept',adult_confirmed:true,processing_confirmed:true});
});
it('does not offer consent to a known underage or ineligible account',async()=>{
 mocks.rpc.mockResolvedValue({data:{eligible:false,accepted:false}});render(<AiPrivacyGate><p>AI controls</p></AiPrivacyGate>);await screen.findByText(/unavailable for this account/);expect(screen.queryByRole('checkbox')).toBeNull();expect(screen.queryByText('AI controls')).toBeNull();
});
it('pauses active voice when privacy choices open and hides AI after withdrawal',async()=>{
 const pause=vi.fn();mocks.rpc.mockResolvedValueOnce({data:{eligible:true,accepted:true}}).mockResolvedValueOnce({data:{eligible:true,accepted:false}});render(<AiPrivacyGate onPause={pause}><p>AI controls</p></AiPrivacyGate>);await screen.findByText('AI controls');fireEvent.click(screen.getByRole('button',{name:'AI privacy choices'}));expect(pause).toHaveBeenCalled();expect(screen.queryByText('AI controls')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Withdraw AI processing permission'}));await waitFor(()=>expect(mocks.rpc).toHaveBeenLastCalledWith('ai_privacy_choices',expect.objectContaining({action:'withdraw'})));await screen.findByRole('button',{name:'Enable AI for my account'});expect(screen.queryByText('AI controls')).toBeNull();
});
it('fails closed when the privacy lookup fails',async()=>{
 mocks.rpc.mockResolvedValue({error:{message:'offline'}});render(<AiPrivacyGate><p>AI controls</p></AiPrivacyGate>);await screen.findByRole('alert');expect(screen.queryByText('AI controls')).toBeNull();expect(screen.queryByRole('checkbox')).toBeNull();
});
