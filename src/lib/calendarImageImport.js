const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validCalendarDate(value) {
  if (!DATE.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function normalizeImageEvents(events) {
  if (!Array.isArray(events)) return [];
  const text = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const time = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '') ? v : '';
  return events.slice(0, 60).map((event, index) => ({
    key: index, selected: true, saved: false,
    title: text(event?.title, 200), date: validCalendarDate(event?.date) ? event.date : '',
    endDate: validCalendarDate(event?.endDate) ? event.endDate : '',
    startTime: time(event?.startTime), endTime: time(event?.endTime),
    allDay: event?.allDay === true, location: text(event?.location, 500),
    warning: text(event?.warning, 1000),
  }));
}
export function imageEventPayload(event) {
  if (!event.title.trim()) throw Error('Add an event title.');
  if (!validCalendarDate(event.date)) throw Error('Choose a valid event date.');
  const endDate = event.endDate || event.date;
  if (!validCalendarDate(endDate)) throw Error('Choose a valid end date.');
  if (!event.allDay && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.endTime))) throw Error('Add start and end times, or choose All day.');
  const start = new Date(`${event.date}T${event.allDay ? '00:00:00' : event.startTime + ':00'}`);
  const end = new Date(`${endDate}T${event.allDay ? '23:59:59' : event.endTime + ':00'}`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw Error('The end must be after the start.');
  return { title: event.title.trim(), start: start.toISOString(), end: end.toISOString(), allDay: event.allDay, location: event.location, memberIds: [], recurrence: 'none' };
}
export function isDuplicateImageEvent(payload, existing) {
  return existing.some(event => event.title?.trim().toLowerCase() === payload.title.trim().toLowerCase() && new Date(event.start).getTime() === new Date(payload.start).getTime());
}
