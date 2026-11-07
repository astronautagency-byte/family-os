import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Modal, PrimaryButton, SecondaryButton, TextField } from './ui';
import ConfirmAction from './ConfirmAction';
import { defaultAccessExpiry, HELPER_PRESETS, HELP_SERVICES, helperCall, helperInvitationUrl, localDateTime, RESOURCE_LABELS } from '../lib/familyHelpers';
import './family-helpers.css';

function InviteHelper({ householdId, resources, request, onClose, onCreated }) {
  const [name,setName] = useState(''), [email,setEmail] = useState('');
  const [preset,setPreset] = useState(request?.service === 'housekeeping' ? 'housekeeping' : request ? 'nanny' : 'nanny');
  const [expiry,setExpiry] = useState(localDateTime(defaultAccessExpiry(request)));
  const [selected,setSelected] = useState(request ? { [`event:${request.event_id}`]: 'view' } : {});
  const [review,setReview] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const options = request ? resources.filter(r => r.kind === 'event' && r.id === request.event_id) : resources;
  const grants = options.filter(r => selected[`${r.kind}:${r.id}`]).map(r => ({ ...r, permission: selected[`${r.kind}:${r.id}`] }));
  const create = async () => {
    setBusy(true); setError('');
    try {
      const result = await helperCall('invite', { name, email, preset, expires_at: new Date(expiry).toISOString(), request_id: request?.id, grants: grants.map(({id,kind,permission}) => ({id,kind,permission})) }, householdId);
      onCreated(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Modal open title={review ? 'Review helper access' : request ? 'Share this event with your helper' : 'Invite a trusted helper'} onClose={busy ? () => {} : onClose}>
    <form className="family-helper-form" onSubmit={e => { e.preventDefault(); if (review) create(); else setReview(true); }}>
      {!review ? <>
        <TextField label="Helper’s name" value={name} maxLength={80} required onChange={e => setName(e.target.value)} />
        <TextField label="Helper’s email" type="email" value={email} maxLength={254} required onChange={e => setEmail(e.target.value)} />
        <label>Helper type<select value={preset} onChange={e => setPreset(e.target.value)}>{Object.entries(HELPER_PRESETS).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <fieldset><legend>Select what to share</legend><p>Task lists are included. Create one in Tasks → New list, then choose it here. Choose view-only or check-off permission for each list.</p>
          {options.length === 0 && <p>No eligible resources. Create a named task list in Tasks, a shopping list or a FamOS calendar first. Only household-visible resources you created can be shared.</p>}
          {options.map(r => { const key=`${r.kind}:${r.id}`; return <div className="family-helper-resource-choice" key={key}>
            <label><input type="checkbox" checked={!!selected[key]} onChange={e => setSelected(s => ({ ...s, [key]: e.target.checked ? 'view' : undefined }))} /> <span>{r.name}<small>{RESOURCE_LABELS[r.kind]}</small></span></label>
            {selected[key] && <select aria-label={`Permission for ${r.name}`} value={selected[key]} onChange={e => setSelected(s => ({ ...s, [key]: e.target.value }))}><option value="view">View only</option>{!['family_calendar','calendar','event'].includes(r.kind) && <option value="complete">View and check off items</option>}</select>}
          </div>; })}
        </fieldset>
        <TextField label="Access ends" type="datetime-local" value={expiry} required onChange={e => setExpiry(e.target.value)} />
        <small>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Invitation acceptance expires after 7 days or when access ends, whichever is sooner.</small>
      </> : <>
        <p><strong>{name}</strong> ({email}) will have access until <strong>{new Date(expiry).toLocaleString()}</strong>.</p>
        <ul>{grants.map(r => <li key={`${r.kind}:${r.id}`}>{r.name} — {r.permission === 'complete' ? 'View and check off items' : 'View only'}</li>)}</ul>
        <p>Future eligible items added to these resources will also be shared. Private and guardian-only items are excluded. Calendars show event titles and times only.</p>
        <p>Family chat, photos, location, finances and account settings stay private. You can revoke access at any time. Previously viewed information cannot be recalled.</p>
        <p className="family-helper-note">We’ll create an email-bound invitation link for you to send to your helper. No email is sent automatically.</p>
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="family-helper-actions"><SecondaryButton type="button" disabled={busy} onClick={review ? () => setReview(false) : onClose}>{review ? 'Back' : 'Cancel'}</SecondaryButton><PrimaryButton type="submit" disabled={busy || !name.trim() || !email.trim() || !expiry || grants.length === 0}>{busy ? 'Creating…' : review ? 'Create invitation link' : 'Review access'}</PrimaryButton></div>
    </form>
  </Modal>;
}

export default function FamilyHelpers({ householdId, isOwner }) {
  const [data,setData] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(false), [invite,setInvite] = useState(null), [link,setLink] = useState(''), [notice,setNotice] = useState(''), [confirm,setConfirm] = useState(null);
  const generation=useRef(0);
  const invalidate=useCallback(() => { generation.current++; },[]);
  const load = useCallback(async () => {
    const id=++generation.current; setError('');
    try { const result=await helperCall('load',{},householdId); if (generation.current===id) setData(result); }
    catch(err) { if(generation.current===id) { setData(null); setError(err.message); } }
  },[householdId]);
  useEffect(() => { setData(null); setLink(''); if(householdId && isOwner) load(); return invalidate; },[householdId,isOwner,load,invalidate]);
  const run = async (action,payload) => {
    setBusy(true); setError('');
    try { await helperCall(action,payload,householdId); setConfirm(null); setNotice('Updated. Family records have been kept.'); await load(); }
    catch(err) { setError(err.message); } finally { setBusy(false); }
  };
  const resourceName = g => data?.resources.find(r => r.kind===g.kind && r.id===g.resource_id)?.name || 'Shared resource';
  return <section className="family-helpers" aria-label="Family helpers">
    <div className="family-helper-heading"><div><h2>Family helpers</h2><p>Share selected task lists, shopping lists and calendars with a nanny, babysitter or cleaner.</p></div></div>
    {!isOwner ? <Card className="p-4"><p>The family owner manages helper access.</p><a href="/helpers">Open shared helper access</a></Card> : !householdId ? <p>Sign in with a family account to invite a helper.</p> : <>
      <Card className="p-4 family-helper-form"><p>Helpers get their own limited view. They don’t become family members. To renew or expand access, revoke the old invitation and create a new one.</p><div className="family-helper-actions"><PrimaryButton disabled={!data || busy} onClick={() => {setNotice('');setInvite({});}}>Invite helper</PrimaryButton><a href="/helpers">Open helper view</a><SecondaryButton disabled={busy} onClick={load}>Refresh</SecondaryButton></div></Card>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {!data && !error && <p role="status">Loading helper access…</p>}
      {data?.helpers.length===0 && <p>No helpers invited. You choose exactly what each person can access.</p>}
      {data?.helpers.map(a => <Card className="p-4 family-helper-card" key={a.id}>
        <div className="family-helper-heading"><div><h3>{a.name}</h3><p>{a.email} · {HELPER_PRESETS[a.preset]}</p></div><span className="family-helper-state">{a.state}</span></div>
        <p>Access ends {new Date(a.expires_at).toLocaleString()}{a.request_id ? ' · Event-specific access' : ''}</p>
        <ul>{a.grants.map(g => <li key={g.id}><span>{resourceName(g)} · {g.permission==='complete' ? 'Can check off items' : 'View only'}</span>{['active','pending'].includes(a.state) && <button type="button" disabled={busy} onClick={() => setConfirm({ action:'revoke_resource', payload:{id:a.id,grant_id:g.id},title:`Stop sharing ${resourceName(g)}?`,copy:`Remove this resource from ${a.name}’s access. A pending invitation will be revoked; create a fresh link with the remaining resources.` })}>Stop sharing</button>}</li>)}</ul>
        <div className="family-helper-actions">{['active','pending'].includes(a.state) && <SecondaryButton disabled={busy} onClick={() => setConfirm({action:'revoke',payload:{id:a.id},title:`Revoke ${a.name}’s access?`,copy:'Future access through this invitation will stop. Family lists and events will be kept.'})}>Revoke access</SecondaryButton>}<SecondaryButton disabled={busy} onClick={() => setConfirm({action:'remove',payload:{id:a.id},title:`Remove ${a.name}?`,copy:'Revoke this access and remove this helper card. Their account and access from other invitations will be kept.'})}>Remove helper</SecondaryButton></div>
      </Card>)}
      <h3>Help for events</h3><p>Open a FamOS event and choose “Plan help”. Arrange the service with your trusted helper, then mark it confirmed here.</p>
      {data?.requests.length===0 && <p>No event help plans yet.</p>}
      {data?.requests.map(r => <Card className="p-4 family-helper-card" key={r.id}>
        <h4>{HELP_SERVICES[r.service]} · {data.resources.find(x=>x.kind==='event' && x.id===r.event_id)?.name || 'Event'}</h4><p>{new Date(r.starts_at).toLocaleString()} – {new Date(r.ends_at).toLocaleString()}</p><p>{r.area || 'Area not set'} · {r.status}</p>{r.requirements && <p>{r.requirements}</p>}{r.budget && <p>Budget: {r.budget}</p>}
        <div className="family-helper-actions">{r.status==='draft' && <SecondaryButton disabled={busy} onClick={()=>setConfirm({action:'request_status',payload:{id:r.id,status:'confirmed'},title:'Confirm your arrangement?',copy:'Only confirm after arranging the job with your helper. This records your arrangement; it does not book, pay or grant access.'})}>Mark arrangement confirmed</SecondaryButton>}
          {r.status==='confirmed' && <><PrimaryButton disabled={busy || new Date(r.ends_at).getTime()+6*3600000<=Date.now()} onClick={()=>setInvite({request:r})}>Share this event</PrimaryButton><SecondaryButton disabled={busy} onClick={()=>setConfirm({action:'request_status',payload:{id:r.id,status:'completed'},title:'Complete this job?',copy:'This also revokes access attached to this job. Other helper access stays as it is.'})}>Mark completed</SecondaryButton></>}
          {['draft','confirmed'].includes(r.status) && <SecondaryButton disabled={busy} onClick={()=>setConfirm({action:'request_status',payload:{id:r.id,status:'cancelled'},title:'Cancel this help plan?',copy:'This revokes access attached to this job. Contact your helper separately to cancel the service; no provider cancellation or refund is sent.'})}>Cancel plan</SecondaryButton>}
        </div>
      </Card>)}
      {!!data?.audit.length && <details><summary>Recent helper activity</summary><ul>{data.audit.map(a=><li key={a.id}>{data.helpers.find(h=>h.id===a.access_id)?.name || 'Family'} · {a.action.replaceAll('_',' ')} · {new Date(a.created_at).toLocaleString()}</li>)}</ul></details>}
    </>}
    {invite && <InviteHelper householdId={householdId} resources={data?.resources || []} request={invite.request} onClose={()=>setInvite(null)} onCreated={result=>{setInvite(null);setLink(helperInvitationUrl(result.token));load();}}/>}
    <Modal open={!!link} title="Invitation ready" onClose={()=>setLink('')}><div className="family-helper-form"><p>Send this link privately to the helper’s invited email. They must sign in with that verified email to accept it. No email has been sent.</p><TextField label="Invitation link" readOnly value={link}/><SecondaryButton onClick={async()=>{try{await navigator.clipboard.writeText(link);setNotice('Invitation link copied.');}catch{setNotice('Select and copy the invitation link.');}}}>Copy link</SecondaryButton><p>This link is shown only now. If it is lost, revoke the pending invitation and create a new one.</p></div></Modal>
    <ConfirmAction open={!!confirm} title={confirm?.title || ''} copy={confirm?.copy} onClose={()=>setConfirm(null)} onConfirm={()=>run(confirm.action,confirm.payload)} busy={busy} confirmLabel="Confirm"/>
  </section>;
}
