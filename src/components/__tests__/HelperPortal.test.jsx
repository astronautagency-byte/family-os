import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HelperWorkspace } from '../../pages/HelperPortal';
const mocks=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('../../lib/familyHelpers',async importOriginal=>({...await importOriginal(),helperCall:mocks.call}));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers();});
const homes=[{id:'one',family:'Family A',name:'Sam',expires_at:'2027-01-01'},{id:'two',family:'Family B',name:'Sam',expires_at:'2027-01-01'}];
const space=(family,title)=>({family,expires_at:'2027-01-01',resources:[{id:'list',grant_id:'grant',kind:'groceries',name:'Supplies',permission:'complete',items:[{id:'item',title,done:false}]}]});
it('sends only the authorized item completion and revalidates access',async()=>{
  mocks.call.mockImplementation(async(action)=>action==='homes'?homes:action==='read'?space('Family A','Soap'):{});
  render(<HelperWorkspace token="" clearToken={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('checkbox',{name:'Soap'}));
  await waitFor(()=>expect(mocks.call).toHaveBeenCalledWith('complete',{id:'one',grant_id:'grant',item_id:'item',done:true}));
  expect(await screen.findByRole('checkbox',{name:'Soap'})).toBeInTheDocument();
});
it('clears already displayed data when access is revoked at revalidation',async()=>{
  let allowed=true;
  mocks.call.mockImplementation(async action=>action==='homes'?(allowed?homes:[]):space('Family A','Soap'));
  render(<HelperWorkspace token="" clearToken={vi.fn()}/>);
  expect(await screen.findByText('Soap')).toBeInTheDocument();
  allowed=false;fireEvent.click(screen.getByRole('button',{name:'Refresh'}));
  await waitFor(()=>expect(screen.queryByText('Soap')).not.toBeInTheDocument());
  expect(await screen.findByRole('alert')).toHaveTextContent('Access ended');
});
it('discards a stale family response after switching to another client',async()=>{
  let pending,delay=false;
  mocks.call.mockImplementation(async(action,payload)=>{
    if(action==='homes')return homes;
    if(action==='read' && payload.id==='one' && delay)return new Promise(resolve=>{pending=resolve;});
    return payload.id==='two'?space('Family B','Towels'):space('Family A','Soap');
  });
  render(<HelperWorkspace token="" clearToken={vi.fn()}/>);
  await screen.findByText('Soap');delay=true;
  fireEvent.click(screen.getByRole('button',{name:'Refresh'}));
  await waitFor(()=>expect(pending).toBeTypeOf('function'));
  fireEvent.change(screen.getByLabelText('Shared space'),{target:{value:'two'}});
  expect(await screen.findByText('Towels')).toBeInTheDocument();
  await act(async()=>{pending(space('Family A','Secret A'));});
  expect(screen.queryByText('Secret A')).not.toBeInTheDocument();
  expect(screen.getByText('Towels')).toBeInTheDocument();
});
it('shows only invitation names before explicit acceptance',async()=>{
  mocks.call.mockImplementation(async action=>action==='homes'?[]:action==='preview'?{family:'Family A',expires_at:'2027-01-01',resources:[{name:'Cleaning',permission:'view'}]}:{id:'one'});
  render(<HelperWorkspace token={'a'.repeat(64)} clearToken={vi.fn()}/>);
  expect(await screen.findByRole('heading',{name:'Invitation from Family A'})).toBeInTheDocument();
  expect(mocks.call.mock.calls.some(([action])=>action==='accept')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Accept invitation'}));
  await waitFor(()=>expect(mocks.call).toHaveBeenCalledWith('accept',{token:'a'.repeat(64)}));
});
