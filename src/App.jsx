import { useEffect, useState } from "react";
import { FamilyProvider } from "./context/FamilyContext";
import BottomNav from "./components/BottomNav";
import Today from "./pages/Today";
import CalendarPage from "./pages/Calendar";
import Meals from "./pages/Meals";
import Groceries from "./pages/Groceries";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import Chat from "./pages/Chat";
import { useAuth } from "./context/AuthContext";
import { AuthLoading, HouseholdOnboarding, SignIn } from "./pages/Auth";

export default function App() {
  const [tab, setTab] = useState("today");
  const { configured, session, household, loading } = useAuth();

  useEffect(() => {
    const applyDaypart = () => {
      const hour = new Date().getHours();
      document.documentElement.dataset.daypart = hour < 12 ? "morning" : hour < 17 ? "day" : "evening";
    };
    applyDaypart();
    const timer = window.setInterval(applyDaypart, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (configured && loading) return <AuthLoading />;
  if (configured && !session) return <SignIn />;
  if (configured && !household) return <HouseholdOnboarding />;

  return (
    <FamilyProvider>
      <div className="max-w-md mx-auto min-h-screen bg-[var(--color-canvas)] relative">
        {tab === "today" && <Today goTo={setTab} />}
        {tab === "calendar" && <CalendarPage goTo={setTab} />}
        {tab === "meals" && <Meals />}
        {tab === "groceries" && <Groceries />}
        {tab === "tasks" && <Tasks />}
        {tab === "chat" && <Chat />}
        {tab === "settings" && <Settings />}
        <BottomNav active={tab} onChange={setTab} />
      </div>
    </FamilyProvider>
  );
}
