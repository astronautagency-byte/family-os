import { BookOpen, Gift, CalendarDays, CheckSquare, CookingPot, Home, MapPin, MessageCircle, Refrigerator, ShoppingCart, Download, MoreHorizontal, Settings, Sparkles } from "./icons";
import { useState } from "react";
import { DESKTOP_DOWNLOAD_LABEL, DESKTOP_DOWNLOAD_PAGE_URL } from "../lib/downloads";
import { openExternalUrl } from "../lib/desktopRuntime";
import { IS_APP_STORE } from "../lib/distribution";
import { Modal } from './ui';
import { useFamily } from "../context/FamilyContext";
import { DEFAULT_SHORTCUTS, CHILD_SHORTCUTS, resolveShortcuts, readShortcuts } from '../lib/navigationShortcuts';
import './navigation-shortcuts.css';

// Fam AI is no longer a tab — it's a global floating action button mounted
// once at the shell level. Leaving it out of TABS keeps the bottom nav
// focused on core surfaces and gives the FAB the always-on presence it
// deserves without conflicting with page routing.
const TABS = [
  { id: "today", label: "Today", icon: Home, hint: "Today's snapshot" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, hint: "Family events" },
  { id: "recipes", label: "Recipe Book", icon: BookOpen, hint: "Your family recipes" },
  { id: "meals", label: "Meals", icon: CookingPot, hint: "This week's plan" },
  { id: "rewards", label: "Rewards", icon: Gift, hint: "RewardBank chores and rewards" },
  { id: "tasks", label: "Tasks", icon: CheckSquare, hint: "Open tasks" },
  { id: "groceries", label: "Shopping", icon: ShoppingCart, hint: "Shared shopping list" },
  { id: "kitchen", label: "Kitchen", icon: Refrigerator, hint: "Freshness and replacement reminders" },
  { id: "chat", label: "Chat", icon: MessageCircle, hint: "Family messages" },
  { id: "location", label: "Location", icon: MapPin, hint: "Optional family location sharing" },
];

const FEATURE_KEYS = { recipes:"recipes", rewards:"rewards", calendar: "calendar", meals: "meals", tasks: "tasks", groceries: "groceries", kitchen: "kitchen", chat: "chat" };

export default function BottomNav({ active, onChange, onOpenAI, features = {}, tabletMode = false, childMode = false, preferenceKey = 'local' }) {
  const [sheet, setSheet] = useState(null);
  const storageKey = `famos:nav-shortcuts:v1:${preferenceKey}:${childMode ? 'child' : 'adult'}`;
  const [preference, setPreference] = useState(() => ({key:storageKey, ids:readShortcuts(storageKey)}));
  const [draft, setDraft] = useState([]);
  const [saveError, setSaveError] = useState('');
  const navigate = (id) => { setSheet(null); onChange(id); };
  const { unreadMessageCount = 0 } = useFamily();
  const visibleTabs = TABS.filter((tab) => {
    return (childMode ? ["calendar","tasks","rewards","chat","location"].includes(tab.id) : true) && features[FEATURE_KEYS[tab.id] || tab.id] !== false;
  });
  const defaults = childMode ? CHILD_SHORTCUTS : DEFAULT_SHORTCUTS;
  const available = visibleTabs.map(tab => tab.id);
  const selected = resolveShortcuts(preference.key === storageKey ? preference.ids : readShortcuts(storageKey), available, defaults);
  const shortcuts = selected.map(id => visibleTabs.find(tab => tab.id === id));
  const editShortcuts = () => { setDraft(selected); setSaveError(''); setSheet('customize'); };
  const saveShortcuts = () => {
    const ids = resolveShortcuts(draft, available, defaults);
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); }
    catch { setSaveError('Your browser could not save these shortcuts. Check available storage and try again.'); return; }
    setPreference({key:storageKey,ids}); setSheet(null);
  };
  return (
    <><nav className="primary-nav m3-navigation" aria-label="FamOS navigation">
      <div className="nav-brand">
        <img src="/icons/famos-app-icon.png" alt="" />
        <div>
          <strong>FamOS</strong>
          <span>Your home base</span>
        </div>
      </div>
      <div className="nav-items">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          const badge = tab.id === "chat" && unreadMessageCount > 0 ? unreadMessageCount : 0;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`nav-item nav-item-${tab.id} m3-navigation-item ${isActive ? "is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              aria-label={badge ? `${tab.label}, ${badge} unread message${badge === 1 ? "" : "s"}` : `${tab.label}${tab.hint ? ` — ${tab.hint}` : ""}`}
              title={tab.hint || tab.label}
            >
              <span className="nav-icon">
                <Icon size={20} strokeWidth={isActive ? 2.25 : 1.8} />
                {badge > 0 && <span className="nav-badge" aria-live="polite">{badge > 9 ? "9+" : badge}</span>}
              </span>
              <span className="nav-label">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      {tabletMode && <p className="nav-foot">Shared family display · Tablet mode</p>}
      {!childMode && !IS_APP_STORE && <button className="nav-foot nav-download" onClick={() => openExternalUrl(DESKTOP_DOWNLOAD_PAGE_URL)}><Download size={15}/>{DESKTOP_DOWNLOAD_LABEL}</button>}
      {!childMode && features.family_packs !== false && <a className="nav-foot" href="/packs">Family Packs · Share with other families</a>}
    </nav>
    <nav className={`reference-mobile-nav ${childMode ? "child-mobile-nav" : ""}`} aria-label="Mobile navigation" style={{gridTemplateColumns:`repeat(${shortcuts.length+1},minmax(0,1fr))`}}>
      {shortcuts.map(({id,label,icon:Icon})=><button key={id} onClick={()=>navigate(id)} aria-current={active===id?'page':undefined}><Icon size={21}/><span>{id==='today'?'Home':label}{id==='chat'&&unreadMessageCount>0?` (${unreadMessageCount>9?'9+':unreadMessageCount})`:''}</span></button>)}
      <button onClick={() => setSheet('more')} aria-expanded={sheet === 'more'} aria-current={!selected.includes(active) ? 'page' : undefined}><MoreHorizontal size={21}/><span>More</span></button>
    </nav>
    <Modal open={sheet !== null} onClose={() => setSheet(null)} title={sheet==='customize'?'Customize shortcuts':'More from FamOS'}>
      {sheet==='customize'?<div className="shortcut-editor">
        <p>Choose up to four shortcuts in the order you want. Other pages stay in More. Saved for your profile on this device.</p>
        {draft.map((id,index)=><label key={index}><span>Shortcut {index+1}</span><select aria-label={`Shortcut ${index+1}`} value={id} onChange={event=>{const next=event.target.value;setDraft(current=>current.map((value,i)=>i===index?next:value===next?id:value));}}>{visibleTabs.map(tab=><option key={tab.id} value={tab.id}>{tab.id==='today'?'Home':tab.label}</option>)}</select></label>)}
        {available.length<4&&<p>Only {available.length} pages are enabled for your profile.</p>}
        {saveError&&<p role="alert">{saveError}</p>}
        <button type="button" className="shortcut-reset" onClick={()=>setDraft(resolveShortcuts([],available,defaults))}>Restore defaults</button>
        <button type="button" className="primary-button" onClick={saveShortcuts}>Save shortcuts</button>
      </div>:<>
      <div className="reference-action-list">
        {visibleTabs.filter(tab => !selected.includes(tab.id)).map(({id, label, icon: Icon}) => <button type="button" key={id} onClick={() => navigate(id)}><span className={`reference-action-icon tone-${id}`}><Icon size={22}/></span><strong>{label}</strong></button>)}
        <button type="button" onClick={editShortcuts}><span className="reference-action-icon"><Settings size={22}/></span><strong>Customize shortcuts</strong></button>
        {!childMode && onOpenAI && features.fam_ai !== false && <button type="button" onClick={() => { setSheet(null); onOpenAI(); }}><span className="reference-action-icon tone-chat"><Sparkles size={22}/></span><strong>Ask Fam AI</strong></button>}
        {!childMode && <button type="button" onClick={() => navigate('settings')}><span className="reference-action-icon tone-calendar"><Settings size={22}/></span><strong>Settings & family</strong></button>}
        {!childMode && !IS_APP_STORE && <button type="button" onClick={() => { setSheet(null); openExternalUrl(DESKTOP_DOWNLOAD_PAGE_URL); }}><span className="reference-action-icon"><Download size={22}/></span><strong>{DESKTOP_DOWNLOAD_LABEL}</strong></button>}
        {!childMode && features.family_packs !== false && <button type="button" onClick={() => window.location.assign('/packs')}><span className="reference-action-icon"><Gift size={22}/></span><strong>Family Packs</strong></button>}
      </div>
      </>}
    </Modal></>
  );
}
