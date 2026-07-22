import { Bot, CalendarDays, CheckSquare, CookingPot, Home, MessageCircle, ShoppingCart } from "lucide-react";
import { useFamily } from "../context/FamilyContext";

const TABS = [
  { id: "today", label: "Today", icon: Home, hint: "Today's snapshot" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, hint: "Family events" },
  { id: "meals", label: "Meals", icon: CookingPot, hint: "This week's plan" },
  { id: "tasks", label: "Tasks", icon: CheckSquare, hint: "Open tasks" },
  { id: "groceries", label: "Shopping", icon: ShoppingCart, hint: "Shared shopping list" },
  { id: "chat", label: "Chat", icon: MessageCircle, hint: "Family messages" },
  { id: "famai", label: "Fam AI", icon: Bot, hint: "Ask anything — meal, grocery, task help" },
];

const FEATURE_KEYS = { calendar: "calendar", meals: "meals", tasks: "tasks", groceries: "groceries", chat: "chat", famai: "fam_ai" };

export default function BottomNav({ active, onChange, features = {}, tabletMode = false }) {
  const { unreadMessageCount = 0 } = useFamily();
  const visibleTabs = TABS.filter((tab) => {
    if (tabletMode && tab.id === "famai") return false;
    return tab.id === "today" || features[FEATURE_KEYS[tab.id]] !== false;
  });
  return (
    <nav className="primary-nav m3-navigation" aria-label="FamOS navigation">
      <div className="nav-brand">
        <img src="/brand/famos-icon-transparent.png" alt="" />
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
              className={`nav-item m3-navigation-item ${isActive ? "is-active" : ""}`}
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
  );
}
