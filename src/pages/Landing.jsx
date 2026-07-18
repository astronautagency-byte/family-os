import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Baby, Bot, CalendarDays, Check, CheckSquare, ChefHat, Gift, GraduationCap, Heart, LockKeyhole, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart, Sparkles, Users } from "lucide-react";
import "../landing.css";
import "../landing-theme.css";
import { PRICING_PLAN, formatMoney } from "../data/pricingPlan";
gsap.registerPlugin(useGSAP, ScrollTrigger);

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

const connectedRoadmap = [
  { status: "Available", title: "Multiple calendars, one family view", copy: "Connect more than one Google Calendar, colour-code events, and see the week together without replacing the calendars you already use.", icon: CalendarDays },
  { status: "Available", title: "Choose what joins the family calendar", copy: "Keep external calendars connected while deciding which events belong in the shared FamOS view.", icon: CheckSquare },
  { status: "In development", title: "Private or shared by default", copy: "Granular controls are being designed so each person can decide which calendars, plans, and details stay private or become visible to the household.", icon: LockKeyhole },
  { status: "Exploring", title: "Bring WhatsApp context into FamOS", copy: "We are exploring a consent-based way to turn selected family conversations into useful plans without importing every message or exposing private chats.", icon: MessageCircle },
];

const pricingAddOns = [
  { id: "fam_ai", label: "Fam AI", copy: `100 helper requests a month. Included during the ${PRICING_PLAN.trial.days}-day trial.`, price: PRICING_PLAN.addOns[0].price.monthly, icon: Bot },
];

function PricingSection({ signedIn }) {
  const pricingRef = useRef(null);
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
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".pricing-card-head h3", { scale: .94, autoAlpha: .72 }, { scale: 1, autoAlpha: 1, duration: .38, ease: "back.out(1.7)", overwrite: "auto" });
      gsap.fromTo(".pricing-total b", { y: 7, autoAlpha: .55 }, { y: 0, autoAlpha: 1, duration: .34, ease: "power2.out", overwrite: "auto" });
    });
    return () => media.revert();
  }, { scope: pricingRef, dependencies: [billing, members, addOnCost], revertOnUpdate: true });

  return <section className="landing-pricing" id="pricing" ref={pricingRef}>
    <div className="landing-section-head"><p>Simple pricing</p><h2>Start small.<br/>Invite the whole crew.</h2><span>Try FamOS free for {PRICING_PLAN.trial.days} days. {PRICING_PLAN.basePlan.membersIncluded} people are included, then each extra member is {formatMoney(PRICING_PLAN.basePlan.additionalMemberPrice.monthly)}/month.</span></div>
    <div className="pricing-shell">
      <div className="pricing-main">
        <div className="pricing-toggle" role="tablist" aria-label="Billing frequency">
          <button className={billing === "monthly" ? "active" : ""} onClick={() => setBilling("monthly")} role="tab" aria-selected={billing === "monthly"}>Monthly</button>
          <button className={billing === "annual" ? "active" : ""} onClick={() => setBilling("annual")} role="tab" aria-selected={billing === "annual"}>Yearly <span>{formatMoney(annualTotal)}/yr</span></button>
        </div>
        <article className="pricing-card">
          <div className="pricing-card-head">
            <span><Users/></span>
            <div><p>Family plan</p><h3><span>{formatMoney(displayedTotal)}</span><small>{billing === "annual" ? "per year" : "per month"}</small></h3></div>
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
          <div className="pricing-total"><span>Total after trial</span><b>{formatMoney(displayedTotal)}<small>{billing === "annual" ? "/yr" : "/mo"}</small></b></div>
          <button onClick={() => go(signedIn ? "today" : "signup")}>Start free for {PRICING_PLAN.trial.days} days <ArrowRight/></button>
          <small><ShieldCheck/> Full feature access during trial. Card required; cancel anytime before billing starts.</small>
        </div>
      </aside>
    </div>
  </section>;
}

function ProductPreview({ feature }) {
  const preview = useRef(null);
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
  useGSAP(()=>{const media=gsap.matchMedia();media.add("(prefers-reduced-motion: no-preference)",()=>{const intro=gsap.timeline();intro.from(".product-screen-bar",{y:-10,autoAlpha:0,duration:.32,ease:"power2.out"}).from(".product-screen-row",{x:18,autoAlpha:0,duration:.38,stagger:.11,ease:"power2.out"},"-=.12");
    if (preview.current.querySelector(".preview-outcome")) intro.from(".preview-outcome",{y:8,autoAlpha:0,duration:.3},"-=.08");
    intro.from(".landing-product-screen>button",{y:8,autoAlpha:0,duration:.3},"-=.12");
    if(feature===0)gsap.timeline({repeat:-1,repeatDelay:.5}).to(".product-screen-row",{backgroundColor:"#eee8ff",duration:.35,stagger:.55}).to(".product-screen-row",{backgroundColor:"#fff",duration:.35,stagger:.55},"-=.8");
    if(feature===1)gsap.timeline({repeat:-1,repeatDelay:.6}).to(".product-screen-row",{y:-3,boxShadow:"0 8px 18px rgba(92,72,31,.12)",duration:.35,stagger:.5}).to(".product-screen-row",{y:0,boxShadow:"0 0 0 rgba(0,0,0,0)",duration:.3,stagger:.5},"-=.7");
    if(feature===2)gsap.timeline({repeat:-1,repeatDelay:1}).to(".product-screen-row .row-check",{scale:1,autoAlpha:1,duration:.28,stagger:.55,ease:"back.out(2)"}).to(".product-screen-row span",{opacity:.55,textDecoration:"line-through",duration:.2,stagger:.55},"<").fromTo(".preview-reward",{scale:.75,autoAlpha:0},{scale:1,autoAlpha:1,duration:.45,ease:"back.out(2)"}).to({}, {duration:.8}).set(".product-screen-row .row-check, .preview-reward",{scale:.75,autoAlpha:0}).set(".product-screen-row span",{opacity:1,textDecoration:"none"});
    if(feature===3)gsap.timeline({repeat:-1,repeatDelay:.8}).to(".product-screen-row .row-check",{scale:1,autoAlpha:1,duration:.25,stagger:.55,ease:"back.out(2)"}).to(".product-screen-row span",{opacity:.48,textDecoration:"line-through",duration:.2,stagger:.55},"<").to({}, {duration:.8}).set(".product-screen-row .row-check",{scale:.75,autoAlpha:0}).set(".product-screen-row span",{opacity:1,textDecoration:"none"});
    if(feature===4)gsap.timeline({repeat:-1,repeatDelay:.8}).fromTo(".typing-dot",{y:0,opacity:.35},{y:-4,opacity:1,duration:.3,stagger:.12,repeat:1,yoyo:true}).fromTo(".preview-reply",{x:10,autoAlpha:0},{x:0,autoAlpha:1,duration:.35,ease:"power2.out"}).to({}, {duration:1}).set(".preview-reply",{autoAlpha:0});
    if(feature===5)gsap.timeline({repeat:-1,repeatDelay:1}).to(".product-screen-row",{backgroundColor:"#eee8ff",duration:.25,stagger:.45}).to(".product-screen-row",{backgroundColor:"#fff",duration:.25,stagger:.45},"-=.5").fromTo(".famai-preview",{scale:.92,autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:"back.out(2)"}).to({}, {duration:.8}).set(".famai-preview",{autoAlpha:0});
    gsap.to(".landing-product-screen>button svg",{x:4,duration:.65,repeat:-1,yoyo:true,ease:"sine.inOut"});});return()=>media.revert();},{scope:preview,dependencies:[feature],revertOnUpdate:true});
  return <div ref={preview} className={`landing-product-screen feature-${feature} ${item.tone}`}><div className="product-screen-bar"><span><Icon/></span><div><small>FAMOS</small><strong>{item.title}</strong></div><i/></div><div className="product-screen-body">{rows.map(([meta,title],index)=><div className={`product-screen-row row-${index}`} key={title}><b>{meta}</b><span><strong>{title}</strong><small>{index===0?"Up next":index===1?"Shared with family":"Ready when you are"}</small></span>{[2,3].includes(feature)?<i className="row-check"><Check/></i>:<em className={index===1?"pink":""}/>}</div>)}</div>{feature===2&&<div className="preview-outcome preview-reward"><Gift/> +175 points earned</div>}{feature===4&&<div className="preview-outcome preview-typing"><span><i className="typing-dot"/><i className="typing-dot"/><i className="typing-dot"/></span><b className="preview-reply">Everyone’s in ✓</b></div>}{feature===5&&<div className="preview-outcome preview-reward famai-preview"><Bot/> Suggested next step ready</div>}<button>Open in FamOS <ArrowRight/></button></div>;
}

export default function Landing({ signedIn = false }) {
  const root = useRef(null);
  const [stage, setStage] = useState(2);
  const [feature, setFeature] = useState(0);
  const selectedStage = stages[stage];
  useGSAP(() => {
    const media = gsap.matchMedia();
    ScrollTrigger.config({ ignoreMobileResize: true });
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".landing-nav", { y: -18, autoAlpha: 0, duration: .55, ease: "power2.out" });
      gsap.from(".landing-hero-copy>*", { y: 20, autoAlpha: 0, duration: .55, stagger: .07, ease: "power2.out" });
      gsap.from(".landing-hero-media", { scale: .96, autoAlpha: 0, duration: .75, ease: "power2.out" });
      gsap.to(".landing-float-card", { y: -9, rotation: "+=1.2", duration: 2.4, stagger: .35, repeat: -1, yoyo: true, ease: "sine.inOut" });

      const revealTargets = gsap.utils.toArray(".landing-purpose, .landing-section-head, .stage-panel, .landing-feature, .capability-grid article, .product-stage, .landing-ai, .landing-step-grid article, .landing-testimonials article, .landing-comparison, .landing-connected, .connected-grid article, .landing-community, .landing-bento>article, .pricing-shell, .landing-privacy, .landing-final");
      gsap.set(revealTargets, { y: 24, autoAlpha: 0 });
      ScrollTrigger.batch(revealTargets, {
        start: "top 88%",
        once: true,
        interval: .08,
        batchMax: 4,
        onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: .62, stagger: .07, ease: "power3.out", overwrite: "auto" }),
        onEnterBack: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: .45, stagger: .04, ease: "power2.out", overwrite: "auto" }),
      });

      gsap.to(".landing-hero-media", {
        yPercent: 4,
        ease: "none",
        scrollTrigger: { trigger: ".landing-hero", start: "top top", end: "bottom top", scrub: .8 },
      });

      gsap.fromTo(".landing-scroll-progress", { scaleX: 0 }, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: .25 },
      });

      gsap.utils.toArray(".landing-section-head h2, .landing-intro h2, .landing-community h2, .landing-privacy h2, .landing-final h2").forEach((heading) => {
        gsap.from(heading, {
          x: -26,
          autoAlpha: 0,
          duration: .7,
          ease: "power3.out",
          scrollTrigger: { trigger: heading, start: "top 86%", once: true },
        });
      });

      gsap.utils.toArray(".stage-family-art, .landing-feature-top img, .landing-ai-art>img, .landing-final>img, .community-avatars").forEach((art) => {
        gsap.fromTo(art, { yPercent: -3 }, {
          yPercent: 4,
          ease: "none",
          scrollTrigger: { trigger: art, start: "top bottom", end: "bottom top", scrub: 1 },
        });
      });

      gsap.utils.toArray(".purpose-grid article svg, .capability-grid article>span").forEach((icon, index) => {
        gsap.to(icon, {
          y: index % 2 ? 5 : -5,
          rotation: index % 2 ? 3 : -3,
          duration: 1.8 + (index % 3) * .25,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      const interactiveCards = gsap.utils.toArray(".purpose-grid article, .landing-feature, .capability-grid article, .landing-step-grid article");
      const listeners = interactiveCards.map((card) => {
        const enter = () => gsap.to(card, { y: -5, scale: 1.012, duration: .28, ease: "power2.out", overwrite: "auto" });
        const leave = () => gsap.to(card, { y: 0, scale: 1, duration: .42, ease: "power3.out", overwrite: "auto" });
        card.addEventListener("pointerenter", enter);
        card.addEventListener("pointerleave", leave);
        return () => {
          card.removeEventListener("pointerenter", enter);
          card.removeEventListener("pointerleave", leave);
        };
      });

      // Mobile Safari finalizes its viewport and image/font geometry after the
      // first paint. Refreshing at those milestones keeps reveal triggers from
      // being calculated off-screen and leaving sections permanently hidden.
      let refreshFrames = 0;
      let revealFrame = 0;
      const refresh = () => {
        cancelAnimationFrame(refreshFrames);
        refreshFrames = requestAnimationFrame(() => {
          ScrollTrigger.sort();
          ScrollTrigger.refresh(true);
        });
      };
      const revealVisible = () => {
        cancelAnimationFrame(revealFrame);
        revealFrame = requestAnimationFrame(() => {
          revealTargets.forEach((target) => {
            const bounds = target.getBoundingClientRect();
            const style = getComputedStyle(target);
            if (bounds.top < innerHeight * .92 && bounds.bottom > 0 && (style.visibility === "hidden" || Number(style.opacity) < .05)) {
              gsap.to(target, { y: 0, autoAlpha: 1, duration: .5, ease: "power2.out", overwrite: "auto" });
            }
          });
        });
      };
      const refreshTimers = [window.setTimeout(refresh, 180), window.setTimeout(refresh, 850)];
      const ready = document.fonts?.ready?.then(refresh).catch(() => {});
      window.addEventListener("load", refresh);
      window.addEventListener("pageshow", refresh);
      window.addEventListener("scroll", revealVisible, { passive: true });
      window.visualViewport?.addEventListener("resize", refresh);
      window.visualViewport?.addEventListener("resize", revealVisible);
      refresh();
      revealVisible();

      return () => {
        void ready;
        listeners.forEach((remove) => remove());
        refreshTimers.forEach(window.clearTimeout);
        cancelAnimationFrame(refreshFrames);
        cancelAnimationFrame(revealFrame);
        window.removeEventListener("load", refresh);
        window.removeEventListener("pageshow", refresh);
        window.removeEventListener("scroll", revealVisible);
        window.visualViewport?.removeEventListener("resize", refresh);
        window.visualViewport?.removeEventListener("resize", revealVisible);
      };
    });
    return () => media.revert();
  }, { scope: root });
  return <div className="landing-page" ref={root}>
    <div className="landing-scroll-progress" aria-hidden="true" />
    <nav className="landing-nav">
      <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><img src="/brand/famos-icon-transparent.png" alt=""/><strong>Fam<span>OS</span></strong></button>
        <div className="landing-links"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#compare">Compare</a><a href="#pricing">Pricing</a></div>
      <div className="landing-actions">{!signedIn&&<button className="landing-signin" onClick={() => go("signin")}>Sign in</button>}<button className="landing-join" onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Get started"}<ArrowRight/></button></div>
    </nav>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy"><p className="landing-kicker"><Sparkles/> Meet FamOS</p><h1>Families run better<br/><span>on FamOS.</span></h1><p>A private home base for calendars, meals, groceries, tasks, chat, and Fam AI.</p><div className="landing-hero-ctas"><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</div><div className="landing-trust"><span><Check/> Families run better on FamOS</span><span><Check/> Built for real family life</span></div></div>
        <div className="landing-hero-media"><img src="/marketing/family-planning-hero.png" alt="FamOS helping a family coordinate calendars, groceries, tasks, budgets, and AI planning at home"/><svg className="hero-squiggle hero-squiggle-one" viewBox="0 0 150 70" aria-hidden="true"><path d="M5 49c20-55 42 30 64-7s37-19 44 4 24 8 31-12"/></svg><svg className="hero-squiggle hero-squiggle-two" viewBox="0 0 110 62" aria-hidden="true"><path d="M4 30c15-27 28 27 43 0s27-16 33 3 17 8 25-9"/></svg><span className="hero-spark hero-spark-one" aria-hidden="true">✦</span><span className="hero-spark hero-spark-two" aria-hidden="true">✦</span><span className="landing-float-note landing-float-card"><CheckSquare/> Three things handled before breakfast</span><span className="landing-float-note landing-float-card second"><CalendarDays/><b>4:30</b> Soccer pickup</span><span className="landing-float-note landing-float-card third"><ShoppingCart/><b>6 items</b> Shared grocery list</span></div>
      </section>

      <section className="landing-purpose" id="app-purpose"><div><p>Meet FamOS</p><h2>Family life, together.</h2><span>Calendars, meals, groceries, tasks, chat, and helpful planning—all in one private household space.</span><div className="purpose-actions"><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</div></div><div className="purpose-grid"><article><CalendarDays/><h3>Shared calendars</h3><p>Sync Google Calendars, colour-code the week, and add real places.</p></article><article><Users/><h3>Family updates</h3><p>Share plans, chat, and give every task a clear owner.</p></article><article><LockKeyhole/><h3>Private home</h3><p>Your household controls who can see and join your space.</p></article></div></section>

      <section className="landing-intro" id="families"><p>WHY FAMOS</p><h2>All the moving parts.<br/>One warm, shared place.</h2><blockquote>FamOS puts the “Fam” in family.</blockquote><div className="landing-family-pills"><span>New parents</span><span>Busy households</span><span>Co-parents</span><span>Multigenerational families</span><span>Families across cities</span></div></section>

      <section className="landing-stages"><div className="landing-section-head"><p>Built for every chapter</p><h2><span className="no-orphan-line">Wherever your family is,</span><br/>FamOS fits.</h2><span>Pick a chapter. The app flexes around the real-life version.</span></div><div className="stage-tabs" role="tablist">{stages.map(({id,label,icon:Icon},index)=><button role="tab" aria-selected={stage===index} className={`${id} ${stage===index?"active":""}`} onClick={()=>setStage(index)} key={label}><Icon/>{label}</button>)}</div><div className={`stage-panel stage-${selectedStage.id}`} key={selectedStage.id}><div><p>{selectedStage.label}</p><h3>{selectedStage.title}</h3><span>{selectedStage.copy}</span><div className="stage-chips">{selectedStage.chips.map(item=><b key={item}><Check/>{item}</b>)}</div></div><img className="stage-family-art" src={selectedStage.artSrc} alt="" aria-hidden="true"/></div></section>

      <section className="landing-features" id="features"><div className="landing-section-head"><p>Everything in sync</p><h2>Plan the week<br/>with less back-and-forth.</h2><span>FamOS keeps schedules, meals, lists, and tasks easy to find.</span></div><div className="landing-feature-grid">{features.map(({title,copy,icon:Icon,art,tone})=><article className={`landing-feature ${tone}`} key={title}><div className="landing-feature-top"><span><Icon/></span><img src={`/illustrations/${art}-editorial.png`} alt="" aria-hidden="true"/></div><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="landing-capabilities"><div className="landing-section-head"><p>Little helpers, big relief</p><h2>The details that make it useful.</h2><span>Not just pretty screens. These are the small, practical moments that make FamOS feel like it actually lives with your family.</span></div><div className="capability-grid">{capabilityHighlights.map(({title,copy,icon:Icon,tone})=><article className={tone} key={title}><span><Icon/></span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="landing-product"><div className="landing-section-head"><p>See it work</p><h2>See how<br/>FamOS works.</h2><span>Choose a feature to preview the flow.</span></div><div className="product-tabs" role="tablist">{features.map(({label,title,icon:Icon},index)=><button role="tab" aria-selected={feature===index} className={feature===index?"active":""} onClick={()=>setFeature(index)} key={title}><Icon/>{label}</button>)}</div><div className="product-stage"><div key={feature}><p>{features[feature].title}</p><h3>{features[feature].previewHeadline}</h3><span className="product-stage-copy">{features[feature].copy}</span><ul><li><Check/> Shared across your household</li><li><Check/> Context-aware next steps</li><li><Check/> Review before anything changes</li></ul></div><ProductPreview feature={feature}/></div></section>

      <section className="landing-ai" id="how-it-works"><div className="landing-ai-art"><img src="/illustrations/famai-editorial.png" alt="Fam AI planning a family weekend"/><svg className="ai-squiggle" viewBox="0 0 130 60" aria-hidden="true"><path d="M4 42c18-47 34 23 53-7s31-13 38 5 18 5 30-17"/></svg><span className="ai-bubble one">Use what’s in the pantry for dinners</span><span className="ai-bubble two">Ready for your review ✓</span></div><div><p className="landing-kicker"><Bot/> Meet Fam AI</p><h2>Plan faster.<br/>Review first.</h2><p>Ask for meal ideas, grocery lists, task plans, or schedule help. Fam AI suggests the next step and waits for approval.</p><ul><li><Check/> Connects meals, groceries, tasks, and calendar</li><li><Check/> Suggests actions from household context</li><li><Check/> Always asks before changing FamOS</li></ul></div></section>

      <section className="landing-steps"><div className="landing-section-head"><p>Start together</p><h2>From new account<br/>to “we’ve got this.”</h2></div><div className="landing-step-grid"><article><b>1</b><h3>Name your home</h3><p>Create the private space your household will share.</p></article><article><b>2</b><h3>Invite your people</h3><p>Send secure invites now, or skip and do it later. We’re not bossy.</p></article><article><b>3</b><h3>Make it yours</h3><p>Connect calendars, choose roles, and start planning together.</p></article></div></section>

      <section className="landing-testimonials"><div className="landing-section-head"><p>Made for real family life</p><h2>One home base.<br/>Many kinds of family.</h2><span>See how FamOS fits the situations families coordinate every day.</span></div><div>{familyScenarios.map((item)=><article key={item.title}><span><Check/> {item.label}</span><h3>{item.title}</h3><p>{item.copy}</p><footer><img src={item.avatar} alt="" aria-hidden="true"/><b>Built around shared family life</b></footer></article>)}</div></section>

      <section className="landing-comparison" id="compare"><div className="landing-section-head"><p>Why FamOS</p><h2>Your family hub,<br/>without another device.</h2><span>Use FamOS across the screens you already have, then add people and features as your household grows.</span></div><div className="comparison-shell"><div className="comparison-head"><span>What matters</span><strong>FamOS</strong><span>Dedicated displays</span><span>Organizer apps</span></div>{comparisonRows.map((row)=><div className="comparison-row" key={row.label}><b>{row.label}</b><strong><Check/>{row.famos}</strong><span>{row.display}</span><span>{row.organizer}</span></div>)}</div><div className="comparison-highlights"><article><Sparkles/><h3>AI that knows the plan</h3><p>Fam AI can connect meals, groceries, tasks, and schedules—then asks before changing anything.</p></article><article><Users/><h3>Sharing at the core</h3><p>Invite family from anywhere, assign clear owners, and keep the same household view on every device.</p></article><article><CheckSquare/><h3>Start simple, add later</h3><p>Begin with the essentials, try FamOS free, and turn on additional help when it earns a place in family life.</p></article></div><small className="comparison-note">Category comparison based on publicly available product information for dedicated displays such as Skylight Calendar and organizer apps such as Cozi and FamilyWall, reviewed July 2026. Features and offers can change.</small></section>

      <section className="landing-connected"><div className="landing-section-head"><p>Connected on your terms</p><h2>Bring the family together.<br/>Keep control of what you share.</h2><span>FamOS is growing toward a flexible connection layer for the calendars and conversations your family already uses.</span></div><div className="connected-grid">{connectedRoadmap.map(({status,title,copy,icon:Icon})=><article key={title}><div><Icon/><span className={status === "Available" ? "available" : ""}>{status}</span></div><h3>{title}</h3><p>{copy}</p></article>)}</div><small>Roadmap items are directional and may change as we validate privacy, consent, and platform requirements with families.</small></section>

      <section className="landing-community"><div className="community-avatars" aria-hidden="true"><img src="/marketing/testimonials/maya.png" alt=""/><img src="/marketing/testimonials/jordan.png" alt=""/><img src="/marketing/testimonials/sam.png" alt=""/></div><p>One home for everyone.</p><h2>Built for every family<br/>stage.</h2><span>From first appointments to school runs, teen schedules, and extended family care, FamOS keeps everyone on the same page.</span><button onClick={()=>go(signedIn?"today":"signup")}>{signedIn?"Open your family space":"Get started"}<ArrowRight/></button><div className="community-facts"><article><b>Shared Household</b><small>One private space for your people.</small></article><article><b>Meal Planning</b><small>Recipes, cook mode, and dietary needs.</small></article><article><b>Sync Multiple Calendars</b><small>Google calendars, colours, and places.</small></article><article><b>Assign Chores & Rewards</b><small>Owners now, rewards when ready.</small></article><article><b>Get Help with Fam AI</b><small>Helpful suggestions when you need them.</small></article></div></section>

      <section className="landing-bento"><article className="bento-dashboard"><div className="bento-copy"><p>Your week in one place</p><h2>Your weekly<br/>home base.</h2><span>Schedules, tasks, groceries, meals, and updates stay visible without digging through group texts.</span><button onClick={()=>setFeature(0)}>Explore the shared calendar <ArrowRight/></button></div><div className="bento-ui"><ProductPreview feature={0}/><span className="bento-float bento-task"><CheckSquare/> School bags packed</span><span className="bento-float bento-meal"><ChefHat/> Taco night · 6:30</span></div></article><article className="bento-ai"><div className="bento-copy"><p>Fam AI</p><h2>Plan faster.<br/>Review first.</h2><span>Turn a simple request into organized suggestions. You stay in control of every change.</span><button onClick={()=>go(signedIn?"famai":"signup")}>{signedIn?"Open Fam AI":"Meet your family assistant"}<ArrowRight/></button></div><div className="bento-ai-demo"><span className="ai-demo-user">Use what’s in the pantry to plan dinners.</span><div><i><Bot/></i><p>I found 3 dinner ideas and built the grocery gaps.</p></div><ul><li><ChefHat/> 3 recipes to review</li><li><ShoppingCart/> 8 grocery gaps found</li><li><Check/> Nothing changes until you approve</li></ul></div></article></section>

      <PricingSection signedIn={signedIn} />

      <section className="landing-privacy"><div><LockKeyhole/><p>Private by design</p></div><h2>Family life is personal.<br/>FamOS treats it that way.</h2><p>Your household has its own protected space. FamOS asks before AI actions are applied and keeps family coordination visible to the people you invite.</p></section>

      <section className="landing-final"><img src="/illustrations/famos-family-planning.png" alt="A family planning together"/><div><p>Family life, in sync.</p><h2>Families run better<br/>on FamOS.</h2><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start your family space"}<ArrowRight/></button></div></section>
    </main>

    <footer className="landing-footer"><div className="landing-brand"><img src="/brand/famos-icon-transparent.png" alt=""/><strong>Fam<span>OS</span></strong></div><p>For the family you have today, and the one you are growing into.</p><div>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}<a href="#pricing">Pricing</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Sign up"}</button></div><small>© 2026 FamOS. All rights reserved.<br/>Developed by the team at Astronaut Digital · Part of Astronaut Ventures</small></footer>
  </div>;
}
