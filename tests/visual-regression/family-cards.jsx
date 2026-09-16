import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import FamilyCardRail from '../../src/components/FamilyCardRail';
import FamilyIllustration,{FAMILY_ART} from '../../src/components/FamilyIllustration';
import IllustratedAvatarPicker from '../../src/components/IllustratedAvatarPicker';
import {Avatar} from '../../src/components/ui';
import CompletionScreen from '../../src/components/CompletionScreen';
import RoutineReviewFields from '../../src/components/RoutineReviewFields';
import BroadcastVoice from '../../src/components/BroadcastVoice';
import PageHeader from '../../src/components/PageHeader';
import '../../src/theme/reference-screens.css';
import '../../src/index.css';
import '../../src/theme/contrast.css';
import '../../src/theme/scheme-accents.css';
function Preview(){
 const [voice,setVoice]=useState(null),[recording,setRecording]=useState(false);
 const [dark,setDark]=useState(false),[selected,setSelected]=useState(''),[avatar,setAvatar]=useState('');
 const [celebration,setCelebration]=useState(''),[routine,setRoutine]=useState({title:'School morning',cadence:'weekdays',start_date:'2026-09-15',assignee_name:'Alex',steps:['Pack lunches','Check backpacks']});
 return <main className={`app-shell ${dark?'theme-dark':''}`} style={{display:'block',minHeight:'100vh',padding:'24px 16px',background:'var(--color-canvas)',color:'var(--color-ink)'}}>
  <div style={{maxWidth:1080,margin:'auto'}}>
   <p>FamOS · Illustration and interaction preview · Sample data</p>
   <section aria-label="Voice note test"><BroadcastVoice value={voice} onChange={setVoice} onRecordingChange={setRecording}/><p>{recording?'Microphone active':voice?'Draft ready — not sent':'No recording'}</p></section>
   <details open><summary>Feature headers</summary>{['Tasks','Kitchen Watch','Meal Plan','Recipe Book','RewardBank'].map(title=><PageHeader key={title} title={title} onAdd={()=>{}}/>)}</details>
   <button onClick={()=>setDark(!dark)} style={{padding:12}}>{dark?'Light mode':'Dark mode'}</button>
   <h1 style={{fontSize:28,margin:'20px 0'}}>A little more together.</h1>
   <button style={{padding:12}} onClick={()=>setCelebration('shopping')}>Preview shopping celebration</button><button style={{padding:12}} onClick={()=>setCelebration('task')}>Preview task celebration</button>
   {celebration && <CompletionScreen kind={celebration} onClose={()=>setCelebration('')}/>}
   <details><summary>Preview routine review form (sample only)</summary><RoutineReviewFields args={routine} members={[{id:'alex',name:'Alex'}]} onChange={setRoutine}/></details>
   <FamilyCardRail title="Your family, at a glance" onSelect={setSelected} cards={[
    {id:'calendar',label:'Today’s schedule',title:'2 events today',detail:'School pickup at 3:30',action:'Open calendar'},
    {id:'tasks',label:'Shared responsibilities',title:'3 tasks to do',detail:'Small jobs. A lighter load for everyone.',action:'View tasks'},
    {id:'meals',label:'What’s for dinner?',title:'Chicken tacos',detail:'Bring everyone to the table.',action:'Open meal plan'},
    {id:'groceries',label:'Your shopping list',title:'8 items to pick up',detail:'Remember it once. Share it with everyone.',action:'Open shopping'},
   ]}/>
   <p role="status">{selected?`Preview action: ${selected}`:'Swipe the cards or use the arrow buttons.'}</p>
   <section style={{maxWidth:420,margin:'40px auto',padding:24,background:'var(--color-surface)',borderRadius:24}}><FamilyIllustration variant="welcome" eager/><h2 style={{fontSize:24,margin:'20px 0 8px'}}>Welcome back</h2><p>Your family’s plans, in one place.</p><label style={{display:'grid',gap:8,marginTop:20}}>Email address<input placeholder="you@example.com" style={{padding:12,border:'1px solid var(--color-border-strong)',borderRadius:12}}/></label></section>
   <h2>Profile avatars</h2><Avatar member={{name:'Your preview',avatarUrl:avatar}} size="xl"/><IllustratedAvatarPicker value={avatar} onChange={setAvatar}/>
   <h2>Matching illustration library</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:16,marginTop:16}}>{Object.entries(FAMILY_ART).filter(([key,value])=>key===value).map(([key])=><figure key={key}><FamilyIllustration variant={key}/><figcaption style={{padding:8}}>{key}</figcaption></figure>)}</div>
  </div>
 </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
