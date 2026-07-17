import { Bell, CalendarDays, CheckSquare, Moon, Settings2, ShoppingCart, Sun, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import { todayISO } from "../lib/dates";

export default function AppTopBar({ onOpenSettings, onNavigate, darkMode, onToggleDarkMode }) {
  const { profile, user } = useAuth();
  const { members, tasks, events, googleEvents, feedEvents, groceries } = useFamily();
  const [open,setOpen]=useState(false); const today=todayISO();
  const [readIds,setReadIds]=useState(()=>{try{return JSON.parse(localStorage.getItem("familyos:read-notifications")||"[]")}catch{return[]}});
  const currentMember = members.find((member) => member.id === user?.id);
  const name = currentMember?.name || profile?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Family";
  const avatar = currentMember?.avatarUrl || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const due=tasks.filter(task=>!task.done&&task.due===today); const todaysEvents=[...events,...googleEvents,...feedEvents].filter(event=>event.start?.slice(0,10)===today); const remaining=groceries.filter(item=>!item.checked).length;
  const notices=useMemo(()=>[...(due.length?[{id:`tasks:${today}:${due.map(item=>item.id).join(",")}`,title:`${due.length} task${due.length===1?"":"s"} due today`,detail:due[0].title,Icon:CheckSquare,tab:"tasks",tone:"peach"}]:[]),...(todaysEvents.length?[{id:`calendar:${today}:${todaysEvents.map(item=>item.id).join(",")}`,title:`${todaysEvents.length} event${todaysEvents.length===1?"":"s"} today`,detail:todaysEvents[0].title,Icon:CalendarDays,tab:"calendar",tone:"blue"}]:[]),...(remaining?[{id:`groceries:${remaining}`,title:`${remaining} groceries remaining`,detail:"Your shared list is ready",Icon:ShoppingCart,tab:"groceries",tone:"mint"}]:[])],[due,today,todaysEvents,remaining]);
  const unread=notices.filter(notice=>!readIds.includes(notice.id));
  const markRead=(ids)=>{const next=[...new Set([...readIds,...ids])].slice(-60);setReadIds(next);localStorage.setItem("familyos:read-notifications",JSON.stringify(next));};
  return <header className="app-topbar">
    <div className="topbar-avatar">{avatar?<img src={avatar} alt={name}/>:<span>{name.slice(0,1).toUpperCase()}</span>}</div>
    <div className="topbar-wordmark"><img src="/brand/famos-icon.png" alt=""/><strong>Fam<span>OS</span></strong></div>
    <div className="topbar-actions">
      <button aria-label={`${unread.length} unread notifications`} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Bell/>{unread.length>0&&<i>{unread.length}</i>}</button>
      <button className="theme-toggle-button" aria-label={darkMode?"Switch to light mode":"Switch to dark mode"} aria-pressed={darkMode} onClick={onToggleDarkMode} type="button">{darkMode?<Sun/>:<Moon/>}</button>
      <button aria-label="Settings" onClick={onOpenSettings}><Settings2/></button>
    </div>
    {open&&<div className="notification-feed"><div className="notification-title"><div><strong>Notifications</strong><span>{unread.length?`${unread.length} unread`:"You’re up to date"}</span></div><div>{unread.length>0&&<button className="mark-read" onClick={()=>markRead(unread.map(item=>item.id))}>Mark read</button>}<button onClick={()=>setOpen(false)} aria-label="Close notifications"><X/></button></div></div>{notices.length?notices.map(({id,title,detail,Icon,tab,tone})=><button className={`notification-row ${readIds.includes(id)?"is-read":"is-unread"} ${tone}`} key={id} onClick={()=>{markRead([id]);onNavigate(tab);setOpen(false)}}><span><Icon/></span><div><strong>{title}</strong><small>{detail}</small></div></button>):<p className="notification-empty">You’re all caught up.</p>}</div>}
  </header>;
}
