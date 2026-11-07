import { useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Check, CalendarPlus, Camera } from './icons';
import { Modal, PrimaryButton, SecondaryButton, TextField } from './ui';
import { readRecipePhotos } from '../lib/recipeImport';
import { invokeEdgeFunction } from '../lib/supabase';
import { normalizeImageEvents, imageEventPayload, isDuplicateImageEvent } from '../lib/calendarImageImport';
import './calendar-image-import.css';

export default function CalendarImageImport({ onClose, addEvent, events = [] }) {
  const [photos, setPhotos] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [referenceMonth, setReferenceMonth] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  const savedEvents = useRef([]);
  const selected = drafts.filter(event => event.selected && !event.saved);
  const selectable = drafts.filter(event => !event.saved);
  const update = (key, patch) => setDrafts(rows => rows.map(row => row.key === key ? {...row, ...patch} : row));
  const selectAll = (value) => setDrafts(rows => rows.map(row => row.saved ? row : {...row, selected:value}));
  async function choosePhotos(files) {
    if (locked.current) return;
    locked.current = true; setBusy('Preparing photos'); setError('');
    try {
      const prepared = await readRecipePhotos(Array.from(files));
      setPhotos(prepared); setDrafts([]); setNotes(''); setMessage('');
    } catch (e) { setError(e.message.replaceAll('recipe', 'calendar or event')); }
    finally { locked.current = false; setBusy(''); }
  }
  async function extract() {
    if (locked.current) return;
    locked.current = true; setBusy('Reading your images'); setError(''); setMessage('');
    try {
      const result = await invokeEdgeFunction('import-calendar-image', {photos, referenceMonth});
      const rows = normalizeImageEvents(result.events);
      setDrafts(rows); setNotes(result.notes || '');
      if (!rows.length) setError('No events were found. Try a clearer image showing event names and dates.');
    } catch (e) { setError(e.message); }
    finally { locked.current = false; setBusy(''); }
  }
  async function save() {
    if (locked.current) return;
    locked.current = true; setBusy('Adding events'); setError(''); setMessage('');
    let added = 0, skipped = 0;
    try {
      // Validate all selected drafts before saving any of them.
      const candidates = selected.map(event => {
        try { return {event, payload:imageEventPayload(event)}; }
        catch (e) { throw Error(`${event.title || 'Untitled event'}: ${e.message}`); }
      });
      for (const {event, payload} of candidates) {
        if (isDuplicateImageEvent(payload, [...events, ...savedEvents.current])) {
          update(event.key, {selected:false, saved:true, duplicate:true}); skipped++; continue;
        }
        await addEvent(payload);
        savedEvents.current.push(payload);
        update(event.key, {selected:false, saved:true}); added++;
      }
      setMessage(`${added} event${added === 1 ? '' : 's'} added.${skipped ? ` ${skipped} already on the calendar skipped.` : ''}`);
    } catch (e) { setError(`${added ? `${added} saved. ` : ''}${e.message || 'Could not save events.'} Saved events will not be added again when you retry.`); }
    finally { locked.current = false; setBusy(''); }
  }
  return <Modal open onClose={() => {if (!locked.current) onClose();}} title="Add events from images">
    <div className="calendar-image-import">
      <p>Upload an invitation, event flyer, or a photo of a calendar. Review and edit the events before adding them to your family’s FamOS calendar.</p>
      <div className="calendar-image-sources">
        <label className="calendar-image-upload"><Camera size={22}/><span>Take a photo</span><input type="file" accept="image/*" capture="environment" disabled={!!busy} onChange={e => {if(e.target.files?.length) choosePhotos(e.target.files); e.target.value = '';}}/></label>
        <label className="calendar-image-upload"><ImagePlus size={22}/><span>Choose event or calendar photos</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple disabled={!!busy} onChange={e => {if(e.target.files?.length) choosePhotos(e.target.files); e.target.value = '';}}/></label>
      </div>
      <small>Up to 3 photos, 20 MB each. HEIC support depends on your device. Photos are sent to our AI provider only when you choose “Read images”; originals are not saved to your calendar.</small>
      {photos.length > 0 && <div className="calendar-image-previews">{photos.map((photo,i) => <img key={i} src={photo} alt={`Selected source image ${i+1}`}/>)}</div>}
      <TextField label="Month and year shown (used when missing from the image)" type="month" value={referenceMonth} disabled={!!busy} onChange={e=>setReferenceMonth(e.target.value)}/>
      <PrimaryButton disabled={!!busy || !photos.length || !referenceMonth || drafts.some(d=>d.saved)} onClick={extract}><ImagePlus size={17}/> Read images</PrimaryButton>
      {busy && <p role="status"><LoaderCircle size={17} className="animate-spin"/> {busy}…</p>}
      {notes && <p className="calendar-image-notes">{notes}</p>}
      {drafts.length > 0 && <>
        <h4>Review {drafts.length} event{drafts.length === 1 ? '' : 's'}</h4>
        <p>Check each date and time against the photo. Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}. Recurring schedules need individual review.</p>
        {drafts.length > 1 && <div className="calendar-image-selection" role="group" aria-label="Choose events to add"><span>{selected.length} of {selectable.length} available selected</span><div><button type="button" disabled={!!busy || !selectable.length || selected.length === selectable.length} onClick={()=>selectAll(true)}>Select all</button><button type="button" disabled={!!busy || !selected.length} onClick={()=>selectAll(false)}>Clear selection</button></div></div>}
        {drafts.map((event,i) => <fieldset key={event.key} disabled={!!busy || event.saved} className="calendar-image-event">
          <legend>{event.saved ? <><Check size={16}/> {event.duplicate ? 'Already on calendar' : 'Added'}</> : `Event ${i+1}`}</legend>
          <label className="calendar-image-check"><input type="checkbox" checked={event.selected} onChange={e=>update(event.key,{selected:e.target.checked})}/> Include this event</label>
          {event.warning && <p className="calendar-image-notes">Check: {event.warning}</p>}
          <TextField label="Event title" value={event.title} maxLength={200} onChange={e=>update(event.key,{title:e.target.value})}/>
          <div className="calendar-image-fields"><TextField label="Start date" type="date" value={event.date} onChange={e=>update(event.key,{date:e.target.value})}/><TextField label="End date (optional)" type="date" value={event.endDate} onChange={e=>update(event.key,{endDate:e.target.value})}/></div>
          <label className="calendar-image-check"><input type="checkbox" checked={event.allDay} onChange={e=>update(event.key,{allDay:e.target.checked})}/> All day</label>
          {!event.allDay && <div className="calendar-image-fields"><TextField label="Start time" type="time" value={event.startTime} onChange={e=>update(event.key,{startTime:e.target.value})}/><TextField label="End time" type="time" value={event.endTime} onChange={e=>update(event.key,{endTime:e.target.value})}/></div>}
          <TextField label="Location (optional)" value={event.location} maxLength={500} onChange={e=>update(event.key,{location:e.target.value})}/>
        </fieldset>)}
        <PrimaryButton onClick={save} disabled={!!busy || !selected.length}><CalendarPlus size={17}/> Add {selected.length} selected event{selected.length === 1 ? '' : 's'}</PrimaryButton>
      </>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <SecondaryButton disabled={!!busy} onClick={onClose}>{drafts.some(d=>d.saved) ? 'Done' : 'Cancel'}</SecondaryButton>
    </div>
  </Modal>;
}
