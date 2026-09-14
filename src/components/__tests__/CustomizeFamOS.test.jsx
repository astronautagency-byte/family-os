import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import CustomizeFamOS from '../CustomizeFamOS';
import {DEFAULT_FEATURES} from '../../lib/householdFeatures';
const mocks=vi.hoisted(()=>({owner:true,save:vi.fn()}));
vi.mock('../../context/HouseholdFeaturesContext',()=>({useHouseholdFeatures:()=>({features:DEFAULT_FEATURES,pauseReminders:false,canManage:mocks.owner,loading:false,error:'',save:mocks.save,refresh:vi.fn()})}));
afterEach(()=>{cleanup();mocks.owner=true;vi.clearAllMocks();});
it('previews a simple layout without saving until confirmed',async()=>{
 mocks.save.mockResolvedValue();
 render(<CustomizeFamOS/>);
 fireEvent.click(screen.getByRole('button',{name:/Simple/}));
 expect(screen.getByRole('switch',{name:'Kitchen'}).checked).toBe(false);
 expect(mocks.save).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Save family layout'}));
 await screen.findByText('Saved for your family.');
 expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({tasks:true,kitchen:false}),false);
});
it('keeps member controls read-only',()=>{
 mocks.owner=false;render(<CustomizeFamOS/>);
 expect(screen.getByRole('button',{name:'Save family layout'}).closest('fieldset').disabled).toBe(true);
});
it('reports save errors without a success confirmation',async()=>{
 mocks.save.mockRejectedValue(Error('Save failed'));render(<CustomizeFamOS/>);
 fireEvent.click(screen.getByRole('button',{name:'Save family layout'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('Save failed'));
 expect(screen.queryByText('Saved for your family.')).toBeNull();
});
