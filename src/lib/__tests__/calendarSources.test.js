import {it,expect} from 'vitest';
import {combineCalendarSources} from '../calendarSources';
import {expandRecurringEvents} from '../eventRecurrence';
it('counts six household events once instead of counting six Google copies too',()=>{
 const household=Array.from({length:6},(_,i)=>({id:`household-${i}`,title:'Event',start:'2026-09-15T10:00:00',calendarId:'shared'}));
 const google=household.map((event,i)=>({...event,id:`google-${i}`}));
 expect(combineCalendarSources(household,google,[],['shared'])).toEqual(household);
});
it('preserves distinct same-title events, unshared calendars and feed events',()=>{
 const a={id:'a',title:'Meeting'},b={id:'b',title:'Meeting',calendarId:'personal'},c={id:'feed'};
 expect(combineCalendarSources([a],[b],[c],['shared'])).toEqual([a,b,c]);
});
it('includes a recurring occurrence in the Home day range',()=>{
 const events=[{id:'weekly',start:'2026-09-08T10:00:00',end:'2026-09-08T11:00:00',recurrence:'weekly'}];
 expect(expandRecurringEvents(events,new Date('2026-09-15T00:00:00'),new Date('2026-09-15T23:59:59'))).toHaveLength(1);
});
