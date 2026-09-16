// Shared Google calendars already arrive through household events. Do not
// count their personal Google copies again. Never dedupe by title/time: two
// different appointments can legitimately have identical labels and times.
export function combineCalendarSources(events=[],googleEvents=[],feedEvents=[],sharedGoogleCalendarIds=[]) {
 const shared=new Set(sharedGoogleCalendarIds);
 return [...events,...googleEvents.filter(event=>!shared.has(event.calendarId)),...feedEvents];
}
