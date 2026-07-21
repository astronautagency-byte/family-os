import { Bell, CalendarDays, CheckSquare, Home, MessageCircle, Moon, Settings2, ShoppingCart, Sun, Tablet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import { todayISO } from "../lib/dates";

export default function AppTopBar({ onOpenSettings, onNavigate, darkMode, onToggleDarkMode, tabletMode, tabletModeAvailable = true, onToggleTabletMode }) {
  const { profile, user, household } = useAuth();
  const { members, tasks, events, googleEvents, feedEvents, groceries, messages, unreadMessageCount = 0, markChatRead } = useFamily();
  const [open,setOpen]=useState(false); const today=todayISO();
  const [readIds,setReadIds]=useState(()=>{try{return JSON.parse(localStorage.getItem("familyos:read-notifications")||"[]")}catch{return[]}});
  const currentMember = members.find((member) => member.id === user?.id);
  const name = currentMember?.name || profile?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Family";
  const avatar = currentMember?.avatarUrl || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const due=tasks.filter(task=>!task.done&&task.due===today); const todaysEvents=[...events,...googleEvents,...feedEvents].filter(event=>event.start?.slice(0,10)===today); const remaining=groceries.filter(item=>!item.checked).length;
  const notices=useMemo(()=>[...(due.length?[{id:`tasks:${today}:${due.map(item=>item.id).join(",")}`,title:`${due.length} task${due.length===1?"":"s"} due today`,detail:due[0].title,Icon:CheckSquare,tab:"tasks",tone:"peach"}]:[]),...(todaysEvents.length?[{id:`calendar:${today}:${todaysEvents.map(item=>item.id).join(",")}`,title:`${todaysEvents.length} event${todaysEvents.length===1?"":"s"} today`,detail:todaysEvents[0].title,Icon:CalendarDays,tab:"calendar",tone:"blue"}]:[]),...(remaining?[{id:`groceries:${remaining}`,title:`${remaining} groceries remaining`,detail:"Your shared list is ready",Icon:ShoppingCart,tab:"groceries",tone:"mint"}]:[])],[due,today,todaysEvents,remaining]);
  const unread=notices.filter(notice=>!readIds.includes(notice.id));
  const markRead=(ids)=>{const next=[...new Set([...readIds,...ids])].slice(-60);setReadIds(next);localStorage.setItem("familyos:read-notifications",JSON.stringify(next));};
  // New chat messages get their own live notice, tracked by chat read-state
  // (not the notice read-ids) so opening chat clears it everywhere.
  const latestMessage=[...(messages||[])].reverse().find(m=>m.text);
  const messageNotice=unreadMessageCount>0?{id:"messages",title:`${unreadMessageCount} new message${unreadMessageCount===1?"":"s"}`,detail:latestMessage?.text||"Open the family chat",Icon:MessageCircle,tab:"chat",tone:"lilac"}:null;
  const bellCount=unread.length+(messageNotice?1:0);
  const openChat=()=>{markChatRead?.();onNavigate("chat");setOpen(false);};
  return <header className="app-topbar">
    <div className={`topbar-avatar ${tabletMode ? "is-household" : ""}`}>{tabletMode?<Home aria-hidden="true"/>:avatar?<img src={avatar} alt={name}/>:<span>{name.slice(0,1).toUpperCase()}</span>}</div>
    <div className="topbar-wordmark"><img src="/brand/famos-icon.png" alt=""/><strong>Fam<span>OS</span></strong>{tabletMode&&<em>{household?.name || "Shared display"}</em>}</div>
    <div className="topbar-actions">
      <button className="m3-icon-button" aria-label={`${bellCount} unread notifications`} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Bell/>{bellCount>0&&<i>{bellCount>9?"9+":bellCount}</i>}</button>
      {(tabletModeAvailable||tabletMode)&&<button className={`tablet-mode-button m3-icon-button ${tabletMode ? "is-active" : ""}`} aria-label={tabletMode?"Exit tablet mode":"Turn on tablet mode"} aria-pressed={tabletMode} title={tabletMode?"Exit tablet mode":"Tablet mode: shared household display"} onClick={onToggleTabletMode} type="button"><Tablet/></button>}
      <button className="theme-toggle-button m3-icon-button" aria-label={darkMode?"Switch to light mode":"Switch to dark mode"} aria-pressed={darkMode} onClick={onToggleDarkMode} type="button">{darkMode?<Sun/>:<Moon/>}</button>
      {!tabletMode&&<button className="m3-icon-button" aria-label="Settings" onClick={onOpenSettings}><Settings2/></button>}
    </div>
    {open&&<div className="notification-feed"><div className="notification-title"><div><strong>Notifications</strong><span>{bellCount?`${bellCount} unread`:"You’re up to date"}</span></div><div>{bellCount>0&&<button className="mark-read" onClick={()=>{if(messageNotice)markChatRead?.();markRead(unread.map(item=>item.id))}}>Mark read</button>}<button onClick={()=>setOpen(false)} aria-label="Close notifications"><X/></button></div></div>{(messageNotice||notices.length)?<>{messageNotice&&<button className={`notification-row is-unread ${messageNotice.tone}`} onClick={openChat}><span><messageNotice.Icon/></span><div><strong>{messageNotice.title}</strong><small>{messageNotice.detail}</small></div></button>}{notices.map(({id,title,detail,Icon,tab,tone})=><button className={`notification-row ${readIds.includes(id)?"is-read":"is-unread"} ${tone}`} key={id} onClick={()=>{markRead([id]);onNavigate(tab);setOpen(false)}}><span><Icon/></span><div><strong>{title}</strong><small>{detail}</small></div></button>)}</>:<p className="notification-empty">You’re all caught up.</p>}</div>}
  </header>;
}
