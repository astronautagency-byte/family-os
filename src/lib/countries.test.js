import {it,expect,vi} from 'vitest';
import {countryCode} from './countries';
import {fetchGooglePlaceSuggestions} from './googleMapsPlaces';
it('normalizes saved country names and ISO codes',()=>{
 expect(countryCode('Canada')).toBe('ca');expect(countryCode('US')).toBe('us');expect(countryCode('United Kingdom')).toBe('gb');expect(countryCode('unknown')).toBe('');
});
it('restricts new Places requests to the selected country',async()=>{
 const fetch=vi.fn().mockResolvedValue({suggestions:[]});
 await fetchGooglePlaceSuggestions({places:{AutocompleteSuggestion:{fetchAutocompleteSuggestions:fetch}},input:'London',country:'Canada'});
 expect(fetch).toHaveBeenCalledWith(expect.objectContaining({includedRegionCodes:['ca']}));
});
it('keeps the restriction when falling back to legacy Places',async()=>{
 const request=vi.fn((args,callback)=>callback([],'OK'));
 const google={maps:{places:{AutocompleteService:class {getPlacePredictions=request;}}}};
 await fetchGooglePlaceSuggestions({google,places:{AutocompleteSuggestion:{fetchAutocompleteSuggestions:vi.fn().mockRejectedValue(new Error('Unavailable'))}},input:'London',country:'United Kingdom'});
 expect(request.mock.calls[0][0].componentRestrictions).toEqual({country:'gb'});
});
it('does not issue worldwide requests when country is unknown',async()=>{
 const fetch=vi.fn();
 expect(await fetchGooglePlaceSuggestions({places:{AutocompleteSuggestion:{fetchAutocompleteSuggestions:fetch}},input:'London'})).toEqual([]);
 expect(fetch).not.toHaveBeenCalled();
});
