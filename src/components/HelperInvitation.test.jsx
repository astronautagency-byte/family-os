import { afterEach,it,expect,vi } from 'vitest';
import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react';
import HelperInvitation from './HelperInvitation';
const link='https://home.fam-os.app/helpers#invite=private-token';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('opens addressed email and text drafts with the private invitation and verified-email requirement',()=>{
 render(<HelperInvitation link={link} email="helper@example.com" onClose={vi.fn()}/>);
 const mail=screen.getByRole('link',{name:'Share by email'}).getAttribute('href');
 expect(mail.startsWith('mailto:helper%40example.com?')).toBe(true);
 for(const href of [mail,screen.getByRole('link',{name:'Share by text message'}).getAttribute('href')]){
  const body=decodeURIComponent(href.split('body=')[1]);
  expect(body).toContain(link);expect(body).toContain('Sign in with helper@example.com');
 }
 expect(screen.getByText(/does not send the message automatically/)).toBeDefined();
});
it('copies the invitation without sending anything',async()=>{
 const writeText=vi.fn().mockResolvedValue();vi.stubGlobal('navigator',{clipboard:{writeText}});
 render(<HelperInvitation link={link} email="helper@example.com" onClose={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Copy invitation'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Invitation copied'));
 expect(writeText).toHaveBeenCalledWith(expect.stringContaining(link));
});
it('keeps a cancelled native share open without copying or claiming delivery',async()=>{
 const share=vi.fn().mockRejectedValue(Object.assign(new Error('Cancelled'),{name:'AbortError'}));const writeText=vi.fn();const onClose=vi.fn();vi.stubGlobal('navigator',{share,clipboard:{writeText}});
 render(<HelperInvitation link={link} email="helper@example.com" onClose={onClose}/>);
 fireEvent.click(screen.getByRole('button',{name:'More sharing options'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'More sharing options'}).disabled).toBe(false));
 expect(share).toHaveBeenCalledWith(expect.objectContaining({url:link}));expect(writeText).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
});
it('provides manual copy instructions when clipboard access fails',async()=>{
 vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('Denied'))}});
 render(<HelperInvitation link={link} email="helper@example.com" onClose={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Copy invitation'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Select and copy'));
 expect(screen.getByLabelText('Invitation link').value).toBe(link);
});
it('shares a passcode invitation without requiring an account',()=>{
 render(<HelperInvitation link={link+'&guest=1'} passcode="9876543210" delivery="SMS accepted for delivery." onClose={vi.fn()}/>);
 expect(screen.getByLabelText('Helper passcode').value).toBe('9876543210');
 const href=screen.getByRole('link',{name:'Share by text message'}).getAttribute('href');
 expect(decodeURIComponent(href)).toContain('No account required');expect(decodeURIComponent(href)).toContain('9876543210');
 expect(screen.getByText(/Anyone with both/)).toBeDefined();
});
