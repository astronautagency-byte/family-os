import {useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {useFamily} from '../context/FamilyContext';
import {supabase} from '../lib/supabase';
import {Avatar,PrimaryButton,SecondaryButton} from './ui';
import './RewardBank.css';
import PageHeader from './PageHeader';
import {Gift, Coins, CheckSquare} from './icons';

const tables=['settings','accounts','rewards','chores','redemptions','ledger'];
export default function RewardBank({onNavigate} = {}) {
 const {user,household}=useAuth();
 const {members=[],memberById={},tasks=[]}=useFamily();
 const parent=household?.role==='owner';
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
 const [child,setChild]=useState(''),[task,setTask]=useState(''),[points,setPoints]=useState(10);
 const [reward,setReward]=useState({title:'',kind:'experience',cost:50,details:''});
 useEffect(()=>{
  let cancelled=false;setData(null);setError('');
  if(!household?.id) {setError('Sign in to a household to use RewardBank.');return;}
  Promise.all(tables.map(name=>supabase.from(`rewardbank_${name}`).select('*').eq('household_id',household.id)))
   .then(results=>{if(cancelled)return;const failure=results.find(r=>r.error);if(failure)throw failure.error;setData(Object.fromEntries(tables.map((name,i)=>[name,results[i].data || []])));})
   .catch(e=>{if(!cancelled)setError(e.code==='42P01' || e.code==='PGRST205'?'RewardBank needs its database update before it can be enabled.':e.message || 'Could not load RewardBank.');});
  return ()=>{cancelled=true;};
 },[household?.id,user?.id,version]);
 async function command(action,payload={}) {
  if(busy)return false;setBusy(true);setError('');
  try {const {error}=await supabase.rpc('rewardbank_command',{h:household.id,action,payload});if(error)throw error;setVersion(v=>v+1);return true;}
  catch(e){setError(e.message || 'Could not save. Please retry.');return false;}
  finally{setBusy(false);}
 }
 const enabled=data?.settings[0]?.enabled;
 const accounts=(data?.accounts || []).filter(a=>parent || a.child_id===user?.id);
 const selectedChild=parent?child:user?.id;
 const account=accounts.find(a=>a.child_id===selectedChild);
 const eligible=tasks.filter(t=>!t.done && (t.assigneeIds || [t.assigneeId]).includes(child));
 const chores=(data?.chores || []).filter(c=>parent || c.child_id===user?.id);
 const requests=(data?.redemptions || []).filter(r=>parent || r.child_id===user?.id);
 return <div className="reward-bank-page">
  <PageHeader title="RewardBank" titleIcon={<Gift size={26}/>} subtitle={parent ? 'Turn family contributions into something to look forward to.' : 'Your chores. Your points. Your next reward.'}/>
  <div className="reward-bank">
   <div className="reward-bank-intro"><Coins size={32}/><div><h2>{parent ? 'Build good habits, together' : 'Small efforts add up'}</h2><p>{parent ? 'Choose chores, approve points, and celebrate with rewards you agree on.' : 'Complete a chore in Tasks. Your parent approves the points, then you can request a reward.'}</p></div>{onNavigate&&<SecondaryButton onClick={()=>onNavigate('tasks')}><CheckSquare size={18}/> Go to Tasks</SecondaryButton>}</div>
   <p className="reward-bank-note">Parents approve earned points and fulfil rewards. Cash is a parent-paid allowance—not a transfer from FamOS.</p>
   {error&&<p role="alert">{error}</p>}
   <SecondaryButton disabled={busy} onClick={()=>setVersion(v=>v+1)}>Refresh RewardBank</SecondaryButton>
   {!data&&!error&&<p role="status">Loading RewardBank…</p>}
   {data&&<fieldset disabled={busy}>
    {parent&&<label className="reward-bank-switch"><input type="checkbox" checked={!!enabled} onChange={e=>command('enable',{enabled:e.target.checked})}/> Enable RewardBank for this household</label>}
    {!enabled?<p>RewardBank is paused. Balances and requests are kept. {parent?'Enable it to start earning and redeeming points.':'Ask your household owner to enable it.'}</p>:<>
     {parent&&<section><h3>Children taking part</h3>
      <p className="reward-bank-note">Choose the children in your household. Only household owners can manage points and rewards.</p>
      <div className="reward-bank-members">{members.filter(m=>m.id!==user?.id).map(m=><button type="button" key={m.id} disabled={accounts.some(a=>a.child_id===m.id)} onClick={()=>command('enroll',{child_id:m.id})}><Avatar member={m}/><span>{m.name}</span><small>{accounts.some(a=>a.child_id===m.id)?'Enabled':'Enable'}</small></button>)}</div>
     </section>}
     <section><h3>{parent?'Point balances':'Your points'}</h3><div className="reward-bank-members">{accounts.map(a=><div key={a.child_id}><Avatar member={memberById[a.child_id]}/><span>{memberById[a.child_id]?.name || 'Member'}</span><strong>{a.balance} pts</strong></div>)}</div>{!accounts.length&&<p>No children enrolled yet.</p>}<p className="reward-bank-note">Available points exclude points reserved for requested rewards.</p></section>
     {parent&&<section><h3>Assign a chore score</h3><p className="reward-bank-note">Assign the task to your child in Tasks first. Suggested scores: quick chore 5, regular chore 10, bigger chore 20.</p>
      <form onSubmit={async e=>{e.preventDefault();if(await command('chore',{child_id:child,task_id:task,points:Number(points)}))setTask('');}}>
       <label>Child<select required value={child} onChange={e=>{setChild(e.target.value);setTask('');}}><option value="">Choose a child</option>{accounts.map(a=><option key={a.child_id} value={a.child_id}>{memberById[a.child_id]?.name || 'Member'}</option>)}</select></label>
       <label>Assigned chore<select required value={task} onChange={e=>setTask(e.target.value)}><option value="">Choose an unfinished task</option>{eligible.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
       <label>Points<input type="number" min="1" max="1000" required value={points} onChange={e=>setPoints(e.target.value)}/></label>
       <PrimaryButton type="submit" disabled={!task || !child}>Save chore points</PrimaryButton>
      </form>
     </section>}
     <section><h3>{parent?'Chores and approvals':'Your earning plan'}</h3>{!chores.length&&<p>No scored chores yet.</p>}
      {chores.map(c=>{const t=tasks.find(t=>t.id===c.task_id);return <article key={c.id}><div><strong>{t?.title || 'Chore'}</strong><small>{memberById[c.child_id]?.name} · {c.points} pts · {c.approved_at?'Points earned':t?.done?'Awaiting parent approval':'Complete in Tasks'}</small></div>{parent&&!c.approved_at&&t?.done&&<SecondaryButton onClick={()=>command('approve',{id:c.id})}>Approve points</SecondaryButton>}</article>;})}
      <p className="reward-bank-note">Each scored task earns points once. For next week, create a new task. Reopening a task does not award points again.</p>
     </section>
     {parent&&<section><h3>Create a reward</h3><form onSubmit={async e=>{e.preventDefault();if(await command('reward',{...reward,cost:Number(reward.cost)}))setReward({...reward,title:'',details:''});}}>
      <label>Reward name<input required maxLength="120" placeholder="Movie night with Katie" value={reward.title} onChange={e=>setReward({...reward,title:e.target.value})}/></label>
      <label>Reward type<select value={reward.kind} onChange={e=>setReward({...reward,kind:e.target.value})}><option value="experience">Experience</option><option value="purchase">Toy or purchase</option><option value="cash">Cash allowance</option></select></label>
      <label>Points needed<input required type="number" min="1" max="100000" value={reward.cost} onChange={e=>setReward({...reward,cost:e.target.value})}/></label>
      <label>What is included?<input maxLength="500" placeholder="Choose a movie and snacks, or specify the allowance amount and currency" value={reward.details} onChange={e=>setReward({...reward,details:e.target.value})}/></label>
      <PrimaryButton type="submit">Create reward</PrimaryButton>
     </form></section>}
     <section className="reward-bank-catalog"><h3><Gift size={20}/> Rewards to work toward</h3>{!data.rewards.length&&<p>{parent?'Create a reward above to give points a purpose.':'Your parent hasn’t added a reward yet.'}</p>}
      {data.rewards.map(r=>{const pending=requests.some(q=>q.reward_id===r.id&&q.child_id===user?.id&&q.status==='requested');return <article key={r.id}><div><strong>{r.title}</strong><small>{r.cost} pts · {r.kind}</small>{r.details&&<p>{r.details}</p>}{!parent&&account&&<><progress max={r.cost} value={Math.min(account.balance,r.cost)} aria-label={`Progress toward ${r.title}`}/><small>{Math.max(0,r.cost-account.balance)} more points needed</small></>}</div>{!parent&&<SecondaryButton disabled={!account || account.balance<r.cost || pending} onClick={()=>command('redeem',{reward_id:r.id})}>{pending?'Requested':'Request reward'}</SecondaryButton>}</article>;})}
     </section>
     <section><h3>Reward requests</h3>{!requests.length&&<p>No rewards requested yet.</p>}{requests.map(r=><article key={r.id}><div><strong>{r.title}</strong><small>{memberById[r.child_id]?.name} · {r.cost} pts · {r.status}</small></div>{parent&&r.status==='requested'&&<div className="reward-bank-actions"><SecondaryButton onClick={()=>command('fulfill',{id:r.id})}>Mark given</SecondaryButton><SecondaryButton onClick={()=>command('decline',{id:r.id})}>Decline & return points</SecondaryButton></div>}</article>)}</section>
     <details><summary>Points history</summary>{data.ledger.filter(e=>parent || e.child_id===user?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(entry=><article key={entry.id}><span>{memberById[entry.child_id]?.name} · {entry.note}</span><strong>{entry.delta>0?'+':''}{entry.delta} pts</strong></article>)}</details>
    </>}
   </fieldset>}
  </div>
 </div>;
}
