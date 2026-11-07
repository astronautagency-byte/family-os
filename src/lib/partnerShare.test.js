import { it, expect } from 'vitest';
import { readPartnerImport, eventImportDraft } from './partnerShare';
it('accepts timed and all-day events as editable drafts', () => {
 const timed = readPartnerImport(new URLSearchParams('famos_add=event&title=Practice&start=2027-04-10T19%3A00%3A00-04%3A00&end=2027-04-10T20%3A00%3A00-04%3A00'));
 expect(timed.title).toBe('Practice'); expect(eventImportDraft(timed)).toMatchObject({title:'Practice', allDay:false});
 const allDay=readPartnerImport(new URLSearchParams('famos_add=event&title=Camp&start=2027-04-10&end=2027-04-12'));
 expect(eventImportDraft(allDay)).toMatchObject({startDate:'2027-04-10',endDate:'2027-04-12',allDay:true});
});
it('rejects unsafe recipe URLs, incomplete events, ambiguous times and backwards end dates',()=>{
 for (const query of ['famos_add=recipe&url=javascript:alert(1)','famos_add=event&title=A&start=2027-04-10T12:00','famos_add=event&title=A&start=2027-04-10&end=2027-04-01','famos_add=event&start=2027-04-10','famos_add=event&title=A&start=2027-02-31']) expect(readPartnerImport(new URLSearchParams(query))).toBeNull();
 expect(readPartnerImport(new URLSearchParams('famos_add=recipe&url=https%3A%2F%2Fexample.com%2Frecipe')).kind).toBe('recipe');
});
