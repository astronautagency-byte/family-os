// External links only populate a review form; they never write family data.
export const PARTNER_IMPORT_KEY = 'famos:partner-import:v1';
export const EVENT_IMPORT_KEY = 'famos:partner-event:v1';
const clip = (value, n) => String(value || '').trim().slice(0, n);
export function readPartnerImport(params) {
  const kind = params.get('famos_add');
  if (kind === 'recipe') {
    try {
      const url = new URL(params.get('url'));
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      return { kind, url: url.href, title: clip(params.get('title'), 120) };
    } catch { return null; }
  }
  if (kind !== 'event') return null;
  const title = clip(params.get('title'), 150);
  const start = clip(params.get('start'), 40), end = clip(params.get('end'), 40);
  const isDate = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const date = new Date(`${s}T12:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s; };
  const isDateTime = (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(s) && isDate(s.slice(0, 10)) && !Number.isNaN(Date.parse(s));
  if (!title || !(isDate(start) || isDateTime(start))) return null;
  if (end && (!(isDate(end) || isDateTime(end)) || isDate(start) !== isDate(end) || Date.parse(end) < Date.parse(start))) return null;
  return { kind, title, start, end, location: clip(params.get('location'), 250) };
}
export function eventImportDraft(event) {
  const local = (value) => { const d = new Date(value); return { date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }; };
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.start)) return { title:event.title, date:event.start, startDate:event.start, endDate:event.end || event.start, allDay:true, location:event.location };
  const start = local(event.start), end = event.end ? local(event.end) : local(new Date(new Date(event.start).getTime()+3600000).toISOString());
  return { title:event.title, date:start.date, startDate:start.date, endDate:end.date, start:start.time, end:end.time, allDay:false, location:event.location };
}
