import { useCallback,useEffect,useRef,useState } from 'react';
import { guestHelperCall } from '../lib/familyHelpers';
import HelperResources from '../components/HelperResources';
import { Card,PrimaryButton,SecondaryButton,TextField } from '../components/ui';
import '../components/family-helpers.css';
const KEY='famos:guest-helper';
function entry(){
 const params=new URLSearchParams(window.location.hash.slice(1));const token=params.get('invite');
 try{
  const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');
  if(token&&/^[a-f0-9]{64}$/.test(token))return {token,secret:saved?.token===token?saved.secret:''};
  return saved||{token:'',secret:''};
 }catch{return {token:token||'',secret:''};}
}

export default function GuestHelperPortal(){
 const [access,setAccess]=useState(entry),[passcode,setPasscode]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const version=useRef(0);const invalidate=useCallback(()=>{version.current++;},[]);
 useEffect(()=>{window.history.replaceState(null,'',window.location.pathname);try{sessionStorage.setItem(KEY,JSON.stringify(access));}catch{}},[access]);
 useEffect(()=>{
  if(!access.secret)return;
  let active=true;const read=async()=>{const id=++version.current;if(document.hidden){setData(null);return;}try{const value=await guestHelperCall('read',{secret:access.secret});if(active&&id===version.current){setData(value);setError('');}}catch(err){if(active&&id===version.current){setData(null);setError(err.message);setAccess(a=>({...a,secret:''}));}}};
  read();const interval=setInterval(read,25000);const offline=()=>{version.current++;setData(null);setError('Connect to the internet to view shared information.');};
  window.addEventListener('focus',read);window.addEventListener('online',read);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',read);
  return()=>{active=false;invalidate();clearInterval(interval);window.removeEventListener('focus',read);window.removeEventListener('online',read);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',read);};
 },[access.secret,invalidate]);
 const login=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const next=await guestHelperCall('login',{token:access.token,passcode});setAccess({...access,secret:next.secret});setPasscode('');}catch(err){setError(err.message);}finally{setBusy(false);}};
 const complete=async(r,item)=>{if(busy)return;setBusy(true);setError('');const id=++version.current;setData(null);try{await guestHelperCall('complete',{secret:access.secret,payload:{grant_id:r.grant_id,item_id:item.id,done:!item.done}});const value=await guestHelperCall('read',{secret:access.secret});if(version.current===id&&!document.hidden)setData(value);}catch(err){setData(null);setError(err.message);}finally{setBusy(false);}};
 const logout=async()=>{version.current++;setData(null);const secret=access.secret;setAccess({...access,secret:''});setPasscode('');try{await guestHelperCall('logout',{secret});}catch{setError('This device is signed out. If offline, the previous session expires within 12 hours.');}};
 return <main className="helper-portal"><header className="helper-welcome"><img src="/brand/famos-logo.png" width="56" height="56" alt="FamOS"/><span>FAMILY HELPERS</span><h1>A helping hand.<br/>A shared plan.</h1><p>Just the lists and calendars your family shares with you.</p></header>
  {error&&<p role="alert">{error}</p>}
  {!access.secret?<Card className="p-4"><form className="family-helper-form" onSubmit={login}><h2>Enter your helper passcode</h2><p>No account needed. Use the private invitation link and the passcode the family gave you.</p>{!access.token&&<p>Open the invitation from the family’s text message first.</p>}<TextField label="Passcode" type="password" autoComplete="off" value={passcode} required onChange={e=>setPasscode(e.target.value)}/><PrimaryButton disabled={busy||!access.token||!passcode}>{busy?'Opening…':'Open shared space'}</PrimaryButton><small>Don’t share your link or passcode. Ask the family for a new invitation if you lose access.</small></form></Card>:<>
   <div className="family-helper-heading"><div><h2>{data?.family||'Your shared space'}</h2>{data&&<p>Access ends {new Date(data.expires_at).toLocaleString()}</p>}</div><SecondaryButton disabled={busy} onClick={logout}>End session</SecondaryButton></div>
   {!data&&!error&&<p role="status">Loading shared information…</p>}
   {data?.resources.length===0&&<p>No resources are currently shared.</p>}
   {data&&<HelperResources resources={data.resources} expiry={data.expires_at} busy={busy} onComplete={complete}/>}
  </>}
  <p className="family-helper-note">The family controls this access and can revoke it at any time. Your helper session lasts up to 12 hours. No family chat, photos, location or account settings are included.</p>
 </main>;
}
