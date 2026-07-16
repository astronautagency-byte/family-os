import { CalendarDays, CheckSquare, CookingPot, Gift, Home, MessageCircle, ShoppingCart } from "lucide-react";

const TABS = [
  { id: "today", label: "Today", icon: Home },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "meals", label: "Meals", icon: CookingPot },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "groceries", label: "Groceries", icon: ShoppingCart },
  { id: "chat", label: "Chat", icon: MessageCircle },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="primary-nav" aria-label="FamilyOS navigation">
      <div className="nav-items">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`nav-item ${isActive ? "is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="nav-icon">
                <Icon size={19} strokeWidth={isActive ? 2.4 : 1.8} color={isActive ? "var(--color-accent)" : "var(--color-ink-faint)"} />
              </span>
              <span className="nav-label">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
