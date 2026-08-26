import { useEffect } from "react";
import { Check, ArrowRight, Shield, Star, Zap, Users, Calendar, ShoppingCart, MessageCircle, Brain, Tablet, ChefHat, ListChecks, Sparkles, ChevronRight } from "lucide-react";

const ICONS = { calendar: Calendar, shopping: ShoppingCart, tasks: ListChecks, chat: MessageCircle, brain: Brain, tablet: Tablet, chef: ChefHat, star: Star, zap: Zap, users: Users, shield: Shield, sparkles: Sparkles };

export default function SeoLanding({ config, signedIn }) {
  const { title, h1, subtitle, eyebrow, heroDescription, features = [], howItWorks = [], faqs = [], ctaTitle, ctaSubtitle, canonical, ogImage } = config;

  useEffect(() => {
    document.title = title;
    const meta = document.querySelector("meta[name=\"description\"]");
    if (meta) meta.content = heroDescription;
    const canonicalEl = document.querySelector("link[rel=\"canonical\"]");
    if (canonicalEl) canonicalEl.href = canonical;
  }, [title, heroDescription, canonical]);

  return (
    <div className="landing-page" style={{ background: "#fdfcfa", color: "#17171f", minHeight: "100vh", overflowX: "hidden" }}>
      {/* Nav */}
      <nav style={{ maxWidth: 1240, height: 88, margin: "auto", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <img src="/brand/famos-icon.png" alt="FamOS" width={48} height={48} style={{ borderRadius: 12, background: "#fff5e9", padding: 4, objectFit: "contain" }} />
          <strong style={{ font: "800 24px/1 Inter, sans-serif", letterSpacing: "-.06em", color: "#17171f" }}>Fam<span style={{ color: "#7952e8" }}>OS</span></strong>
        </a>
        <div style={{ display: "flex", gap: 20, font: "600 14px/1 Inter, sans-serif" }}>
          <a href="/features" style={{ color: "#17171f", textDecoration: "none" }}>Features</a>
          <a href="/pricing" style={{ color: "#17171f", textDecoration: "none" }}>Pricing</a>
          <a href="/contact" style={{ color: "#17171f", textDecoration: "none" }}>Contact</a>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/sign-in" style={{ font: "700 14px/1 Inter, sans-serif", color: "#17171f", textDecoration: "none", padding: "11px 17px" }}>Sign in</a>
          <a href="/sign-up" style={{ display: "inline-flex", alignItems: "center", borderRadius: 9999, background: "#17171f", color: "#fff", padding: "13px 20px", font: "750 14px/1 Inter, sans-serif", textDecoration: "none" }}>Start free trial</a>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ maxWidth: 1240, margin: "auto", padding: "80px 28px 60px", textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", color: "#6b49d1", font: "800 12px/1 Inter, sans-serif", textTransform: "uppercase", letterSpacing: ".1em" }}>{eyebrow}</span>
        <h1 style={{ margin: "20px auto 24px", maxWidth: 800, font: "750 clamp(36px,5vw,64px)/1.05 Inter Tight, sans-serif", letterSpacing: "-.06em" }}>{h1}</h1>
        <p style={{ maxWidth: 620, margin: "0 auto", fontSize: 19, lineHeight: 1.55, color: "#55525d" }}>{subtitle}</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 30 }}>
          <a href="/sign-up" style={{ display: "inline-flex", alignItems: "center", gap: 9, borderRadius: 9999, background: "#7952e8", color: "#fff", padding: "16px 24px", font: "750 14px/1 Inter, sans-serif", textDecoration: "none" }}>Start your free trial <ArrowRight size={17} /></a>
          <a href="/features" style={{ display: "inline-flex", alignItems: "center", gap: 9, borderRadius: 9999, border: "1px solid #ded5ff", background: "transparent", color: "#17171f", padding: "16px 24px", font: "700 14px/1 Inter, sans-serif", textDecoration: "none" }}>See all features</a>
        </div>
      </main>

      {/* Features grid */}
      {features.length > 0 && (
        <section style={{ maxWidth: 1240, margin: "auto", padding: "80px 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {features.map((f, i) => {
              const Icon = ICONS[f.icon] || Check;
              return (
                <article key={i} style={{ padding: 28, borderRadius: 24, border: "1px solid #e8e5f0", background: "#fff" }}>
                  <div style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 12, background: f.bg || "#f4f0ff", color: f.color || "#7952e8", marginBottom: 16 }}><Icon size={22} /></div>
                  <h2 style={{ font: "700 20px/1.2 Inter Tight, sans-serif", letterSpacing: "-.02em", marginBottom: 8 }}>{f.title}</h2>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "#55525d" }}>{f.description}</p>
                  {f.bullets && (
                    <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                      {f.bullets.map((b, j) => <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.5, color: "#444", marginBottom: 6 }}><Check size={15} style={{ color: "#228766", marginTop: 2, flexShrink: 0 }} />{b}</li>)}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* How it works */}
      {howItWorks.length > 0 && (
        <section style={{ padding: "80px 28px", background: "#f4f0ff", textAlign: "center" }}>
          <p style={{ color: "#7952e8", font: "850 12px/1 Inter, sans-serif", letterSpacing: ".14em", textTransform: "uppercase" }}>How it works</p>
          <h2 style={{ font: "720 clamp(28px,3.5vw,44px)/1.05 Inter Tight, sans-serif", letterSpacing: "-.05em", margin: "14px auto 40px" }}>Simple enough for Tuesday night. Powerful enough for tournament weekend.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, maxWidth: 1000, margin: "auto", textAlign: "left" }}>
            {howItWorks.map((step, i) => (
              <div key={i} style={{ padding: 24, borderRadius: 20, background: "#fff", border: "1px solid #e8e5f0" }}>
                <span style={{ display: "inline-grid", placeItems: "center", width: 32, height: 32, borderRadius: "50%", background: "#ffb11b", font: "700 14px/1 Inter, sans-serif", marginBottom: 14 }}>{i + 1}</span>
                <h3 style={{ font: "700 18px/1.2 Inter Tight, sans-serif", marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: "#55525d" }}>{step.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQs */}
      {faqs.length > 0 && (
        <section style={{ maxWidth: 800, margin: "auto", padding: "80px 28px" }}>
          <h2 style={{ font: "720 clamp(28px,3.5vw,40px)/1.1 Inter Tight, sans-serif", letterSpacing: "-.04em", textAlign: "center", marginBottom: 36 }}>Frequently asked questions</h2>
          <div style={{ display: "grid", gap: 16 }}>
            {faqs.map((faq, i) => (
              <details key={i} style={{ padding: "18px 20px", borderRadius: 16, border: "1px solid #e8e5f0", background: "#fff" }}>
                <summary style={{ font: "600 15px/1.3 Inter, sans-serif", cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>{faq.q}<ChevronRight size={16} style={{ flexShrink: 0, transition: "transform .2s" }} /></summary>
                <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#55525d" }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ maxWidth: 1160, margin: "80px auto", padding: "60px 40px", borderRadius: 32, background: "#7952e8", color: "white", textAlign: "center" }}>
        <h2 style={{ font: "720 clamp(28px,4vw,48px)/1 Inter Tight, sans-serif", letterSpacing: "-.05em", marginBottom: 16 }}>{ctaTitle}</h2>
        <p style={{ fontSize: 16, color: "#e4dfff", marginBottom: 28, maxWidth: 500, margin: "0 auto 28px" }}>{ctaSubtitle}</p>
        <a href="/sign-up" style={{ display: "inline-flex", alignItems: "center", borderRadius: 9999, background: "#fff", color: "#17171f", padding: "16px 24px", font: "750 14px/1 Inter, sans-serif", textDecoration: "none" }}>Start your free trial</a>
      </section>

      {/* Footer */}
      <footer style={{ maxWidth: 1240, margin: "auto", padding: "48px 28px", borderTop: "1px solid #e8e5f0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#66626c" }}>
        <span>&copy; 2026 FamOS. All rights reserved.</span>
        <div style={{ display: "flex", gap: 24 }}><a href="/privacy" style={{ color: "#66626c", textDecoration: "none" }}>Privacy</a><a href="/terms" style={{ color: "#66626c", textDecoration: "none" }}>Terms</a><a href="/contact" style={{ color: "#66626c", textDecoration: "none" }}>Contact</a></div>
      </footer>
    </div>
  );
}
