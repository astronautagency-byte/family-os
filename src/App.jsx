import { useEffect, useState } from "react";
import { FamilyProvider } from "./context/FamilyContext";
import BottomNav from "./components/BottomNav";
import AppTopBar from "./components/AppTopBar";
import Today from "./pages/Today";
import CalendarPage from "./pages/Calendar";
import Meals from "./pages/Meals";
import Groceries from "./pages/Groceries";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import Chat from "./pages/Chat";
import Finance from "./pages/Finance";
import Rewards from "./pages/Rewards";
import { useAuth } from "./context/AuthContext";
import { AuthLoading, HouseholdOnboarding, ResetPassword, SignIn } from "./pages/Auth";

export default function App() {
  const [tab, setTab] = useState("today");
  const { configured, session, household, loading, passwordRecovery, onboardingRequired } = useAuth();

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
  if (configured && passwordRecovery) return <ResetPassword />;
  if (configured && !session) return <SignIn />;
  if (configured && (!household || onboardingRequired)) return <HouseholdOnboarding />;

  return (
    <FamilyProvider>
      <div className="app-shell">
        <BottomNav active={tab} onChange={setTab} />
        <main className="app-content">
          {tab !== "rewards" && <AppTopBar onOpenSettings={() => setTab("settings")} />}
          {tab === "today" && <Today goTo={setTab} />}
          {tab === "calendar" && <CalendarPage goTo={setTab} />}
          {tab === "meals" && <Meals />}
          {tab === "groceries" && <Groceries />}
          {tab === "tasks" && <Tasks />}
          {tab === "chat" && <Chat />}
          {tab === "finance" && <Finance />}
          {tab === "settings" && <Settings />}
          {tab === "rewards" && <Rewards />}
        </main>
      </div>
    </FamilyProvider>
  );
}
