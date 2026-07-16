import { useEffect, useMemo, useState } from "react";
import { BedDouble, BookOpen, PawPrint, Plus, Settings2, Star } from "lucide-react";
import { Modal, PrimaryButton, TextField } from "../components/ui";

const KEY="family-os:rewards:v1";
const seed={balance:1250,chores:[{id:"c1",title:"Clean your room",points:50,icon:"bed",done:false},{id:"c2",title:"Feed the dog",points:25,icon:"pet",done:false},{id:"c3",title:"Read for 20 mins",points:100,icon:"book",done:false}],rewards:[{id:"r1",title:"30m Extra Screen Time",cost:500,art:"screen"},{id:"r2",title:"Ice Cream Night",cost:800,art:"icecream"},{id:"r3",title:"Choose Family Movie",cost:650,art:"movie"}],history:[{id:"h1",title:'Redeemed “Later Bedtime”',when:"2 days ago"}]};
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||seed}catch{return seed}};
const icons={bed:BedDouble,pet:PawPrint,book:BookOpen};

export default function Rewards(){
 const [data,setData]=useState(load); const [parentMode,setParentMode]=useState(false); const [modal,setModal]=useState(null);
 const [chore,setChore]=useState({title:"",points:25}); const [reward,setReward]=useState({title:"",cost:500});
 useEffect(()=>localStorage.setItem(KEY,JSON.stringify(data)),[data]);
 const available=data.chores.filter(c=>!c.done); const earned=useMemo(()=>data.chores.filter(c=>c.done).reduce((n,c)=>n+c.points,0),[data.chores]);
 const complete=(id)=>setData(d=>{const item=d.chores.find(c=>c.id===id);if(!item||item.done)return d;return{...d,balance:d.balance+item.points,chores:d.chores.map(c=>c.id===id?{...c,done:true}:c),history:[{id:`h${Date.now()}`,title:`Completed “${item.title}” · +${item.points} points`,when:"Just now"},...d.history]}});
 const redeem=(item)=>{if(data.balance<item.cost)return;setData(d=>({...d,balance:d.balance-item.cost,history:[{id:`h${Date.now()}`,title:`Redeemed “${item.title}”`,when:"Just now"},...d.history]}));};
 const addChore=()=>{if(!chore.title.trim())return;setData(d=>({...d,chores:[...d.chores,{id:`c${Date.now()}`,title:chore.title.trim(),points:Number(chore.points),icon:"bed",done:false}]}));setChore({title:"",points:25});setModal(null)};
 const addReward=()=>{if(!reward.title.trim())return;setData(d=>({...d,rewards:[...d.rewards,{id:`r${Date.now()}`,title:reward.title.trim(),cost:Number(reward.cost),art:"movie"}]}));setReward({title:"",cost:500});setModal(null)};
 return <div className="rewards-screen pb-28"><header className="rewards-header"><img src="/icons/icon-192.png" alt="FamilyOS"/><h1>My Rewards</h1><button onClick={()=>setParentMode(v=>!v)} aria-label="Toggle parent mode">{parentMode?<Settings2/>:<Star/>}</button></header><main className="px-5">
  <section className="balance-card"><div className="reward-star"><Star fill="currentColor"/></div><p>TOTAL BALANCE</p><h2>{data.balance.toLocaleString()} <span>Points</span></h2><small>{earned?`${earned} points earned from chores!`:"Top earner this week!"}</small></section>
  {parentMode&&<div className="parent-banner"><div><strong>Parent controls</strong><span>Assign chores and create experiences</span></div><button onClick={()=>setModal("chore")}><Plus/> Chore</button><button onClick={()=>setModal("reward")}><Plus/> Reward</button></div>}
  <div className="rewards-section-title"><h2>Available Tasks</h2><span>{available.length} Tasks Today</span></div><div className="reward-chores">{available.map(c=>{const Icon=icons[c.icon]||BedDouble;return <article key={c.id}><div className="chore-icon"><Icon/></div><div><strong>{c.title}</strong><span>+{c.points} pts</span></div><button onClick={()=>complete(c.id)} aria-label={`Complete ${c.title}`}><span/></button></article>})}{!available.length&&<p className="reward-empty">All chores complete. Great work!</p>}</div>
  <div className="rewards-section-title"><h2>Redeem Rewards</h2><span>See All</span></div><div className="reward-shop">{data.rewards.map(r=><article key={r.id}><span className="reward-cost">{r.cost} PTS</span><h3>{r.title}</h3><p>Family experience</p><button disabled={data.balance<r.cost} onClick={()=>redeem(r)}>Redeem</button></article>)}</div>
  {data.history[0]&&<div className="reward-history"><span>↶</span><p>You recently {data.history[0].title.toLowerCase()}<small>{data.history[0].when}.</small></p></div>}
 </main><Modal open={modal==="chore"} onClose={()=>setModal(null)} title="Assign a chore"><TextField label="Chore" value={chore.title} onChange={e=>setChore({...chore,title:e.target.value})}/><TextField label="Points" type="number" value={chore.points} onChange={e=>setChore({...chore,points:e.target.value})}/><PrimaryButton onClick={addChore}>Assign chore</PrimaryButton></Modal><Modal open={modal==="reward"} onClose={()=>setModal(null)} title="Create an experience"><TextField label="Experience" value={reward.title} onChange={e=>setReward({...reward,title:e.target.value})}/><TextField label="Point cost" type="number" value={reward.cost} onChange={e=>setReward({...reward,cost:e.target.value})}/><PrimaryButton onClick={addReward}>Create reward</PrimaryButton></Modal></div>
}
