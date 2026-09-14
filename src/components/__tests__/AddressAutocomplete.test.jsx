import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import AddressAutocomplete from '../AddressAutocomplete';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../../lib/googleMapsPlaces',()=>({googleMapsApiKey:'test',loadGooglePlaces:async()=>({google:{},places:{}}),fetchGooglePlaceSuggestions:mocks.fetch}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('retains the selected country while typing and clears address metadata when changing country',async()=>{
 const change=vi.fn();await act(async()=>{render(<AddressAutocomplete country="Canada" value="123" onChange={change}/>);});
 fireEvent.change(screen.getByLabelText('Home address'),{target:{value:'123 Main'}});
 expect(change).toHaveBeenLastCalledWith(expect.objectContaining({country:'Canada',address:'123 Main'}));
 fireEvent.change(screen.getByLabelText('Country'),{target:{value:'us'}});
 expect(change).toHaveBeenLastCalledWith(expect.objectContaining({country:'United States',address:'',latitude:null}));
});
it('ignores a late suggestion response after the country changes',async()=>{
 let resolve;mocks.fetch.mockImplementationOnce(()=>new Promise(r=>resolve=r)).mockResolvedValue([]);
 const {rerender}=render(<AddressAutocomplete country="Canada" value="London" onChange={()=>{}}/>);
 await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());
 rerender(<AddressAutocomplete country="United States" value="London" onChange={()=>{}}/>);
 resolve([{placePrediction:{text:{text:'London, Canada'}}}]);
 await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledTimes(2));
 expect(screen.queryByRole('option',{name:'London, Canada'})).toBeNull();
});
