import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckSquare, CookingPot, HeartHandshake, Home, MessageCircle, Refrigerator, Settings2, ShieldCheck, ShoppingCart, Sparkles, X } from "lucide-react";
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
import DesktopAuthGate from "./components/DesktopAuthGate";
import Confetti from "./components/Confetti";
import { useAuth } from "./context/AuthContext";
import { AuthLoading, HouseholdOnboarding, ResetPassword, SignIn } from "./pages/Auth";
import { supabase } from "./lib/supabase";
import { classifySharedContent, SHARED_RECIPE_KEY, sharedRecipeTitle } from "./lib/sharedContent";
import ErrorBoundary from "./components/ErrorBoundary";
import FeaturePaywall from "./components/FeaturePaywall";
import { PREMIUM_FEATURE_IDS } from "./data/billingCatalog";
import { PRICING_PLAN, formatMoney } from "./data/pricingPlan";
import { clearDesktopAuthState, expectedDesktopAuthState, isTauriRuntime, listenForDesktopAuth } from "./lib/desktopRuntime";
import { finishDesktopAuthHandoff, redeemDesktopAuthHandoff } from "./lib/desktopAuth";
import { checkAndSendLifecycleEmails } from "./lib/onboardingEmails";

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
const Download = lazy(() => import("./pages/Download"));
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
const TOUR_FEATURES = [
  { id: "today", label: "Today", icon: Home, copy: "See the day at a glance: what's next, what needs attention, and where the household is headed." },
  { id: "calendar", label: "Calendar", icon: CalendarDays, featureKey: "calendar", copy: "Bring family calendars together, keep private events private, and plan the week from one shared view." },
  { id: "meals", label: "Meals", icon: CookingPot, featureKey: "meals", copy: "Plan breakfast, lunch, and dinner, discover ideas, and use Cook Mode when it is time to make dinner." },
  { id: "tasks", label: "Tasks", icon: CheckSquare, featureKey: "tasks", copy: "Give everyday jobs a clear owner, bring in existing lists, and see what is done without asking twice." },
  { id: "groceries", label: "Shopping", icon: ShoppingCart, featureKey: "groceries", copy: "Keep one shared shopping list, add items quickly, and move through the store with less mental load." },
  { id: "kitchen", label: "Kitchen Watch", icon: Refrigerator, featureKey: "kitchen", copy: "Keep an eye on what is in the kitchen and get a gentle nudge before food needs to be used." },
  { id: "chat", label: "Chat", icon: MessageCircle, featureKey: "chat", copy: "Keep family conversation close to the plans, lists, and decisions it belongs with." },
  { id: "famai", label: "Fam AI", icon: Sparkles, featureKey: "fam_ai", copy: "Ask for help with meals, lists, tasks, and the week. Fam AI proposes actions and waits for your approval." },
  { id: "settings", label: "Settings", icon: Settings2, copy: "Make FamOS feel like home: connect calendars, choose a colour, invite family, and manage your plan." },
];

function TrialConfirmationModal({ onClose, onManage }) {
  const trialEnds = new Date(Date.now() + PRICING_PLAN.trial.days * 86400000).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const proPlan = PRICING_PLAN.plans.find((plan) => plan.id === "pro");
  return (
    <div className="trial-confirmation-layer" role="presentation">
      <section className="trial-confirmation-card" role="dialog" aria-modal="true" aria-labelledby="trial-confirmation-title">
        <div className="trial-confirmation-mark"><ShieldCheck size={22} /></div>
        <p className="feature-tour-eyebrow">FamOS Pro</p>
        <h2 id="trial-confirmation-title">You’re on FamOS Pro.</h2>
        <p className="trial-confirmation-copy">Your {PRICING_PLAN.trial.days}-day trial has started.</p>
        <div className="trial-confirmation-summary">
          <div><span>Trial ends</span><strong>{trialEnds}</strong></div>
          <div><span>Today</span><strong>$0</strong></div>
          <div><span>After trial</span><strong>{formatMoney(proPlan?.price.monthly || 0)}/month</strong></div>
        </div>
        <button type="button" className="trial-confirmation-primary" onClick={onClose}>Start Using FamOS</button>
        <button type="button" className="trial-confirmation-secondary" onClick={onManage}>Manage Subscription</button>
      </section>
    </div>
  );
}

function FounderWelcomeModal({ onDismiss }) {
  return (
    <div className="founder-welcome-layer" role="presentation">
      <section className="founder-welcome-card" role="dialog" aria-modal="true" aria-labelledby="founder-welcome-title">
        <button type="button" className="founder-welcome-close" onClick={onDismiss} aria-label="Close welcome message"><X size={18} /></button>
        <div className="founder-welcome-mark"><HeartHandshake size={22} /></div>
        <p className="founder-welcome-eyebrow">A note from Alex</p>
        <h2 id="founder-welcome-title">Welcome to FamOS.</h2>
        <p className="founder-welcome-copy">I built FamOS to make the everyday work of family life feel a little lighter. I’m so glad you’re here — I hope it gives your household more clarity, more calm, and more time together.</p>
        <p className="founder-welcome-signoff">— Alex Vorobiev<br /><span>Founder, FamOS</span></p>
        <div className="founder-welcome-actions">
          <a href="/settings?support=feedback" onClick={onDismiss}>Share feedback</a>
          <a href="/settings?support=feature" onClick={onDismiss}>Suggest a feature</a>
        </div>
      </section>
    </div>
  );
}

function FeatureTour({ mode, steps, stepIndex, onStart, onSkip, onNext, onBack, onExplore, onFinish, onFeedback, onFeatureRequest }) {
  if (!mode) return null;
  if (mode === "complete") {
    return (
      <div className="feature-tour-layer" role="presentation">
        <section className="feature-tour-card feature-tour-complete" role="dialog" aria-modal="true" aria-labelledby="feature-tour-complete-title">
          <div className="feature-tour-complete-mark"><HeartHandshake size={22} /></div>
          <p className="feature-tour-eyebrow">You’re all set</p>
          <h2 id="feature-tour-complete-title">Thanks for taking the tour.</h2>
          <p>FamOS is yours to shape. Tell us what would make your family’s everyday flow even better.</p>
          <div className="feature-tour-actions feature-tour-complete-actions">
            <button type="button" className="feature-tour-secondary" onClick={onFeedback}>Share feedback</button>
            <button type="button" className="feature-tour-primary" onClick={onFeatureRequest}>Suggest a feature</button>
          </div>
          <button type="button" className="feature-tour-feedback-link" onClick={onFinish}>Continue to FamOS</button>
        </section>
      </div>
    );
  }
  if (mode === "prompt") {
    return (
      <div className="feature-tour-layer" role="presentation">
        <section className="feature-tour-card feature-tour-prompt" role="dialog" aria-modal="true" aria-labelledby="feature-tour-prompt-title">
          <button type="button" className="feature-tour-close" onClick={onSkip} aria-label="Skip FamOS tour"><X size={18} /></button>
          <div className="feature-tour-mark"><Sparkles size={22} /></div>
          <p className="feature-tour-eyebrow">Make yourself at home</p>
          <h2 id="feature-tour-prompt-title">Want a quick tour?</h2>
          <p>We’ll show you the FamOS features available to your household. You can explore each one as we go, or jump in on your own.</p>
          <div className="feature-tour-actions">
            <button type="button" className="feature-tour-secondary" onClick={onSkip}>Maybe later</button>
            <button type="button" className="feature-tour-primary" onClick={onStart}>Show me around</button>
          </div>
        </section>
      </div>
    );
  }

  const step = steps[stepIndex];
  if (!step) return null;
  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  return (
    <div className="feature-tour-layer feature-tour-layer-active" role="presentation">
      <section className="feature-tour-card feature-tour-active-card" role="dialog" aria-modal="true" aria-labelledby="feature-tour-title">
        <div className="feature-tour-active-head">
          <span className="feature-tour-step-count">{stepIndex + 1} of {steps.length}</span>
          <button type="button" className="feature-tour-close" onClick={onSkip} aria-label="Exit FamOS tour"><X size={18} /></button>
        </div>
        <div className="feature-tour-progress" aria-hidden="true"><i style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} /></div>
        <div className="feature-tour-feature-icon"><Icon size={22} /></div>
        <p className="feature-tour-eyebrow">Explore {step.label}</p>
        <h2 id="feature-tour-title">{step.label}</h2>
        <p>{step.copy}</p>
        <button type="button" className="feature-tour-explore" onClick={() => onExplore(step.id)}><Icon size={16} /> Open {step.label}</button>
        <div className="feature-tour-actions">
          <button type="button" className="feature-tour-secondary" onClick={isFirst ? onSkip : onBack}>{isFirst ? "Skip tour" : "Back"}</button>
          <button type="button" className="feature-tour-primary" onClick={isLast ? onFinish : onNext}>{isLast ? "Finish tour" : "Next"}</button>
        </div>
        <button type="button" className="feature-tour-feedback-link" onClick={onFinish}>I’m ready to explore on my own</button>
      </section>
    </div>
  );
}

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
const PUBLIC_ROUTES = ["privacy", "terms", "pricing", "signin", "signup", "download"];
const ROUTE_ALIASES = { "sign-in": "signin", "lsign-in": "signin", "sign-up": "signup", "partners": "partner", "app/admin": "admin" };
const VALID_ROUTES = [...VALID_TABS, "landing", "admin", "partner", "partners", ...PUBLIC_ROUTES];
const FEATURES_PATH_REGEX = /^\/features(?:\/([a-z-]+))?\/?$/i;
const normalizeRoute = (route = "") => ROUTE_ALIASES[route] || route;
const pathRoute = () => normalizeRoute(window.location.pathname.replace(/^\/+|\/+$/g, ""));
const isFeaturesPath = () => FEATURES_PATH_REGEX.test(window.location.pathname.replace(/\/+$/g, ""));
const routeFromLocation = () => {
  const route = pathRoute();
  if (isFeaturesPath()) return "features";
  if ([...PUBLIC_ROUTES, "admin", "partner", "partners"].includes(route)) return route;
  if (VALID_TABS.includes(route)) return route;
  return "";
};
const tabFromLocation = () => VALID_TABS.includes(routeFromLocation()) ? routeFromLocation() : "today";

const APP_DOMAIN = "home.fam-os.app";
const MARKETING_DOMAIN = "fam-os.app";
const AUTH_PATH_REGEX = /^\/sign[-_]?(?:in|up)\/?$/i;

function ensureCorrectDomain(session) {
  if (typeof window === "undefined") return;
  const hostname = window.location.hostname;
  const isAppDomain = hostname === APP_DOMAIN || hostname.startsWith("home.fam-os");
  const isMarketingDomain = hostname === MARKETING_DOMAIN || hostname.startsWith("fam-os.app");
  const params = new URLSearchParams(window.location.search);
  const signedOutHandoff = params.get("signed_out") === "1";

  // This marker is intentionally carried in the URL because localStorage is
  // isolated per origin. Never redirect while the marketing origin is clearing
  // a stale session left behind from an earlier visit.
  if (signedOutHandoff) return;

  // The public homepage is canonical at https://fam-os.app/. Keep the old
  // /landing path working for existing bookmarks, but remove it from the URL.
  if (isMarketingDomain && /^\/landing\/?$/i.test(window.location.pathname)) {
    window.history.replaceState({}, "", `/${window.location.search}${window.location.hash}`);
  }

  if (session && isMarketingDomain) {
    // Signed in on marketing domain → redirect to app domain
    window.location.replace(`https://${APP_DOMAIN}${window.location.pathname}${window.location.search}`);
  } else if (!session && isAppDomain && !AUTH_PATH_REGEX.test(window.location.pathname) && !window.location.pathname.startsWith("/admin") && !window.location.pathname.startsWith("/app/admin") && !window.location.pathname.startsWith("/partner")) {
    // Not signed in on app domain → redirect to marketing website
    window.location.replace(`https://${MARKETING_DOMAIN}`);
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
  const [founderWelcomeOpen, setFounderWelcomeOpen] = useState(false);
  const [featureTourMode, setFeatureTourMode] = useState(null);
  const [featureTourStep, setFeatureTourStep] = useState(0);
  const [trialConfirmationOpen, setTrialConfirmationOpen] = useState(false);
  const [desktopAuth, setDesktopAuth] = useState({ status: "idle", error: "" });
  const desktopHandoffAttempted = useRef(false);
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
  const { configured, session, household, householdProfile, loading, passwordRecovery, onboardingRequired } = useAuth();
  const publicRoute = route;
  const featureTourSteps = useMemo(() => TOUR_FEATURES.filter((feature) => {
    if (feature.id === "today" || feature.id === "settings") return true;
    return runtimeConfig.features?.[feature.featureKey] !== false && entitlements?.features?.[feature.featureKey] !== false;
  }), [entitlements, runtimeConfig.features]);
  const featureTourKey = session?.user?.id ? `family-os:feature-tour-seen:v1:${session.user.id}` : "";

  useEffect(() => {
    const onTrialConfirmation = () => setTrialConfirmationOpen(true);
    window.addEventListener("famos:onboarding-trial-confirmation", onTrialConfirmation);
    return () => window.removeEventListener("famos:onboarding-trial-confirmation", onTrialConfirmation);
  }, []);

  useEffect(() => {
    if (!session?.user?.id || loading) return;
    const params = new URLSearchParams(window.location.search);
    const pendingKey = `family-os:onboarding-trial-pending:${session.user.id}`;
    const confirmationKey = `family-os:onboarding-trial-confirmation:${session.user.id}`;
    if ((params.get("billing") === "success" && localStorage.getItem(pendingKey) === "true") || localStorage.getItem(confirmationKey) === "promo") {
      setTrialConfirmationOpen(true);
      localStorage.removeItem(pendingKey);
      localStorage.removeItem(confirmationKey);
      if (params.get("billing") === "success") window.history.replaceState({}, "", window.location.pathname);
    }
  }, [session?.user?.id, loading]);

  const closeTrialConfirmation = () => setTrialConfirmationOpen(false);

  useEffect(() => {
    const applyDaypart = () => {
      const hour = new Date().getHours();
      document.documentElement.dataset.daypart = hour < 12 ? "morning" : hour < 17 ? "day" : "evening";
    };
    applyDaypart();

    const params = new URLSearchParams(window.location.search);
    const signedOutHandoff = params.get("signed_out") === "1";
    if (signedOutHandoff && window.location.hostname === MARKETING_DOMAIN && !loading) {
      // Supabase stores auth state per origin. Clear the marketing origin too,
      // then remove the handoff marker only after getSession has finished and
      // the local sign-out has completed, so a stale session cannot bounce the
      // user back to home.fam-os.app.
      const finishHandoff = () => {
        window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
        window.__famosSigningOut = false;
      };
      if (session) {
        supabase.auth.signOut({ scope: "local" }).then(finishHandoff).catch(finishHandoff);
      } else {
        finishHandoff();
      }
    } else if (!loading) {
      ensureCorrectDomain(session);
    }

    const timer = window.setInterval(applyDaypart, 60_000);
    return () => window.clearInterval(timer);
  }, [session, loading, configured]);
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
    if (!configured || !isTauriRuntime()) return undefined;
    let active = true;
    const onOpenError = (event) => {
      if (active) setDesktopAuth({ status: "idle", error: event.detail || "Could not open the FamOS sign-in page." });
    };
    window.addEventListener("famos:desktop-auth-error", onOpenError);
    const stopListening = listenForDesktopAuth(async ({ code, state }) => {
      if (!active) return;
      const expected = expectedDesktopAuthState();
      if (!expected || expected !== state) {
        setDesktopAuth({ status: "idle", error: "This sign-in request expired. Start again from the FamOS app." });
        return;
      }
      setDesktopAuth({ status: "exchanging", error: "" });
      try {
        const payload = await redeemDesktopAuthHandoff(code, state);
        if (!payload?.session?.access_token || !payload?.session?.refresh_token) throw new Error("The sign-in response was incomplete. Start again from the FamOS app.");
        const { error } = await supabase.auth.setSession(payload.session);
        if (error) throw error;
        clearDesktopAuthState();
        setDesktopAuth({ status: "ready", error: "" });
      } catch (error) {
        setDesktopAuth({ status: "idle", error: error?.message || "Desktop sign-in could not be completed." });
      }
    }).catch((error) => {
      if (active) setDesktopAuth({ status: "idle", error: error?.message || "Desktop sign-in is unavailable." });
    });
    return () => {
      active = false;
      window.removeEventListener("famos:desktop-auth-error", onOpenError);
      Promise.resolve(stopListening).then((stop) => stop?.());
    };
  }, [configured]);

  // If the user was already signed in when the desktop browser flow opened,
  // complete the handoff without forcing another password entry.
  useEffect(() => {
    if (!configured || isTauriRuntime() || !session || desktopHandoffAttempted.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("desktop") !== "1") return;
    desktopHandoffAttempted.current = true;
    finishDesktopAuthHandoff(session).catch((error) => {
      desktopHandoffAttempted.current = false;
      setDesktopAuth({ status: "idle", error: error?.message || "Desktop sign-in could not be completed." });
    });
  }, [configured, session]);

  // Lifecycle onboarding emails — check on mount and send any that are due
  useEffect(() => {
    if (!session?.user?.id || !household?.id || onboardingRequired) return;
    const completedAt = householdProfile?.completed_at;
    if (!completedAt) return;
    checkAndSendLifecycleEmails({
      householdId: household.id,
      userId: session.user.id,
      completedAt,
      householdName: household.name,
      userFirstName: session.user.user_metadata?.display_name?.split(" ")[0] || session.user.email?.split("@")[0],
    }).catch(() => {});
  }, [session?.user?.id, household?.id, onboardingRequired, householdProfile?.completed_at]);

  useEffect(() => {
    if (!session?.user?.id || !household?.id || onboardingRequired || entitlements === null) return;
    const founderKey = `family-os:founder-welcome-seen:v1:${session.user.id}`;
    const tourSeen = featureTourKey && localStorage.getItem(featureTourKey) === "true";
    if (localStorage.getItem(founderKey) !== "true") {
      setFounderWelcomeOpen(true);
    } else if (!tourSeen && featureTourMode === null) {
      setFeatureTourMode("prompt");
    }
  }, [session?.user?.id, household?.id, onboardingRequired, entitlements, featureTourKey, featureTourMode]);

  const dismissFounderWelcome = () => {
    if (session?.user?.id) localStorage.setItem(`family-os:founder-welcome-seen:v1:${session.user.id}`, "true");
    setFounderWelcomeOpen(false);
    if (featureTourKey && localStorage.getItem(featureTourKey) !== "true") setFeatureTourMode("prompt");
  };

  const skipFeatureTour = () => {
    if (featureTourKey) localStorage.setItem(featureTourKey, "true");
    setFeatureTourMode(null);
  };

  const startFeatureTour = () => {
    setFeatureTourStep(0);
    setFeatureTourMode("active");
  };

  const finishFeatureTour = () => {
    if (featureTourKey) localStorage.setItem(featureTourKey, "true");
    setFeatureTourMode(null);
  };

  const completeFeatureTour = () => {
    if (featureTourMode === "complete") {
      setFeatureTourMode(null);
      return;
    }
    if (featureTourKey) localStorage.setItem(featureTourKey, "true");
    setFeatureTourMode("complete");
  };

  const openTourFeedback = (type) => {
    if (featureTourKey) localStorage.setItem(featureTourKey, "true");
    setFeatureTourMode(null);
    setTab("settings");
    const supportType = type === "feature" ? "feature" : "feedback";
    window.history.replaceState({}, "", `/settings?support=${supportType}`);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("famos:open-support", { detail: { type } })), 0);
  };

  const exploreFeatureTourStep = (featureId) => {
    if (featureId === "famai") {
      setFamAiOpen(true);
      return;
    }
    setTab(featureId);
  };

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
    console.log("[billing] startFeatureCheckout called:", feature);
    setBillingBusy(true);
    setBillingError("");
    try {
      console.log("[billing] invoking create-checkout-session...");
      const result = await supabase.functions.invoke("create-checkout-session", { body: { feature, billing: "monthly" } });
      console.log("[billing] edge function result:", JSON.stringify({ hasData: !!result.data, hasError: !!result.error, dataKeys: result.data ? Object.keys(result.data) : null }));
      const { data, error } = result;
      if (error) {
        let message = data?.error || error.message || "Could not start checkout.";
        console.log("[billing] edge error:", message);
        try {
          const resp = error?.context;
          if (resp && typeof resp.json === "function") {
            const body = await resp.json();
            console.log("[billing] error body:", JSON.stringify(body));
            if (body?.error) message = body.error;
            if (body?.url) { setBillingBusy(false); window.location.href = body.url; return; }
          } else if (resp?.error) { message = resp.error; }
          else if (resp?.url) { setBillingBusy(false); window.location.href = resp.url; return; }
        } catch { /* fall through */ }
        throw new Error(message);
      }
      if (!data?.url) { throw new Error("Checkout returned no URL."); }
      console.log("[billing] navigating to:", data.url);
      setBillingBusy(false);
      window.location.href = data.url;
    } catch (err) {
      console.error("[billing] FAILED:", err);
      setBillingBusy(false);
      setBillingError(err?.message || "Could not open secure checkout.");
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
  if (publicRoute === "download") return <Suspense fallback={<PageFallback />}><Download /></Suspense>;
  if (publicRoute === "privacy") return <Suspense fallback={<PageFallback />}><Privacy signedIn={!!session} /></Suspense>;
  if (publicRoute === "terms") return <Suspense fallback={<PageFallback />}><Terms signedIn={!!session} /></Suspense>;
  if (configured && !session && publicRoute === "signin") return <SignIn key="signin" initialCreating={false} />;
  if (configured && !session && publicRoute === "signup") return <SignIn key="signup" initialCreating />;
  if (configured && !session && isTauriRuntime()) return <DesktopAuthGate status={desktopAuth.status} error={desktopAuth.error} />;
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
            <FamAI open={famAiOpen} onClose={() => setFamAiOpen(false)} screen={tab} />
          </Suspense>
        </ErrorBoundary>
        {trialConfirmationOpen && <TrialConfirmationModal onClose={closeTrialConfirmation} onManage={() => { closeTrialConfirmation(); setTab("settings"); }} />}
        {founderWelcomeOpen && <FounderWelcomeModal onDismiss={dismissFounderWelcome} />}
        {!founderWelcomeOpen && <FeatureTour mode={featureTourMode} steps={featureTourSteps} stepIndex={featureTourStep} onStart={startFeatureTour} onSkip={skipFeatureTour} onNext={() => setFeatureTourStep((current) => Math.min(featureTourSteps.length - 1, current + 1))} onBack={() => setFeatureTourStep((current) => Math.max(0, current - 1))} onExplore={exploreFeatureTourStep} onFinish={featureTourStep === featureTourSteps.length - 1 ? completeFeatureTour : finishFeatureTour} onFeedback={() => openTourFeedback("feedback")} onFeatureRequest={() => openTourFeedback("feature")} />}
        <InstallPrompt />
        <Confetti />
      </div>
    </FamilyProvider>
  );
}
