import { CalendarDays, CheckSquare, CookingPot, Home, MessageCircle, Refrigerator, ShoppingCart, Plus, MoreHorizontal, Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { Modal } from './ui';
import { useFamily } from "../context/FamilyContext";

// Fam AI is no longer a tab — it's a global floating action button mounted
// once at the shell level. Leaving it out of TABS keeps the bottom nav
// focused on core surfaces and gives the FAB the always-on presence it
// deserves without conflicting with page routing.
const TABS = [
  { id: "today", label: "Today", icon: Home, hint: "Today's snapshot" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, hint: "Family events" },
  { id: "meals", label: "Meals", icon: CookingPot, hint: "This week's plan" },
  { id: "tasks", label: "Tasks", icon: CheckSquare, hint: "Open tasks" },
  { id: "groceries", label: "Shopping", icon: ShoppingCart, hint: "Shared shopping list" },
  { id: "kitchen", label: "Kitchen", icon: Refrigerator, hint: "Freshness and replacement reminders" },
  { id: "chat", label: "Chat", icon: MessageCircle, hint: "Family messages" },
];

const FEATURE_KEYS = { calendar: "calendar", meals: "meals", tasks: "tasks", groceries: "groceries", kitchen: "kitchen", chat: "chat" };

export default function BottomNav({ active, onChange, onAdd, onOpenAI, features = {}, tabletMode = false }) {
  const [sheet, setSheet] = useState(null);
  const navigate = (id) => { setSheet(null); onChange(id); };
  const { unreadMessageCount = 0 } = useFamily();
  const visibleTabs = TABS.filter((tab) => {
    return tab.id === "today" || features[FEATURE_KEYS[tab.id]] !== false;
  });
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
      <p className="nav-foot">{tabletMode ? "Shared family display · Tablet mode" : "Families run better on FamOS."}</p>
    </nav>
    <nav className="reference-mobile-nav" aria-label="Mobile navigation">
      <button onClick={() => navigate('today')} aria-current={active === 'today' ? 'page' : undefined}><Home size={21}/><span>Home</span></button>
      {features.calendar !== false ? <button onClick={() => navigate('calendar')} aria-current={active === 'calendar' ? 'page' : undefined}><CalendarDays size={21}/><span>Calendar</span></button> : <span/>}
      <button className="reference-add-button" onClick={() => setSheet('add')} aria-label="Open quick actions" aria-expanded={sheet === 'add'}><Plus size={28}/></button>
      {features.chat !== false ? <button onClick={() => navigate('chat')} aria-current={active === 'chat' ? 'page' : undefined}><MessageCircle size={21}/><span>Chat{unreadMessageCount > 0 ? ` (${unreadMessageCount > 9 ? '9+' : unreadMessageCount})` : ''}</span></button> : <span/>}
      <button onClick={() => setSheet('more')} aria-expanded={sheet === 'more'} aria-current={!['today','calendar','chat'].includes(active) ? 'page' : undefined}><MoreHorizontal size={21}/><span>More</span></button>
    </nav>
    <Modal open={sheet !== null} onClose={() => setSheet(null)} title={sheet === 'add' ? 'What would you like to do?' : 'More from FamOS'}>
      <div className="reference-action-list">
        {visibleTabs.filter(tab => sheet === 'add' ? !['today','chat'].includes(tab.id) : !['today','calendar','chat'].includes(tab.id)).map(({id, label, icon: Icon, hint}) => <button type="button" key={id} onClick={() => { if (sheet === 'add' && onAdd) { setSheet(null); onAdd(id); } else navigate(id); }}><span className={`reference-action-icon tone-${id}`}><Icon size={23}/></span><span><strong>{sheet === 'add' ? ({calendar:'Add event',tasks:'Add task',groceries:'Add grocery item',kitchen:'Add kitchen item',meals:'Add meal'})[id] : label}</strong><small>{hint}</small></span></button>)}
        {onOpenAI && features.fam_ai !== false && <button type="button" onClick={() => { setSheet(null); onOpenAI(); }}><span className="reference-action-icon tone-chat"><Sparkles size={23}/></span><span><strong>Ask Fam AI</strong><small>Get help planning your day</small></span></button>}
        {sheet === 'more' && <button type="button" onClick={() => navigate('settings')}><span className="reference-action-icon tone-calendar"><Settings size={23}/></span><span><strong>Settings & family</strong><small>People, preferences, and support</small></span></button>}
      </div>
    </Modal></>
  );
}
