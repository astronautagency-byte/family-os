import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimate, useInView, useScroll, useSpring, useTransform, useReducedMotion, MotionConfig, stagger } from "framer-motion";
import { ArrowRight, Baby, Bot, CalendarDays, Check, CheckSquare, ChefHat, Gift, GraduationCap, Heart, LockKeyhole, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart, Sparkles, Users } from "lucide-react";
import "../landing.css";
import "../landing-theme.css";
import { PRICING_PLAN, formatMoney } from "../data/pricingPlan";

// Shared motion vocabulary. Framer Motion drives all landing animation via
// IntersectionObserver-backed `whileInView`, which — unlike GSAP ScrollTrigger —
// does not need viewport recalculation on mobile Safari's URL-bar resize, so
// sections can no longer get stuck at opacity:0 on phones.
const EASE = [0.22, 1, 0.36, 1];
const BACK = [0.34, 1.56, 0.64, 1];
const REVEAL_VIEWPORT = { once: true, amount: 0.15, margin: "0px 0px -40px 0px" };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const fadeUpSmall = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
const headingIn = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
};
const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const revealBlock = { variants: fadeUp, initial: "hidden", whileInView: "show", viewport: REVEAL_VIEWPORT };
const revealHeading = { variants: headingIn, initial: "hidden", whileInView: "show", viewport: REVEAL_VIEWPORT };
const revealGroup = { variants: staggerParent, initial: "hidden", whileInView: "show", viewport: REVEAL_VIEWPORT };
const hoverLift = { whileHover: { y: -5, scale: 1.012 }, transition: { duration: 0.28, ease: EASE } };

function SectionHead({ eyebrow, children, note, className }) {
  return (
    <motion.div className={`landing-section-head${className ? ` ${className}` : ""}`} {...revealGroup}>
      <motion.p variants={fadeUp}>{eyebrow}</motion.p>
      <motion.h2 variants={headingIn}>{children}</motion.h2>
      {note != null && <motion.span variants={fadeUp}>{note}</motion.span>}
    </motion.div>
  );
}

const features = [
  { label: "Calendar", title: "One calendar. Fewer surprises.", previewHeadline: "Every calendar, one clear week.", copy: "Sync multiple Google Calendars, colour-code event types, and add places with Maps suggestions.", icon: CalendarDays, art: "calendar", tone: "lilac" },
  { label: "Meals", title: "Meal planning for the week.", previewHeadline: "Plan meals without the daily scramble.", copy: "Plan one or two weeks, save recipes, set dietary notes, and launch a hands-free cook mode.", icon: ChefHat, art: "meals", tone: "yellow" },
  { label: "Tasks", title: "Chores with an owner.", previewHeadline: "Give every task a clear owner.", copy: "Assign the thing, clear the list, and keep rewards ready for kid accounts when the time is right.", icon: CheckSquare, art: "tasks", tone: "pink" },
  { label: "Groceries", title: "Shared grocery lists.", previewHeadline: "One list, ready for the store.", copy: "Quick-add favourites, scan barcodes, focus shop in-store, then copy or share the list to your grocery app.", icon: ShoppingCart, art: "groceries", tone: "mint" },
  { label: "Family chat", title: "Family chat, with context.", previewHeadline: "Keep family conversations together.", copy: "Message the household without losing the plan you were talking about.", icon: MessageCircle, art: "chat", tone: "blue" },
  { label: "Fam AI", title: "Helpful suggestions when you need them.", previewHeadline: "Helpful next steps from household context.", copy: "Ask for meals from groceries, groceries from meals, or tasks from calendar events.", icon: Bot, art: "famai", tone: "peach" },
];

const capabilityHighlights = [
  { title: "Maps in the calendar", copy: "Type a place, pick the real location, then open directions when it’s time to go.", icon: CalendarDays, tone: "lilac" },
  { title: "Recipe mode", copy: "Open a planned meal, see the recipe, then start a step-by-step cooking flow.", icon: ChefHat, tone: "yellow" },
  { title: "Household tastes", copy: "Save recipes and keep dietary restrictions in the planning loop.", icon: Heart, tone: "pink" },
  { title: "Grocery lists that travel", copy: "Copy, save, or share your list into Uber Eats, DoorDash, or Instacart.", icon: ShoppingCart, tone: "mint" },
  { title: "Focus shop", copy: "Check off items in-store, scan barcodes, and save favourites for next time.", icon: CheckSquare, tone: "blue" },
  { title: "Fam AI daisy chains", copy: "Turn pantry lists into meals, meals into groceries, and calendar events into tasks.", icon: Bot, tone: "peach" },
];

const go = (route) => {
  const cleanPaths = { signin: "/sign-in", signup: "/sign-up", pricing: "/pricing", privacy: "/privacy", terms: "/terms" };
  if (cleanPaths[route]) {
    window.history.pushState(null, "", cleanPaths[route]);
    window.dispatchEvent(new Event("popstate"));
    return;
  }
  window.location.hash = route;
};

const stages = [
  { id: "expecting", label: "Expecting", icon: Heart, title: "Prepare for a new baby.", copy: "Keep appointments, prep lists, budgets, and support plans in one place.", artSrc: "/illustrations/stage-expecting.png", chips: ["Prenatal appointment", "Nursery checklist", "Support circle"] },
  { id: "newborn", label: "Newborn", icon: Baby, title: "Support for newborn days.", copy: "Track feeds, errands, meals, visitors, and small wins when days are full.", artSrc: "/illustrations/stage-newborn.png", chips: ["Bottle restock", "Meal train", "Quiet hours"] },
  { id: "school", label: "School years", icon: GraduationCap, title: "School days, organized.", copy: "School events, activities, chores, meals, and pickups—without chasing five separate chats.", artSrc: "/illustrations/stage-school.png", chips: ["Library books", "Soccer pickup", "Lunch plan"] },
  { id: "teen", label: "Teenagers", icon: MessageCircle, title: "Teen schedules, clearer.", copy: "Give teens ownership while keeping schedules, tasks, and plans clear.", artSrc: "/illustrations/stage-teen.png", chips: ["Shared car", "Work shift", "Reward request"] },
  { id: "extended", label: "Extended family", icon: Users, title: "Extended family, connected.", copy: "Care, celebrations, errands, and everyday support across generations and locations.", artSrc: "/illustrations/stage-extended.png", chips: ["Grandma’s visit", "Prescription pickup", "Family dinner"] },
];

const familyScenarios = [
  { title: "One version of the week", copy: "School events, appointments, pickups, and meal plans stay visible to the whole household.", label: "For busy households", avatar: "/marketing/testimonials/maya.png" },
  { title: "A shared system between homes", copy: "Calendars, groceries, and tasks travel with the family instead of living on one wall or one phone.", label: "For co-parents", avatar: "/marketing/testimonials/jordan.png" },
  { title: "Plans teens can own", copy: "Give every person a clear view of what is happening and what belongs to them.", label: "For growing families", avatar: "/marketing/testimonials/sam.png" },
];

const comparisonRows = [
  { label: "Upfront hardware", famos: "None — use the screens you already own", display: "Dedicated display purchase", organizer: "Usually none" },
  { label: "Use it anywhere", famos: "Phone, tablet, laptop, or wall-mounted screen", display: "Centred on a home display and companion app", organizer: "Mobile and web access varies" },
  { label: "Plan that grows", famos: "Pricing scales with household members", display: "Hardware plus optional subscription", organizer: "Free and premium bundles" },
  { label: "Choose your extras", famos: "Add Fam AI when your family needs it", display: "Features depend on device and plan", organizer: "Premium features depend on plan" },
  { label: "Family coordination", famos: "Calendar, meals, groceries, tasks, chat, rewards, and AI", display: "Strong shared calendar and home display", organizer: "Core organizer features vary by app" },
  { label: "Try before committing", famos: `${PRICING_PLAN.trial.days}-day free trial`, display: "Offers and trials vary", organizer: "Free tiers or trials vary" },
];

const pricingAddOns = [
  { id: "fam_ai", label: "Fam AI", copy: `100 helper requests a month. Included during the ${PRICING_PLAN.trial.days}-day trial.`, price: PRICING_PLAN.addOns[0].price.monthly, icon: Bot },
];

function PricingSection({ signedIn }) {
  const [billing, setBilling] = useState("monthly");
  const [members, setMembers] = useState(PRICING_PLAN.basePlan.membersIncluded);
  const [addOns, setAddOns] = useState({ fam_ai: PRICING_PLAN.trial.famAiPretoggled });
  const extraMembers = Math.max(0, members - PRICING_PLAN.basePlan.membersIncluded);
  const monthlyBase = PRICING_PLAN.basePlan.price.monthly;
  const annualBase = PRICING_PLAN.basePlan.price.yearly;
  const annualDiscount = annualBase / (monthlyBase * 12);
  const memberCost = extraMembers * PRICING_PLAN.basePlan.additionalMemberPrice.monthly;
  const addOnCost = pricingAddOns.reduce((sum, item) => sum + (addOns[item.id] ? item.price : 0), 0);
  const monthlySubtotal = monthlyBase + memberCost + addOnCost;
  const annualMemberCost = memberCost * 12 * annualDiscount;
  const annualAddOnCost = addOnCost * 12 * annualDiscount;
  const annualTotal = annualBase + annualMemberCost + annualAddOnCost;
  const annualMonthlyEquivalent = annualTotal / 12;
  const displayedTotal = billing === "annual" ? annualTotal : monthlySubtotal;
  const savings = monthlySubtotal * 12 - annualTotal;
  const annualizeMonthly = (value) => value * 12 * annualDiscount;
  // Re-keying on the computed values remounts the figure so Framer replays the
  // little pop whenever billing frequency or member count changes.
  const pulseKey = `${billing}-${displayedTotal}`;

  return <section className="landing-pricing" id="pricing">
    <SectionHead eyebrow="Simple pricing" note={`Try FamOS free for ${PRICING_PLAN.trial.days} days. ${PRICING_PLAN.basePlan.membersIncluded} people are included, then each extra member is ${formatMoney(PRICING_PLAN.basePlan.additionalMemberPrice.monthly)}/month.`}>Start small.<br/>Invite the whole crew.</SectionHead>
    <motion.div className="pricing-shell" {...revealBlock}>
      <div className="pricing-main">
        <div className="pricing-toggle" role="tablist" aria-label="Billing frequency">
          <button className={billing === "monthly" ? "active" : ""} onClick={() => setBilling("monthly")} role="tab" aria-selected={billing === "monthly"}>Monthly</button>
          <button className={billing === "annual" ? "active" : ""} onClick={() => setBilling("annual")} role="tab" aria-selected={billing === "annual"}>Yearly <span>{formatMoney(annualTotal)}/yr</span></button>
        </div>
        <article className="pricing-card">
          <div className="pricing-card-head">
            <span><Users/></span>
            <div><p>Family plan</p><motion.h3 key={pulseKey} initial={{ scale: 0.94, opacity: 0.72 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.38, ease: BACK }}><span>{formatMoney(displayedTotal)}</span><small>{billing === "annual" ? "per year" : "per month"}</small></motion.h3></div>
          </div>
          <p className="pricing-note">{billing === "annual" ? `${formatMoney(annualTotal)} billed yearly after your ${PRICING_PLAN.trial.days}-day free trial — about ${formatMoney(annualMonthlyEquivalent)}/month.` : `Billed monthly after your ${PRICING_PLAN.trial.days}-day free trial. Card required.`}</p>
          <div className="family-size-control">
            <div><strong>People in your home</strong><small>{PRICING_PLAN.basePlan.membersIncluded} included, then {formatMoney(PRICING_PLAN.basePlan.additionalMemberPrice.monthly)}/month each</small></div>
            <div>
              <button aria-label="Remove family member" onClick={() => setMembers((value) => Math.max(PRICING_PLAN.basePlan.membersIncluded, value - 1))}><Minus/></button>
              <b>{members}</b>
              <button aria-label="Add family member" onClick={() => setMembers((value) => Math.min(20, value + 1))}><Plus/></button>
            </div>
          </div>
          <ul className="pricing-includes">
            <li><Check/> Calendar, meals, recipes, groceries, tasks, chat, and rewards</li>
            <li><Check/> A private home base with secure family invitations</li>
            <li><Check/> Google Calendar sync, roles, dietary preferences, and Fam AI when you want backup</li>
          </ul>
        </article>
        <div className={`pricing-addons ${pricingAddOns.length === 1 ? "single" : ""}`}>
          <p>Add-ons</p>
          {pricingAddOns.map(({ id, label, copy, price, icon: Icon }) => <button className={addOns[id] ? "selected" : ""} onClick={() => setAddOns((current) => ({ ...current, [id]: !current[id] }))} key={id}>
            <span><Icon/></span>
            <strong>{label}<small>{copy}</small></strong>
            <em>{billing === "annual" ? `${formatMoney(annualizeMonthly(price))}/yr` : `${formatMoney(price)}/mo`}</em>
          </button>)}
        </div>
      </div>
      <aside className="pricing-side">
        <div className="pricing-summary">
          <div><span>Base plan</span><b>{billing === "annual" ? `${formatMoney(annualBase)}/yr` : formatMoney(monthlyBase)}</b></div>
          <div><span>{extraMembers} extra member{extraMembers === 1 ? "" : "s"}</span><b>{billing === "annual" ? `${formatMoney(annualMemberCost)}/yr` : formatMoney(memberCost)}</b></div>
          <div><span>Fam AI add-on</span><b>{billing === "annual" ? `${formatMoney(annualAddOnCost)}/yr` : formatMoney(addOnCost)}</b></div>
          {billing === "annual" && <div className="annual-savings"><span>Yearly savings</span><b>{formatMoney(savings)}</b></div>}
          <div className="pricing-total"><span>Total after trial</span><motion.b key={pulseKey} initial={{ y: 7, opacity: 0.55 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.34, ease: EASE }}>{formatMoney(displayedTotal)}<small>{billing === "annual" ? "/yr" : "/mo"}</small></motion.b></div>
          <button onClick={() => go(signedIn ? "today" : "signup")}>Start free for {PRICING_PLAN.trial.days} days <ArrowRight/></button>
          <small><ShieldCheck/> Full feature access during trial. Card required; cancel anytime before billing starts.</small>
        </div>
      </aside>
    </motion.div>
  </section>;
}

function ProductPreview({ feature }) {
  const [scope, animate] = useAnimate();
  const item = features[feature];
  const Icon = item.icon;
  const rows = {
    0: [["8:15", "School drop-off"], ["4:30", "Soccer practice"], ["7:00", "Family dinner"]],
    1: [["MON", "Lemon chicken"], ["TUE", "Taco bowls"], ["WED", "Pasta night"]],
    2: [["+50", "Clean your room"], ["+25", "Feed the dog"], ["+100", "Read for 20 min"]],
    3: [["✓", "Oat milk"], ["2", "Avocados"], ["★", "Pasta"]],
    4: [["M", "Dinner at 6?"], ["A", "Works for me"], ["L", "I’ll be home"]],
    5: [["AI", "Dinner ideas"], ["→", "Grocery gaps"], ["✓", "Ready to approve"]],
  }[feature];

  useEffect(() => {
    const node = scope.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    const timers = [];
    const q = (sel) => node.querySelectorAll(sel);
    const has = (sel) => q(sel).length > 0;
    const set = (sel, props) => (has(sel) ? animate(sel, props, { duration: 0 }) : Promise.resolve());
    const to = (sel, props, opts) => (has(sel) ? animate(sel, props, opts) : Promise.resolve());
    const deco = (on) => q(".product-screen-row span").forEach((el) => { el.style.textDecoration = on ? "line-through" : "none"; });
    const wait = (s) => new Promise((r) => { const id = setTimeout(r, s * 1000); timers.push(id); });

    const loops = {
      0: async () => {
        await to(".product-screen-row", { backgroundColor: "#eee8ff" }, { duration: 0.35, delay: stagger(0.18) });
        await to(".product-screen-row", { backgroundColor: "#ffffff" }, { duration: 0.35, delay: stagger(0.18) });
        await wait(0.5);
      },
      1: async () => {
        await to(".product-screen-row", { y: -3, boxShadow: "0 8px 18px rgba(92,72,31,.12)" }, { duration: 0.35, delay: stagger(0.16) });
        await to(".product-screen-row", { y: 0, boxShadow: "0 0 0 rgba(0,0,0,0)" }, { duration: 0.3, delay: stagger(0.16) });
        await wait(0.6);
      },
      2: async () => {
        await to(".product-screen-row .row-check", { scale: 1, opacity: 1 }, { duration: 0.28, delay: stagger(0.2), ease: BACK });
        deco(true);
        await to(".product-screen-row span", { opacity: 0.55 }, { duration: 0.2, delay: stagger(0.2) });
        await to(".preview-reward", { scale: 1, opacity: 1 }, { duration: 0.45, ease: BACK });
        await wait(0.9);
        await set(".product-screen-row .row-check", { scale: 0.75, opacity: 0 });
        await set(".preview-reward", { scale: 0.75, opacity: 0 });
        deco(false);
        await set(".product-screen-row span", { opacity: 1 });
        await wait(1);
      },
      3: async () => {
        await to(".product-screen-row .row-check", { scale: 1, opacity: 1 }, { duration: 0.25, delay: stagger(0.2), ease: BACK });
        deco(true);
        await to(".product-screen-row span", { opacity: 0.48 }, { duration: 0.2, delay: stagger(0.2) });
        await wait(0.9);
        await set(".product-screen-row .row-check", { scale: 0.75, opacity: 0 });
        deco(false);
        await set(".product-screen-row span", { opacity: 1 });
        await wait(0.8);
      },
      4: async () => {
        await to(".typing-dot", { y: [0, -4, 0], opacity: [0.35, 1, 0.35] }, { duration: 0.55, delay: stagger(0.12) });
        await to(".preview-reply", { x: [10, 0], opacity: [0, 1] }, { duration: 0.35, ease: "easeOut" });
        await wait(1);
        await set(".preview-reply", { opacity: 0 });
        await wait(0.8);
      },
      5: async () => {
        await to(".product-screen-row", { backgroundColor: "#eee8ff" }, { duration: 0.25, delay: stagger(0.16) });
        await to(".product-screen-row", { backgroundColor: "#ffffff" }, { duration: 0.25, delay: stagger(0.16) });
        await to(".famai-preview", { scale: 1, opacity: 1 }, { duration: 0.35, ease: BACK });
        await wait(0.8);
        await set(".famai-preview", { scale: 0.92, opacity: 0 });
        await wait(1);
      },
    };

    const play = async () => {
      await set(".product-screen-bar", { opacity: 0, y: -10 });
      await set(".product-screen-row", { opacity: 0, x: 18 });
      await set(".preview-outcome", { opacity: 0, y: 8 });
      await set(".landing-product-screen>button", { opacity: 0, y: 8 });
      await set(".product-screen-row .row-check", { scale: 0.75, opacity: 0 });
      await set(".preview-reward", { scale: 0.75, opacity: 0, y: 0 });
      await set(".famai-preview", { scale: 0.92, opacity: 0, y: 0 });

      if (reduce) {
        await set(".product-screen-bar", { opacity: 1, y: 0 });
        await set(".product-screen-row", { opacity: 1, x: 0 });
        await set(".preview-outcome", { opacity: 1, y: 0 });
        await set(".landing-product-screen>button", { opacity: 1, y: 0 });
        return;
      }

      await to(".product-screen-bar", { opacity: 1, y: 0 }, { duration: 0.32, ease: "easeOut" });
      if (cancelled) return;
      await to(".product-screen-row", { opacity: 1, x: 0 }, { duration: 0.38, delay: stagger(0.11), ease: "easeOut" });
      if (cancelled) return;
      // Feature 4's outcome is the persistent typing indicator; features 2 and 5
      // pop their outcome in during the loop, so they stay hidden after the intro.
      if (feature === 4) to(".preview-outcome", { opacity: 1, y: 0 }, { duration: 0.3 });
      to(".landing-product-screen>button", { opacity: 1, y: 0 }, { duration: 0.3 });
      to(".landing-product-screen>button svg", { x: [0, 4, 0] }, { duration: 1.3, repeat: Infinity, ease: "easeInOut" });

      const loop = loops[feature];
      while (!cancelled && loop) {
        await loop();
      }
    };

    play();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [feature, animate, scope]);

  return <div ref={scope} className={`landing-product-screen feature-${feature} ${item.tone}`}><div className="product-screen-bar"><span><Icon/></span><div><small>FAMOS</small><strong>{item.title}</strong></div><i/></div><div className="product-screen-body">{rows.map(([meta,title],index)=><div className={`product-screen-row row-${index}`} key={title}><b>{meta}</b><span><strong>{title}</strong><small>{index===0?"Up next":index===1?"Shared with family":"Ready when you are"}</small></span>{[2,3].includes(feature)?<i className="row-check"><Check/></i>:<em className={index===1?"pink":""}/>}</div>)}</div>{feature===2&&<div className="preview-outcome preview-reward"><Gift/> +175 points earned</div>}{feature===4&&<div className="preview-outcome preview-typing"><span><i className="typing-dot"/><i className="typing-dot"/><i className="typing-dot"/></span><b className="preview-reply">Everyone’s in ✓</b></div>}{feature===5&&<div className="preview-outcome preview-reward famai-preview"><Bot/> Suggested next step ready</div>}<button>Open in FamOS <ArrowRight/></button></div>;
}

export default function Landing({ signedIn = false }) {
  const [stage, setStage] = useState(2);
  const [feature, setFeature] = useState(0);
  const selectedStage = stages[stage];
  const prefersReduced = useReducedMotion();

  // The app shell scrolls on <body> (html/body/#root are height:100% in
  // index.css), not the window — so every useScroll is pinned to it via
  // `container`. Tracking window.scrollY here would read a value that never moves.
  const scrollerRef = useRef(typeof document !== "undefined" ? document.body : null);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ container: scrollerRef });
  const progressScaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  const { scrollYProgress: heroProgress } = useScroll({ container: scrollerRef, target: heroRef, offset: ["start start", "end start"] });
  const heroYRaw = useTransform(heroProgress, [0, 1], ["0%", "4%"]);
  const heroY = prefersReduced ? "0%" : heroYRaw;

  // Scroll-linked depth for the Fam AI showcase. Each layer drifts at its own
  // rate as the section passes through the viewport, so the illustration and its
  // chat bubbles feel like they sit at different depths.
  const aiRef = useRef(null);
  const { scrollYProgress: aiProgress } = useScroll({ container: scrollerRef, target: aiRef, offset: ["start end", "end start"] });
  const aiArtY = useTransform(aiProgress, [0, 1], ["8%", "-8%"]);
  const aiArtScale = useTransform(aiProgress, [0, 1], [1.06, 0.96]);
  const aiBubble1Y = useTransform(aiProgress, [0, 1], ["48%", "-36%"]);
  const aiBubble2Y = useTransform(aiProgress, [0, 1], ["34%", "-50%"]);
  const aiSquiggleRot = useTransform(aiProgress, [0, 1], [-10, 12]);

  // Persistent mobile CTA appears once the hero has scrolled out of view.
  const heroInView = useInView(heroRef, { amount: 0.25 });

  const floatCard = (delay) => ({
    animate: { y: [0, -9, 0], rotate: [0, 1.2, 0] },
    transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay },
  });

  return <MotionConfig reducedMotion="user"><div className="landing-page">
    <motion.div className="landing-scroll-progress" style={{ scaleX: progressScaleX }} aria-hidden="true" />
    <motion.nav className="landing-nav" initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.55, ease: EASE }}>
      <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><img src="/brand/famos-icon-transparent.png" alt=""/><strong>Fam<span>OS</span></strong></button>
        <div className="landing-links"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#compare">Compare</a><a href="#pricing">Pricing</a></div>
      <div className="landing-actions">{!signedIn&&<button className="landing-signin" onClick={() => go("signin")}>Sign in</button>}<button className="landing-join" onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Get started"}<ArrowRight/></button></div>
    </motion.nav>

    <main>
      <section className="landing-hero" ref={heroRef}>
        <motion.div className="landing-hero-copy" variants={staggerParent} initial="hidden" animate="show">
          <motion.p className="landing-kicker" variants={fadeUp}><Sparkles/> Meet FamOS</motion.p>
          <motion.h1 variants={fadeUp}>Families run better<br/><span>on FamOS.</span></motion.h1>
          <motion.p variants={fadeUp}>A private home base for calendars, meals, groceries, tasks, chat, and Fam AI.</motion.p>
          <motion.div className="landing-hero-ctas" variants={fadeUp}><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</motion.div>
          <motion.div className="landing-trust" variants={fadeUp}><span><Check/> Families run better on FamOS</span><span><Check/> Built for real family life</span></motion.div>
        </motion.div>
        <motion.div className="landing-hero-media" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.75, ease: EASE }} style={{ y: heroY }}>
          <img src="/marketing/family-planning-hero.png" alt="FamOS helping a family coordinate calendars, groceries, tasks, budgets, and AI planning at home"/><svg className="hero-squiggle hero-squiggle-one" viewBox="0 0 150 70" aria-hidden="true"><path d="M5 49c20-55 42 30 64-7s37-19 44 4 24 8 31-12"/></svg><svg className="hero-squiggle hero-squiggle-two" viewBox="0 0 110 62" aria-hidden="true"><path d="M4 30c15-27 28 27 43 0s27-16 33 3 17 8 25-9"/></svg><span className="hero-spark hero-spark-one" aria-hidden="true">✦</span><span className="hero-spark hero-spark-two" aria-hidden="true">✦</span>
          <motion.span className="landing-float-note landing-float-card" {...floatCard(0)}><CheckSquare/> Three things handled before breakfast</motion.span>
          <motion.span className="landing-float-note landing-float-card second" {...floatCard(0.35)}><CalendarDays/><b>4:30</b> Soccer pickup</motion.span>
          <motion.span className="landing-float-note landing-float-card third" {...floatCard(0.7)}><ShoppingCart/><b>6 items</b> Shared grocery list</motion.span>
        </motion.div>
      </section>

      <motion.section className="landing-purpose" id="app-purpose" {...revealBlock}><div><p>Meet FamOS</p><h2>Family life, together.</h2><span>Calendars, meals, groceries, tasks, chat, and helpful planning—all in one private household space.</span><div className="purpose-actions"><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</div></div><div className="purpose-grid"><motion.article {...hoverLift}><CalendarDays/><h3>Shared calendars</h3><p>Sync Google Calendars, colour-code the week, and add real places.</p></motion.article><motion.article {...hoverLift}><Users/><h3>Family updates</h3><p>Share plans, chat, and give every task a clear owner.</p></motion.article><motion.article {...hoverLift}><LockKeyhole/><h3>Private home</h3><p>Your household controls who can see and join your space.</p></motion.article></div></motion.section>

      <section className="landing-intro" id="families"><p>WHY FAMOS</p><motion.h2 {...revealHeading}>All the moving parts.<br/>One warm, shared place.</motion.h2><blockquote>FamOS puts the “Fam” in family.</blockquote><div className="landing-family-pills"><span>New parents</span><span>Busy households</span><span>Co-parents</span><span>Multigenerational families</span><span>Families across cities</span></div></section>

      <section className="landing-stages"><SectionHead eyebrow="Built for every chapter" note="Pick a chapter. The app flexes around the real-life version."><span className="no-orphan-line">Wherever your family is,</span><br/>FamOS fits.</SectionHead><div className="stage-tabs" role="tablist">{stages.map(({id,label,icon:Icon},index)=><button role="tab" aria-selected={stage===index} className={`${id} ${stage===index?"active":""}`} onClick={()=>setStage(index)} key={label}><Icon/>{label}</button>)}</div><motion.div className={`stage-panel stage-${selectedStage.id}`} {...revealBlock}><motion.div key={selectedStage.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: EASE }}><p>{selectedStage.label}</p><h3>{selectedStage.title}</h3><span>{selectedStage.copy}</span><div className="stage-chips">{selectedStage.chips.map(item=><b key={item}><Check/>{item}</b>)}</div></motion.div><motion.img className="stage-family-art" key={selectedStage.artSrc} src={selectedStage.artSrc} alt="" aria-hidden="true" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}/></motion.div></section>

      <section className="landing-features" id="features"><SectionHead eyebrow="Everything in sync" note="FamOS keeps schedules, meals, lists, and tasks easy to find.">Plan the week<br/>with less back-and-forth.</SectionHead><motion.div className="landing-feature-grid" {...revealGroup}>{features.map(({title,copy,icon:Icon,art,tone})=><motion.article className={`landing-feature ${tone}`} key={title} variants={fadeUp} {...hoverLift}><div className="landing-feature-top"><span><Icon/></span><img src={`/illustrations/${art}-editorial.png`} alt="" aria-hidden="true"/></div><h3>{title}</h3><p>{copy}</p></motion.article>)}</motion.div></section>

      <section className="landing-capabilities"><SectionHead eyebrow="Little helpers, big relief" note="Not just pretty screens. These are the small, practical moments that make FamOS feel like it actually lives with your family.">The details that make it useful.</SectionHead><motion.div className="capability-grid" {...revealGroup}>{capabilityHighlights.map(({title,copy,icon:Icon,tone})=><motion.article className={tone} key={title} variants={fadeUp} {...hoverLift}><span><Icon/></span><h3>{title}</h3><p>{copy}</p></motion.article>)}</motion.div></section>

      <section className="landing-product"><SectionHead eyebrow="See it work" note="Choose a feature to preview the flow.">See how<br/>FamOS works.</SectionHead><div className="product-tabs" role="tablist">{features.map(({label,title,icon:Icon},index)=><button role="tab" aria-selected={feature===index} className={feature===index?"active":""} onClick={()=>setFeature(index)} key={title}><Icon/>{label}</button>)}</div><motion.div className="product-stage" {...revealBlock}><motion.div key={`stage-copy-${feature}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: EASE }}><p>{features[feature].title}</p><h3>{features[feature].previewHeadline}</h3><span className="product-stage-copy">{features[feature].copy}</span><ul><li><Check/> Shared across your household</li><li><Check/> Context-aware next steps</li><li><Check/> Review before anything changes</li></ul></motion.div><ProductPreview key={`preview-${feature}`} feature={feature}/></motion.div></section>

      <motion.section className="landing-ai" id="how-it-works" ref={aiRef} {...revealBlock}><div className="landing-ai-art"><motion.img src="/illustrations/famai-editorial.png" alt="Fam AI planning a family weekend" style={prefersReduced ? undefined : { y: aiArtY, scale: aiArtScale }} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: EASE }}/><motion.svg className="ai-squiggle" viewBox="0 0 130 60" aria-hidden="true" style={prefersReduced ? undefined : { rotate: aiSquiggleRot }} initial={{ opacity: 0 }} whileInView={{ opacity: 0.85 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}><path d="M4 42c18-47 34 23 53-7s31-13 38 5 18 5 30-17"/></motion.svg><motion.span className="ai-bubble one" style={prefersReduced ? undefined : { y: aiBubble1Y }} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.5, ease: BACK, delay: 0.15 }}>Use what’s in the pantry for dinners</motion.span><motion.span className="ai-bubble two" style={prefersReduced ? undefined : { y: aiBubble2Y }} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.5, ease: BACK, delay: 0.4 }}>Ready for your review ✓</motion.span></div><div><p className="landing-kicker"><Bot/> Meet Fam AI</p><h2>Plan faster.<br/>Review first.</h2><p>Ask for meal ideas, grocery lists, task plans, or schedule help. Fam AI suggests the next step and waits for approval.</p><motion.ul {...revealGroup}><motion.li variants={fadeUpSmall}><Check/> Connects meals, groceries, tasks, and calendar</motion.li><motion.li variants={fadeUpSmall}><Check/> Suggests actions from household context</motion.li><motion.li variants={fadeUpSmall}><Check/> Always asks before changing FamOS</motion.li></motion.ul><motion.button className="landing-ai-cta" onClick={() => go(signedIn ? "famai" : "signup")} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}>{signedIn ? "Open Fam AI" : "Try Fam AI free"}<ArrowRight/></motion.button></div></motion.section>

      <section className="landing-steps"><SectionHead eyebrow="Start together">From new account<br/>to “we’ve got this.”</SectionHead><motion.div className="landing-step-grid" {...revealGroup}><motion.article variants={fadeUp} {...hoverLift}><b>1</b><h3>Name your home</h3><p>Create the private space your household will share.</p></motion.article><motion.article variants={fadeUp} {...hoverLift}><b>2</b><h3>Invite your people</h3><p>Send secure invites now, or skip and do it later. We’re not bossy.</p></motion.article><motion.article variants={fadeUp} {...hoverLift}><b>3</b><h3>Make it yours</h3><p>Connect calendars, choose roles, and start planning together.</p></motion.article></motion.div></section>

      <section className="landing-testimonials"><SectionHead eyebrow="Made for real family life" note="See how FamOS fits the situations families coordinate every day.">One home base.<br/>Many kinds of family.</SectionHead><motion.div {...revealGroup}>{familyScenarios.map((item)=><motion.article key={item.title} variants={fadeUp}><span><Check/> {item.label}</span><h3>{item.title}</h3><p>{item.copy}</p><footer><img src={item.avatar} alt="" aria-hidden="true"/><b>Built around shared family life</b></footer></motion.article>)}</motion.div></section>

      <motion.section className="landing-comparison" id="compare" {...revealBlock}><SectionHead eyebrow="Why FamOS" note="Use FamOS across the screens you already have, then add people and features as your household grows.">Your family hub,<br/>without another device.</SectionHead><motion.div className="comparison-shell" {...revealGroup}><div className="comparison-head"><span>What matters</span><strong>FamOS</strong><span>Dedicated displays</span><span>Organizer apps</span></div>{comparisonRows.map((row)=><motion.div className="comparison-row" key={row.label} variants={fadeUpSmall}><b>{row.label}</b><strong><Check/>{row.famos}</strong><span>{row.display}</span><span>{row.organizer}</span></motion.div>)}</motion.div><div className="comparison-highlights"><article><Sparkles/><h3>AI that knows the plan</h3><p>Fam AI can connect meals, groceries, tasks, and schedules—then asks before changing anything.</p></article><article><Users/><h3>Sharing at the core</h3><p>Invite family from anywhere, assign clear owners, and keep the same household view on every device.</p></article><article><CheckSquare/><h3>Start simple, add later</h3><p>Begin with the essentials, try FamOS free, and turn on additional help when it earns a place in family life.</p></article></div><motion.div className="comparison-cta" {...revealBlock}><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : `Start your ${PRICING_PLAN.trial.days}-day free trial`}<ArrowRight/></button><small><ShieldCheck/> No charge today · cancel anytime before your trial ends</small></motion.div><small className="comparison-note">Category comparison based on publicly available product information for dedicated displays such as Skylight Calendar and organizer apps such as Cozi and FamilyWall, reviewed July 2026. Features and offers can change.</small></motion.section>

      <motion.section className="landing-community" {...revealBlock}><div className="community-avatars" aria-hidden="true"><img src="/marketing/testimonials/maya.png" alt=""/><img src="/marketing/testimonials/jordan.png" alt=""/><img src="/marketing/testimonials/sam.png" alt=""/></div><p>One home for everyone.</p><motion.h2 {...revealHeading}>Built for every family<br/>stage.</motion.h2><span>From first appointments to school runs, teen schedules, and extended family care, FamOS keeps everyone on the same page.</span><button onClick={()=>go(signedIn?"today":"signup")}>{signedIn?"Open your family space":"Get started"}<ArrowRight/></button><motion.div className="community-facts" {...revealGroup}><motion.article variants={fadeUpSmall}><b>Shared Household</b><small>One private space for your people.</small></motion.article><motion.article variants={fadeUpSmall}><b>Meal Planning</b><small>Recipes, cook mode, and dietary needs.</small></motion.article><motion.article variants={fadeUpSmall}><b>Sync Multiple Calendars</b><small>Google calendars, colours, and places.</small></motion.article><motion.article variants={fadeUpSmall}><b>Assign Chores & Rewards</b><small>Owners now, rewards when ready.</small></motion.article><motion.article variants={fadeUpSmall}><b>Get Help with Fam AI</b><small>Helpful suggestions when you need them.</small></motion.article></motion.div></motion.section>

      <section className="landing-bento"><motion.article className="bento-dashboard" {...revealBlock}><div className="bento-copy"><p>Your week in one place</p><h2>Your weekly<br/>home base.</h2><span>Schedules, tasks, groceries, meals, and updates stay visible without digging through group texts.</span><button onClick={()=>setFeature(0)}>Explore the shared calendar <ArrowRight/></button></div><div className="bento-ui"><ProductPreview feature={0}/><span className="bento-float bento-task"><CheckSquare/> School bags packed</span><span className="bento-float bento-meal"><ChefHat/> Taco night · 6:30</span></div></motion.article><motion.article className="bento-ai" {...revealBlock}><div className="bento-copy"><p>Fam AI</p><h2>Plan faster.<br/>Review first.</h2><span>Turn a simple request into organized suggestions. You stay in control of every change.</span><button onClick={()=>go(signedIn?"famai":"signup")}>{signedIn?"Open Fam AI":"Meet your family assistant"}<ArrowRight/></button></div><div className="bento-ai-demo"><span className="ai-demo-user">Use what’s in the pantry to plan dinners.</span><div><i><Bot/></i><p>I found 3 dinner ideas and built the grocery gaps.</p></div><ul><li><ChefHat/> 3 recipes to review</li><li><ShoppingCart/> 8 grocery gaps found</li><li><Check/> Nothing changes until you approve</li></ul></div></motion.article></section>

      <PricingSection signedIn={signedIn} />

      <motion.section className="landing-privacy" {...revealBlock}><div><LockKeyhole/><p>Private by design</p></div><motion.h2 {...revealHeading}>Family life is personal.<br/>FamOS treats it that way.</motion.h2><p>Your household has its own protected space. FamOS asks before AI actions are applied and keeps family coordination visible to the people you invite.</p></motion.section>

      <motion.section className="landing-final" {...revealBlock}><img src="/illustrations/famos-family-planning.png" alt="A family planning together"/><div><p>Family life, in sync.</p><motion.h2 {...revealHeading}>Families run better<br/>on FamOS.</motion.h2><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start your family space"}<ArrowRight/></button></div></motion.section>
    </main>

    <footer className="landing-footer"><div className="landing-brand"><img src="/brand/famos-icon-transparent.png" alt=""/><strong>Fam<span>OS</span></strong></div><p>For the family you have today, and the one you are growing into.</p><div>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}<a href="#pricing">Pricing</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Sign up"}</button></div><small>© 2026 FamOS. All rights reserved.<br/>Developed by the team at Astronaut Digital · Part of Astronaut Ventures</small></footer>

    <AnimatePresence>{!heroInView && <motion.div className="landing-sticky-cta" initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ duration: 0.32, ease: EASE }}><div><strong>{signedIn ? "Your family space is ready" : `Full access free for ${PRICING_PLAN.trial.days} days`}</strong><small>{signedIn ? "Pick up where you left off" : "Card required · cancel anytime"}</small></div><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button></motion.div>}</AnimatePresence>
  </div></MotionConfig>;
}
