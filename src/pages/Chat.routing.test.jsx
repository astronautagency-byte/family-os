import { it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import Chat from './Chat';
beforeAll(()=>{Element.prototype.scrollIntoView=vi.fn();});
const mocks = vi.hoisted(() => {
 const members = [{id:'alex',name:'Alex',initials:'A'}, {id:'kat',name:'Kat',initials:'K'}, {id:'lee',name:'Lee',initials:'L'}];
 return {send:vi.fn(), members, messages:[
  {id:'1',senderId:'alex',recipientId:null,text:'Family message',sentAt:'2026-09-14T12:00:00Z'},
  {id:'2',senderId:'kat',recipientId:'alex',text:'Private message',sentAt:'2026-09-14T12:01:00Z'},
  {id:'3',senderId:'kat',recipientId:'lee',text:'Other private message',sentAt:'2026-09-14T12:02:00Z'},
 ]};
});
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:'alex'}})}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({members:mocks.members,memberById:Object.fromEntries(mocks.members.map(m=>[m.id,m])),messages:mocks.messages,sendMessage:mocks.send})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('keeps family and direct messages in their own channel',()=>{
 render(<Chat/>);
 expect(screen.getByText('Family message')).toBeDefined();
 expect(screen.queryByText('Private message')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'K Kat'}));
 expect(screen.getByText('Private message')).toBeDefined();
 expect(screen.queryByText('Family message')).toBeNull();
 expect(screen.queryByText('Other private message')).toBeNull();
});
it('keeps private drafts out of Everyone and sends the explicit recipient',async()=>{
 mocks.send.mockResolvedValue(undefined);
 render(<Chat/>);
 fireEvent.click(screen.getByRole('button',{name:'K Kat'}));
 fireEvent.change(screen.getByPlaceholderText('Message Kat'),{target:{value:'Just for Kat'}});
 fireEvent.click(screen.getByRole('button',{name:'Everyone'}));
 expect(screen.getByPlaceholderText('Tell everyone…').value).toBe('');
 fireEvent.click(screen.getByRole('button',{name:'K Kat'}));
 expect(screen.getByPlaceholderText('Message Kat').value).toBe('Just for Kat');
 fireEvent.click(screen.getByRole('button',{name:'Send message'}));
 await waitFor(()=>expect(mocks.send).toHaveBeenCalledWith({text:'Just for Kat',recipientId:'kat',senderId:'alex'}));
});
