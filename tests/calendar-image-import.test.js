import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageEvents, imageEventPayload, isDuplicateImageEvent, validCalendarDate } from '../src/lib/calendarImageImport.js';

test('rejects impossible dates and leaves uncertain extracted fields blank', () => {
  assert.equal(validCalendarDate('2026-02-30'), false);
  assert.equal(validCalendarDate('2028-02-29'), true);
  const [event] = normalizeImageEvents([{title:'School concert',date:'2026-02-30',startTime:'25:10',allDay:'true'}]);
  assert.equal(event.date,''); assert.equal(event.startTime,''); assert.equal(event.allDay,false);
  assert.throws(()=>imageEventPayload(event),/valid event date/);
});
test('missing times cannot silently become all-day events', () => {
  const [event] = normalizeImageEvents([{title:'Practice',date:'2026-11-06'}]);
  assert.throws(()=>imageEventPayload(event),/start and end times/);
  const payload = imageEventPayload({...event,allDay:true});
  assert.equal(payload.allDay,true);
  assert.ok(new Date(payload.end)>new Date(payload.start));
});
test('supports explicit overnight dates and rejects backwards time ranges', () => {
  const [event] = normalizeImageEvents([{title:'Trip',date:'2026-11-06',startTime:'23:00',endTime:'01:00'}]);
  assert.throws(()=>imageEventPayload(event),/end must be after/);
  assert.ok(imageEventPayload({...event,endDate:'2026-11-07'}).end);
});
test('caps untrusted output, tolerates null rows and detects exact title/time duplicates', () => {
  assert.equal(normalizeImageEvents(new Array(65).fill(null)).length,60);
  const event={title:'School concert',start:'2026-11-06T18:00:00Z'};
  assert.equal(isDuplicateImageEvent({...event,title:' SCHOOL CONCERT '},[event]),true);
  assert.equal(isDuplicateImageEvent({...event,start:'2026-11-07T18:00:00Z'},[event]),false);
});
