// Shared Google calendars already arrive through household events. Do not
// count their personal Google copies again. Never dedupe by title/time: two
// different appointments can legitimately have identical labels and times.
export function combineCalendarSources(events=[],googleEvents=[],feedEvents=[],sharedGoogleCalendarIds=[]) {
 const shared=new Set(sharedGoogleCalendarIds);
 const direct = new Map(googleEvents.map(event=>[event.id,event]));
 const enriched=events.map(event=>{const source=event.source === "google" && direct.get(event.externalId);return source?.allDay ? {...event,allDay:true,allDayStart:source.allDayStart,allDayEndExclusive:source.allDayEndExclusive,start:source.start,end:source.end} : event;});
 return [...enriched,...googleEvents.filter(event=>!shared.has(event.calendarId)),...feedEvents];
}
