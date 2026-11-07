import {afterEach,expect,it,vi} from 'vitest';
import {fetchGoogleCalendarEvents} from '../googleCalendar';
import {parseIcalEvents} from '../icalCalendar';
import {isAllDayEvent,eventOccursOnDate} from '../calendarEventDates';
import {combineCalendarSources} from '../calendarSources';
const savedTZ=process.env.TZ;
afterEach(()=>{process.env.TZ=savedTZ;vi.unstubAllGlobals();});
it('keeps a Google all-day date and its exclusive end and does not misclassify a timed midnight event',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({items:[{id:'a',summary:'All day',start:{date:'2026-11-07'},end:{date:'2026-11-08'}},{id:'b',summary:'Midnight',start:{dateTime:'2026-11-07T00:00:00-05:00'},end:{dateTime:'2026-11-07T01:00:00-05:00'}}]})}));
 const [a,b]=await fetchGoogleCalendarEvents('test',[{id:'cal',summary:'Calendar'}]);expect(a.allDay).toBe(true);expect(a.allDayStart).toBe('2026-11-07');expect(a.allDayEndExclusive).toBe('2026-11-08');expect(eventOccursOnDate(a,'2026-11-07')).toBe(true);expect(eventOccursOnDate(a,'2026-11-08')).toBe(false);expect(isAllDayEvent(b)).toBe(false);
});
it('honours iCalendar TZID rather than interpreting it in the viewer time zone',()=>{
 const feed='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nSUMMARY:Practice\nDTSTART;TZID=America/Los_Angeles:20261107T073000\nDTEND;TZID=America/Los_Angeles:20261107T083000\nEND:VEVENT\nEND:VCALENDAR'; const [e]=parseIcalEvents(feed,{id:'f',name:'Test'});expect(e.start).toBe('2026-11-07T15:30:00.000Z');expect(e.end).toBe('2026-11-07T16:30:00.000Z');expect(e.allDay).toBe(false);
});
it('preserves inclusive start and exclusive end on multi-day iCalendar events',()=>{
 const feed='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nSUMMARY:School break\nDTSTART;VALUE=DATE:20261107\nDTEND;VALUE=DATE:20261110\nEND:VEVENT\nEND:VCALENDAR';const [e]=parseIcalEvents(feed,{id:'f',name:'Test'});expect(e.allDay).toBe(true);expect(eventOccursOnDate(e,'2026-11-07')).toBe(true);expect(eventOccursOnDate(e,'2026-11-09')).toBe(true);expect(eventOccursOnDate(e,'2026-11-10')).toBe(false);
});
it('preserves all-day metadata for the owner of a shared Google calendar',()=>{const stored={id:'local',source:'google',externalId:'gcal_cal_a',calendarId:'cal'};const direct={id:'gcal_cal_a',calendarId:'cal',allDay:true,allDayStart:'2026-11-07',allDayEndExclusive:'2026-11-08',start:'2026-11-07T05:00:00.000Z',end:'2026-11-08T05:00:00.000Z'};const result=combineCalendarSources([stored],[direct],[],['cal']);expect(result).toHaveLength(1);expect(result[0].allDay).toBe(true);expect(result[0].allDayStart).toBe('2026-11-07');});
it('writes all-day Google events with date-only exclusive ends and timed events with dateTime',async()=>{const {googleEventTimes}=await import('../googleCalendar');const start=new Date(2026,10,7,0,0),end=new Date(2026,10,7,23,59,59);expect(googleEventTimes({allDay:true,start:start.toISOString(),end:end.toISOString()},'America/Toronto')).toEqual({start:{date:'2026-11-07'},end:{date:'2026-11-08'}});expect(googleEventTimes({allDay:false,start:start.toISOString(),end:end.toISOString()},'America/Toronto')).toEqual({start:{dateTime:start.toISOString(),timeZone:'America/Toronto'},end:{dateTime:end.toISOString(),timeZone:'America/Toronto'}});});
it('loads every page of a Google calendar instead of dropping later events',async()=>{const event=id=>({id,summary:id,start:{dateTime:'2026-11-07T09:00:00-05:00'},end:{dateTime:'2026-11-07T10:00:00-05:00'}});const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({items:[event('first')],nextPageToken:'next'})}).mockResolvedValueOnce({ok:true,json:async()=>({items:[event('second')]})});vi.stubGlobal('fetch',fetchMock);const found=await fetchGoogleCalendarEvents('token',[{id:'cal',summary:'Calendar'}]);expect(found.map(e=>e.title)).toEqual(['first','second']);expect(fetchMock.mock.calls[1][0]).toContain('pageToken=next');});
