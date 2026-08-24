import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { FEATURES, FEATURE_BY_ID, FEATURE_HERO, MARKETING_FEATURES, SITE_WIDE_FEATURES } from "../data/featureData";
import MarketingNav from "../components/MarketingNav";
import MarketingFooter from "../components/MarketingFooter";
import "../feature.css";

/* ── helpers ─────────────────────────────────────────────────────────── */

// MarketingNav lives in src/components/MarketingNav.jsx and is shared by
// the home page and every /features/* page — one canonical nav so the
// public marketing surface reads as one product.

/* ── CSS Phone Screen Mockups ─────────────────────────────────────────── */

const PhoneScreen = ({ featureId }) => {
  const screens = {
    today: (
      <>
        <div className="phs-kicker">EVENING · 7:42 PM</div>
        <div className="phs-hero-text">Good evening, Alex</div>
        <div className="phs-row phs-row-accent"><span className="phs-dot" style={{ background: '#7c3aed' }} /><div><strong>6:30</strong> Pasta night</div><span className="phs-badge">35 min</span></div>
        <div className="phs-row"><span className="phs-dot" style={{ background: '#059669' }} /><div><strong>4:30</strong> Soccer pickup</div><span className="phs-badge">Up next</span></div>
        <div className="phs-row"><span className="phs-dot" style={{ background: '#dc2626' }} /><div><strong>7:00</strong> Family dinner</div><span className="phs-badge">Home</span></div>
        <div className="phs-divider" />
        <div className="phs-section-title">Kitchen Watch</div>
        <div className="phs-chip-row"><span className="phs-chip phs-chip-warn">Blueberries</span><span className="phs-chip phs-chip-warn">Milk</span><span className="phs-chip">Eggs</span></div>
      </>
    ),
    calendar: (
      <>
        <div className="phs-kicker">MAY · WEEK 21</div>
        <div className="phs-hero-text">This week</div>
        <div className="phs-day-strip"><span>S</span><span>M</span><span>T</span><span className="phs-day-active">W</span><span>T</span><span>F</span><span>S</span></div>
        <div className="phs-divider" />
        <div className="phs-row"><span className="phs-dot" style={{ background: '#3b82f6' }} /><div><strong>Soccer practice</strong><span className="phs-sub">5:30 PM · Riverside</span></div></div>
        <div className="phs-row"><span className="phs-dot" style={{ background: '#8b5cf6' }} /><div><strong>Piano lesson</strong><span className="phs-sub">4:00 PM · Studio</span></div></div>
        <div className="phs-row"><span className="phs-dot" style={{ background: '#f97316' }} /><div><strong>Family dinner</strong><span className="phs-sub">7:00 PM · Home</span></div></div>
      </>
    ),
    meals: (
      <>
        <div className="phs-kicker">DINNER PLAN</div>
        <div className="phs-hero-text">Monday</div>
        <div className="phs-meal-card"><span className="phs-meal-emoji">🍝</span><div><strong>Sheet-pan fajitas</strong><span className="phs-sub">35 min · 8 ingredients</span></div></div>
        <div className="phs-meal-card"><span className="phs-meal-emoji">🌮</span><div><strong>Taco bowls</strong><span className="phs-sub">25 min · 6 ingredients</span></div></div>
        <div className="phs-meal-card"><span className="phs-meal-emoji">🐟</span><div><strong>Baked salmon</strong><span className="phs-sub">30 min · 7 ingredients</span></div></div>
        <div className="phs-cta-pill">Cook Mode →</div>
      </>
    ),
    shopping: (
      <>
        <div className="phs-kicker">11 ITEMS · 3 CATEGORIES</div>
        <div className="phs-hero-text">Shopping list</div>
        <div className="phs-list-item"><span className="phs-check" />Avocados<span className="phs-tag">Produce</span></div>
        <div className="phs-list-item"><span className="phs-check" />Shredded cheddar<span className="phs-tag">Dairy</span></div>
        <div className="phs-list-item"><span className="phs-check" />Tortillas<span className="phs-tag">Pantry</span></div>
        <div className="phs-list-item"><span className="phs-check" />Tomatoes<span className="phs-tag">Produce</span></div>
        <div className="phs-divider" />
        <div className="phs-section-title">Kitchen Inventory</div>
        <div className="phs-chip-row"><span className="phs-chip">Fridge</span><span className="phs-chip">Freezer</span><span className="phs-chip">Pantry</span></div>
      </>
    ),
    tasks: (
      <>
        <div className="phs-kicker">4 OPEN · 1 DONE</div>
        <div className="phs-hero-text">Today's tasks</div>
        <div className="phs-task-item"><span className="phs-task-check" />Feed the dog<span className="phs-avatar-sm" style={{ background: '#059669' }}>L</span></div>
        <div className="phs-task-item"><span className="phs-task-check" />Pack soccer bag<span className="phs-avatar-sm" style={{ background: '#3b82f6' }}>M</span></div>
        <div className="phs-task-item"><span className="phs-task-check" />Pay tuition<span className="phs-avatar-sm" style={{ background: '#f97316' }}>A</span></div>
        <div className="phs-divider" />
        <div className="phs-streak"><span>🔥</span> 6-day streak · Lou</div>
      </>
    ),
    chat: (
      <>
        <div className="phs-chat-msg phs-chat-user">Running 10 min late</div>
        <div className="phs-chat-msg phs-chat-ai"><span className="phs-chat-avatar">🤖</span>Got it! Updated the family board.</div>
        <div className="phs-chat-msg phs-chat-user">Can you grab milk?</div>
        <div className="phs-chat-msg phs-chat-ai"><span className="phs-chat-avatar">🤖</span>Added to the grocery list ✓</div>
        <div className="phs-divider" />
        <div className="phs-section-title">Smart shortcuts</div>
        <div className="phs-chip-row"><span className="phs-chip">Add to list</span><span className="phs-chip">Create task</span></div>
      </>
    ),
    'fam-ai': (
      <>
        <div className="phs-kicker">FAM AI</div>
        <div className="phs-hero-text">What can I help with?</div>
        <div className="phs-chat-msg phs-chat-user">What's for dinner tonight?</div>
        <div className="phs-chat-msg phs-chat-ai"><span className="phs-chat-avatar">✨</span>I found 3 dinner ideas using what you have. Here's one: Sheet-pan fajitas — 35 min, 8 ingredients.</div>
        <div className="phs-cta-pill">Review recipes →</div>
      </>
    ),
    family: (
      <>
        <div className="phs-kicker">HOUSEHOLD</div>
        <div className="phs-hero-text">Settings</div>
        <div className="phs-member-row"><span className="phs-avatar-sm" style={{ background: '#7c3aed' }}>A</span><div><strong>Alex</strong><span className="phs-sub">Owner</span></div></div>
        <div className="phs-member-row"><span className="phs-avatar-sm" style={{ background: '#ec4899' }}>M</span><div><strong>Mia</strong><span className="phs-sub">Co-owner</span></div></div>
        <div className="phs-member-row"><span className="phs-avatar-sm" style={{ background: '#059669' }}>L</span><div><strong>Lou</strong><span className="phs-sub">Member</span></div></div>
        <div className="phs-divider" />
        <div className="phs-section-title">Appearance</div>
        <div className="phs-chip-row"><span className="phs-chip phs-chip-active">Plum</span><span className="phs-chip">Sage</span><span className="phs-chip">Ocean</span></div>
      </>
    ),
  };
  return screens[featureId] || screens.today;
};

/* ── Feature hero (left copy + right mock-panel) ─────────────────────── */

/* Feature hero — Comer AI layout: pastel gradient stage, headline + lede
 * + CTAs + benefit pills on the left, framed phone with an actual
 * FamOS screenshot (when available) on the right, with three floating
 * product cards around the device. Falls back to <FeatureMockPanel> for
 * modules that don't have a dedicated screenshot yet. */
const FeatureHero = ({ feature }) => {
  const hero = FEATURE_HERO[feature.id] || {};
  return (
    <header className="features-module-hero">
      <div className="features-module-hero-grid">
        <div className="features-module-hero-copy">
          <nav className="features-breadcrumb" aria-label="Breadcrumb">
            <a href="/features">All features</a>
            <span className="features-breadcrumb-sep" aria-hidden="true"><ChevronRight size={12} /></span>
            <span style={{ color: "#17171f" }} aria-current="page">{feature.name}</span>
          </nav>
          <p>{feature.eyebrow}</p>
          <h1>{feature.title}</h1>
          <span className="lede">{feature.lede}</span>
          <div className="features-module-hero-actions">
            <a href="https://home.fam-os.app/sign-up">Try it free <ArrowRight size={14} /></a>
            <a href="/features">See all features <ArrowUpRight size={14} /></a>
          </div>
          {hero.pills?.length > 0 && (
            <div className="feature-hero-pills">
              {hero.pills.map((pill) => <b key={pill}>{pill}</b>)}
            </div>
          )}
        </div>
        <FeatureHeroStage feature={feature} hero={hero} />
      </div>
    </header>
  );
};

const FeatureHeroStage = ({ feature, hero }) => {
  const screenshot = hero.screenshot;
  const cards = hero.cards || [];
  return (
    <div className={`feature-hero-stage feature-hero-stage-${feature.id}`} data-tone={feature.tone}>
      <div className="feature-hero-phone" data-tone={feature.tone}>
        {screenshot ? (
          <img
            className="feature-hero-phone-screen"
            src={screenshot.src}
            alt={screenshot.alt}
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="feature-hero-phone-css">
            <div className="feature-hero-phone-header">
              <span className="feature-hero-phone-notch" />
            </div>
            <div className="feature-hero-phone-content">
              <PhoneScreen featureId={feature.id} />
            </div>
          </div>
        )}
      </div>
      {cards.length > 0 && cards.map((card, idx) => (
        <div
          key={`${card.title}-${idx}`}
          className={`feature-hero-card feature-hero-card-${idx + 1}`}
          data-accent={card.accent}
          aria-hidden="true"
        >
          <span className="feature-hero-card-glyph">{card.emoji}</span>
          <div>
            <strong>{card.title}</strong>
            <small>{card.subtitle}</small>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Bullets section ─────────────────────────────────────────────────── */

const FeatureBullets = ({ feature }) => (
  <section className="features-bullets" aria-label="Feature highlights">
    <div className="features-bullets-head">
      <p>WHY YOU'LL USE IT DAILY</p>
      <h2>Designed for how real families run.</h2>
      <p className="lede">Every detail built for real Monday-to-Sunday family life — not a feature checklist.</p>
    </div>
    <div className="features-bullets-grid">
      {feature.bullets.map((bullet) => {
        const Icon = bullet.icon;
        return (
          <article className="features-bullet" key={bullet.title}>
            <span><Icon size={22} /></span>
            <h3>{bullet.title}</h3>
            <p>{bullet.copy}</p>
          </article>
        );
      })}
    </div>
  </section>
);

/* ── Spotlight (per-feature pro tips) ────────────────────────────────── */

const FeatureSpotlight = ({ feature }) => {
  if (!feature.tips?.length) return null;
  return (
    <section className={`features-spotlight${feature.tone ? ` features-spotlight-${feature.tone}` : ""}`} aria-label={`${feature.name} pro tips`}>
      <div className="features-spotlight-inner">
        <div className="features-spotlight-head">
          <p>PRO TIPS</p>
          <h2>Getting more from {feature.name}.</h2>
          <p className="lede">Three things worth knowing about {feature.name} before your first week is up.</p>
        </div>
        <div className="features-spotlight-grid">
          {feature.tips.map((tip, idx) => (
            <article className="features-spotlight-tip" key={tip.headline}>
              <span className="features-spotlight-num">{String(idx + 1).padStart(2, "0")}</span>
              <h3>{tip.headline}</h3>
              <p>{tip.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ── Site-wide proofs (shown on every module page) ───────────────────── */

const SiteWideProofs = () => (
  <section className="features-sitewide" aria-label="Site-wide features">
    <div className="features-sitewide-inner">
      {SITE_WIDE_FEATURES.map(({ icon: Icon, label }) => (
        <article key={label}>
          <span><Icon size={20} /></span>
          <span>
            <strong>{label}</strong>
            <small>Works across every module, no per-feature setup.</small>
          </span>
        </article>
      ))}
    </div>
  </section>
);

/* ── Cross-link to other features ───────────────────────────────────── */

const ModuleNav = ({ currentId }) => {
  // Only link to the six modules highlighted on the marketing surface;
  // the deep-link catalog entries that aren't surfaced (today, rewards,
  // family) are skipped here so a /features/meals page never suggests
  // a /features/today tour that isn't part of the public surface.
  const others = MARKETING_FEATURES.filter((f) => f.id !== currentId);
  return (
    <section className="features-modulenav" aria-label="Explore other features">
      <div className="features-modulenav-inner">
        <h3>Explore more of FamOS</h3>
        <div className="features-modulenav-grid">
          {others.map((feature) => {
            const Icon = feature.icon;
            return (
              <a key={feature.id} href={`/features/${feature.id}`}>
                <span><Icon size={15} /></span>
                {feature.name}
                <ChevronRight className="arrow" size={13} />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ── Final CTA strip ─────────────────────────────────────────────────── */

/* On the /features index this still renders the generic cross-feature
 * pitch. On a per-module page it accepts the feature so the headline +
 * copy name that specific module — e.g. "Try FamOS Calendar free for 30
 * days — multiple Google Calendars, two-way Google sync..." instead of
 * the across-the-board "Every module unlocked." */
const FinalCta = ({ feature = null }) => {
  const headline = feature?.ctaHeadline || "One month free. Every module unlocked.";
  const copy = feature?.ctaCopy || "Start a 30-day Pro trial with every FamOS feature unlocked. A card is required for the trial, and you can cancel before it ends.";
  return (
    <section className="features-final">
      <div className="features-final-inner">
        <h2>{headline}</h2>
        <p>{copy}</p>
        <div className="features-final-actions">
          <a href="https://home.fam-os.app/sign-up">Start free trial <ArrowRight size={14} /></a>
          <a href="/">See pricing</a>
        </div>
      </div>
    </section>
  );
};

/* ── Single Feature page (/features/<id>) ────────────────────────────── */

const FeaturePage = ({ id }) => {
  const feature = FEATURE_BY_ID(id);
  if (!feature) {
    return <NotFoundFeature />;
  }
  return (
    <main className="features-page">
      <MarketingNav currentId={id} />
      <FeatureHero feature={feature} />
      <FeatureBullets feature={feature} />
      <FeatureSpotlight feature={feature} />
      <FinalCta feature={feature} />
      <MarketingFooter />
    </main>
  );
};

const NotFoundFeature = () => (
  <main className="features-page">
    <MarketingNav />
    <Feedback
      eyebrow="404"
      title="That feature doesn't exist — yet."
      lede="We build what families ask for. So the catalogue keeps moving."
    />
    <FinalCta />
    <MarketingFooter />
  </main>
);

const Feedback = ({ eyebrow, title, lede }) => (
  <section style={{ padding: "120px 28px 80px", textAlign: "center" }}>
    <div style={{ maxWidth: 660, margin: "auto" }}>
      <p style={{ color: "#7952e8", fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 14 }}>{eyebrow}</p>
      <h1 style={{ font: `760 clamp(34px, 4.4vw, 56px)/1.04 var(--font-display)`, letterSpacing: "-.035em", marginBottom: 16, color: "#17171f" }}>{title}</h1>
      <p style={{ color: "#5a5260", fontSize: 16, lineHeight: 1.55, marginBottom: 24 }}>{lede}</p>
      <div className="features-final-actions" style={{ justifyContent: "center" }}>
        <a href="/features">Browse all features</a>
        <a href="/">Back to home</a>
      </div>
    </div>
  </section>
);

/* ── /features index page ────────────────────────────────────────────── */

const FeaturesIndex = () => {
  // Hash-anchor deep links from Landing's "src/pages/Landing.jsx" still
  // resolve here so users landing on /features#meals jump to the right
  // card.
  useEffect(() => {
    const { hash } = window.location;
    if (hash?.length > 1) {
      const target = document.querySelector(hash);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    }
  }, []);

  return (
    <main className="features-page">
      <MarketingNav />

      <section className="features-index-hero">
        <div className="features-index-hero-grid">
          <div className="features-index-hero-copy">
            <p>FEATURES TOUR</p>
            <h1>Six modules. One page each.</h1>
            <p className="lede">
              Calendars, meals, tasks, shopping, chat, and Fam AI. Tap a module to see what it feels like at home.
            </p>
            <div className="features-index-hero-actions">
              <a href="https://home.fam-os.app/sign-up">Try FamOS free for 30 days <ArrowRight size={14} /></a>
              <a href="/">See pricing</a>
            </div>
          </div>
          <FeatureHeroStage feature={FEATURE_BY_ID("calendar")} hero={FEATURE_HERO.calendar} />
        </div>
      </section>

      <section className="features-index-section" id="all-modules" aria-label="All modules">
        <h2>Meet every module.</h2>
        <p className="features-section-lede">Tap a module to see what it does — and the small things it does better with time.</p>
        <div className="features-index-grid">
          {MARKETING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <a
                key={feature.id}
                id={feature.id}
                href={`/features/${feature.id}`}
                className="features-index-card"
                data-tone={feature.tone}
              >
                <div className="features-index-card-head">
                  <span><Icon size={24} /></span>
                  <b className={feature.tone}>{feature.pill}</b>
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.lede}</p>
                <div className="features-index-card-footer">
                  Module tour <ChevronRight size={14} />
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <SiteWideProofs />
      <FinalCta />
      <MarketingFooter />
    </main>
  );
};

/* ── Path → page router ──────────────────────────────────────────────── */

// After trimming slashes off `window.location.pathname` we have no leading
// `/` to match — the regex must accept `features/<id>` directly. Without
// this, every /features/<id> page silently falls through to <FeaturesIndex />
// and visitors see the "All modules" grid instead of the module's own
// highlights.
const featurePathRegex = /^features\/([a-z-]+)\/?$/i;

const FeaturesRouter = () => {
  const [path, setPath] = useState(() => typeof window === "undefined" ? "" : window.location.pathname);
  useEffect(() => {
    // Public marketing surface: visitors arrive via full-page nav (anchor
    // clicks on <a href>). We only re-evaluate on browser back/forward so
    // chunk-loader can keep the same Features bundle mounted across index
    // ↔ module navigations.
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  const trimmedPath = (path || "").replace(/^\/+|\/+$/g, "");
  if (!trimmedPath || trimmedPath === "features") return <FeaturesIndex />;
  const match = trimmedPath.match(featurePathRegex);
  // Lowercase so /features/Meals still finds the meals feature (ids are all
  // lowercase, so a case-insensitive regex match without normalising would
  // render a confusing 404 for what looks like a valid URL).
  if (match) return <FeaturePage id={match[1].toLowerCase()} />;
  return <FeaturesIndex />;
};

export default FeaturesRouter;
