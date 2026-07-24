import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { FamilyProvider } from "./context/FamilyContext";
import BottomNav from "./components/BottomNav";
import AppTopBar from "./components/AppTopBar";
import InstallPrompt from "./components/InstallPrompt";
import { useAuth } from "./context/AuthContext";
import { AuthLoading, HouseholdOnboarding, ResetPassword, SignIn } from "./pages/Auth";
import { supabase } from "./lib/supabase";

// Route/page-level code splitting: each page is its own chunk, so the initial
// bundle isn't the whole app. Signed-out visitors load only Landing; signed-in
// users load Today first and other tabs on demand.
const Today = lazy(() => import("./pages/Today"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Meals = lazy(() => import("./pages/Meals"));
const Groceries = lazy(() => import("./pages/Groceries"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Settings = lazy(() => import("./pages/Settings"));
const Chat = lazy(() => import("./pages/Chat"));
const FamAI = lazy(() => import("./pages/FamAI"));
const Landing = lazy(() => import("./pages/Landing"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Admin = lazy(() => import("./pages/Admin"));

const PageFallback = () => (
  <div className="app-page-skeleton" role="status" aria-label="Loading page">
    <div className="skeleton-header">
      <div className="skeleton-eyebrow shimmer" />
      <div className="skeleton-title shimmer" />
      <div className="skeleton-subtitle shimmer" />
    </div>
    <div className="skeleton-cards">
      <div className="skeleton-card shimmer" />
      <div className="skeleton-card skeleton-card--tall shimmer" />
      <div className="skeleton-card shimmer" />
      <div className="skeleton-card skeleton-card--short shimmer" />
      <div className="skeleton-card shimmer" />
    </div>
  </div>
);
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
  const [tab, setTabState] = useState(() => {
    const requestedTab = tabFromLocation();
    const tabletActive = localStorage.getItem("familyos:tablet-mode") === "true"
      && typeof window !== "undefined"
      && window.matchMedia("(min-width: 700px) and (max-width: 1100px)").matches;
    return tabletActive && ["settings", "famai"].includes(requestedTab) ? "today" : requestedTab;
  });
  const [route, setRoute] = useState(routeFromLocation);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("familyos:theme") === "dark");
  const [tabletMode, setTabletMode] = useState(() => localStorage.getItem("familyos:tablet-mode") === "true");
  // Tablet mode is a shared-display layout meant only for tablet-sized screens.
  // We track whether the viewport is actually a tablet so the mode never applies
  // on phones or desktops even if the stored preference is on.
  const [isTabletViewport, setIsTabletViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 700px) and (max-width: 1100px)").matches
  );
  const effectiveTabletMode = tabletMode && isTabletViewport;
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
    const mq = window.matchMedia("(min-width: 700px) and (max-width: 1100px)");
    const onChange = (event) => setIsTabletViewport(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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
    localStorage.setItem("familyos:tablet-mode", String(tabletMode));
    document.documentElement.dataset.tabletMode = effectiveTabletMode ? "true" : "false";
    if (effectiveTabletMode && ["settings", "famai"].includes(tab)) setTab("today");
    return () => {
      delete document.documentElement.dataset.tabletMode;
    };
  }, [tabletMode, effectiveTabletMode, tab]);
  // Keep every signed-in session alive proactively (not just tablet mode) so a
  // user can close the app and come back anytime without logging in again.
  // Supabase auto-refreshes in the background, but a backgrounded tab or a
  // rotated refresh token can let a session lapse; refreshing on
  // focus/visibility/interval closes that gap.
  //
  // NOTE: depend on the boolean `hasSession`, NOT the `session` object, and do
  // NOT refresh on mount. refreshSession() emits TOKEN_REFRESHED → a new session
  // object; depending on `session` (or refreshing immediately) would re-run this
  // effect and loop forever, flashing the loader on every login.
  const hasSession = !!session;
  useEffect(() => {
    if (!configured || !hasSession || !supabase) return undefined;
    const refreshActiveSession = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.refreshSession().catch(() => {});
      }
    };
    const timer = window.setInterval(refreshActiveSession, 30 * 60 * 1000);
    window.addEventListener("focus", refreshActiveSession);
    document.addEventListener("visibilitychange", refreshActiveSession);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshActiveSession);
      document.removeEventListener("visibilitychange", refreshActiveSession);
    };
  }, [configured, hasSession]);
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

  // Page-entrance animation. GSAP is loaded lazily (dynamic import) so it stays
  // out of the initial bundle; the animation kicks in once the chunk resolves.
  useEffect(() => {
    if (!shellRef.current) return undefined;
    let media;
    let cancelled = false;
    import("gsap").then(({ default: gsap }) => {
      if (cancelled || !shellRef.current) return;
      media = gsap.matchMedia();
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
    }).catch(() => {});
    return () => { cancelled = true; media?.revert?.(); };
  }, [tab]);

  if (configured && loading) return <AuthLoading />;
  if (configured && passwordRecovery) return <ResetPassword />;
  if (publicRoute === "admin") return <Suspense fallback={<PageFallback />}><Admin /></Suspense>;
  if (publicRoute === "landing" || publicRoute === "pricing") return <Suspense fallback={<PageFallback />}><Landing signedIn={!!session} /></Suspense>;
  if (publicRoute === "privacy") return <Suspense fallback={<PageFallback />}><Privacy signedIn={!!session} /></Suspense>;
  if (publicRoute === "terms") return <Suspense fallback={<PageFallback />}><Terms signedIn={!!session} /></Suspense>;
  if (configured && !session && publicRoute === "signin") return <SignIn key="signin" initialCreating={false} />;
  if (configured && !session && publicRoute === "signup") return <SignIn key="signup" initialCreating />;
  if (configured && !session) return <Suspense fallback={<PageFallback />}><Landing /></Suspense>;
  if (configured && (!household || onboardingRequired)) return <HouseholdOnboarding />;
  if (["suspended", "disabled"].includes(runtimeConfig.status)) return (
    <main className="admin-denied">
      <ShieldCheck />
      <h1>This family account is paused</h1>
      <p>Your household data is safe. Contact FamOS support to restore access.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );

  // Deep-link resolver — accepts ?cook=meal_<id> (Today hero CTA) and writes
  // the intent into sessionStorage so Meals.jsx picks it up on mount and
  // auto-opens Cook Mode. The key is single-use; Meals strips it on consume.
  const COOK_INTENT_KEY = "famos:cook-intent:v1";
  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const cookId = params.get("cook");
    const taskId = params.get("task");
    const eventId = params.get("event");
    const listId = params.get("list");
    const sharedText = params.get("shared_text");
    const sharedUrl = params.get("shared_url");
    if (!cookId && !taskId && !eventId && !listId && !sharedText && !sharedUrl) return;
    try {
      if (cookId && typeof window !== "undefined") {
        window.sessionStorage.setItem(COOK_INTENT_KEY, cookId);
      }
    } catch { /* private mode */ }
    if (cookId) setTab("meals");
    else if (taskId) setTab("tasks");
    else if (eventId) setTab("calendar");
    else if (listId || sharedText || sharedUrl) setTab("groceries");
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
  }, [session]);

  return (
    <FamilyProvider tabletMode={effectiveTabletMode}>
      <div className={`app-shell ${darkMode ? "theme-dark" : ""} ${effectiveTabletMode ? "tablet-mode" : ""}`} ref={shellRef}>
        <BottomNav active={tab} onChange={setTab} features={runtimeConfig.features} tabletMode={effectiveTabletMode} />
        <main className="app-content">
          <AppTopBar
            onOpenSettings={() => setTab("settings")}
            onNavigate={setTab}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((value) => !value)}
            tabletMode={effectiveTabletMode}
            tabletModeAvailable={isTabletViewport}
            onToggleTabletMode={() => setTabletMode((value) => !value)}
          />
          <Suspense fallback={<PageFallback />}>
            {tab === "today" && <Today goTo={setTab} />}
            {tab === "calendar" && <CalendarPage goTo={setTab} />}
            {tab === "meals" && <Meals />}
            {tab === "groceries" && <Groceries />}
            {tab === "tasks" && <Tasks />}
            {tab === "chat" && <Chat />}
            {tab === "settings" && <Settings />}
          </Suspense>
        </main>
        {/* Fam AI is now a global floating surface — no longer a tab. */}
        <Suspense fallback={null}>
          <FamAI />
        </Suspense>
        <InstallPrompt />
      </div>
    </FamilyProvider>
  );
}
