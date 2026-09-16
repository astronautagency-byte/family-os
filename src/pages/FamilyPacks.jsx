import {useCallback,useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {useHouseholdFeatures} from '../context/HouseholdFeaturesContext';
import {supabase} from '../lib/supabase';
import {todayISO} from '../lib/dates';
import {PACK_KINDS,PACK_CADENCES,PACK_TOKEN,cleanPack,packCandidates,packLink,publicSource} from '../lib/familyPacks';
import {Package,ArrowLeft,Link2,Check,Share2,BookOpen,CalendarDays,ListChecks,RefreshCw,Trash2} from '../components/icons';
import {DateField} from '../components/ui';
import './FamilyPacks.css';

const icons={tasks:ListChecks,routines:RefreshCw,recipes:BookOpen,meals:CalendarDays};
const destination={tasks:'tasks',routines:'tasks',recipes:'recipes',meals:'meals'};
export function PackContents({pack,onChange}) {
 const edit=(index,patch)=>onChange({...pack,items:pack.items.map((item,i)=>i===index?{...item,...patch}:item)});
 return <div className="pack-items">{pack.items.map((item,index)=><article className="pack-item" key={index}>
  {onChange?<label>Item name<input maxLength={200} value={item.title} onChange={e=>edit(index,{title:e.target.value})}/></label>:<h3>{item.title}</h3>}
  {pack.kind==='routines'&&<>{onChange?<><label>Repeats<select value={item.cadence} onChange={e=>edit(index,{cadence:e.target.value})}>{PACK_CADENCES.map(value=><option key={value}>{value}</option>)}</select></label><label>Optional steps — one per line<textarea rows={3} value={item.steps.join('\n')} onChange={e=>edit(index,{steps:e.target.value.split('\n').filter(Boolean)})}/></label></>:<><p>Repeats {item.cadence}</p><ol>{item.steps.map((step,i)=><li key={i}>{step}</li>)}</ol></>}</>}
  {pack.kind==='meals'&&<p className="pack-meta">Day {item.day+1} · {item.slot}</p>}
  {item.recipe&&<><div className="pack-meta">{item.recipe.servings?`${item.recipe.servings} servings · `:''}{item.recipe.readyInMinutes?`${item.recipe.readyInMinutes} min`:''}</div>
   {onChange?<>{['ingredients','instructions'].map(key=><label key={key}>{key==='ingredients'?'Ingredients':'Cooking steps'} — one per line<textarea rows={5} value={item.recipe[key].join('\n')} onChange={e=>edit(index,{recipe:{...item.recipe,[key]:e.target.value.split('\n')}})}/></label>)}</>:<details><summary>Ingredients & cooking steps</summary><ul>{item.recipe.ingredients.map((text,i)=><li key={i}>{text}</li>)}</ul><ol>{item.recipe.instructions.map((text,i)=><li key={i}>{text}</li>)}</ol></details>}
   {publicSource(item.recipe.sourceUrl)&&<a href={publicSource(item.recipe.sourceUrl)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Original recipe · {item.recipe.sourceName||new URL(item.recipe.sourceUrl).hostname}</a>}
  </>}
  {onChange&&<button className="pack-remove" onClick={()=>onChange({...pack,items:pack.items.filter((_,i)=>i!==index)})}><Trash2 size={16}/> Remove item</button>}
 </article>)}</div>;
}

export default function FamilyPacks() {
 const {user,household}=useAuth();
 const {features,loading:featuresLoading}=useHouseholdFeatures();
 const owner=household?.role==='owner';
 const [token]=useState(()=>window.location.hash.slice(1));
 const [preview,setPreview]=useState(null),[previewLoading,setPreviewLoading]=useState(!!token);
 const [kind,setKind]=useState(()=>{const requested=new URLSearchParams(window.location.search).get('kind');return Object.hasOwn(PACK_KINDS,requested)?requested:'tasks';}),[candidates,setCandidates]=useState([]),[selected,setSelected]=useState([]);
 const [draft,setDraft]=useState(null),[reviewed,setReviewed]=useState(false),[title,setTitle]=useState('');
 const [links,setLinks]=useState([]),[created,setCreated]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[start,setStart]=useState(todayISO()),[imported,setImported]=useState(false);
 const [revoke,setRevoke]=useState(null);
 const enabled=features.family_packs!==false&&features[destination[kind]]!==false;
 useEffect(()=>{
  // Public bearer links should not be indexed. No analytics event contains a token.
  const meta=document.createElement('meta');meta.name='robots';meta.content='noindex, nofollow';document.head.append(meta);
  return()=>meta.remove();
 },[]);
 useEffect(()=>{if(!token)return;let cancelled=false;
  if(!PACK_TOKEN.test(token)){setError('This sharing link is not valid.');setPreviewLoading(false);return;}
  supabase.rpc('preview_family_pack',{t:token}).then(({data,error})=>{
   if(cancelled)return;
   if(error)setError('This pack could not load. Please try again later.');
   else if(!data)setError('This link has expired or was revoked by its owner.');
   else {try{setPreview(cleanPack(data));}catch{setError('This pack has an unsupported format.');}}
   setPreviewLoading(false);
  }).catch(()=>{if(!cancelled){setError('Could not connect. Please try again.');setPreviewLoading(false);}});
  return()=>{cancelled=true;};
 },[token]);
 useEffect(()=>{if(!owner||token||featuresLoading)return;let cancelled=false;
  setLoading(true);setCandidates([]);setSelected([]);setDraft(null);setReviewed(false);setError('');
  if(!enabled){setLoading(false);return;}
  let query=supabase.from(kind==='recipes'?'household_recipes':kind==='meals'?'meals':'tasks').select('*').eq('household_id',household.id);
  if(kind==='tasks'||kind==='routines')query=query.eq('is_done',false).order('created_at',{ascending:false});
  if(kind==='meals') {const end=new Date(`${todayISO()}T12:00:00Z`);end.setUTCDate(end.getUTCDate()+13);query=query.gte('meal_date',todayISO()).lte('meal_date',end.toISOString().slice(0,10)).order('meal_date');}
  if(kind==='recipes')query=query.order('created_at',{ascending:false});
  query.limit(200).then(({data,error})=>{if(cancelled)return;if(error)setError('Could not load your items. Please retry.');else setCandidates(packCandidates(kind,data||[]));setLoading(false);}).catch(()=>{if(!cancelled){setError('Could not connect.');setLoading(false);}});
  return()=>{cancelled=true;};
 },[kind,household?.id,owner,token,enabled,featuresLoading]);
 const loadLinks=useCallback(async()=>{const {data,error}=await supabase.from('family_packs').select('id,token,payload,expires_at,revoked_at').eq('household_id',household?.id).order('created_at',{ascending:false}).limit(50);if(error)throw Error('Sharing is unavailable. The Family Packs database update may not be installed yet.');return data||[];},[household?.id]);
 useEffect(()=>{let active=true;setLinks([]);if(owner&&!token)loadLinks().then(rows=>{if(active)setLinks(rows);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[owner,token,loadLinks]);
 async function run(action){if(busy)return;setBusy(true);setError('');setStatus('');try{await action();}catch(e){setError(e.message||'Something went wrong. Please retry.');}finally{setBusy(false);}}
 async function copy(link){try{await navigator.clipboard.writeText(link);setStatus('Link copied. Share it with another family.');}catch{setStatus('Copy the link from the field below.');}}
 function signin(){try{sessionStorage.setItem('famos:pending-pack',token);}catch{}window.location.assign('/signin');}
 const Icon=icons[preview?.kind||kind];
 return <main className="family-packs">
  <nav className="pack-nav"><a href="/"><ArrowLeft size={18}/> FamOS</a><a href="/packs">Family Packs</a></nav>
  <header className="pack-hero"><span className="pack-symbol"><Package size={30}/></span><div><p className="pack-eyebrow">GOOD IDEAS TRAVEL</p><h1>{preview?.title||'A little help, from one family to another.'}</h1><p>Share what works at home. Make it your own.</p></div></header>
  {error&&<p className="pack-notice" role="alert">{error}</p>}{status&&<p className="pack-notice" role="status">{status}</p>}
  {previewLoading&&<p role="status">Opening your Family Pack…</p>}
  {token&&preview&&<section className="pack-panel"><div className="pack-section-title"><Icon size={22}/><h2>{PACK_KINDS[preview.kind]} · {preview.items.length} {preview.items.length===1?'item':'items'}</h2></div><p>This is a snapshot, not access to the sender’s household. Your copy belongs to you.</p><PackContents pack={preview}/>
   {imported?<div className="pack-notice" role="status"><Check size={22}/> Your copy is ready. Edit it in <a href={`/${destination[preview.kind]}`}>{PACK_KINDS[preview.kind]}</a>.</div>:!user?<div className="pack-import"><p>Preview freely. Sign in or create a FamOS account to save a copy. New household setup includes the standard Pro trial offer.</p><button className="pack-primary" onClick={signin}>Sign in to use this with my family</button></div>:!household?<p><a href="/">Set up your household</a>, then return to this link to import.</p>:!owner?<p>Ask your household owner to import this pack.</p>:features.family_packs===false||features[destination[preview.kind]]===false?<p>This page is turned off for your household. <a href="/settings">Enable it in Family Settings</a> before importing.</p>:<fieldset disabled={busy||featuresLoading} className="pack-import">
    {['meals','routines'].includes(preview.kind)&&<DateField label={preview.kind==='meals'?'Day 1 of your meal plan':'Start repeating on'} min={todayISO()} value={start} onChange={setStart} disabled={busy}/>}
    <p>{preview.kind==='meals'?'Existing meals will never be replaced. Choose an empty date range.':preview.kind==='routines'?'These routines will repeat from your chosen date. Assign them and configure reminders in Tasks.':'Items are copied without assignments, due dates, or reminders.'} Importing the same pack again will not create duplicates.</p>
    <button className="pack-primary" onClick={()=>run(async()=>{const {data,error}=await supabase.rpc('import_family_pack',{t:token,h:household.id,start_date:['meals','routines'].includes(preview.kind)?start:null});if(error)throw error;if(!data)throw Error('Import was not confirmed. Retry safely.');setImported(true);})}>{busy?'Saving your copy…':'Use this with my family'}</button>
   </fieldset>}
  </section>}
  {!token&&(!user?<section className="pack-panel"><h2>Small ideas. Happier households.</h2><p>Turn your routines, recipes, task lists, and meal plans into reusable packs.</p><a href="/signin">Sign in to create a pack</a></section>:!owner?<section className="pack-panel"><p>Family Packs are managed by your household owner.</p><a href="/">Return to FamOS</a></section>:<>
   <section className="pack-panel"><div className="pack-section-title"><Share2 size={22}/><h2>{draft?'Review your public snapshot':'Make a Family Pack'}</h2></div>
    {created?<div className="pack-success"><Check size={28}/><h3>Your pack is ready to share.</h3><p>Anyone with this link can view and copy it. It expires in 90 days; you can revoke it sooner.</p><label>Share link<input readOnly value={packLink(created)} onFocus={e=>e.target.select()}/></label><div className="pack-actions"><button className="pack-primary" onClick={()=>copy(packLink(created))}><Link2 size={18}/> Copy link</button><button onClick={()=>{setCreated('');setDraft(null);setSelected([]);setTitle('');setReviewed(false);}}>Make another pack</button></div></div>:<fieldset disabled={busy}>
     {!draft?<><label>What would you like to share?<select value={kind} onChange={e=>{setKind(e.target.value);setTitle('');}}>{Object.entries(PACK_KINDS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
      <label>Pack name<input maxLength={80} placeholder="Our easy school-week dinners" value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <p>{kind==='meals'?'Choose meals from the next two weeks. Dates become relative day numbers.':kind==='routines'?'Choose existing repeating tasks. Private notes are excluded; add shareable steps during review.':'Choose up to 30 items. Only the checked items will be shared.'}</p>
      {!enabled?<p>This feature is off. Enable it in <a href="/settings">Family Settings</a> to share its content.</p>:loading?<p role="status">Loading your items…</p>:!candidates.length?<p>No eligible items yet. <a href={`/${destination[kind]}`}>Add some first</a>.</p>:<div className="pack-selection">{candidates.map(item=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={!selected.includes(item.id)&&selected.length>=30} onChange={e=>setSelected(ids=>e.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/><span>{item.title}{kind==='meals'&&<small>Day {item.day+1} · {item.slot}</small>}</span></label>)}</div>}
      <button className="pack-primary" disabled={!title.trim()||!selected.length||loading||!enabled} onClick={()=>{try{setDraft(cleanPack({title,kind,items:candidates.filter(item=>selected.includes(item.id))}));setReviewed(false);setError('');}catch(e){setError(e.message);}}}>Review {selected.length||''} selected items</button>
     </>:<><p className="pack-notice">Names, dates, assignments, reward balances, notes, and uploaded photos are not included as metadata. Check the text below for personal details before sharing. Only share recipe text you have permission to distribute; original source credit is retained.</p><label>Pack name<input maxLength={80} value={draft.title} onChange={e=>{setDraft({...draft,title:e.target.value});setReviewed(false);}}/></label><PackContents pack={draft} onChange={value=>{setDraft(value);setReviewed(false);}}/>
      <label className="pack-consent"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>I checked every item for personal details and have permission to share this content. Anyone with the link can copy it.</span></label>
      <div className="pack-actions"><button onClick={()=>setDraft(null)}>Back</button><button className="pack-primary" disabled={!reviewed||!draft.items.length} onClick={()=>run(async()=>{const safe=cleanPack(draft);const {data,error}=await supabase.rpc('publish_family_pack',{h:household.id,p:safe});if(error)throw error;if(!PACK_TOKEN.test(data||''))throw Error('The link could not be confirmed. Check your shared packs before retrying.');setCreated(data);setLinks(await loadLinks());})}>{busy?'Creating link…':'Create private share link'}</button></div>
     </>}
    </fieldset>}
   </section>
   <section className="pack-panel"><h2>Your shared packs</h2><p>Revoking a link stops new previews and imports. Copies already saved by other families remain theirs.</p>{!links.length&&<p>No packs shared yet.</p>}{links.map(link=>{const active=!link.revoked_at&&Date.parse(link.expires_at)>Date.now();return <article className="pack-shared" key={link.id}><div><h3>{link.payload.title}</h3><p>{active?`Expires ${new Date(link.expires_at).toLocaleDateString()}`:link.revoked_at?'Revoked':'Expired'}</p></div>{active&&<div className="pack-actions"><button onClick={()=>{setCreated(link.token);copy(packLink(link.token));}}>Copy link</button><button disabled={busy} onClick={()=>setRevoke(link.id)}>Revoke</button></div>}{revoke===link.id&&<div className="pack-notice"><p>Stop sharing this pack? Existing copies will not be removed.</p><button disabled={busy} onClick={()=>run(async()=>{const {error}=await supabase.rpc('revoke_family_pack',{pack:link.id});if(error)throw error;setRevoke(null);if(created===link.token)setCreated('');setLinks(await loadLinks());setStatus('Link revoked.');})}>Confirm revoke</button><button onClick={()=>setRevoke(null)}>Keep link</button></div>}</article>;})}</section>
  </>)}
 </main>;
}
