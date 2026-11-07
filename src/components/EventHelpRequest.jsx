import { useState } from 'react';
import { Modal, PrimaryButton, SecondaryButton, TextField, TextAreaField } from './ui';
import { HELP_SERVICES, helperCall, localDateTime } from '../lib/familyHelpers';
import './family-helpers.css';

export function HelpRequestForm({ event, householdId, onSaved, onCancel }) {
  const [service, setService] = useState('babysitting');
  const [start, setStart] = useState(localDateTime(event.start));
  const [end, setEnd] = useState(localDateTime(event.end));
  const [area, setArea] = useState(''), [requirements, setRequirements] = useState(''), [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await helperCall('request', { event_id: event.id, service, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), area, requirements, budget }, householdId);
      onSaved(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <form className="family-helper-form" onSubmit={save}>
    <p>Plan trusted help for <strong>{event.title}</strong>. Arrange the service with your helper, then confirm it in Family helpers before sharing access.</p>
    <label>Help needed<select value={service} onChange={e => setService(e.target.value)}>{Object.entries(HELP_SERVICES).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <div className="family-helper-grid"><TextField label="Help starts" type="datetime-local" value={start} required onChange={e => setStart(e.target.value)} /><TextField label="Help ends" type="datetime-local" value={end} required min={start} onChange={e => setEnd(e.target.value)} /></div>
    <small>Times use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</small>
    <TextField label="Approximate area" value={area} maxLength={120} placeholder="e.g. Richmond Hill" onChange={e => setArea(e.target.value)} />
    <TextAreaField label="Requirements" value={requirements} maxLength={2000} placeholder="Hours, tasks and what kind of help you need" onChange={e => setRequirements(e.target.value)} />
    <TextField label="Budget (optional)" value={budget} maxLength={120} placeholder="e.g. CAD 100 total" onChange={e => setBudget(e.target.value)} />
    <p className="family-helper-note">This saves a private plan. It does not contact a provider, book a service, take payment or share your address.</p>
    {error && <p role="alert">{error}</p>}
    <div className="family-helper-actions"><SecondaryButton type="button" onClick={onCancel} disabled={busy}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={busy || !start || !end || new Date(end) <= new Date(start)}>{busy ? 'Saving…' : 'Save help plan'}</PrimaryButton></div>
  </form>;
}

export default function EventHelpRequest({ event, householdId, onClose }) {
  const [saved,setSaved] = useState(false);
  return <Modal open={!!event} title={saved ? 'Help plan saved' : 'Plan help for this event'} onClose={onClose}>
    {saved ? <div className="family-helper-form"><p>Continue in Settings → Family → Family helpers. Confirm your arrangement there, then create an invitation for the selected event.</p><SecondaryButton onClick={onClose}>Done</SecondaryButton></div> : event && <HelpRequestForm key={event.id} event={event} householdId={householdId} onCancel={onClose} onSaved={() => setSaved(true)} />}
  </Modal>;
}
