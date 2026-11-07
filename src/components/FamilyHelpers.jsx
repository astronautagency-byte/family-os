import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Modal, PrimaryButton, SecondaryButton, TextField } from './ui';
import ConfirmAction from './ConfirmAction';
import HelperInvitation from './HelperInvitation';
import { defaultAccessExpiry, HELPER_PRESETS, HELP_SERVICES, helperCall, helperInvitationUrl, localDateTime, RESOURCE_LABELS, sendHelperSms } from '../lib/familyHelpers';
import './family-helpers.css';

function InviteHelper({ householdId, resources, request, onClose, onCreated }) {
  const [name,setName] = useState(''), [phone,setPhone] = useState(''), [smsConsent,setSmsConsent]=useState(false);
  const [passcode,setPasscode]=useState(()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),x=>(x%10).toString()).join(''));
  const [preset,setPreset] = useState(request?.service === 'housekeeping' ? 'housekeeping' : request ? 'nanny' : 'nanny');
  const [expiry,setExpiry] = useState(localDateTime(defaultAccessExpiry(request)));
  const [selected,setSelected] = useState(request ? { [`event:${request.event_id}`]: 'view' } : {});
  const [review,setReview] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const options = request ? resources.filter(r => r.kind === 'event' && r.id === request.event_id) : resources;
  const grants = options.filter(r => selected[`${r.kind}:${r.id}`]).map(r => ({ ...r, permission: selected[`${r.kind}:${r.id}`] }));
  const resourceChoice=r=>{const key=`${r.kind}:${r.id}`;return <div className="family-helper-resource-choice" key={key}><label><input type="checkbox" checked={!!selected[key]} onChange={e=>setSelected(s=>({...s,[key]:e.target.checked?'view':undefined}))}/><span>{r.name}<small>{RESOURCE_LABELS[r.kind]}</small></span></label>{selected[key]&&<select aria-label={`Permission for ${r.name}`} value={selected[key]} onChange={e=>setSelected(s=>({...s,[key]:e.target.value}))}><option value="view">View only</option>{!['family_calendar','calendar','event'].includes(r.kind)&&<option value="complete">View and check off items</option>}</select>}</div>;};
  const create = async () => {
    setBusy(true); setError('');
    try {
      const result = await helperCall('invite', { name, mode:'passcode', passcode, phone:phone.trim().replace(/[ ()-]/g,''), sms_consent:smsConsent, preset, expires_at: new Date(expiry).toISOString(), request_id: request?.id, grants: grants.map(({id,kind,permission}) => ({id,kind,permission})) }, householdId);
      let delivery='';if(phone.trim()){try{await sendHelperSms(result.id,result.token,passcode);delivery='SMS accepted for delivery.';}catch(err){delivery=err.message;}}
      onCreated({...result,passcode,delivery,phone});
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Modal open title={review ? 'Review helper access' : request ? 'Share this event with your helper' : 'Invite a trusted helper'} onClose={busy ? () => {} : onClose}>
    <form className="family-helper-form" onSubmit={e => { e.preventDefault(); if (review) create(); else setReview(true); }}>
      {!review ? <>
        <TextField label="Helper’s name" value={name} maxLength={80} required onChange={e => setName(e.target.value)} />
        <TextField label="Helper passcode" value={passcode} minLength={8} maxLength={64} required autoComplete="off" onChange={e=>setPasscode(e.target.value)} hint="Assign at least 8 characters. Shown only when you create this invitation."/>
        <TextField label="Mobile number (optional)" type="tel" value={phone} autoComplete="tel" placeholder="+1 416 555 0123" onChange={e=>setPhone(e.target.value)}/>
        {phone.trim()&&<label className="helper-sms-consent"><input type="checkbox" checked={smsConsent} onChange={e=>setSmsConsent(e.target.checked)}/> This helper agrees to receive a one-time access invitation by SMS at this number.</label>}
        <label>Helper type<select value={preset} onChange={e => setPreset(e.target.value)}>{Object.entries(HELPER_PRESETS).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <fieldset><legend>Select what to share</legend><p>Choose the lists or calendars your helper needs. Each list can be view-only or allow check-off.</p>
          {options.length === 0 && <p>No eligible resources. Create a named task list in Tasks, a shopping list or a FamOS calendar first. Only household-visible resources you created can be shared.</p>}
          <div className="family-helper-resource-catalog">{options.filter(r=>r.kind!=='event'||request).sort((a,b)=>(['tasks','groceries','custom','family_calendar','calendar','event'].indexOf(a.kind)-['tasks','groceries','custom','family_calendar','calendar','event'].indexOf(b.kind))).map(resourceChoice)}
          {!request&&options.some(r=>r.kind==='event')&&<details><summary>Individual events ({options.filter(r=>r.kind==='event').length})</summary>{options.filter(r=>r.kind==='event').map(resourceChoice)}</details>}</div>
        </fieldset>
        <TextField label="Access ends" type="datetime-local" value={expiry} required onChange={e => setExpiry(e.target.value)} />
        <small>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Invitation acceptance expires after 7 days or when access ends, whichever is sooner.</small>
      </> : <>
        <p><strong>{name}</strong> will have access until <strong>{new Date(expiry).toLocaleString()}</strong>.</p>
        <ul>{grants.map(r => <li key={`${r.kind}:${r.id}`}>{r.name} — {r.permission === 'complete' ? 'View and check off items' : 'View only'}</li>)}</ul>
        <p>Future eligible items added to these resources will also be shared. Private and guardian-only items are excluded. Calendars show event titles and times only.</p>
        <p>Family chat, photos, location, finances and account settings stay private. You can revoke access at any time. Previously viewed information cannot be recalled.</p>
        <p className="family-helper-note">We’ll create a private link and passcode. If you provided a mobile number and permission, FamOS will automatically send the invitation by SMS. Otherwise, share it privately yourself.</p>
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="family-helper-actions"><SecondaryButton type="button" disabled={busy} onClick={review ? () => setReview(false) : onClose}>{review ? 'Back' : 'Cancel'}</SecondaryButton><PrimaryButton type="submit" disabled={busy || !name.trim() || passcode.length<8 || (phone.trim()&&!smsConsent) || !expiry || grants.length === 0}>{busy ? 'Creating…' : review ? phone.trim()?'Create and send SMS':'Create invitation' : 'Review access'}</PrimaryButton></div>
    </form>
  </Modal>;
}

export default function FamilyHelpers({ householdId, isOwner }) {
  const [data,setData] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(false), [invite,setInvite] = useState(null), [link,setLink] = useState(''), [notice,setNotice] = useState(''), [confirm,setConfirm] = useState(null);
  const [invitation,setInvitation]=useState(null);
  const generation=useRef(0);
  const invalidate=useCallback(() => { generation.current++; },[]);
  const load = useCallback(async () => {
    const id=++generation.current; setError('');
    try { const result=await helperCall('load',{},householdId); if (generation.current===id) setData(result); }
    catch(err) { if(generation.current===id) { setData(null); setError(err.message); } }
  },[householdId]);
  useEffect(() => { setData(null); setLink(''); setInvitation(null); if(householdId && isOwner) load(); return invalidate; },[householdId,isOwner,load,invalidate]);
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
        <div className="family-helper-heading"><div><h3>{a.name}</h3><p>{a.email?.endsWith('@passcode.invalid')?'Passcode access':a.email} · {HELPER_PRESETS[a.preset]}</p></div><span className="family-helper-state">{a.state}</span></div>
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
    {invite && <InviteHelper householdId={householdId} resources={data?.resources || []} request={invite.request} onClose={()=>setInvite(null)} onCreated={result=>{setInvite(null);setInvitation(result);setLink(helperInvitationUrl(result.token)+'&guest=1');load();}}/>}
    {link&&<HelperInvitation key={link} link={link} passcode={invitation?.passcode} delivery={invitation?.delivery} onClose={()=>{setLink('');setInvitation(null);}}/>}
    <ConfirmAction open={!!confirm} title={confirm?.title || ''} copy={confirm?.copy} onClose={()=>setConfirm(null)} onConfirm={()=>run(confirm.action,confirm.payload)} busy={busy} confirmLabel="Confirm"/>
  </section>;
}
