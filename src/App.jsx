import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ShieldCheck } from "lucide-react";
import { FamilyProvider } from "./context/FamilyContext";
import BottomNav from "./components/BottomNav";
import AppTopBar from "./components/AppTopBar";
import InstallPrompt from "./components/InstallPrompt";
import Today from "./pages/Today";
import CalendarPage from "./pages/Calendar";
import Meals from "./pages/Meals";
import Groceries from "./pages/Groceries";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import Chat from "./pages/Chat";
import FamAI from "./pages/FamAI";
import Landing from "./pages/Landing";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Admin from "./pages/Admin";
import { useAuth } from "./context/AuthContext";
import { AuthLoading, HouseholdOnboarding, ResetPassword, SignIn } from "./pages/Auth";
import { supabase } from "./lib/supabase";

gsap.registerPlugin(useGSAP);
const VALID_TABS = ["today","calendar","meals","tasks","groceries","chat","famai","settings"];
const PUBLIC_ROUTES = ["privacy", "terms", "pricing", "signin", "signup"];
const ROUTE_ALIASES = { "sign-in": "signin", "lsign-in": "signin", "sign-up": "signup" };
const VALID_ROUTES = [...VALID_TABS, "landing", "admin", ...PUBLIC_ROUTES];
const normalizeRoute = (route = "") => ROUTE_ALIASES[route] || route;
const pathRoute = () => normalizeRoute(window.location.pathname.replace(/^\/+|\/+$/g, ""));
const routeFromLocation = () => {
  const hashRoute = normalizeRoute(window.location.hash.slice(1));
  if (VALID_ROUTES.includes(hashRoute)) return hashRoute;
  const route = pathRoute();
  return [...PUBLIC_ROUTES, "admin"].includes(route) ? route : "";
};
const tabFromLocation = () => VALID_TABS.includes(routeFromLocation()) ? routeFromLocation() : "today";

export default function App() {
  const [tab, setTabState] = useState(tabFromLocation);
  const [route, setRoute] = useState(routeFromLocation);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("familyos:theme") === "dark");
  const [runtimeConfig, setRuntimeConfig] = useState({ status: "active", features: {} });
  const setTab = (next) => { setTabState(next); window.history.replaceState(null, "", `#${next}`); };
  const shellRef = useRef(null);
  const { configured, session, household, loading, passwordRecovery, onboardingRequired } = useAuth();
  const publicRoute = route;

  useEffect(() => {
    const applyDaypart = () => {
      const hour = new Date().getHours();
      document.documentElement.dataset.daypart = hour < 12 ? "morning" : hour < 17 ? "day" : "evening";
    };
    applyDaypart();
    const timer = window.setInterval(applyDaypart, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const onLocationChange = () => { setRoute(routeFromLocation()); setTabState(tabFromLocation()); };
    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("familyos:theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  useEffect(() => {
    if (!configured || !session || !household?.id || publicRoute === "admin") return;
    let active = true;
    supabase.rpc("household_runtime_config", { target_household: household.id }).then(({ data, error }) => {
      if (!active || error || !data) return;
      setRuntimeConfig(data);
      const featureKey = tab === "famai" ? "fam_ai" : tab;
      if (data.features?.[featureKey] === false) setTab("today");
    });
    return () => { active = false; };
  }, [configured, session, household?.id, publicRoute, tab]);

  useGSAP(() => {
    if (!shellRef.current) return undefined;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const animate = (selector, from, to) => {
        const targets = shellRef.current.querySelectorAll(selector);
        if (targets.length) gsap.fromTo(targets, from, to);
      };
      animate(".page-header, .family-hero, .app-content .kinship-card, .app-content section", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out", stagger: 0.035, clearProps: "opacity,visibility,transform" });
      animate(".nav-item.is-active .nav-icon", { scale: 0.72, y: 3 }, { scale: 1, y: 0, duration: 0.38, ease: "back.out(2)", clearProps: "transform" });
      animate(".reference-fab", { scale: 0.6, rotation: -18 }, { scale: 1, rotation: 0, duration: 0.42, delay: 0.08, ease: "back.out(1.8)", clearProps: "transform" });
      animate(".family-hero img", { x: 8 }, { x: 0, duration: 0.6, ease: "power2.out", clearProps: "transform" });
      animate(".page-spot", { scale: 0.82, rotation: -4 }, { scale: 1, rotation: 0, duration: 0.48, delay: 0.06, ease: "back.out(1.7)", clearProps: "transform" });
    });
    return () => media.revert();
  }, { scope: shellRef, dependencies: [tab], revertOnUpdate: true });

  if (configured && loading) return <AuthLoading />;
  if (configured && passwordRecovery) return <ResetPassword />;
  if (publicRoute === "admin") return <Admin />;
  if (publicRoute === "landing" || publicRoute === "pricing") return <Landing signedIn={!!session} />;
  if (publicRoute === "privacy") return <Privacy signedIn={!!session} />;
  if (publicRoute === "terms") return <Terms signedIn={!!session} />;
  if (configured && !session && publicRoute === "signin") return <SignIn key="signin" initialCreating={false} />;
  if (configured && !session && publicRoute === "signup") return <SignIn key="signup" initialCreating />;
  if (configured && !session) return <Landing />;
  if (configured && (!household || onboardingRequired)) return <HouseholdOnboarding />;
  if (["suspended", "disabled"].includes(runtimeConfig.status)) return (
    <main className="admin-denied">
      <ShieldCheck />
      <h1>This family account is paused</h1>
      <p>Your household data is safe. Contact FamOS support to restore access.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );

  return (
    <FamilyProvider>
      <div className={`app-shell ${darkMode ? "theme-dark" : ""}`} ref={shellRef}>
        <BottomNav active={tab} onChange={setTab} features={runtimeConfig.features} />
        <main className="app-content">
          <AppTopBar onOpenSettings={() => setTab("settings")} onNavigate={setTab} darkMode={darkMode} onToggleDarkMode={() => setDarkMode((value) => !value)} />
          {tab === "today" && <Today goTo={setTab} />}
          {tab === "calendar" && <CalendarPage goTo={setTab} />}
          {tab === "meals" && <Meals />}
          {tab === "groceries" && <Groceries />}
          {tab === "tasks" && <Tasks />}
          {tab === "chat" && <Chat />}
          {tab === "famai" && <FamAI />}
          {tab === "settings" && <Settings />}
        </main>
        <InstallPrompt />
      </div>
    </FamilyProvider>
  );
}
