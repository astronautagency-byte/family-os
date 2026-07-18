import { CalendarDays, CheckSquare, CookingPot, Home, MessageCircle, ShoppingCart, Sparkles } from "lucide-react";

const TABS = [
  { id: "today", label: "Today", icon: Home },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "meals", label: "Meals", icon: CookingPot },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "groceries", label: "Groceries", icon: ShoppingCart },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "famai", label: "Fam AI", icon: Sparkles },
];

const FEATURE_KEYS = { calendar: "calendar", meals: "meals", tasks: "tasks", groceries: "groceries", chat: "chat", famai: "fam_ai" };

export default function BottomNav({ active, onChange, features = {} }) {
  const visibleTabs = TABS.filter((tab) => tab.id === "today" || features[FEATURE_KEYS[tab.id]] !== false);
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
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`nav-item m3-navigation-item ${isActive ? "is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="nav-icon">
                <Icon size={20} strokeWidth={isActive ? 2.25 : 1.8} />
              </span>
              <span className="nav-label">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="nav-foot">Families run better on FamOS.</p>
    </nav>
  );
}
