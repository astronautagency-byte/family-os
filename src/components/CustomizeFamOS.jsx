import {useEffect,useState} from 'react';
import {useHouseholdFeatures} from '../context/HouseholdFeaturesContext';
import {PAGE_OPTIONS,FEATURE_OPTIONS,presetFeatures} from '../lib/householdFeatures';
import {Settings2,Eye} from './icons';
import {PrimaryButton,SecondaryButton} from './ui';
import './CustomizeFamOS.css';
export default function CustomizeFamOS(){
 const {features,pauseReminders,canManage,loading,error,save,refresh}=useHouseholdFeatures();
 const [draft,setDraft]=useState(features),[pause,setPause]=useState(pauseReminders),[preset,setPreset]=useState('custom'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState('');
 useEffect(()=>{setDraft(features);setPause(pauseReminders);},[features,pauseReminders]);
 const change=(key,value)=>{setDraft({...draft,[key]:value});setPreset('custom');setMessage('');};
 return <section data-tab="family" className="customize-famos">
  <h2 className="settings-section-title"><Settings2 size={20}/> Customize FamOS</h2>
  <p>Keep what helps your family. Turn anything back on later—your data stays safe.</p>
  {!canManage&&<p>Only your household owner can change these settings for the family.</p>}
  {error&&<p role="alert">{error} <button onClick={refresh}>Retry</button></p>}
  <fieldset disabled={!canManage||loading||busy||!!error}>
   <legend>Start with a layout</legend>
   <div className="customize-presets">{[['simple','Simple','Calendar, tasks, and chat'],['everyday','Everyday','Daily essentials, shopping, and meals'],['custom','Custom','Choose what works for your family']].map(([id,title,copy])=><button type="button" key={id} aria-pressed={preset===id} onClick={()=>{setPreset(id);setMessage('');if(id!=='custom')setDraft(presetFeatures(id));}}><strong>{title}</strong><small>{copy}</small></button>)}</div>
   {[['Pages',PAGE_OPTIONS],['Features',FEATURE_OPTIONS]].map(([title,options])=><div className="customize-group" key={title}><h3>{title}</h3>{options.map(([key,label])=><label key={key}><span>{label}{key==="insights"&&<small>Contextual summaries in FamAI.</small>}{key==="routine_suggestions"&&<small>Routine planning prompts in FamAI; your existing routines stay intact.</small>}</span><input type="checkbox" role="switch" checked={draft[key]} onChange={e=>change(key,e.target.checked)}/></label>)}</div>)}
   <p className="customize-dependencies">Kitchen off: no kitchen-based meal suggestions or shopping-to-kitchen prompts. Tasks off: existing rewards remain available, but new chores must wait until Tasks is restored. Recipe Book works independently of Meal Planning.</p>
   <label className="customize-reminders"><input type="checkbox" checked={pause} onChange={e=>{setPause(e.target.checked);setMessage('');}}/><span>Pause reminders and updates for disabled pages<small>Your personal notification preferences stay unchanged. Reminders resume when a page is restored; skipped alerts are not replayed.</small></span></label>
   <aside className="customize-preview"><h3><Eye size={18}/> Your family’s pages</h3><p>{['Today',...PAGE_OPTIONS.filter(([key])=>draft[key]).map(([,label])=>label),'Settings'].join(' · ')}</p><small>Children: {PAGE_OPTIONS.filter(([key])=>['calendar','tasks','rewards','chat'].includes(key)&&draft[key]).map(([,label])=>label).join(' · ')||'No pages enabled; a quiet home screen with sign out.'}</small></aside>
   <div className="customize-actions"><PrimaryButton onClick={async()=>{setBusy(true);setFailure('');setMessage('');try{await save(draft,pause);setMessage('Saved for your family.');}catch(e){setFailure(e.message);}finally{setBusy(false);}}}>{busy?'Saving…':'Save family layout'}</PrimaryButton><SecondaryButton onClick={()=>{setDraft(features);setPause(pauseReminders);setPreset('custom');setMessage('');}}>Discard changes</SecondaryButton></div>
  </fieldset>
  {message&&<p role="status">{message}</p>}{failure&&<p role="alert">{failure}</p>}
 </section>;
}
