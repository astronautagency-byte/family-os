import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FamilyHelpers from '../FamilyHelpers';
import { HelpRequestForm } from '../EventHelpRequest';
const mocks=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('../../lib/familyHelpers',async importOriginal=>({...await importOriginal(),helperCall:mocks.call}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const resources=[{id:'list-1',kind:'groceries',name:'Cleaning supplies'},{id:'calendar-1',kind:'calendar',name:'Childcare calendar'}];
function setup(helpers=[],requests=[]) {mocks.call.mockImplementation(async action=>action==='load'?{resources,helpers,requests,audit:[]}:action==='invite'?{id:'access-1',token:'a'.repeat(64)}:{});}
it('requires explicit resource selection and review before creating an invitation',async()=>{
  setup();render(<FamilyHelpers householdId="home-1" isOwner/>);
  fireEvent.click(await screen.findByRole('button',{name:'Invite helper'}));
  expect(screen.getByRole('button',{name:'Review access'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Helper’s name'),{target:{value:'Sam'}});
  fireEvent.change(screen.getByLabelText('Helper’s email'),{target:{value:'sam@example.com'}});
  expect(screen.getByRole('button',{name:'Review access'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox',{name:/Cleaning supplies/}));
  fireEvent.change(screen.getByLabelText('Permission for Cleaning supplies'),{target:{value:'complete'}});
  fireEvent.click(screen.getByRole('button',{name:'Review access'}));
  expect(mocks.call).not.toHaveBeenCalledWith('invite',expect.anything(),expect.anything());
  expect(screen.getByText(/Future eligible items/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Create invitation link'}));
  await waitFor(()=>expect(mocks.call).toHaveBeenCalledWith('invite',expect.objectContaining({email:'sam@example.com',grants:[{id:'list-1',kind:'groceries',permission:'complete'}]}),'home-1'));
  expect((await screen.findByLabelText('Invitation link')).value).toContain('/helpers#invite=');
});
it('keeps owner controls away from family members',()=>{
  setup();render(<FamilyHelpers householdId="home-1" isOwner={false}/>);
  expect(screen.getByText('The family owner manages helper access.')).toBeInTheDocument();
  expect(mocks.call).not.toHaveBeenCalled();
});
it('records help hours and approximate area without copying the event address',async()=>{
  setup();const onSaved=vi.fn();
  render(<HelpRequestForm householdId="home-1" event={{id:'event-1',title:'Party',start:'2027-01-10T18:00:00Z',end:'2027-01-10T21:00:00Z',location:'123 Private Street'}} onSaved={onSaved} onCancel={vi.fn()}/>);
  expect(screen.getByLabelText('Approximate area')).toHaveValue('');
  expect(screen.queryByText('123 Private Street')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Approximate area'),{target:{value:'Richmond Hill'}});
  fireEvent.click(screen.getByRole('button',{name:'Save help plan'}));
  await waitFor(()=>expect(mocks.call).toHaveBeenCalledWith('request',expect.objectContaining({event_id:'event-1',service:'babysitting',area:'Richmond Hill'}),'home-1'));
  expect(onSaved).toHaveBeenCalled();
});
