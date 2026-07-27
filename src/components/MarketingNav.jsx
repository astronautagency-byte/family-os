import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import FeaturesDropdown from "./FeaturesDropdown";

/* ── MarketingNav ───────────────────────────────────────────────────
 * Single canonical marketing navigation used by Landing (home) and
 * every /features/* page. Renders the same DOM, with the same CTAs,
 * everywhere — so users see one consistent nav across the public
 * surface regardless of where they arrive.
 *
 * Props
 * ─────
 *   signedIn   — when true the right side shows "Open FamOS"
 *                (linking to /today); when false it shows "Sign in"
 *                + "Get started →". Default: false (anonymous marketing
 *                visitor — the conservative default for SEO landings).
 *   currentId  — module id, when set the Features dropdown trigger
 *                lights up and the matching item is highlighted in the
 *                panel so visitors see which deep-dive they're on.
 *
 * Behavior
 * ────────
 *   - Brand anchor links to /landing like a real link. When the visitor
 *     is already on a marketing URL (root or /landing), the onClick
 *     intercepts and `scrollTo({top: 0})`.
 *   - At ≤900px the desktop link row hides and a hamburger button
 *     appears on the right. Tapping it slides a right-edge sheet drawer
 *     in from off-screen, dimming the page behind a blur backdrop.
 *   - Body scroll is locked while the drawer is open. Seven close
 *     paths: backdrop tap, in-panel X button, ESC, drawer link click,
 *     Features-dropdown item select (onItemClick), dropdown
 *     Escape / outside-click (onDismiss), and a matchMedia listener
 *     that auto-closes if the viewport grows past 900px mid-session.
 *     Tab focus-traps inside the panel; focus lands on the first
 *     focusable 400ms after open (just after the 380ms slide-in).
 *   - At rest the nav is transparent; after scrolling 60px it picks up
 *     the soft cream tint + 14px backdrop blur (Apple product-page
 *     pattern).
 * ───────────────────────────────────────────────────────────────────── */

const isOnLanding = () => {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname || "";
  return path === "/" || path === "/landing" || path.startsWith("/landing/");
};

const SCROLL_BLUR_THRESHOLD = 60;
// Remember the body overflow value so we can mirror it on close instead
// of clobbering whatever the page had before the drawer opened.
const getBodyOverflow = () => (typeof document === "undefined" ? "" : document.body.style.overflow || "");

const HamburgerIcon = ({ open }) => (
  <span className="marketing-nav-menu-bars" aria-hidden="true">
    <i className={open ? "is-top" : ""} />
    <i className={open ? "is-mid" : ""} />
    <i className={open ? "is-bot" : ""} />
  </span>
);

const MarketingNav = ({ signedIn = false, currentId = null }) => {
  const [onLanding, setOnLanding] = useState(isOnLanding);
  const [isScrolled, setIsScrolled] = useState(
    typeof window !== "undefined" && window.scrollY > SCROLL_BLUR_THRESHOLD,
  );
  // Drawer state lives separately from the scroll-aware className so a
  // re-render on scroll doesn't reset the hamburger press.
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const hamburgerRef = useRef(null);
  const drawerRef = useRef(null);

  // ── Scroll-aware nav tint ───────────────────────────────────────
  useEffect(() => {
    const syncLanding = () => setOnLanding(isOnLanding());
    const syncScroll = () => setIsScrolled((typeof window !== "undefined" && window.scrollY > SCROLL_BLUR_THRESHOLD));
    syncScroll();
    window.addEventListener("popstate", syncLanding);
    window.addEventListener("scroll", syncScroll, { passive: true });
    return () => {
      window.removeEventListener("popstate", syncLanding);
      window.removeEventListener("scroll", syncScroll);
    };
  }, []);

  const closeDrawer = useCallback(() => setIsMobileOpen(false), []);

  // ── Mid-session breakpoint cross ─────────────────────────────────
  // If the drawer is open on mobile and the viewport grows past 900px
  // (tablet rotation, attaching an external monitor, browser-resize),
  // auto-close the drawer so the body-scroll-lock + the panel-in-front
  // of the desktop nav don't linger into a wrong context.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia("(max-width: 900px)");
    const onChange = (event) => { if (!event.matches) closeDrawer(); };
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else if (mql.addListener) mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    };
  }, [closeDrawer]);

  // ── Drawer open lifecycle: body scroll lock + ESC close + focus + focus-trap ──
  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const previousOverflow = getBodyOverflow();
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(
      drawerRef.current?.querySelectorAll(
        'a[href], button:not([disabled])',
      ) || [],
    );
    const onKey = (event) => {
      if (event.key === "Escape") { closeDrawer(); return; }
      // Focus-trap: keep Tab cycling inside the panel so keyboard users
      // don't bleed focus to elements behind the backdrop. WCAG 2.4.3
      // + Apple HIG "modal sheet" pattern.
      if (event.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // Wait for the panel's 380ms slide-in to land before announcing
    // focus — otherwise screen readers hear the first item while the
    // panel is still off-screen and the morph-X is mid-animation.
    const focusTimer = setTimeout(() => {
      focusables()[0]?.focus();
    }, 400);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
    // closeDrawer is a stable useCallback reference (deps []); it
    // belongs in the deps array to satisfy react-hooks/exhaustive-deps
    // without needing a lint suppression.
  }, [isMobileOpen, closeDrawer]);

  const handleBrandClick = (event) => {
    if (!onLanding) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <motion.nav
        className={`marketing-nav${isScrolled ? " is-scrolled" : ""}`}
        aria-label="FamOS marketing"
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <a
          className="marketing-nav-brand"
          href="/landing"
          onClick={handleBrandClick}
          aria-label="FamOS home"
        >
          <img src="/icons/icon-512.png" alt="" />
          <strong><span>Fam</span>OS</strong>
        </a>
        <div className="marketing-nav-links">
          <a href="/landing">Home</a>
          <FeaturesDropdown active label="Features" currentId={currentId} />
          <a href="/landing#how-it-works">How it works</a>
          <a href="/landing#compare">Compare</a>
          <a href="/landing#pricing">Pricing</a>
        </div>
        <div className="marketing-nav-actions">
          {!signedIn && (
            <a className="marketing-nav-signin" href="/signin">Sign in</a>
          )}
          <a
            className="marketing-nav-join"
            href={signedIn ? "/today" : "/signup"}
          >
            {signedIn ? "Open FamOS" : (<>Get started <ArrowRight size={15} /></>)}
          </a>
        </div>
        <button
          ref={hamburgerRef}
          type="button"
          className={`marketing-nav-menu${isMobileOpen ? " is-open" : ""}`}
          aria-label={isMobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileOpen}
          aria-controls="marketing-nav-drawer"
          onClick={() => setIsMobileOpen((value) => !value)}
        >
          <HamburgerIcon open={isMobileOpen} />
        </button>
      </motion.nav>

      <div
        ref={drawerRef}
        id="marketing-nav-drawer"
        className={`marketing-drawer${isMobileOpen ? " is-open" : ""}`}
        aria-hidden={!isMobileOpen}
      >
        <button
          type="button"
          className="marketing-drawer-backdrop"
          aria-label="Close menu"
          tabIndex={isMobileOpen ? 0 : -1}
          onClick={closeDrawer}
        />
        <div
          className="marketing-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label="FamOS marketing menu"
        >
          <div className="marketing-drawer-head">
            <a
              className="marketing-drawer-brand"
              href="/landing"
              onClick={closeDrawer}
            >
              <img src="/icons/icon-512.png" alt="" />
              <strong><span>Fam</span>OS</strong>
            </a>
            <button
              type="button"
              className="marketing-drawer-close"
              aria-label="Close FamOS marketing menu"
              onClick={closeDrawer}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <nav className="marketing-drawer-links" aria-label="FamOS marketing menu links">
            <a href="/landing" onClick={closeDrawer}>Home</a>
            <FeaturesDropdown active label="Features" currentId={currentId} onItemClick={closeDrawer} onDismiss={closeDrawer} />
            <a href="/landing#how-it-works" onClick={closeDrawer}>How it works</a>
            <a href="/landing#compare" onClick={closeDrawer}>Compare</a>
            <a href="/landing#pricing" onClick={closeDrawer}>Pricing</a>
          </nav>
          <div className="marketing-drawer-actions">
            {!signedIn && (
              <a className="marketing-drawer-signin" href="/signin" onClick={closeDrawer}>Sign in</a>
            )}
            <a
              className="marketing-drawer-join"
              href={signedIn ? "/today" : "/signup"}
              onClick={closeDrawer}
            >
              {signedIn ? "Open FamOS" : (<>Get started <ArrowRight size={16} /></>)}
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default MarketingNav;
