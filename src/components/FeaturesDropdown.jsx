import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { MARKETING_FEATURES } from "../data/featureData";

// One-line value propositions for the mega-menu grid, matching the human,
// solution-first copy used across the landing page.
const MENU_TAGLINES = {
  today: "The whole household's day on one screen",
  meals: "Plan meals, cook hands-free",
  calendar: "Every calendar, one calm view",
  "fam-ai": "Your household's quiet assistant",
  tasks: "Chores with a clear owner",
  chat: "Family chat that lives with the plan",
  shopping: "One list, every hand",
  family: "A private home that feels like yours",
};

/* Reusable nav dropdown that lists every FamOS feature module. Used by
 * both Landing's top nav ("All modules" link replacement) and the
 * dedicated /features page nav. The trigger button is styled to look
 * like the surrounding nav links — putting the chevron inside makes it
 * discoverable that this is a menu, not a single destination.
 *
 * Open behaviour:
 *   - Hover over the trigger or focus it (keyboard) → opens immediately
 *   - Hover the panel → keeps it open (no flicker when crossing the gap)
 *   - Leave the trigger or panel → 150 ms grace before closing so a
 *     mouse path from trigger to panel doesn't accidentally close it
 *   - Click the trigger → toggles
 *   - Click outside / press Escape → closes
 *   - Click an item → navigates and closes
 *
 * Active state: when `active === true`, the trigger is highlighted
 * (any /features route). When `active === <id>` (an exact module id),
 * the matching item in the panel also gets a `.is-current` class so
 * visitors see which module deep-dive they're currently on. */

// `onItemClick` lets a parent (e.g. MarketingNav's mobile drawer) close
// itself when a menu item activates — without that, tapping a feature
// while the drawer is open would close the dropdown but leave the drawer
// sitting on top of the destination page. `onDismiss` fires on every other
// close path (Escape, outside-click) so a parent like the mobile drawer
// can collapse alongside — closing the inner Features dropdown should not
// leave the user with the outer drawer still open one ESC press away.
const FeaturesDropdown = ({ active = false, label = "Features", currentId = null, onItemClick = null, onDismiss = null }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const closeTimerRef = useRef(null);
  const openTimerRef = useRef(null);

  const clearTimers = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };
  // Hover-to-open wants a small lead-in so a fast mouse sweep doesn't
  // toggle the menu open and shut on the return path. Crucially, we
  // clear any pending close timer BEFORE the `open` short-circuit —
  // otherwise a click-to-open → hover-out → hover-in sequence would
  // race the still-pending close timer and yank the panel shut.
  const openSoon = () => {
    clearTimers();
    if (open) return;
    openTimerRef.current = setTimeout(() => setOpen(true), 60);
  };
  const closeSoon = () => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), 180);
  };
  const toggle = () => {
    clearTimers();
    setOpen((value) => !value);
  };

  // Remember which element had focus when we opened so we can restore
  // it when the user closes via Escape / outside-click. We don't restore
  // on item-click because the new page navigation takes over focus.
  const openerRef = useRef(null);
  const captureOpener = () => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    openerRef.current = active && active !== document.body ? active : null;
  };
  const restoreOpener = () => {
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener && typeof opener.focus === "function") opener.focus();
  };

  useEffect(() => () => clearTimers(), []);

  // Click outside + Escape close. The trigger and panel themselves are
  // excluded via ref so clicks inside them don't trigger the listener.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (!open) return;
      setOpen(false);
      restoreOpener();
      onDismiss?.();
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (!open) return;
      setOpen(false);
      restoreOpener();
      onDismiss?.();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // When the panel opens via keyboard, focus the current module (if any)
  // or the first item. Falls back to the overview link when nothing else
  // matches. Avoids focusing the trigger itself.
  const focusPanelFirst = () => {
    if (!panelRef.current) return;
    const current = panelRef.current.querySelector("a.is-current");
    if (current) { current.focus(); return; }
    const first = panelRef.current.querySelector("a[role=\"menuitem\"]");
    if (first) first.focus();
  };

  const isActiveTrigger = active === true || (typeof currentId === "string" && currentId.length > 0);

  return (
    <div
      className={`features-dropdown${open ? " is-open" : ""}${isActiveTrigger ? " is-active" : ""}`}
      onMouseEnter={openSoon}
      onMouseLeave={closeSoon}
    >
      <button
        ref={triggerRef}
        type="button"
        className="features-dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Browse FamOS modules (${MARKETING_FEATURES.length} features)`}
        onClick={() => {
          captureOpener();
          toggle();
        }}
        onFocus={(event) => {
          // Capture the previously-focused element on every focus, but
          // don't capture when focus arrives from a click on the trigger
          // itself (the click handler already captured it).
          if (event.target === event.currentTarget) captureOpener();
          openSoon();
        }}
        onKeyDown={(event) => {
          // Enter / Space opens; arrow-down opens + focuses the current
          // module (or first item if no current) inside the panel.
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            captureOpener();
            setOpen(true);
            requestAnimationFrame(focusPanelFirst);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            captureOpener();
            setOpen(true);
            requestAnimationFrame(focusPanelFirst);
          }
        }}
      >
        <span>{label}</span>
        <ChevronDown size={13} className="features-dropdown-chev" aria-hidden="true" />
      </button>
      <div
        ref={panelRef}
        className="features-dropdown-panel"
        role="menu"
        aria-label="FamOS feature modules"
      >
        <div className="features-dropdown-hero">
          <div className="features-dropdown-hero-copy">
            <p className="features-dropdown-hero-eyebrow">Explore FamOS</p>
            <h4 className="features-dropdown-hero-title">Everything FamOS does</h4>
            <span className="features-dropdown-hero-sub">One private home for the everyday stuff — schedules, meals, lists, and the little reminders that keep a household running.</span>
          </div>
          <div className="features-dropdown-hero-actions">
            <a
              href="/features"
              className="features-dropdown-hero-cta primary"
              role="menuitem"
              onClick={() => { setOpen(false); onItemClick?.(); }}
            >
              Browse all features <ArrowRight size={15} aria-hidden="true" />
            </a>
            <a
              href="/landing#pricing"
              className="features-dropdown-hero-cta"
              role="menuitem"
              onClick={() => { setOpen(false); onItemClick?.(); }}
            >
              See pricing
            </a>
          </div>
        </div>
        <div className="features-dropdown-divider" aria-hidden="true" />
        <div className="features-dropdown-grid" role="none">
          {MARKETING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            const isCurrent = currentId === feature.id;
            return (
              <a
                key={feature.id}
                href={`/features/${feature.id}`}
                className={`features-dropdown-item${isCurrent ? " is-current" : ""}`}
                role="menuitem"
                data-tone={feature.tone}
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => { setOpen(false); onItemClick?.(); }}
              >
                <span className="features-dropdown-item-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="features-dropdown-item-copy">
                  <strong>{feature.name}</strong>
                  <small>{MENU_TAGLINES[feature.id] || feature.pill}</small>
                </span>
                <span className="features-dropdown-item-link">Learn more <ChevronRight size={13} aria-hidden="true" /></span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FeaturesDropdown;
