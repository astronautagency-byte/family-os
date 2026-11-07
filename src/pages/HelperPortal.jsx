import { useCallback, useEffect, useRef, useState } from 'react';
import { expandRecurringEvents } from '../lib/eventRecurrence';
import { supabase } from '../lib/supabase';
import { helperCall, RESOURCE_LABELS } from '../lib/familyHelpers';
import { Card, PrimaryButton, SecondaryButton, TextField } from '../components/ui';
import ConfirmAction from '../components/ConfirmAction';
import '../components/family-helpers.css';
import GuestHelperPortal from './GuestHelperPortal';

const PENDING_KEY='famos:helper-invitation';
function invitationToken() {
  const params=new URLSearchParams(window.location.hash.slice(1)), incoming=params.get('invite');
  if(incoming) {
    window.history.replaceState(null,'',window.location.pathname);
    if(/^[a-f0-9]{64}$/.test(incoming)) { try {sessionStorage.setItem(PENDING_KEY,JSON.stringify({token:incoming,at:Date.now()}));}catch{} return incoming; }
  }
  try {const pending=JSON.parse(sessionStorage.getItem(PENDING_KEY)); if(pending && Date.now()-pending.at<7*86400000) return pending.token; sessionStorage.removeItem(PENDING_KEY);}catch{}
  return '';
}

function displayedItems(resource, expiry) {
  if (!['family_calendar','calendar'].includes(resource.kind)) return resource.items;
  const from = new Date(); from.setHours(0,0,0,0);
  return expandRecurringEvents(resource.items,from,new Date(expiry)).filter(item => new Date(item.end)>=from && new Date(item.start)<=new Date(expiry)).sort((a,b)=>new Date(a.start)-new Date(b.start));
}

export function HelperWorkspace({ token, clearToken }) {
  const [homes,setHomes]=useState([]), [selected,setSelected]=useState(''), [data,setData]=useState(null), [preview,setPreview]=useState(null);
  const [error,setError]=useState(''), [busy,setBusy]=useState(false), [leave,setLeave]=useState(false);
  const generation=useRef(0), selection=useRef('');
  const invalidate=useCallback(()=>{generation.current++;},[]);
  const refresh=useCallback(async id=>{
    const version=++generation.current; setData(null); setError('');
    try {
      const relationships=await helperCall('homes');
      if(version!==generation.current) return;
      setHomes(relationships);
      const next=relationships.some(x=>x.id===id) ? id : relationships[0]?.id || '';
      // An expired/revoked selection is never silently replaced with another client.
      if(id && !relationships.some(x=>x.id===id)) {selection.current='';setSelected('');setError('Access ended or is unavailable. Choose another shared space if you have one.');return;}
      selection.current=next; setSelected(next);
      if(next) {const value=await helperCall('read',{id:next}); if(version===generation.current && selection.current===next) setData(value);}
    } catch(err) {if(version===generation.current){setData(null);setHomes([]);setError(err.message);}}
  },[]);
  useEffect(()=>{
    refresh('');
    const interval=setInterval(()=>{if(!document.hidden)refresh(selection.current);},25000);
    const visibility=()=>{generation.current++;setData(null);if(!document.hidden)refresh(selection.current);};
    const focus=()=>refresh(selection.current), offline=()=>{generation.current++;setData(null);setError('Connect to the internet to view shared information.');};
    document.addEventListener('visibilitychange',visibility); window.addEventListener('focus',focus); window.addEventListener('offline',offline);window.addEventListener('online',focus);
    return()=>{invalidate();clearInterval(interval);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',focus);window.removeEventListener('offline',offline);window.removeEventListener('online',focus);};
  },[refresh,invalidate]);
  useEffect(()=>{
    let current=true;
    setPreview(null);
    if(token) helperCall('preview',{token}).then(value=>{if(current)setPreview(value);}).catch(err=>{if(current)setError(err.message);});
    return()=>{current=false;};
  },[token]);
  const accept=async()=>{setBusy(true);setError('');try{const result=await helperCall('accept',{token});setPreview(null);clearToken();await refresh(result.id);}catch(err){setError(err.message);}finally{setBusy(false);}};
  const complete=async(resource,item)=>{
    const id=selection.current;setBusy(true);setError('');
    try{await helperCall('complete',{id,grant_id:resource.grant_id,item_id:item.id,done:!item.done});await refresh(id);}catch(err){generation.current++;setData(null);setError(err.message);}finally{setBusy(false);}
  };
  return <>
    {error && <p role="alert">{error}</p>}
    {preview && <Card className="p-4 family-helper-form"><h2>Invitation from {preview.family}</h2><p>Access ends {new Date(preview.expires_at).toLocaleString()}.</p><ul>{preview.resources.map((r,i)=><li key={i}>{r.name} · {r.permission==='complete'?'View and check off items':'View only'}</li>)}</ul><p>Accept to see only these resources. You can leave at any time.</p><PrimaryButton disabled={busy} onClick={accept}>{busy?'Accepting…':'Accept invitation'}</PrimaryButton><SecondaryButton disabled={busy} onClick={()=>{setPreview(null);clearToken();}}>Dismiss invitation</SecondaryButton></Card>}
    <div className="family-helper-actions"><label>Shared space<select aria-label="Shared space" value={selected} disabled={busy} onChange={e=>{selection.current=e.target.value;setSelected(e.target.value);setData(null);refresh(e.target.value);}}><option value="">Choose a family</option>{homes.map(h=><option key={h.id} value={h.id}>{h.family} · {h.name}{h.request_id?' · Event access':''}</option>)}</select></label><SecondaryButton disabled={busy} onClick={()=>refresh(selection.current)}>Refresh</SecondaryButton></div>
    {!homes.length && !preview && !error && <p>No active shared spaces. Ask a family to invite you, then open their invitation link here.</p>}
    {data && <>
      <div className="family-helper-heading"><div><h2>{data.family}</h2><p>Shared with you · access ends {new Date(data.expires_at).toLocaleString()}</p></div><SecondaryButton disabled={busy} onClick={()=>setLeave(true)}>Leave this shared space</SecondaryButton></div>
      {data.resources.length===0 && <p>No resources are currently shared with you.</p>}
      {data.resources.map(resource=><Card className="p-4 family-helper-card" key={resource.grant_id}><h3>{resource.name}</h3><small>{RESOURCE_LABELS[resource.kind]} · {resource.permission==='complete'?'You can check off items':'View only'}</small>
        {['family_calendar','calendar'].includes(resource.kind) && <p>Upcoming events through the end of your access.</p>}{!displayedItems(resource,data.expires_at).length && <p>No shared items.</p>}
        <ul className="family-helper-items">{displayedItems(resource,data.expires_at).map(item=><li key={item.id}>{item.start ? <div><strong>{item.title}</strong><p>{new Date(item.start).toLocaleString()} – {new Date(item.end).toLocaleString()}</p></div> : <label><input type="checkbox" checked={!!item.done} disabled={busy || resource.permission!=='complete'} onChange={()=>complete(resource,item)}/><span>{item.title}</span></label>}</li>)}</ul>
      </Card>)}
    </>}
    <p className="family-helper-note">This view requires an internet connection. Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}. Family chat, location and account details are not included.</p>
    <ConfirmAction open={leave} title="Leave this shared space?" copy="Your access through this invitation will end. Family records and your other shared spaces will be kept." busy={busy} onClose={()=>setLeave(false)} confirmLabel="Leave" onConfirm={async()=>{setBusy(true);try{await helperCall('leave',{id:selection.current});setLeave(false);selection.current='';setSelected('');await refresh('');}catch(err){setError(err.message);}finally{setBusy(false);}}}/>
  </>;
}

function AccountHelperPortal() {
  const [token,setToken]=useState(invitationToken), [session,setSession]=useState(null), [loading,setLoading]=useState(true);
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [error,setError]=useState(''), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!supabase){setLoading(false);return;}
    let active=true;
    supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);if(error)setError(error.message);setLoading(false);}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setLoading(false);}});
    const focus=()=>supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session);});window.addEventListener('focus',focus);
    return()=>{active=false;subscription.unsubscribe();window.removeEventListener('focus',focus);};
  },[]);
  const clearToken=()=>{setToken('');try{sessionStorage.removeItem(PENDING_KEY);}catch{}};
  const login=async(e,magic=false)=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const result=magic ? await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:`${window.location.origin}/helpers`}}) : await supabase.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      if(magic)setNotice('Check your email for a sign-in link. After signing in, return to this invitation tab or reopen the family’s invitation link.');
    }catch(err){setError(err.message);}finally{setBusy(false);}
  };
  return <main className="helper-portal"><header className="family-helper-heading"><div><a href="/">FamOS</a><h1>Family helpers</h1><p>Only what a family has chosen to share with you.</p></div>{session && <SecondaryButton onClick={async()=>{setSession(null);await supabase.auth.signOut();}}>Sign out</SecondaryButton>}</header>
    {!supabase ? <p role="alert">Family helpers is unavailable until FamOS is connected.</p> : loading ? <p role="status">Checking your account…</p> : session ? <HelperWorkspace key={session.user.id} token={token} clearToken={clearToken}/> : <Card className="p-4"><form className="family-helper-form" onSubmit={login}><h2>Sign in to view shared access</h2><p>Use the email address the family invited. You can keep your own family account.</p><TextField type="email" label="Email" value={email} required autoComplete="email" onChange={e=>setEmail(e.target.value)}/><TextField type="password" label="Password" value={password} autoComplete="current-password" onChange={e=>setPassword(e.target.value)}/><PrimaryButton type="submit" disabled={busy || !password}>{busy?'Signing in…':'Sign in'}</PrimaryButton><SecondaryButton type="button" disabled={busy || !email} onClick={e=>login(e,true)}>Email me a sign-in link</SecondaryButton><p>No password yet? Use the email sign-in link to create or verify your account.</p>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</form></Card>}
  </main>;
}

export default function HelperPortal(){
 const params=new URLSearchParams(window.location.hash.slice(1));
 const legacy=params.has('invite')&&!params.has('guest');
 return legacy||new URLSearchParams(window.location.search).get('account')==='1'?<AccountHelperPortal/>:<GuestHelperPortal/>;
}
