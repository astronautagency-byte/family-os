import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
// Eager-load feature.css alongside the main entry so the FeaturesDropdown's
// `position:absolute` popover styles are guaranteed to be present before any
// page (lazy-loaded Landing.jsx OR Features.jsx) renders its nav. Without this,
// vite code-splits the CSS into a separate chunk that loads asynchronously
// after Landing.jsx mounts — leaving the dropdown briefly in default block
// flow (visible vertical menu under the trigger). The same CSS is also
// imported (and deduped) by Landing.jsx and Features.jsx for explicitness.
import "./feature.css";
import { FamilyProvider } from "./context/FamilyContext";
import BottomNav from "./components/BottomNav";
import AppTopBar from "./components/AppTopBar";
import InstallPrompt from "./components/InstallPrompt";
import Confetti from "./components/Confetti";
import { useAuth } from "./context/AuthContext";
import { AuthLoading, HouseholdOnboarding, ResetPassword, SignIn } from "./pages/Auth";
import { supabase } from "./lib/supabase";
import { classifySharedContent, SHARED_RECIPE_KEY, sharedRecipeTitle } from "./lib/sharedContent";
import ErrorBoundary from "./components/ErrorBoundary";
import FeaturePaywall from "./components/FeaturePaywall";
import { PREMIUM_FEATURE_IDS } from "./data/billingCatalog";

// Route/page-level code splitting: each page is its own chunk, so the initial
// bundle isn't the whole app. Signed-out visitors load only Landing; signed-in
// users load Today first and other tabs on demand.
const Today = lazy(() => import("./pages/Today"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Meals = lazy(() => import("./pages/Meals"));
const Groceries = lazy(() => import("./pages/Groceries"));
const KitchenWatch = lazy(() => import("./pages/KitchenWatch"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Settings = lazy(() => import("./pages/Settings"));
const Chat = lazy(() => import("./pages/Chat"));
const FamAI = lazy(() => import("./pages/FamAI"));
const Landing = lazy(() => import("./pages/Landing"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Admin = lazy(() => import("./pages/Admin"));
const Partner = lazy(() => import("./pages/Partner"));
const Features = lazy(() => import("./pages/Features"));

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
const PageErrorFallback = ({ retry, reloadLatest, goToday }) => {
  const crash = (() => {
    try {
      const raw = localStorage.getItem("famos:recent-crash:v1");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  return (
    <section className="app-page-error" role="alert">
      <ShieldCheck size={24} />
      <h1>This page needs another try</h1>
      <p>The rest of FamOS is still available and your household data is safe.</p>
      {crash?.id && <p className="app-page-error-id">Diagnostic: {crash.id}</p>}
      {crash?.message && (
        <details className="app-page-error-details">
          <summary>Error details</summary>
          <pre>{crash.message}</pre>
        </details>
      )}
      <div><button onClick={retry}>Try this page again</button><button onClick={reloadLatest}>Load latest version</button><button onClick={goToday}>Return to Today</button></div>
    </section>
  );
};
const VALID_TABS = ["today","calendar","meals","tasks","groceries","kitchen","chat","famai","settings"];
const PUBLIC_ROUTES = ["privacy", "terms", "pricing", "signin", "signup"];
const ROUTE_ALIASES = { "sign-in": "signin", "lsign-in": "signin", "sign-up": "signup" };
const VALID_ROUTES = [...VALID_TABS, "landing", "admin", "partner", ...PUBLIC_ROUTES];
const FEATURES_PATH_REGEX = /^\/features(?:\/([a-z-]+))?\/?$/i;
const normalizeRoute = (route = "") => ROUTE_ALIASES[route] || route;
const pathRoute = () => normalizeRoute(window.location.pathname.replace(/^\/+|\/+$/g, ""));
const isFeaturesPath = () => FEATURES_PATH_REGEX.test(window.location.pathname.replace(/\/+$/g, ""));
const routeFromLocation = () => {
  const route = pathRoute();
  if (isFeaturesPath()) return "features";
  if ([...PUBLIC_ROUTES, "admin", "partner"].includes(route)) return route;
  if (VALID_TABS.includes(route)) return route;
  return "";
};
const tabFromLocation = () => VALID_TABS.includes(routeFromLocation()) ? routeFromLocation() : "today";

const APP_DOMAIN = "home.fam-os.app";
const MARKETING_DOMAIN = "fam-os.app";

function ensureCorrectDomain(session) {
  if (typeof window === "undefined") return;
  const hostname = window.location.hostname;
  const isAppDomain = hostname === APP_DOMAIN || hostname.startsWith("home.fam-os");
  const isMarketingDomain = hostname === MARKETING_DOMAIN || hostname.startsWith("fam-os.app");
  
  if (session && isMarketingDomain) {
    // Signed in on marketing domain → redirect to app domain
    window.location.replace(`https://${APP_DOMAIN}${window.location.pathname}${window.location.search}`);
  } else if (!session && isAppDomain && !window.location.pathname.startsWith("/signin") && !window.location.pathname.startsWith("/signup")) {
    // Not signed in on app domain → redirect to marketing domain
    window.location.replace(`https://${MARKETING_DOMAIN}/signin`);
  }
}

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
  const [colorScheme, setColorScheme] = useState(() => localStorage.getItem("familyos:color-scheme") || "famos");
  // Fam AI is now a global overlay accessible from every page via the top bar
  // Sparkles button (no more floating FAB). The boolean below drives the
  // controlled-mode `open` prop on <FamAI />.
  const [famAiOpen, setFamAiOpen] = useState(false);
  const [tabletMode, setTabletMode] = useState(() => localStorage.getItem("familyos:tablet-mode") === "true");
  // Tablet mode is a shared-display layout meant only for tablet-sized screens.
  // We track whether the viewport is actually a tablet so the mode never applies
  // on phones or desktops even if the stored preference is on.
  const [isTabletViewport, setIsTabletViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 700px) and (max-width: 1100px)").matches
  );
  const effectiveTabletMode = tabletMode && isTabletViewport;
  const [runtimeConfig, setRuntimeConfig] = useState({ status: "active", features: {} });
  const [entitlements, setEntitlements] = useState(null);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  const setTab = (next) => {
    if (entitlements && PREMIUM_FEATURE_IDS.includes(next) && entitlements.features?.[next] !== true) {
      setUpgradeFeature(next);
      setBillingError("");
      return;
    }
    setUpgradeFeature("");
    setTabState(next);
    if (VALID_TABS.includes(next)) {
      window.history.pushState({ tab: next }, "", `/${next === "today" ? "" : next}`);
    }
  };
  const shellRef = useRef(null);
  const { configured, session, household, loading, passwordRecovery, onboardingRequired } = useAuth();
  const publicRoute = route;

  useEffect(() => {
    const applyDaypart = () => {
      const hour = new Date().getHours();
      document.documentElement.dataset.daypart = hour < 12 ? "morning" : hour < 17 ? "day" : "evening";
    };
    applyDaypart();
    ensureCorrectDomain(session);
    const timer = window.setInterval(applyDaypart, 60_000);
    return () => window.clearInterval(timer);
  }, [session]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 700px) and (max-width: 1100px)");
    const onChange = (event) => setIsTabletViewport(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    const onLocationChange = () => { setRoute(routeFromLocation()); setTabState(tabFromLocation()); };
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("popstate", onLocationChange);
    };
  }, []);

  // Backward compatibility: redirect old hash URLs (/#/calendar) to clean paths (/calendar)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && VALID_ROUTES.includes(hash)) {
      const path = hash === "today" ? "/" : `/${hash}`;
      window.history.replaceState({ tab: hash }, "", path);
      setRoute(routeFromLocation());
      setTabState(tabFromLocation());
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("familyos:theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  useEffect(() => {
    localStorage.setItem("familyos:color-scheme", colorScheme);
    document.documentElement.dataset.colorScheme = colorScheme;
  }, [colorScheme]);
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
    let refreshInFlight = false;
    const refreshActiveSession = () => {
      if (document.visibilityState !== "visible" || refreshInFlight) return;
      refreshInFlight = true;
      supabase.auth.refreshSession().catch(() => {}).finally(() => { refreshInFlight = false; });
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

  useEffect(() => {
    if (!configured || !session || !household?.id || !supabase) return;
    let active = true;
    supabase.rpc("get_my_entitlements").then(({ data, error }) => {
      if (!active) return;
      // Until the migration is installed, preserve existing households rather
      // than accidentally locking working features during rollout.
      setEntitlements(error || !data ? { status: "legacy", features: Object.fromEntries(PREMIUM_FEATURE_IDS.map((key) => [key, true])) } : data);
    });
    return () => { active = false; };
  }, [configured, session, household?.id]);

  const startFeatureCheckout = async (feature) => {
    setBillingBusy(true);
    setBillingError("");
    try {
      const { data, error } = await supabase.functions.invoke("chargebee-checkout", { body: { feature } });
      if (error) throw error;
      if (!data?.url) throw new Error("Secure checkout could not be opened.");
      window.location.assign(data.url);
    } catch (error) {
      setBillingBusy(false);
      setBillingError(error?.message || "Could not open secure checkout.");
    }
  };

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

  // Deep-link resolver — accepts ?cook=meal_<id> (Today hero CTA), ?task=,
  // ?event=, ?list=, ?shared_text/=url= and routes to the right tab. Writes
  // the cook intent to sessionStorage so Meals.jsx picks it up on mount and
  // auto-opens Cook Mode. The key is single-use; the URL is stripped after.
  // MUST stay above the conditional-returns block below or this hook's slot
  // appears only after sign-in, breaking the Rules of Hooks (render 1 runs
  // the 16 hooks above and returns early as Landing; render 2 needs 17).
  const COOK_INTENT_KEY = "famos:cook-intent:v1";
  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const cookId = params.get("cook");
    const taskId = params.get("task");
    const eventId = params.get("event");
    const listId = params.get("list");
    const sharedTitle = params.get("shared_title");
    const sharedText = params.get("shared_text");
    const sharedUrl = params.get("shared_url");
    if (!cookId && !taskId && !eventId && !listId && !sharedTitle && !sharedText && !sharedUrl) return;
    try {
      if (cookId && typeof window !== "undefined") {
        window.sessionStorage.setItem(COOK_INTENT_KEY, cookId);
      }
      if ((sharedTitle || sharedText || sharedUrl) && classifySharedContent({ title: sharedTitle, text: sharedText, url: sharedUrl }) === "recipe") {
        window.sessionStorage.setItem(SHARED_RECIPE_KEY, JSON.stringify({ title: sharedRecipeTitle({ title: sharedTitle, text: sharedText, url: sharedUrl }), text: sharedText || "", url: sharedUrl || "" }));
      }
    } catch { /* private mode */ }
    if (cookId) setTab("meals");
    else if (taskId) setTab("tasks");
    else if (eventId) setTab("calendar");
    else if ((sharedTitle || sharedText || sharedUrl) && classifySharedContent({ title: sharedTitle, text: sharedText, url: sharedUrl }) === "recipe") setTab("meals");
    else if (listId || sharedTitle || sharedText || sharedUrl) setTab("groceries");
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  }, [session]);

  if (configured && loading) return <AuthLoading />;
  if (configured && passwordRecovery) return <ResetPassword />;
  if (publicRoute === "admin") return <Suspense fallback={<PageFallback />}><Admin /></Suspense>;
  if (publicRoute === "partner") return <Suspense fallback={<PageFallback />}><Partner /></Suspense>;
  if (publicRoute === "features") return <Suspense fallback={<PageFallback />}><Features /></Suspense>;
  if (publicRoute === "landing" || publicRoute === "pricing") return <Suspense fallback={<PageFallback />}><Landing signedIn={!!session} /></Suspense>;
  if (publicRoute === "privacy") return <Suspense fallback={<PageFallback />}><Privacy signedIn={!!session} /></Suspense>;
  if (publicRoute === "terms") return <Suspense fallback={<PageFallback />}><Terms signedIn={!!session} /></Suspense>;
  if (configured && !session && publicRoute === "signin") return <SignIn key="signin" initialCreating={false} />;
  if (configured && !session && publicRoute === "signup") return <SignIn key="signup" initialCreating />;
  if (configured && !session) return <Suspense fallback={<PageFallback />}><Landing /></Suspense>;
  if (configured && (!household || onboardingRequired)) return <HouseholdOnboarding colorScheme={colorScheme} onColorSchemeChange={setColorScheme} />;
  if (["suspended", "disabled"].includes(runtimeConfig.status)) return (
    <main className="admin-denied">
      <ShieldCheck />
      <h1>This family account is paused</h1>
      <p>Your household data is safe. Contact FamOS support to restore access.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );

  return (
    <FamilyProvider tabletMode={effectiveTabletMode}>
      <div className={`app-shell ${darkMode ? "theme-dark" : ""} ${effectiveTabletMode ? "tablet-mode" : ""}`} data-color-scheme={colorScheme} ref={shellRef}>
        <BottomNav active={tab} onChange={setTab} features={runtimeConfig.features} tabletMode={effectiveTabletMode} />
        <main className="app-content">
          <AppTopBar
            onOpenSettings={() => setTab("settings")}
            onNavigate={setTab}
            onOpenFamAI={() => entitlements?.features?.fam_ai === false ? setUpgradeFeature("fam_ai") : setFamAiOpen(true)}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((value) => !value)}
            tabletMode={effectiveTabletMode}
            tabletModeAvailable={isTabletViewport}
            onToggleTabletMode={() => setTabletMode((value) => !value)}
          />
          <ErrorBoundary resetKey={tab} fallback={({ retry, clearSW }) => <PageErrorFallback retry={retry} reloadLatest={clearSW} goToday={() => setTab("today")} />}>
            <Suspense fallback={<PageFallback />}>
              {upgradeFeature ? <FeaturePaywall featureId={upgradeFeature} onChoose={startFeatureCheckout} onBack={() => setUpgradeFeature("")} busy={billingBusy} error={billingError} /> : <>
              {tab === "today" && <Today goTo={setTab} />}
              {tab === "calendar" && <CalendarPage goTo={setTab} />}
              {tab === "meals" && <Meals />}
              {tab === "groceries" && <Groceries />}
              {tab === "kitchen" && <KitchenWatch goTo={setTab} />}
              {tab === "tasks" && <Tasks />}
              {tab === "chat" && <Chat />}
              {tab === "settings" && <Settings colorScheme={colorScheme} onColorSchemeChange={setColorScheme} />}
              </>}
            </Suspense>
          </ErrorBoundary>
        </main>
        {/* Fam AI is now a global overlay controlled by the AppTopBar Sparkles
            button. Passing `open` / `onClose` keeps it controlled — closing
            from inside the sheet simply clears the openFamAI flag. */}
        <ErrorBoundary resetKey={`famai-${famAiOpen}`} fallback={() => null}>
          <Suspense fallback={null}>
            <FamAI open={famAiOpen} onClose={() => setFamAiOpen(false)} />
          </Suspense>
        </ErrorBoundary>
        <InstallPrompt />
        <Confetti />
      </div>
    </FamilyProvider>
  );
}
