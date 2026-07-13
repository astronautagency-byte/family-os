import { CalendarDays, CheckSquare, CookingPot, Home, MessageCircle, Settings2, ShoppingCart } from "lucide-react";

const TABS = [
  { id: "today", label: "Today", icon: Home },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "meals", label: "Meals", icon: CookingPot },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "groceries", label: "Groceries", icon: ShoppingCart },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[var(--color-surface)]/92 backdrop-blur-xl border-t border-[var(--color-border)] safe-bottom shadow-[0_-8px_30px_rgba(80,45,25,0.05)]">
      <div className="max-w-md mx-auto grid grid-cols-7 px-1.5 pt-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 relative"
              aria-current={isActive ? "page" : undefined}
            >
              <span className={`w-9 h-7 rounded-xl flex items-center justify-center transition-all ${isActive ? "sunrise-gradient shadow-sm -translate-y-0.5" : ""}`}>
                <Icon size={19} strokeWidth={isActive ? 2.4 : 1.8} color={isActive ? "#191919" : "var(--color-ink-faint)"} />
              </span>
              <span
                className="text-[9.5px] font-medium leading-tight"
                style={{ color: isActive ? "var(--color-accent)" : "var(--color-ink-faint)" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
