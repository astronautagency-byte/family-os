import HouseholdOffers from '../components/HouseholdOffers';
import MarketingProductPreview from '../components/MarketingProductPreview';
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimate, useInView, useScroll, useSpring, useTransform, useReducedMotion, MotionConfig, stagger } from "framer-motion";
import { ArrowRight, Baby, BellRing, Bot, CalendarDays, Check, CheckSquare, ChefHat, FileInput, Gift, GraduationCap, Heart, LoaderCircle, LockKeyhole, MapPin, MessageCircle, Palette, Refrigerator, ShieldCheck, ShoppingCart, Smartphone, Sparkles, Users } from "../components/icons";
import "../landing.css";
import "../landing-theme.css";
import "../theme/marketing-refresh.css";
import FamilyIllustration from "../components/FamilyIllustration";
import "../feature.css";
import MarketingNav from "../components/MarketingNav";
import MarketingFooter from "../components/MarketingFooter";
import { supabase } from "../lib/supabase";
import { IS_MAC_APP_STORE } from "../lib/distribution";

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
  { label: "Meals", title: "Dinner, figured out.", previewHeadline: "A meal plan everyone can see.", copy: "Plan the week's meals in minutes. Follow any recipe hands-free with Cook Mode. Add missing ingredients to the grocery list without leaving the kitchen.", icon: ChefHat, art: "meals", tone: "yellow" },
  { label: "Fam AI", title: "Your family's quiet genius.", previewHeadline: "Ask for help with your family’s plans.", copy: "Ask for meal ideas, grocery lists, or help planning the week. Fam AI can use household context to help you plan.", icon: Bot, art: "famai", tone: "peach" },
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
  { title: "Conversations near your plans", copy: "Keep household messages close to the calendar and tasks.", icon: MessageCircle, tone: "yellow" },
  { title: "Fam AI, review first", copy: "Meal ideas, grocery lists, calendar summaries — always behind your confirmation.", icon: Bot, tone: "mint" },
];

const APP_ORIGIN = "https://home.fam-os.app";

const go = (route) => {
  const authPaths = { signin: "/sign-in", signup: "/sign-up" };
  if (authPaths[route]) {
    window.location.assign(`${APP_ORIGIN}${authPaths[route]}`);
    return;
  }
  const cleanPaths = { landing: "/", pricing: "/pricing", privacy: "/privacy", terms: "/terms" };
  if (cleanPaths[route]) {
    window.history.pushState(null, "", cleanPaths[route]);
    window.dispatchEvent(new Event("popstate"));
    return;
  }
  window.history.pushState({ tab: route }, "", route === "today" ? "/" : `/${route}`);
  window.dispatchEvent(new Event("popstate"));
};

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
  { label: "Billing", famos: "Free Core; optional AI coming soon", display: "Offers and trials vary", organizer: "Free tiers or trials vary" },
];

function PricingSection() {
  return <section className="landing-pricing" id="pricing">
    <SectionHead eyebrow="Household pricing">Start free.<br/>Add what helps.</SectionHead>
    <HouseholdOffers/>
    <a className="landing-primary-btn" href={`${APP_ORIGIN}/sign-up`}>Start with Free Core</a>
  </section>;
}

function ProductPreview({ feature }) {
  const page = {0:'calendar',1:'meals',3:'tasks'}[feature] || 'calendar';
  return <MarketingProductPreview kind={page}/>;
}
function LifestylePhoto({ name, alt, eager = false }) {
  return <img src={`/marketing/lifestyle/${name}-960.webp`} srcSet={`/marketing/lifestyle/${name}-640.webp 640w, /marketing/lifestyle/${name}-960.webp 960w, /marketing/lifestyle/${name}-1536.webp 1536w`} sizes="(max-width: 700px) 100vw, 55vw" alt={alt} width="1536" height="1024" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async"/>;
}

export default function Landing({ signedIn = false }) {

  const [feature, setFeature] = useState(0);
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

  // Persistent mobile CTA appears once the hero has scrolled out of view.
  const heroInView = useInView(heroRef, { amount: 0.25 });

  // Keep the hero UI alive without letting the cards collide: each card gets
  // its own gentle vertical drift and a tiny tilt, while MotionConfig respects
  // the user's reduced-motion preference.

  return <MotionConfig reducedMotion="user"><div className="landing-page">
    <motion.div className="landing-scroll-progress" style={{ scaleX: progressScaleX }} aria-hidden="true" />
    <MarketingNav signedIn={signedIn} />

    <main>
      <section className="landing-hero landing-hero-editorial" ref={heroRef}>
        <motion.div className="landing-hero-copy" variants={staggerParent} initial="hidden" animate="show">
          <motion.h1 variants={fadeUp}>Your family,<br/>finally in sync.</motion.h1>
          <motion.p variants={fadeUp}>A little less organizing. A little more living. Keep your calendar, meals and everyday to-dos together in one private family space.</motion.p>
          <motion.div className="landing-hero-ctas" variants={fadeUp}><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</motion.div>
          <motion.div className="landing-trust" variants={fadeUp}><span><Check/> Private to your household</span><span><Check/> No card needed to start</span></motion.div>
        </motion.div>
        <div className="hero-real-life"><LifestylePhoto name="family" alt="A family planning their day together at the kitchen island" eager/><div className="hero-product-inset"><ProductPreview feature={0}/></div></div>
      </section>

      <motion.section className="landing-purpose" id="app-purpose" {...revealBlock}><div><p>Meet FamOS</p><h2>Made for the way your family actually works.</h2><span>One calm, private place for the everyday stuff — schedules, meals, lists, and the little reminders that keep a household running. No learning curve. No complexity. Just clarity.</span><div className="purpose-actions"><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free"}<ArrowRight/></button>{!signedIn&&<button onClick={() => go("signin")}>Sign in</button>}</div></div><div className="purpose-grid"><motion.article {...hoverLift}><CalendarDays/><h3>Shared calendars</h3><p>Bring in the calendars you already use and see the week together — no more “what’s happening when?”</p></motion.article><motion.article {...hoverLift}><Users/><h3>Family updates</h3><p>Share plans, chat, and give every task a clear owner, so nobody’s left guessing.</p></motion.article><motion.article {...hoverLift}><LockKeyhole/><h3>Private home</h3><p>Your household decides who sees what. Your space stays yours.</p></motion.article></div></motion.section>


      <section className="landing-film" aria-labelledby="landing-film-title"><div className="landing-film-copy"><h2 id="landing-film-title">A little more in sync.</h2><p>See how FamOS brings the everyday pieces of family life together.</p></div><video className="landing-film-player" controls playsInline preload="none" poster="/marketing/video/famos-family-poster.jpg" aria-label="FamOS family organizer video"><source src="/marketing/video/famos-family.webm" type="video/webm"/><source src="/marketing/video/famos-family.mp4" type="video/mp4"/>Your browser can’t play this video. <a href="/marketing/video/famos-family.mp4">Download the video</a>.</video></section>

      <section className="landing-life-story" id="families"><div><h2>Less “what’s for dinner?”<br/>More time together.</h2><p>Save a recipe, plan a meal, and let everyone see what’s cooking. The everyday details stay in FamOS, so you can get back to family life.</p><a href="/features/meals">Explore meal planning <ArrowRight/></a></div><LifestylePhoto name="cooking" alt="A parent and child preparing dinner together"/></section>

      <section className="landing-features" id="features"><SectionHead eyebrow="Everything in sync" note="FamOS keeps schedules, meals, lists, and tasks easy to find.">Plan the week<br/>with less back-and-forth.</SectionHead><motion.div className="landing-feature-grid" {...revealGroup}>{features.map(({title,copy,icon:Icon,art,tone})=><motion.article className={`landing-feature ${tone}`} key={title} variants={fadeUp} {...hoverLift}><div className="landing-feature-top"><span><Icon/></span><FamilyIllustration variant={art === "shopping" ? "groceries" : art}/></div><h3>{title}</h3><p>{copy}</p></motion.article>)}</motion.div></section>


      <section className="landing-location-feature"><div className="landing-location-icon"><MapPin size={25}/></div><div><span className="feature-new-badge">New</span><h2>A little closer, wherever you are.</h2><p>Choose when to share your location, or send your household an “I’m okay” check-in.</p><a href="/features/location">Explore Family location <ArrowRight size={17}/></a></div></section>
      <section className="landing-product"><SectionHead eyebrow="See it work" note="Choose a feature to preview the flow.">See how<br/>FamOS works.</SectionHead><div className="product-tabs" role="tablist">{features.map(({label,title,icon:Icon},index)=>[0,1,3].includes(index) && <button role="tab" aria-selected={feature===index} className={feature===index?"active":""} onClick={()=>setFeature(index)} key={title}><Icon/>{label}</button>)}</div><motion.div className="product-stage" {...revealBlock}><motion.div key={`stage-copy-${feature}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: EASE }}><p>{features[feature].title}</p><h3>{features[feature].previewHeadline}</h3><span className="product-stage-copy">{features[feature].copy}</span><ul><li><Check/> Shared across your household</li><li><Check/> Context-aware next steps</li><li><Check/> Choose the tools your family needs</li></ul></motion.div><ProductPreview key={`preview-${feature}`} feature={feature}/></motion.div></section>

      <section className="landing-ai landing-ai-clean" id="how-it-works">
        <figure className="landing-ai-preview" aria-label="Example Fam AI meal planning conversation">
          <header><Sparkles aria-hidden="true"/><strong>Fam AI</strong><span>Example conversation</span></header>
          <p className="landing-ai-prompt">Help me plan three easy dinners this week.</p>
          <div className="landing-ai-draft">
            <p>Here’s a starting point for your week.</p>
            <dl><div><dt>Monday</dt><dd>Sheet-pan chicken & vegetables</dd></div><div><dt>Tuesday</dt><dd>Tomato & basil pasta</dd></div><div><dt>Wednesday</dt><dd>Black bean tacos</dd></div></dl>
            <p className="landing-ai-review"><Check aria-hidden="true"/> Review before adding to your plan</p>
          </div>
          <figcaption>An example of a suggested plan. You decide what gets added.</figcaption>
        </figure><div><h2>Plan faster.<br/>Review first.</h2><p>Ask in plain words. Get meal ideas, grocery lists, or help planning the week. Fam AI understands your household — and helps you put useful ideas into action.</p><motion.ul {...revealGroup}><motion.li variants={fadeUpSmall}><Check/> Understands meals, groceries, tasks, and schedules</motion.li><motion.li variants={fadeUpSmall}><Check/> Suggests helpful next steps from your household</motion.li><motion.li variants={fadeUpSmall}><Check/> Check details before relying on a suggestion</motion.li></motion.ul><motion.button className="landing-ai-cta" onClick={() => go(signedIn ? "famai" : "signup")} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}>{signedIn ? "Open Fam AI" : "Try Fam AI free"}<ArrowRight/></motion.button></div></section>

      <section className="landing-steps"><SectionHead eyebrow="Start together">From new account<br/>to “we’ve got this.”</SectionHead><motion.div className="landing-step-grid" {...revealGroup}><motion.article variants={fadeUp} {...hoverLift}><b>1</b><h3>Name your home</h3><p>Thirty seconds. That's all it takes.</p></motion.article><motion.article variants={fadeUp} {...hoverLift}><b>2</b><h3>Invite your people</h3><p>Send secure invites now, or skip and do it later. We’re not bossy.</p></motion.article><motion.article variants={fadeUp} {...hoverLift}><b>3</b><h3>Make it yours</h3><p>Connect calendars. Choose colours. Start planning. It feels right from the first tap.</p></motion.article></motion.div></section>

      <section className="landing-life-story landing-voice-feature"><div><span className="feature-new-badge">New</span><h2>Say it now.<br/>Make a plan.</h2><p>Ask FamOS to add an event, task, shopping item or meal. Check the details and confirm before it’s saved.</p><a href="/features/voice">Explore voice assistant <ArrowRight/></a></div><div className="landing-voice-preview"><MarketingProductPreview kind="voice"/></div></section>
      <section className="landing-testimonials"><SectionHead eyebrow="Made for real family life" note="See how FamOS fits the situations families coordinate every day.">One home base.<br/>Many kinds of family.</SectionHead><motion.div {...revealGroup}>{familyScenarios.map((item)=><motion.article key={item.title} variants={fadeUp}><span><Check/> {item.label}</span><h3>{item.title}</h3><p>{item.copy}</p><footer><img src={item.avatar.replace(".png", "-160.webp")} width="60" height="60" loading="lazy" decoding="async" alt="" aria-hidden="true"/><b>Built around shared family life</b></footer></motion.article>)}</motion.div></section>

      <motion.section className="landing-comparison" id="compare" {...revealBlock}><SectionHead eyebrow="Why FamOS" note="Use FamOS across the screens you already have, then add people and features as your household grows.">Your family hub,<br/>without another device.</SectionHead><motion.div className="comparison-shell" {...revealGroup}><div className="comparison-head"><span>What matters</span><strong>FamOS</strong><span>Dedicated displays</span><span>Organizer apps</span></div>{comparisonRows.map((row)=><motion.div className="comparison-row" key={row.label} variants={fadeUpSmall}><b>{row.label}</b><strong><Check/>{row.famos}</strong><span>{row.display}</span><span>{row.organizer}</span></motion.div>)}</motion.div><div className="comparison-highlights"><article><Sparkles/><h3>AI that actually knows your family</h3><p>Not a generic chatbot. Fam AI understands your meals, groceries, tasks, and schedule — and helps you plan the next step.</p></article><article><Users/><h3>Built to share</h3><p>Invite family from anywhere. Assign clear owners. The same household view on every device — phone, tablet, laptop.</p></article><article><CheckSquare/><h3>Start free. Grow when you're ready.</h3><p>Calendar, tasks, shopping, chat, and kitchen watch — free forever. Add sync, recipes, and AI when your family wants more.</p></article></div><motion.div className="comparison-cta" {...revealBlock}><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free"}<ArrowRight/></button><small><ShieldCheck/> Paid plans are charged immediately · cancel future renewals anytime</small></motion.div>      <a className="mp-primary" href="/compare">Compare FamOS with Skylight, Cozi and FamilyWall <ArrowRight size={18}/></a><small className="comparison-note">Category comparison based on publicly available product information for dedicated displays such as Skylight Calendar and organizer apps such as Cozi and FamilyWall, reviewed July 2026. Features and offers can change.</small>
      <motion.div className="comparison-cta" {...revealBlock}><a href="/features">Browse every feature <ArrowRight/></a><small>One dedicated page per module with screenshots, use-cases, and what to try first.</small></motion.div></motion.section>



      {!IS_MAC_APP_STORE && <PricingSection signedIn={signedIn} />}

      <motion.section className="landing-privacy" {...revealBlock}><div><LockKeyhole/><p>Private by design</p></div><motion.h2 {...revealHeading}>Family life is personal.<br/>FamOS treats it that way.</motion.h2><p>Your household has its own protected space. FamOS asks before AI actions are applied and keeps family coordination visible to the people you invite.</p></motion.section>

      <motion.section className="landing-final" {...revealBlock}><div><p>Family life, in sync.</p><motion.h2 {...revealHeading}>The calm your family<br/>deserves.</motion.h2><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start your family space"}<ArrowRight/></button></div></motion.section>
    </main>

    <MarketingFooter signedIn={signedIn} />

    <AnimatePresence>{!heroInView && <motion.div className="landing-sticky-cta" initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ duration: 0.32, ease: EASE }}><div><strong>{signedIn ? "Your family space is ready" : "A calmer day starts here"}</strong><small>{signedIn ? "Pick up where you left off" : "Start free · no card needed"}</small></div><button onClick={() => go(signedIn ? "today" : "signup")}>{signedIn ? "Open FamOS" : "Start free"}<ArrowRight/></button></motion.div>}</AnimatePresence>
  </div></MotionConfig>;
}
