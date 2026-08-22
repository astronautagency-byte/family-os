import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimate, useInView, useScroll, useSpring, useTransform, useReducedMotion, MotionConfig, stagger } from "framer-motion";
import { ArrowRight, Baby, BellRing, Bot, CalendarDays, Check, CheckSquare, ChefHat, FileInput, GraduationCap, Heart, LoaderCircle, LockKeyhole, MessageCircle, Palette, Refrigerator, ShieldCheck, ShoppingCart, Smartphone, Sparkles, Users } from "lucide-react";
import "../landing.css";
import "../landing-theme.css";
import "../feature.css";
import { PRICING_PLAN, formatMoney } from "../data/pricingPlan";
import MarketingNav from "../components/MarketingNav";
import MarketingFooter from "../components/MarketingFooter";
import { supabase } from "../lib/supabase";

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

// The six day-to-day workflows used by the interactive homepage preview.
// The full product catalog also includes Today and Family & Settings in the
// shared navigation, footer, and dedicated /features index.
const features = [
  { label: "Calendar", title: "Your family's week. Finally clear.", previewHeadline: "One shared view of everyone’s week.", copy: "Every school event, work meeting, sports practice, and dinner plan — in one beautiful view. Bring in the calendars you already use. See the week the way your family actually lives it.", icon: CalendarDays, art: "calendar", tone: "lilac" },
  { label: "Meals", title: "Dinner, figured out.", copy: "Plan the week's meals in minutes. Follow any recipe hands-free with Cook Mode. Add missing ingredients to the grocery list without leaving the kitchen.", icon: ChefHat, art: "meals", tone: "yellow" },
  { label: "Fam AI", title: "Your family's quiet genius.", previewHeadline: "Ask in plain words. Approve before anything changes.", copy: "Ask for meal ideas, grocery lists, or help planning the week. Fam AI understands your household — and waits for your OK before anything changes.", icon: Bot, art: "famai", tone: "peach" },
  { label: "Tasks", title: "Everyone knows what’s theirs.", previewHeadline: "Every task has a home and an owner.", copy: "Colour-coded lists. Clear owners. Routines for the stuff that repeats. No more “did you remember…?”", icon: CheckSquare, art: "tasks", tone: "pink" },
  { label: "Chat", title: "Family chat, with the plan right there.", previewHeadline: "Talk about the plan, right where the plan lives.", copy: "Keep the conversation and the plan together — no more digging through old messages to remember what you decided.", icon: MessageCircle, art: "chat", tone: "blue" },
  { label: "Shopping", title: "The list that keeps up with you.", previewHeadline: "From list to kitchen, without the mental load.", copy: "Quick-add on the way out the door. Focus mode in the aisle. Items that find their way to the fridge, freezer, or pantry when you get home.", icon: ShoppingCart, art: "groceries", tone: "mint" },
];

const capabilityHighlights = [
  { title: "Calendars, your way", copy: "Bring in Google, Apple, school, sports — and choose what stays private. Every calendar, one view.", icon: CalendarDays, tone: "lilac" },
  { title: "Recipes with Cook Mode", copy: "Big step-by-step screen. Voice commands. Flour-covered hands never touch the phone.", icon: ChefHat, tone: "yellow" },
  { title: "Know what’s in the kitchen", copy: "See what's in the fridge, freezer, and pantry. Plan meals around what you already have.", icon: Refrigerator, tone: "pink" },
  { title: "Use-it-soon reminders", copy: "A quiet reminder before things expire. Restock in one tap.", icon: BellRing, tone: "mint" },
  { title: "Photos and quick scans", copy: "Snap a photo or scan a barcode. The brand and image stay on the card.", icon: ShoppingCart, tone: "blue" },
  { title: "Imports you approve", copy: "Paste from Apple, Google, or Microsoft. Confirm before anything lands in your list.", icon: FileInput, tone: "peach" },
  { title: "A look that’s yours", copy: "Choose a palette that feels like yours. Light and dark modes, tuned to match.", icon: Palette, tone: "lilac" },
  { title: "Updates without clutter", copy: "A quick broadcast to everyone's home page. React and move on.", icon: MessageCircle, tone: "yellow" },
  { title: "Fam AI, review first", copy: "Meal ideas, grocery lists, calendar summaries — always behind your confirmation.", icon: Bot, tone: "mint" },
];

const go = (route) => {
  const cleanPaths = { signin: "/sign-in", signup: "/sign-up", pricing: "/pricing", privacy: "/privacy", terms: "/terms" };
  if (cleanPaths[route]) {
    window.history.pushState(null, "", cleanPaths[route]);
    window.dispatchEvent(new Event("popstate"));
    return;
  }
  window.history.pushState({ tab: route }, "", route === "today" ? "/" : `/${route}`);
  window.dispatchEvent(new Event("popstate"));
};

const stages = [
  { id: "expecting", label: "Expecting", icon: Heart, title: "The countdown begins. Everything in one place.", copy: "Appointments, prep lists, budgets, and support plans — all in one calm view.", artSrc: "/illustrations/stage-expecting.png", chips: ["Prenatal appointment", "Nursery checklist", "Support circle"] },
  { id: "newborn", label: "Newborn", icon: Baby, title: "The days are long. FamOS makes them easier.", copy: "Feeds, errands, meals, visitors, and small wins — tracked when days are a blur.", artSrc: "/illustrations/stage-newborn.png", chips: ["Bottle restock", "Meal train", "Quiet hours"] },
  { id: "school", label: "School years", icon: GraduationCap, title: "The school year, without the chaos.", copy: "School events, activities, chores, meals, and pickups—without chasing five separate chats.", artSrc: "/illustrations/stage-school.png", chips: ["Library books", "Soccer pickup", "Lunch plan"] },
  { id: "teen", label: "Teenagers", icon: MessageCircle, title: "Give them ownership. Keep the clarity.", copy: "Teens own their tasks. You see the full picture. Everyone wins.", artSrc: "/illustrations/stage-teen.png", chips: ["Shared car", "Work shift", "Reward request"] },
  { id: "extended", label: "Extended family", icon: Users, title: "Across generations. Across cities. Still connected.", copy: "Care, celebrations, errands, and everyday support — wherever everyone is.", artSrc: "/illustrations/stage-extended.png", chips: ["Grandma’s visit", "Prescription pickup", "Family dinner"] },
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
  { label: "Try before committing", famos: `${PRICING_PLAN.trial.days}-day free trial on Pro`, display: "Offers and trials vary", organizer: "Free tiers or trials vary" },
];

function PricingSection({ signedIn }) {
  const [billing, setBilling] = useState("monthly");
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const plan = PRICING_PLAN.paidPlans.find((p) => p.id === selectedPlan) || PRICING_PLAN.paidPlans[1];
  const monthlyPrice = plan.price.monthly;
  const yearlyPrice = plan.price.yearly;
  const displayPrice = billing === "annual" ? yearlyPrice : monthlyPrice;
  const displayPer = billing === "annual" ? "/yr" : "/mo";
  const yearlySavings = monthlyPrice * 12 - yearlyPrice;
  const trialDays = PRICING_PLAN.trial.days;
  const coreFeatures = PRICING_PLAN.plans[0].featureList;
  const pulseKey = `${billing}-${selectedPlan}`;

  const startCheckout = async () => {
    setCheckoutError("");
    if (!signedIn) {
      const params = new URLSearchParams({ returnPath: "/pricing" });
      window.history.pushState(null, "", `/sign-up?${params.toString()}`);
      window.dispatchEvent(new Event("popstate"));
      return;
    }
    setCheckoutBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("chargebee-checkout", {
        body: { feature: selectedPlan, billing },
      });
      if (error) throw error;
      const url = data?.url;
      if (!url) throw new Error("Checkout couldn't start. Please try again in a moment.");
      window.location.assign(url);
    } catch (err) {
      setCheckoutError(err?.message || "Could not start checkout. Please try again.");
      setCheckoutBusy(false);
    }
  };

  return <section className="landing-pricing" id="pricing">
    <SectionHead eyebrow="Simple pricing" note="Calendar, Tasks, Shopping, Chat and Kitchen Watch are free forever. Upgrade to Plus or Pro for sync, recipes, meal planning, and more.">Start free.<br/>Add what helps.</SectionHead>
    <motion.div className="pricing-shell" {...revealBlock}>
      <div className="pricing-main">
        <div className="pricing-toggle" role="tablist" aria-label="Billing frequency">
          <button className={billing === "monthly" ? "active" : ""} onClick={() => setBilling("monthly")} role="tab" aria-selected={billing === "monthly"}>Monthly</button>
          <button className={billing === "annual" ? "active" : ""} onClick={() => setBilling("annual")} role="tab" aria-selected={billing === "annual"}>Yearly <span>Save ${yearlySavings.toFixed(0)}</span></button>
        </div>

        <div className="pricing-plan-cards">
          {PRICING_PLAN.paidPlans.map((p) => {
            const active = selectedPlan === p.id;
            const price = billing === "annual" ? p.price.yearly : p.price.monthly;
            const per = billing === "annual" ? "/yr" : "/mo";
            return <button
              key={p.id}
              className={`pricing-plan-card${active ? " selected" : ""}${p.isPopular ? " popular" : ""}`}
              onClick={() => setSelectedPlan(p.id)}
              aria-pressed={active}
            >
              {p.isPopular && <span className="pricing-plan-badge">Most popular</span>}
              <div className="pricing-plan-head">
                <strong>{p.name}</strong>
                <span className="pricing-plan-price"><em>{formatMoney(price)}</em>{per}</span>
              </div>
              <p className="pricing-plan-tagline">{p.tagline}</p>
              <ul className="pricing-plan-features">
                {p.featureList.map((feature) => <li key={feature}><Check size={14}/> {feature}</li>)}
              </ul>
            </button>;
          })}
        </div>

        <article className="pricing-card">
          <div className="pricing-card-head">
            <span><Users/></span>
            <div><p>Your plan</p><motion.h3 key={pulseKey} initial={{ scale: 0.94, opacity: 0.72 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.38, ease: BACK }}><span>{formatMoney(displayPrice)}</span><small>{displayPer}</small></motion.h3></div>
          </div>
          <p className="pricing-note">No card is required for Core. Paid plans include a {trialDays}-day free trial — cancel anytime during the trial and you won't be charged.</p>
          <ul className="pricing-includes">
            {coreFeatures.map((feature) => <li key={feature}><Check/> {feature}</li>)}
          </ul>
        </article>
      </div>
      <aside className="pricing-side">
        <div className="pricing-summary">
          <div><span>Core plan</span><b>Free</b></div>
          <div><span>{plan.name}</span><b>{formatMoney(displayPrice)}{displayPer}</b></div>
          {billing === "annual" && yearlySavings > 0 && <div className="annual-savings"><span>Yearly savings</span><b>${yearlySavings.toFixed(2)}</b></div>}
          <div className="pricing-total"><span>After {trialDays}-day trial</span><motion.b key={pulseKey} initial={{ y: 7, opacity: 0.55 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.34, ease: EASE }}>{formatMoney(displayPrice)}<small>{displayPer}</small></motion.b></div>
          <button onClick={startCheckout} disabled={checkoutBusy}>
            {checkoutBusy ? <LoaderCircle className="animate-spin" size={16} /> : null}
            {checkoutBusy ? "Opening checkout…" : `Start ${trialDays}-day free trial`}
            {!checkoutBusy && <ArrowRight/>}
          </button>
          {checkoutError && <small className="pricing-checkout-error">{checkoutError}</small>}
          <small><ShieldCheck/> Secure Chargebee checkout. Card required for trial. Cancel anytime.</small>
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
    <MarketingNav signedIn={signedIn} />

    <main>
      <section className="landing-hero landing-hero-fullbleed" ref={heroRef}>
        <div className="hero-lifestyle-bg">
          <img src="/illustrations/famos-lifestyle.png" alt="" aria-hidden="true" />
          <div className="hero-lifestyle-overlay" />
        </div>
        <motion.div className="landing-hero-copy" variants={staggerParent} initial="hidden" animate="show">
          <motion.p className="landing-kicker" variants={fadeUp}><Sparkles/> Meet FamOS</motion.p>
          <motion.h1 variants={fadeUp}>Your family,<br/>finally in sync.</motion.h1>
          <motion.p variants={fadeUp}>One private home for calendars, meals, groceries, tasks, chat, and a helpful bit of AI. So the whole household is on the same page — without the chaos.</motion.p>
          <motion.div className="landing-hero-ctas" variants={fadeUp}><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</motion.div>
          <motion.div className="landing-trust" variants={fadeUp}><span><Check/> Private to your household</span><span><Check/> Free to start, no card needed</span></motion.div>
        </motion.div>
      </section>

      <section className="landing-devices">
        <div className="landing-devices-inner">
          <motion.div className="landing-devices-copy" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6, ease: EASE }}>
            <p className="landing-kicker"><Smartphone /> Works everywhere you do</p>
            <h2>No new hardware.<br/>Just the screens you already use.</h2>
            <p>FamOS runs on your phone, tablet, laptop, or any wall-mounted screen. Bring it with you anywhere and use it where you already manage your family life — the kitchen, the car, the couch.</p>
            <motion.ul className="landing-devices-list" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15, ease: EASE }}>
              <li><Check /> Phone, tablet, laptop, or wall display</li>
              <li><Check /> Same household view on every device</li>
              <li><Check /> No dedicated hardware to buy</li>
              <li><Check /> Works offline for what matters most</li>
            </motion.ul>
          </motion.div>
          <motion.div className="landing-devices-image" initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: EASE }}>
            <img src="/illustrations/famos-devices.png" alt="FamOS running on laptop, tablet, and phone" />
          </motion.div>
        </div>
      </section>

      <motion.section className="landing-purpose" id="app-purpose" {...revealBlock}><div><p>Meet FamOS</p><h2>Made for the way your family actually works.</h2><span>One calm, private place for the everyday stuff — schedules, meals, lists, and the little reminders that keep a household running. No learning curve. No complexity. Just clarity.</span><div className="purpose-actions"><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</div></div><div className="purpose-grid"><motion.article {...hoverLift}><CalendarDays/><h3>Shared calendars</h3><p>Bring in the calendars you already use and see the week together — no more “what’s happening when?”</p></motion.article><motion.article {...hoverLift}><Users/><h3>Family updates</h3><p>Share plans, chat, and give every task a clear owner, so nobody’s left guessing.</p></motion.article><motion.article {...hoverLift}><LockKeyhole/><h3>Private home</h3><p>Your household decides who sees what. Your space stays yours.</p></motion.article></div></motion.section>

      <section className="landing-intro" id="families"><p>WHY FAMOS</p><motion.h2 {...revealHeading}>Every moving part.<br/>One calm place.</motion.h2><blockquote>The end of the family group-chat panic.</blockquote><div className="landing-family-pills"><span>New parents</span><span>Busy households</span><span>Co-parents</span><span>Multigenerational families</span><span>Families across cities</span></div></section>

      <section className="landing-stages"><SectionHead eyebrow="Built for every chapter" note="Pick a chapter. The app flexes around the real-life version."><span className="no-orphan-line">Wherever your family is,</span><br/>FamOS fits.</SectionHead><div className="stage-tabs" role="tablist">{stages.map(({id,label,icon:Icon},index)=><button role="tab" aria-selected={stage===index} className={`${id} ${stage===index?"active":""}`} onClick={()=>setStage(index)} key={label}><Icon/>{label}</button>)}</div><motion.div className={`stage-panel stage-${selectedStage.id}`} {...revealBlock}><motion.div key={selectedStage.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: EASE }}><p>{selectedStage.label}</p><h3>{selectedStage.title}</h3><span>{selectedStage.copy}</span><div className="stage-chips">{selectedStage.chips.map(item=><b key={item}><Check/>{item}</b>)}</div></motion.div><motion.img className="stage-family-art" key={selectedStage.artSrc} src={selectedStage.artSrc} alt="" aria-hidden="true" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}/></motion.div></section>

      <section className="landing-features" id="features"><SectionHead eyebrow="Everything in sync" note="FamOS keeps schedules, meals, lists, and tasks easy to find.">Plan the week<br/>with less back-and-forth.</SectionHead><motion.div className="landing-feature-grid" {...revealGroup}>{features.map(({title,copy,icon:Icon,art,tone})=><motion.article className={`landing-feature ${tone}`} key={title} variants={fadeUp} {...hoverLift}><div className="landing-feature-top"><span><Icon/></span><img src={`/illustrations/${art}-editorial.png`} alt="" aria-hidden="true"/></div><h3>{title}</h3><p>{copy}</p></motion.article>)}</motion.div></section>

      <section className="landing-capabilities"><SectionHead eyebrow="Thoughtful touches" note="The small, practical moments that make FamOS feel like it was built by someone who actually runs a household.">Details that feel like they were made for you.</SectionHead><motion.div className="capability-grid" {...revealGroup}>{capabilityHighlights.map(({title,copy,icon:Icon,tone})=><motion.article className={tone} key={title} variants={fadeUp} {...hoverLift}><span><Icon/></span><h3>{title}</h3><p>{copy}</p></motion.article>)}</motion.div></section>

      <section className="landing-product"><SectionHead eyebrow="See it work" note="Choose a feature to preview the flow.">See how<br/>FamOS works.</SectionHead><div className="product-tabs" role="tablist">{features.map(({label,title,icon:Icon},index)=><button role="tab" aria-selected={feature===index} className={feature===index?"active":""} onClick={()=>setFeature(index)} key={title}><Icon/>{label}</button>)}</div><motion.div className="product-stage" {...revealBlock}><motion.div key={`stage-copy-${feature}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: EASE }}><p>{features[feature].title}</p><h3>{features[feature].previewHeadline}</h3><span className="product-stage-copy">{features[feature].copy}</span><ul><li><Check/> Shared across your household</li><li><Check/> Context-aware next steps</li><li><Check/> Review before anything changes</li></ul></motion.div><ProductPreview key={`preview-${feature}`} feature={feature}/></motion.div></section>

      <motion.section className="landing-ai" id="how-it-works" ref={aiRef} {...revealBlock}><div className="landing-ai-art"><motion.img src="/illustrations/famai-editorial.png" alt="Fam AI planning a family weekend" style={prefersReduced ? undefined : { y: aiArtY, scale: aiArtScale }} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: EASE }}/><motion.svg className="ai-squiggle" viewBox="0 0 130 60" aria-hidden="true" style={prefersReduced ? undefined : { rotate: aiSquiggleRot }} initial={{ opacity: 0 }} whileInView={{ opacity: 0.85 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}><path d="M4 42c18-47 34 23 53-7s31-13 38 5 18 5 30-17"/></motion.svg><motion.span className="ai-bubble one" style={prefersReduced ? undefined : { y: aiBubble1Y }} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.5, ease: BACK, delay: 0.15 }}>Use what’s in the pantry for dinners</motion.span><motion.span className="ai-bubble two" style={prefersReduced ? undefined : { y: aiBubble2Y }} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.5, ease: BACK, delay: 0.4 }}>Ready for your review ✓</motion.span></div><div><p className="landing-kicker"><Bot/> Meet Fam AI</p><h2>Plan faster.<br/>Review first.</h2><p>Ask in plain words. Get meal ideas, grocery lists, or help planning the week. Fam AI understands your household — and never changes anything without your say-so.</p><motion.ul {...revealGroup}><motion.li variants={fadeUpSmall}><Check/> Understands meals, groceries, tasks, and schedules</motion.li><motion.li variants={fadeUpSmall}><Check/> Suggests helpful next steps from your household</motion.li><motion.li variants={fadeUpSmall}><Check/> Never changes anything without your say-so</motion.li></motion.ul><motion.button className="landing-ai-cta" onClick={() => go(signedIn ? "famai" : "signup")} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}>{signedIn ? "Open Fam AI" : "Try Fam AI free"}<ArrowRight/></motion.button></div></motion.section>

      <section className="landing-steps"><SectionHead eyebrow="Start together">From new account<br/>to “we’ve got this.”</SectionHead><motion.div className="landing-step-grid" {...revealGroup}><motion.article variants={fadeUp} {...hoverLift}><b>1</b><h3>Name your home</h3><p>Thirty seconds. That's all it takes.</p></motion.article><motion.article variants={fadeUp} {...hoverLift}><b>2</b><h3>Invite your people</h3><p>Send secure invites now, or skip and do it later. We’re not bossy.</p></motion.article><motion.article variants={fadeUp} {...hoverLift}><b>3</b><h3>Make it yours</h3><p>Connect calendars. Choose colours. Start planning. It feels right from the first tap.</p></motion.article></motion.div></section>

      <section className="landing-testimonials"><SectionHead eyebrow="Made for real family life" note="See how FamOS fits the situations families coordinate every day.">One home base.<br/>Many kinds of family.</SectionHead><motion.div {...revealGroup}>{familyScenarios.map((item)=><motion.article key={item.title} variants={fadeUp}><span><Check/> {item.label}</span><h3>{item.title}</h3><p>{item.copy}</p><footer><img src={item.avatar} alt="" aria-hidden="true"/><b>Built around shared family life</b></footer></motion.article>)}</motion.div></section>

      <motion.section className="landing-comparison" id="compare" {...revealBlock}><SectionHead eyebrow="Why FamOS" note="Use FamOS across the screens you already have, then add people and features as your household grows.">Your family hub,<br/>without another device.</SectionHead><motion.div className="comparison-shell" {...revealGroup}><div className="comparison-head"><span>What matters</span><strong>FamOS</strong><span>Dedicated displays</span><span>Organizer apps</span></div>{comparisonRows.map((row)=><motion.div className="comparison-row" key={row.label} variants={fadeUpSmall}><b>{row.label}</b><strong><Check/>{row.famos}</strong><span>{row.display}</span><span>{row.organizer}</span></motion.div>)}</motion.div><div className="comparison-highlights"><article><Sparkles/><h3>AI that actually knows your family</h3><p>Not a generic chatbot. Fam AI understands your meals, groceries, tasks, and schedule — and never acts without your approval.</p></article><article><Users/><h3>Built to share</h3><p>Invite family from anywhere. Assign clear owners. The same household view on every device — phone, tablet, laptop.</p></article><article><CheckSquare/><h3>Start free. Grow when you're ready.</h3><p>Calendar, tasks, shopping, chat, and kitchen watch — free forever. Add sync, recipes, and AI when your family wants more.</p></article></div><motion.div className="comparison-cta" {...revealBlock}><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : `Start your ${PRICING_PLAN.trial.days}-day free trial`}<ArrowRight/></button><small><ShieldCheck/> No charge today · cancel anytime before your trial ends</small></motion.div>      <small className="comparison-note">Category comparison based on publicly available product information for dedicated displays such as Skylight Calendar and organizer apps such as Cozi and FamilyWall, reviewed July 2026. Features and offers can change.</small>
      <motion.div className="comparison-cta" {...revealBlock}><a href="/features">Browse every feature <ArrowRight/></a><small>One dedicated page per module with screenshots, use-cases, and what to try first.</small></motion.div></motion.section>

      <motion.section className="landing-community" {...revealBlock}><div className="community-avatars" aria-hidden="true"><img src="/marketing/testimonials/maya.png" alt=""/><img src="/marketing/testimonials/jordan.png" alt=""/><img src="/marketing/testimonials/sam.png" alt=""/></div><p>One home for everyone.</p><motion.h2 {...revealHeading}>Built for every family<br/>stage.</motion.h2><span>From first appointments to school runs, teen schedules, and extended family care — FamOS adapts to the way your family actually works.</span><button onClick={()=>go(signedIn?"today":"signup")}>{signedIn?"Open your family space":"Get started"}<ArrowRight/></button><motion.div className="community-facts" {...revealGroup}><motion.article variants={fadeUpSmall}><b>One private home</b><small>Roles and visibility for your people.</small></motion.article><motion.article variants={fadeUpSmall}><b>Meals & kitchen</b><small>Recipes, Cook Mode, and what’s in the pantry.</small></motion.article><motion.article variants={fadeUpSmall}><b>Calendars, together</b><small>Private or shared, with Google sync.</small></motion.article><motion.article variants={fadeUpSmall}><b>Tasks with owners</b><small>Custom lists, routines, and imports you approve.</small></motion.article><motion.article variants={fadeUpSmall}><b>Fam AI, review first</b><small>Helpful proposals that wait for your OK.</small></motion.article></motion.div></motion.section>

      <section className="landing-bento"><motion.article className="bento-dashboard" {...revealBlock}><div className="bento-copy"><p>Your week in one place</p><h2>Your weekly<br/>home base.</h2><span>Schedules, tasks, groceries, meals, and updates stay visible without digging through group texts.</span><button onClick={()=>setFeature(0)}>Explore the shared calendar <ArrowRight/></button></div><div className="bento-ui"><ProductPreview feature={0}/><span className="bento-float bento-task"><CheckSquare/> School bags packed</span><span className="bento-float bento-meal"><ChefHat/> Taco night · 6:30</span></div></motion.article><motion.article className="bento-ai" {...revealBlock}><div className="bento-copy"><p>Fam AI</p><h2>Plan faster.<br/>Review first.</h2><span>Turn a simple request into organized suggestions. You stay in control of every change.</span><button onClick={()=>go(signedIn?"famai":"signup")}>{signedIn?"Open Fam AI":"Meet your family assistant"}<ArrowRight/></button></div><div className="bento-ai-demo"><span className="ai-demo-user">Use what’s in the pantry to plan dinners.</span><div><i><Bot/></i><p>I found 3 dinner ideas and built the grocery gaps.</p></div><ul><li><ChefHat/> 3 recipes to review</li><li><ShoppingCart/> 8 grocery gaps found</li><li><Check/> Nothing changes until you approve</li></ul></div></motion.article></section>

      <PricingSection signedIn={signedIn} />

      <motion.section className="landing-privacy" {...revealBlock}><div><LockKeyhole/><p>Private by design</p></div><motion.h2 {...revealHeading}>Family life is personal.<br/>FamOS treats it that way.</motion.h2><p>Your household has its own protected space. FamOS asks before AI actions are applied and keeps family coordination visible to the people you invite.</p></motion.section>

      <motion.section className="landing-final" {...revealBlock}><div><p>Family life, in sync.</p><motion.h2 {...revealHeading}>The calm your family<br/>deserves.</motion.h2><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start your family space"}<ArrowRight/></button></div></motion.section>
    </main>

    <MarketingFooter signedIn={signedIn} />

    <AnimatePresence>{!heroInView && <motion.div className="landing-sticky-cta" initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ duration: 0.32, ease: EASE }}><div><strong>{signedIn ? "Your family space is ready" : `Full access free for ${PRICING_PLAN.trial.days} days`}</strong><small>{signedIn ? "Pick up where you left off" : "Card required · cancel anytime"}</small></div><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button></motion.div>}</AnimatePresence>
  </div></MotionConfig>;
}
