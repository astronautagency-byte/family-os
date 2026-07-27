import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
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
 * Brand behaviour
 * ───────────────
 *   The brand anchor links to /landing like a real link. When the
 *   visitor is already on a marketing URL (root or /landing), the
 *   onClick intercepts and `scrollTo({top: 0})` — so it feels like
 *   the home-page "scroll to top" button that used to live in
 *   Landing's inline nav, without dropping the navigation semantics
 *   that product pages need.
 *
 * Animation
 * ─────────
 *   The whole `<motion.nav>` runs a brief entry animation (y from
 *   -18 to 0, opacity from 0 to 1). It respects the surrounding
 *   `<MotionConfig reducedMotion="user">` so users with that OS
 *   preference see the nav instantly.
 * ───────────────────────────────────────────────────────────────────── */

const isOnLanding = () => {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname || "";
  return path === "/" || path === "/landing" || path.startsWith("/landing/");
};

const SCROLL_BLUR_THRESHOLD = 60;

const MarketingNav = ({ signedIn = false, currentId = null }) => {
  // Re-sync on history navigation so a deep-link visit doesn't show
  // stale brand behaviour after the user clicks a hash anchor back.
  // ScrollY flips `is-scrolled` once the visitor has moved past the
  // hero paragraph, at which point the nav tints + blurs — same
  // pattern as Apple's MacBook Pro / iPhone product pages.
  const [onLanding, setOnLanding] = useState(isOnLanding);
  // Initialise from real scrollY so a hard-reload of a scrolled page
  // doesn't flash the nav as transparent for one frame before flipping
  // to blurred. SSR-safe: window is guarded.
  const [isScrolled, setIsScrolled] = useState(
    typeof window !== "undefined" && window.scrollY > SCROLL_BLUR_THRESHOLD,
  );
  useEffect(() => {
    const syncLanding = () => setOnLanding(isOnLanding());
    const syncScroll = () => setIsScrolled((typeof window !== "undefined" && window.scrollY > SCROLL_BLUR_THRESHOLD));
    syncScroll();
    window.addEventListener("popstate", syncLanding);
    // passive: true — never blocks the scroll thread, costs ~0
    window.addEventListener("scroll", syncScroll, { passive: true });
    return () => {
      window.removeEventListener("popstate", syncLanding);
      window.removeEventListener("scroll", syncScroll);
    };
  }, []);

  const handleBrandClick = (event) => {
    if (!onLanding) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
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
    </motion.nav>
  );
};

export default MarketingNav;
