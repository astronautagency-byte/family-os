import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { FEATURES, FEATURE_BY_ID, TONES, SITE_WIDE_FEATURES } from "../data/featureData";
import FeaturesDropdown from "../components/FeaturesDropdown";
import "../feature.css";

/* ── helpers ─────────────────────────────────────────────────────────── */

const FeaturesNav = ({ currentId = null }) => (
  <nav className="features-nav" aria-label="Features">
    <a className="features-nav-brand" href="/landing">
      <img src="/famicon.png" alt="" />
      <strong><span>Fam</span>OS</strong>
    </a>
    <div className="features-nav-links">
      <a href="/landing">Home</a>
      <FeaturesDropdown active currentId={currentId} label="Features" />
      <a href="/landing#pricing">Pricing</a>
      <a href="/landing#faq">FAQ</a>
    </div>
    <div className="features-nav-actions">
      <a href="/signup">Start free trial <ArrowRight size={14} /></a>
      <a href="/signin">Sign in</a>
    </div>
  </nav>
);

const FeaturesFooter = () => (
  <footer className="features-footer">
    <div className="features-footer-inner">
      <div>
        <h4>FamOS</h4>
        <p>The family operating system that quietly keeps everyone in sync — from morning routines to weekend dinners to next year's calendar.</p>
      </div>
      <div>
        <h4>Features</h4>
        <ul>
          <li><a href="/features/today">Today</a></li>
          <li><a href="/features/calendar">Calendar</a></li>
          <li><a href="/features/meals">Meals & Cook Mode</a></li>
          <li><a href="/features/shopping">Shopping list</a></li>
          <li><a href="/features/fam-ai">Fam AI</a></li>
        </ul>
      </div>
      <div>
        <h4>Product</h4>
        <ul>
          <li><a href="/features/tasks">Tasks & rewards</a></li>
          <li><a href="/features/chat">Family chat</a></li>
          <li><a href="/features/family">Invites & settings</a></li>
          <li><a href="/landing#pricing">Pricing</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="/terms">Terms</a></li>
          <li><a href="/signin">Sign in</a></li>
          <li><a href="/signup">Start trial</a></li>
        </ul>
      </div>
    </div>
    <div className="features-footer-bottom">
      <span>© {new Date().getFullYear()} FamOS — made with care for families.</span>
      <span><a href="/landing">Home</a> · <a href="/features">All features</a> · <a href="/landing#pricing">Pricing</a></span>
    </div>
  </footer>
);

/* ── Feature hero (left copy + right mock-panel) ─────────────────────── */

const FeatureHero = ({ feature }) => {
  const tone = TONES[feature.tone] || TONES.lilac;
  const Icon = feature.icon;
  return (
    <header
      className="features-module-hero"
      style={{ background: `linear-gradient(180deg, #fffdf9 0%, ${tone.from} 60%, ${tone.to} 100%)` }}
    >
      <div className="features-module-hero-grid">
        <div className="features-module-hero-copy">
          <p>{feature.eyebrow}</p>
          <h1>{feature.title}</h1>
          <span className="lede">{feature.lede}</span>
          <div className="features-module-hero-actions">
            <a href="/signup">Try it free <ArrowRight size={14} /></a>
            <a href="/features">See all features <ArrowUpRight size={14} /></a>
          </div>
        </div>
        <FeatureMockPanel feature={feature} />
      </div>
    </header>
  );
};

const FeatureMockPanel = ({ feature }) => {
  if (!feature.preview) return null;
  const { title, kicker, pills, rows } = feature.preview;
  const Icon = feature.icon;
  return (
    <div className="features-mock-panel">
      <div className="features-mock-bar">
        <span><Icon size={18} /></span>
        <div>
          <small>{kicker}</small>
          <strong>{title}</strong>
        </div>
        <i />
      </div>
      {pills?.length > 0 && (
        <div className="features-mock-buttons">
          {pills.map((pill) => <b key={pill}>{pill}</b>)}
        </div>
      )}
      <div className="features-mock-rows">
        {rows?.map((row, idx) => (
          <div className="features-mock-row" key={`${row.name}-${idx}`}>
            <b data-accent={row.accent}>{row.avatar}</b>
            <span>
              <strong>{row.name}</strong>
              <small>{row.meta}</small>
            </span>
            <em data-accent="pink" />
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Bullets section ─────────────────────────────────────────────────── */

const FeatureBullets = ({ feature }) => (
  <section className="features-bullets" aria-label="Feature highlights">
    <div className="features-bullets-head">
      <p>WHY YOU'LL USE IT DAILY</p>
      <h2>Built around the way real families run.</h2>
      <p className="lede">Every detail in {feature.name} was cut to fit actual Monday-to-Sunday use, not a feature-checklist screenshot.</p>
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
  const others = FEATURES.filter((f) => f.id !== currentId);
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

const FinalCta = () => (
  <section className="features-final">
    <div className="features-final-inner">
      <h2>One month free. Every module unlocked.</h2>
      <p>Start a 30-day trial with the full Core plan, the Smart Family Bundle add-on, and Fam AI all included. No card required to look around.</p>
      <div className="features-final-actions">
        <a href="/signup">Start free trial <ArrowRight size={14} /></a>
        <a href="/landing">See pricing</a>
      </div>
    </div>
  </section>
);

/* ── Single Feature page (/features/<id>) ────────────────────────────── */

const FeaturePage = ({ id }) => {
  const feature = FEATURE_BY_ID(id);
  if (!feature) {
    return <NotFoundFeature />;
  }
  return (
    <main className="features-page">
      <FeaturesNav currentId={id} />
      <div className="px-5" style={{ padding: "0 28px" }}>
        <div className="features-breadcrumb" style={{ paddingTop: 28 }}>
          <a href="/features">All features</a>
          <ChevronRight size={12} />
          <span style={{ color: "#17171f" }}>{feature.name}</span>
        </div>
      </div>
      <FeatureHero feature={feature} />
      <FeatureBullets feature={feature} />
      <SiteWideProofs />
      <ModuleNav currentId={feature.id} />
      <FinalCta />
      <FeaturesFooter />
    </main>
  );
};

const NotFoundFeature = () => (
  <main className="features-page">
    <FeaturesNav />
    <Feedback
      eyebrow="404"
      title="That feature doesn't exist — yet."
      lede="We build modules as our users ask for them, so the catalogue keeps moving."
    />
    <FinalCta />
    <FeaturesFooter />
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
        <a href="/landing">Back to home</a>
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
      <FeaturesNav />

      <section className="features-index-hero">
        <div className="features-index-hero-grid">
          <div className="features-index-hero-copy">
            <p>FEATURES TOUR</p>
            <h1>Every module in <em>FamOS</em>, one page deep.</h1>
            <p className="lede">
              From the morning dashboard to evening Cook Mode, from real-time sync across phones to the grocery banner that knows what you're missing — here's a tour of every feature in FamOS.
            </p>
            <div className="features-index-hero-actions">
              <a href="/signup">Start your free trial <ArrowRight size={14} /></a>
              <a href="/landing">See pricing</a>
            </div>
          </div>
          <FeatureMockPanel feature={FEATURES[0]} />
        </div>
      </section>

      <section className="features-index-section" id="all-modules" aria-label="All modules">
        <h2>Browse every FamOS module</h2>
        <p className="features-section-lede">Tap any module to see its dedicated deep-dive with screenshots, the problems it solves, and the micro-features you only notice after a few weeks.</p>
        <div className="features-index-grid">
          {FEATURES.map((feature) => {
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
      <FeaturesFooter />
    </main>
  );
};

/* ── Path → page router ──────────────────────────────────────────────── */

const featurePathRegex = /^\/features\/([a-z-]+)\/?$/i;

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
  if (match) return <FeaturePage id={match[1]} />;
  return <FeaturesIndex />;
};

export default FeaturesRouter;
