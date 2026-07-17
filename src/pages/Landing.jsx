import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Baby, Bot, CalendarDays, Check, CheckSquare, ChefHat, Gift, GraduationCap, Heart, LockKeyhole, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart, Sparkles, Users, WalletCards } from "lucide-react";
import "../landing.css";
import "../landing-theme.css";
import { PRICING_PLAN, formatMoney } from "../data/pricingPlan";
gsap.registerPlugin(useGSAP);

const features = [
  { label: "Calendar", title: "One calendar. Fewer surprises.", copy: "Pull the week into one colour-coded view, including the Google Calendars your family already uses.", icon: CalendarDays, art: "calendar", tone: "lilac" },
  { label: "Meals", title: "Dinner plans, minus the debate.", copy: "Plan ahead, spin meal roulette, and get ideas before everyone asks what’s for dinner.", icon: ChefHat, art: "meals", tone: "yellow" },
  { label: "Tasks & rewards", title: "Chores with an owner.", copy: "Assign the thing, set the points, and celebrate the little wins.", icon: Gift, art: "tasks", tone: "pink" },
  { label: "Groceries", title: "The list that remembers.", copy: "Staples, favourites, quantities, and who added what—all in one place.", icon: ShoppingCart, art: "groceries", tone: "mint" },
  { label: "Family chat", title: "Family chat, with context.", copy: "Quick decisions stay next to the plans they’re about. Revolutionary, we know.", icon: MessageCircle, art: "chat", tone: "blue" },
  { label: "Finances", title: "Money, a little less mysterious.", copy: "Keep an eye on household spending without turning dinner into a budget meeting.", icon: WalletCards, art: "finance", tone: "peach" },
];

const go = (route) => { window.location.hash = route; };

const stages = [
  { id: "expecting", label: "Expecting", icon: Heart, title: "Tiny human. Big logistics.", copy: "Appointments, prep lists, budgets, and the support crew—kept gently in one place.", artSrc: "/illustrations/stage-expecting.png", chips: ["Prenatal appointment", "Nursery checklist", "Support circle"] },
  { id: "newborn", label: "Newborn", icon: Baby, title: "For the beautiful blur.", copy: "Feeds, errands, meals, visitors, and small wins stay visible when nobody has spare brain space.", artSrc: "/illustrations/stage-newborn.png", chips: ["Bottle restock", "Meal train", "Quiet hours"] },
  { id: "school", label: "School years", icon: GraduationCap, title: "Every backpack, accounted for.", copy: "School events, activities, chores, meals, and pickups—without chasing five separate chats.", artSrc: "/illustrations/stage-school.png", chips: ["Library books", "Soccer pickup", "Lunch plan"] },
  { id: "teen", label: "Teenagers", icon: MessageCircle, title: "More independence. Less detective work.", copy: "Give teens ownership while keeping the family plan clear, kind, and out of the guesswork zone.", artSrc: "/illustrations/stage-teen.png", chips: ["Shared car", "Work shift", "Reward request"] },
  { id: "extended", label: "Extended family", icon: Users, title: "Close, even when spread out.", copy: "Care, celebrations, errands, and everyday support across generations and locations.", artSrc: "/illustrations/stage-extended.png", chips: ["Grandma’s visit", "Prescription pickup", "Family dinner"] },
];

const testimonials = [
  { quote: "We stopped asking ‘who knew about this?’ FamOS gives everyone the same version of the week.", name: "Maya", detail: "Parent of two · Toronto", avatar: "/marketing/testimonials/maya.png" },
  { quote: "The grocery list, school calendar, and chores finally feel like one system—not three extra jobs wearing a trench coat.", name: "Jordan", detail: "Co-parent · Vancouver", avatar: "/marketing/testimonials/jordan.png" },
  { quote: "Our teenager actually uses it because their plans feel like theirs, not another parent checklist in disguise.", name: "Sam", detail: "Parent of a teenager · Ottawa", avatar: "/marketing/testimonials/sam.png" },
];

const pricingAddOns = [
  { id: "fam_ai", label: "Fam AI", copy: `100 helper requests a month. Included during the ${PRICING_PLAN.trial.days}-day trial.`, price: PRICING_PLAN.addOns[0].price.monthly, icon: Bot },
];

function PricingSection({ signedIn }) {
  const [billing, setBilling] = useState("monthly");
  const [members, setMembers] = useState(PRICING_PLAN.basePlan.membersIncluded);
  const [addOns, setAddOns] = useState({ fam_ai: PRICING_PLAN.trial.famAiPretoggled });
  const extraMembers = Math.max(0, members - PRICING_PLAN.basePlan.membersIncluded);
  const base = billing === "annual" ? PRICING_PLAN.basePlan.price.yearly / 12 : PRICING_PLAN.basePlan.price.monthly;
  const monthlyBase = PRICING_PLAN.basePlan.price.monthly;
  const annualBase = PRICING_PLAN.basePlan.price.yearly;
  const memberCost = extraMembers * PRICING_PLAN.basePlan.additionalMemberPrice.monthly;
  const addOnCost = pricingAddOns.reduce((sum, item) => sum + (addOns[item.id] ? item.price : 0), 0);
  const monthlySubtotal = monthlyBase + memberCost + addOnCost;
  const monthlyTotal = base + memberCost + addOnCost;
  const annualDue = annualBase + (memberCost + addOnCost) * 12;
  const savings = monthlySubtotal * 12 - annualDue;

  return <section className="landing-pricing" id="pricing">
    <div className="landing-section-head"><p>Simple pricing</p><h2>Start small.<br/>Invite the whole crew.</h2><span>Try FamOS free for {PRICING_PLAN.trial.days} days. {PRICING_PLAN.basePlan.membersIncluded} people are included, then each extra member is {formatMoney(PRICING_PLAN.basePlan.additionalMemberPrice.monthly)}/month.</span></div>
    <div className="pricing-shell">
      <div className="pricing-main">
        <div className="pricing-toggle" role="tablist" aria-label="Billing frequency">
          <button className={billing === "monthly" ? "active" : ""} onClick={() => setBilling("monthly")} role="tab" aria-selected={billing === "monthly"}>Monthly</button>
          <button className={billing === "annual" ? "active" : ""} onClick={() => setBilling("annual")} role="tab" aria-selected={billing === "annual"}>Yearly <span>{formatMoney(annualBase)}/yr</span></button>
        </div>
        <article className="pricing-card">
          <div className="pricing-card-head">
            <span><Users/></span>
            <div><p>Family plan</p><h3>{formatMoney(monthlyTotal)}<small>/month</small></h3></div>
          </div>
          <p className="pricing-note">{billing === "annual" ? `${formatMoney(annualDue)} billed yearly after your ${PRICING_PLAN.trial.days}-day free trial.` : `Billed monthly after your ${PRICING_PLAN.trial.days}-day free trial. Card required. No surprise choreography.`}</p>
          <div className="family-size-control">
            <div><strong>People in your home</strong><small>{PRICING_PLAN.basePlan.membersIncluded} included, then {formatMoney(PRICING_PLAN.basePlan.additionalMemberPrice.monthly)}/month each</small></div>
            <div>
              <button aria-label="Remove family member" onClick={() => setMembers((value) => Math.max(PRICING_PLAN.basePlan.membersIncluded, value - 1))}><Minus/></button>
              <b>{members}</b>
              <button aria-label="Add family member" onClick={() => setMembers((value) => Math.min(20, value + 1))}><Plus/></button>
            </div>
          </div>
          <ul className="pricing-includes">
            <li><Check/> Calendar, meals, tasks, groceries, chat, finance planning, and rewards</li>
            <li><Check/> A private home base with secure family invitations</li>
            <li><Check/> Google Calendar sync, roles, and Fam AI when you want backup</li>
          </ul>
        </article>
        <div className={`pricing-addons ${pricingAddOns.length === 1 ? "single" : ""}`}>
          <p>Add-ons</p>
          {pricingAddOns.map(({ id, label, copy, price, icon: Icon }) => <button className={addOns[id] ? "selected" : ""} onClick={() => setAddOns((current) => ({ ...current, [id]: !current[id] }))} key={id}>
            <span><Icon/></span>
            <strong>{label}<small>{copy}</small></strong>
            <em>{formatMoney(price)}/mo</em>
          </button>)}
        </div>
      </div>
      <aside className="pricing-side">
        <div className="pricing-summary">
          <div><span>Base plan</span><b>{billing === "annual" ? `${formatMoney(annualBase)}/yr` : formatMoney(monthlyBase)}</b></div>
          <div><span>{extraMembers} extra member{extraMembers === 1 ? "" : "s"}</span><b>{formatMoney(memberCost)}</b></div>
          <div><span>Fam AI add-on</span><b>{formatMoney(addOnCost)}</b></div>
          {billing === "annual" && <div className="annual-savings"><span>Yearly savings</span><b>{formatMoney(savings)}</b></div>}
          <div className="pricing-total"><span>Total after trial</span><b>{formatMoney(monthlyTotal)}<small>/mo</small></b></div>
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
    5: [["$", "Groceries · $84"], ["$", "Activities · $45"], ["$", "Household · $32"]],
  }[feature];
  useGSAP(()=>{const media=gsap.matchMedia();media.add("(prefers-reduced-motion: no-preference)",()=>{const intro=gsap.timeline();intro.from(".product-screen-bar",{y:-10,autoAlpha:0,duration:.32,ease:"power2.out"}).from(".product-screen-row",{x:18,autoAlpha:0,duration:.38,stagger:.11,ease:"power2.out"},"-=.12").from(".preview-outcome",{y:8,autoAlpha:0,duration:.3},"-=.08").from(".landing-product-screen>button",{y:8,autoAlpha:0,duration:.3},"-=.12");
    if(feature===0)gsap.timeline({repeat:-1,repeatDelay:.5}).to(".product-screen-row",{backgroundColor:"#eee8ff",duration:.35,stagger:.55}).to(".product-screen-row",{backgroundColor:"#fff",duration:.35,stagger:.55},"-=.8");
    if(feature===1)gsap.timeline({repeat:-1,repeatDelay:.6}).to(".product-screen-row",{y:-3,boxShadow:"0 8px 18px rgba(92,72,31,.12)",duration:.35,stagger:.5}).to(".product-screen-row",{y:0,boxShadow:"0 0 0 rgba(0,0,0,0)",duration:.3,stagger:.5},"-=.7");
    if(feature===2)gsap.timeline({repeat:-1,repeatDelay:1}).to(".product-screen-row .row-check",{scale:1,autoAlpha:1,duration:.28,stagger:.55,ease:"back.out(2)"}).to(".product-screen-row span",{opacity:.55,textDecoration:"line-through",duration:.2,stagger:.55},"<").fromTo(".preview-reward",{scale:.75,autoAlpha:0},{scale:1,autoAlpha:1,duration:.45,ease:"back.out(2)"}).to({}, {duration:.8}).set(".product-screen-row .row-check, .preview-reward",{scale:.75,autoAlpha:0}).set(".product-screen-row span",{opacity:1,textDecoration:"none"});
    if(feature===3)gsap.timeline({repeat:-1,repeatDelay:.8}).to(".product-screen-row .row-check",{scale:1,autoAlpha:1,duration:.25,stagger:.55,ease:"back.out(2)"}).to(".product-screen-row span",{opacity:.48,textDecoration:"line-through",duration:.2,stagger:.55},"<").to({}, {duration:.8}).set(".product-screen-row .row-check",{scale:.75,autoAlpha:0}).set(".product-screen-row span",{opacity:1,textDecoration:"none"});
    if(feature===4)gsap.timeline({repeat:-1,repeatDelay:.8}).fromTo(".typing-dot",{y:0,opacity:.35},{y:-4,opacity:1,duration:.3,stagger:.12,repeat:1,yoyo:true}).fromTo(".preview-reply",{x:10,autoAlpha:0},{x:0,autoAlpha:1,duration:.35,ease:"power2.out"}).to({}, {duration:1}).set(".preview-reply",{autoAlpha:0});
    if(feature===5)gsap.timeline({repeat:-1,repeatDelay:1}).fromTo(".preview-progress span",{width:"0%"},{width:"78%",duration:1.5,ease:"power2.inOut"}).fromTo(".budget-check",{scale:.6,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:"back.out(2)"}).to({}, {duration:1}).set(".preview-progress span, .budget-check",{clearProps:"all"});
    gsap.to(".landing-product-screen>button svg",{x:4,duration:.65,repeat:-1,yoyo:true,ease:"sine.inOut"});});return()=>media.revert();},{scope:preview,dependencies:[feature],revertOnUpdate:true});
  return <div ref={preview} className={`landing-product-screen feature-${feature} ${item.tone}`}><div className="product-screen-bar"><span><Icon/></span><div><small>FAMOS</small><strong>{item.title}</strong></div><i/></div><div className="product-screen-body">{rows.map(([meta,title],index)=><div className={`product-screen-row row-${index}`} key={title}><b>{meta}</b><span><strong>{title}</strong><small>{index===0?"Up next":index===1?"Shared with family":"Ready when you are"}</small></span>{[2,3].includes(feature)?<i className="row-check"><Check/></i>:<em className={index===1?"pink":""}/>}</div>)}</div>{feature===2&&<div className="preview-outcome preview-reward"><Gift/> +175 points earned</div>}{feature===4&&<div className="preview-outcome preview-typing"><span><i className="typing-dot"/><i className="typing-dot"/><i className="typing-dot"/></span><b className="preview-reply">Everyone’s in ✓</b></div>}{feature===5&&<div className="preview-outcome preview-budget"><div><span>Weekly goal</span><strong>$161 left</strong></div><div className="preview-progress"><span/></div><small className="budget-check"><Check/> On track</small></div>}<button>Open in FamOS <ArrowRight/></button></div>;
}

export default function Landing({ signedIn = false }) {
  const root = useRef(null);
  const [stage, setStage] = useState(2);
  const [feature, setFeature] = useState(0);
  const selectedStage = stages[stage];
  useGSAP(() => { const media=gsap.matchMedia(); media.add("(prefers-reduced-motion: no-preference)",()=>{gsap.from(".landing-nav",{y:-18,autoAlpha:0,duration:.55,ease:"power2.out"});gsap.from(".landing-hero-copy>*",{y:20,autoAlpha:0,duration:.55,stagger:.07,ease:"power2.out"});gsap.from(".landing-hero-media",{scale:.96,autoAlpha:0,duration:.75,ease:"power2.out"});gsap.to(".landing-float-card",{y:-9,rotation:"+=1.2",duration:2.4,stagger:.35,repeat:-1,yoyo:true,ease:"sine.inOut"});});return()=>media.revert();},{scope:root});
  return <div className="landing-page" ref={root}>
    <nav className="landing-nav">
      <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><img src="/brand/famos-icon-transparent.png" alt=""/><strong>Fam<span>OS</span></strong></button>
      <div className="landing-links"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#families">For every family</a><a href="#pricing">Pricing</a></div>
      <div className="landing-actions">{!signedIn&&<button className="landing-signin" onClick={() => go("signin")}>Sign in</button>}<button className="landing-join" onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Get started"}<ArrowRight/></button></div>
    </nav>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy"><p className="landing-kicker"><Sparkles/> Meet FamOS</p><h1>FamOS keeps<br/><span>family life together.</span></h1><p>A private home base for calendars, meals, groceries, tasks, chat, and Fam AI. Less chasing. More knowing what’s happening.</p><div className="landing-hero-ctas"><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free trial"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</div><div className="landing-trust"><span><Check/> Families run better on FamOS</span><span><Check/> Built for real family life</span></div></div>
        <div className="landing-hero-media"><img src="/marketing/family-planning-hero.png" alt="FamOS helping a family coordinate calendars, groceries, tasks, budgets, and AI planning at home"/><svg className="hero-squiggle hero-squiggle-one" viewBox="0 0 150 70" aria-hidden="true"><path d="M5 49c20-55 42 30 64-7s37-19 44 4 24 8 31-12"/></svg><svg className="hero-squiggle hero-squiggle-two" viewBox="0 0 110 62" aria-hidden="true"><path d="M4 30c15-27 28 27 43 0s27-16 33 3 17 8 25-9"/></svg><span className="hero-spark hero-spark-one" aria-hidden="true">✦</span><span className="hero-spark hero-spark-two" aria-hidden="true">✦</span><span className="landing-float-note landing-float-card"><CheckSquare/> Three things handled before breakfast</span><span className="landing-float-note landing-float-card second"><CalendarDays/><b>4:30</b> Soccer pickup</span><span className="landing-float-note landing-float-card third"><ShoppingCart/><b>6 items</b> Shared grocery list</span></div>
      </section>

      <section className="landing-purpose" id="app-purpose"><div><p>Meet FamOS</p><h2>Your family’s operating system, minus the corporate energy.</h2><span>FamOS helps households coordinate shared calendars, Google Calendar sync, meals, groceries, tasks, family chat, finance planning, and AI-assisted organization in one secure home space.</span></div><div className="purpose-grid"><article><CalendarDays/><h3>Calendars that talk</h3><p>Connect the Google Calendars your household already relies on, then see the week together.</p></article><article><Users/><h3>Everyone gets the memo</h3><p>Invite your people, share updates, and give tasks a clear owner.</p></article><article><LockKeyhole/><h3>Private by default</h3><p>Your home space belongs to your household. Disconnect access anytime.</p></article></div></section>

      <section className="landing-intro" id="families"><p>WHY FAMOS</p><h2>All the moving parts.<br/>One warm, shared place.</h2><blockquote>FamOS puts the “Fam” in family.</blockquote><div className="landing-family-pills"><span>New parents</span><span>Busy households</span><span>Co-parents</span><span>Multigenerational families</span><span>Families across cities</span></div></section>

      <section className="landing-stages"><div className="landing-section-head"><p>Built for every chapter</p><h2>Wherever your family is,<br/>FamOS fits.</h2><span>Pick a chapter. The app flexes around the real-life version.</span></div><div className="stage-tabs" role="tablist">{stages.map(({id,label,icon:Icon},index)=><button role="tab" aria-selected={stage===index} className={`${id} ${stage===index?"active":""}`} onClick={()=>setStage(index)} key={label}><Icon/>{label}</button>)}</div><div className={`stage-panel stage-${selectedStage.id}`} key={selectedStage.id}><div><p>{selectedStage.label}</p><h3>{selectedStage.title}</h3><span>{selectedStage.copy}</span><div className="stage-chips">{selectedStage.chips.map(item=><b key={item}><Check/>{item}</b>)}</div></div><img className="stage-family-art" src={selectedStage.artSrc} alt="" aria-hidden="true"/></div></section>

      <section className="landing-features" id="features"><div className="landing-section-head"><p>Everything in rhythm</p><h2>The week starts<br/>making sense.</h2><span>FamOS keeps the practical stuff visible, so fewer things live in someone’s head.</span></div><div className="landing-feature-grid">{features.map(({title,copy,icon:Icon,art,tone})=><article className={`landing-feature ${tone}`} key={title}><div className="landing-feature-top"><span><Icon/></span><img src={`/illustrations/${art}-editorial.png`} alt="" aria-hidden="true"/></div><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="landing-product"><div className="landing-section-head"><p>See it work</p><h2>Tap around.<br/>The chaos won’t mind.</h2><span>Pick a feature and see how FamOS turns loose ends into next steps.</span></div><div className="product-tabs" role="tablist">{features.map(({label,title,icon:Icon},index)=><button role="tab" aria-selected={feature===index} className={feature===index?"active":""} onClick={()=>setFeature(index)} key={title}><Icon/>{label}</button>)}</div><div className="product-stage"><div key={feature}><p>{features[feature].title}</p><h3>{features[feature].copy}</h3><ul><li><Check/> Shared across your household</li><li><Check/> Clear ownership and updates</li><li><Check/> Designed for quick mobile use</li></ul></div><ProductPreview feature={feature}/></div></section>

      <section className="landing-ai" id="how-it-works"><div className="landing-ai-art"><img src="/illustrations/famai-editorial.png" alt="Fam AI planning a family weekend"/><svg className="ai-squiggle" viewBox="0 0 130 60" aria-hidden="true"><path d="M4 42c18-47 34 23 53-7s31-13 38 5 18 5 30-17"/></svg><span className="ai-bubble one">Add soccer practice Friday at 5</span><span className="ai-bubble two">Ready for your review ✓</span></div><div><p className="landing-kicker"><Bot/> Meet Fam AI</p><h2>Ask naturally.<br/>Approve calmly.</h2><p>Turn everyday messages into tasks, calendar events, grocery items, and meal plans. Fam AI drafts the moves; you stay in charge.</p><ul><li><Check/> Actionable, not just chatty</li><li><Check/> Your family keeps the final say</li><li><Check/> Smart because it knows the household context</li></ul></div></section>

      <section className="landing-steps"><div className="landing-section-head"><p>Start together</p><h2>From new account<br/>to “we’ve got this.”</h2></div><div className="landing-step-grid"><article><b>1</b><h3>Name your home</h3><p>Create the private space your household will share.</p></article><article><b>2</b><h3>Invite your people</h3><p>Send secure invites now, or skip and do it later. We’re not bossy.</p></article><article><b>3</b><h3>Make it yours</h3><p>Connect calendars, choose roles, and start planning together.</p></article></div></section>

      <section className="landing-testimonials"><div className="landing-section-head"><p>From the kitchen table</p><h2>Made for families<br/>with a lot going on.</h2><span>Illustrative feedback showing the kind of relief FamOS is built to create.</span></div><div>{testimonials.map((item)=><article key={item.name}><span>{"★★★★★"}</span><blockquote>“{item.quote}”</blockquote><footer><img src={item.avatar} alt="" aria-hidden="true"/><span><b>{item.name}</b><small>{item.detail}</small></span></footer></article>)}</div><small className="testimonial-note">Sample testimonials and AI-generated portraits for design demonstration.</small></section>

      <section className="landing-community"><div className="community-avatars" aria-hidden="true"><img src="/marketing/testimonials/maya.png" alt=""/><img src="/marketing/testimonials/jordan.png" alt=""/><img src="/marketing/testimonials/sam.png" alt=""/></div><p>One household. One shared rhythm.</p><h2>Built for every family<br/>with a lot to coordinate.</h2><span>From the first appointment to school runs, teen schedules, and care across generations—FamOS keeps the people who matter on the same page.</span><button onClick={()=>go(signedIn?"today":"signup")}>{signedIn?"Open your family space":"Bring your family together"}<ArrowRight/></button><div className="community-facts"><article><b>Shared Household</b><small>One private space for everyone.</small></article><article><b>Meal Planning</b><small>Plan dinners without the group chat.</small></article><article><b>Sync Multiple Calendars</b><small>Bring the week into one view.</small></article><article><b>Assign Chores & Rewards</b><small>Give tasks clear owners.</small></article><article><b>Get Help with Fam AI</b><small>Turn requests into plans.</small></article></div></section>

      <section className="landing-bento"><article className="bento-dashboard"><div className="bento-copy"><p>One place for the week</p><h2>The family<br/>home base.</h2><span>Schedules, tasks, groceries, meals, and updates stay visible without another group-text scavenger hunt.</span><button onClick={()=>setFeature(0)}>Explore the shared calendar <ArrowRight/></button></div><div className="bento-ui"><ProductPreview feature={0}/><span className="bento-float bento-task"><CheckSquare/> School bags packed</span><span className="bento-float bento-meal"><ChefHat/> Taco night · 6:30</span></div></article><article className="bento-ai"><div className="bento-copy"><p>Fam AI</p><h2>Ask naturally.<br/>Approve calmly.</h2><span>Turn a natural request into organized actions while your family stays in control of every change.</span><button onClick={()=>go(signedIn?"famai":"signup")}>{signedIn?"Open Fam AI":"Meet your family assistant"}<ArrowRight/></button></div><div className="bento-ai-demo"><span className="ai-demo-user">Plan three easy dinners and add the groceries.</span><div><i><Bot/></i><p>I prepared a meal plan and 12 grocery items.</p></div><ul><li><ChefHat/> 3 dinners ready</li><li><ShoppingCart/> 12 items to review</li><li><Check/> Nothing changes until you approve</li></ul></div></article></section>

      <PricingSection signedIn={signedIn} />

      <section className="landing-privacy"><div><LockKeyhole/><p>Private by design</p></div><h2>Family life is personal.<br/>FamOS treats it that way.</h2><p>Your household has its own protected space. FamOS asks before AI actions are applied and keeps family coordination visible to the people you invite.</p></section>

      <section className="landing-final"><img src="/illustrations/famos-family-planning.png" alt="A family planning together"/><div><p>Your family, in sync.</p><h2>Families run better<br/>on FamOS.</h2><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start your family space"}<ArrowRight/></button></div></section>
    </main>

    <footer className="landing-footer"><div className="landing-brand"><img src="/brand/famos-icon-transparent.png" alt=""/><strong>Fam<span>OS</span></strong></div><p>For whatever your family looks like today—and tomorrow.</p><div>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}<a href="#pricing">Pricing</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Sign up"}</button></div><small>© 2026 FamOS. All rights reserved.<br/>Developed by the team at Astronaut Digital · Part of Astronaut Ventures</small></footer>
  </div>;
}
