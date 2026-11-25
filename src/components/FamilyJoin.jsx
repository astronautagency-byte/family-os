import {useState} from 'react';
import {supabase} from '../lib/supabase';
import {Card,PrimaryButton,SecondaryButton,TextField} from './ui';

export default function FamilyJoin({householdId,isOwner=false,onRefresh}) {
  const [code,setCode]=useState('');
  const [issued,setIssued]=useState(null);
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  async function act(action,extra={}) {
    setBusy(true);setError('');setNotice('');
    try {
      const {data:result,error:failure}=await supabase.rpc('family_join',{action,payload:{household_id:householdId,...extra}});
      if(failure || result?.error) throw new Error(result?.error || failure.message);
      if(action==='create') {setIssued(result);setData(null);}
      if(action==='load') setData(result);
      if(action==='revoke') {setIssued(null);setData(null);setNotice('Code revoked.');}
      if(action==='approve' || action==='decline') {setData(null);setNotice(action==='approve'?'Approved. They can check their request and accept the invitation.':'Request declined.');}
      if(action==='request') setNotice(result.status==='approved'?'Approved. Check your invitation to finish joining.':result.status==='declined'?'Your request was declined. Ask your family before trying again.':'Request sent. Your family must approve access.');
      if(action==='status') {
        const requests=result.requests || [];
        setNotice(requests.some(r=>r.status==='approved')?'Approved. Checking your invitation…':requests.some(r=>r.status==='pending'&&!r.expired)?'Waiting for family approval.':'No active request. Ask your family for a current code.');
        await onRefresh?.();
      }
    } catch(failure) {setError(failure.message || 'Could not update family access. Try again.');}
    finally {setBusy(false);}
  }
  async function share(copyOnly=false) {
    setError('');setNotice('');
    const text=`Join our FamOS family. Sign in at https://home.fam-os.app/sign-up and enter ${issued.code}. This code expires in 48 hours. I’ll approve your request.`;
    try {
      if(!copyOnly && navigator.share) await navigator.share({title:'Join our FamOS family',text});
      else {await navigator.clipboard.writeText(text);setNotice('Invitation copied. Paste it into a text or email.');}
    } catch(failure) {if(failure.name!=='AbortError') setError('Sharing was unavailable. Select and copy the displayed code.');}
  }
  if(householdId && !isOwner) return null;
  return <Card className="family-join-panel">
    <h3>{householdId?'Invite with a family code':'Join a family'}</h3>
    <p>{householdId?'Share a code by text or email, then approve each person before they join.':'Already have a family code? Enter it to request access with your verified email.'}</p>
    {householdId ? <>
      {issued && <div className="family-join-code"><strong>{issued.code}</strong><small>Expires {new Date(issued.expires_at).toLocaleString()}</small><SecondaryButton disabled={busy} onClick={()=>share()}>Share code</SecondaryButton><SecondaryButton disabled={busy} onClick={()=>share(true)}>Copy invitation</SecondaryButton></div>}
      <div className="family-join-actions"><PrimaryButton disabled={busy} onClick={()=>act('create')}>{issued?'Replace code':'Create code'}</PrimaryButton><SecondaryButton disabled={busy} onClick={()=>act('load')}>Review access requests</SecondaryButton></div>
      {data?.codes?.filter(c=>!c.revoked).map(c=><div className="family-join-request" key={c.id}><span>Code expires {new Date(c.expires_at).toLocaleString()}</span><SecondaryButton disabled={busy} onClick={()=>act('revoke',{id:c.id})}>Revoke code</SecondaryButton></div>)}
      {issued && <SecondaryButton disabled={busy} onClick={()=>act('revoke',{id:issued.id})}>Revoke displayed code</SecondaryButton>}
      {data?.requests?.map(r=><div className="family-join-request" key={r.id}><span><strong>{r.name || 'Family member'}</strong><small>{r.email}</small></span><div className="family-join-actions"><SecondaryButton disabled={busy} onClick={()=>act('decline',{id:r.id})}>Decline</SecondaryButton><PrimaryButton disabled={busy} onClick={()=>act('approve',{id:r.id})}>Approve member</PrimaryButton></div></div>)}
      {data && !data.requests?.length && <p>No pending requests.</p>}
    </> : <>
      <TextField label="Family code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} autoComplete="off" maxLength={11} placeholder="ABCDE-12345"/>
      <div className="family-join-actions"><PrimaryButton disabled={busy || code.replace(/[^A-Z0-9]/g,'').length!==10} onClick={()=>act('request',{code})}>Request to join</PrimaryButton><SecondaryButton disabled={busy} onClick={()=>act('status')}>Check approval</SecondaryButton></div>
    </>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </Card>;
}
