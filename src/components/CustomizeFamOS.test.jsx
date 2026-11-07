import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import CustomizeFamOS from './CustomizeFamOS';
vi.mock('../context/HouseholdFeaturesContext',()=>({useHouseholdFeatures:()=>({features:{tasks:true},pauseReminders:false,canManage:true,save:vi.fn()})}));
it('starts family feature controls collapsed and keeps them editable when expanded',()=>{
 render(<CustomizeFamOS/>);const disclosure=screen.getByText('Family features').closest('details');expect(disclosure.open).toBe(false);fireEvent.click(screen.getByText('Family features'));expect(disclosure.open).toBe(true);expect(screen.getByRole('button',{name:'Save family layout'})).toBeDefined();
});
