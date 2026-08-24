import { ArrowDownToLine, ArrowRight, CheckCircle2, ExternalLink, MonitorDown, Smartphone } from "lucide-react";
import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import { DESKTOP_DOWNLOAD_URL, DESKTOP_RELEASES_URL } from "../lib/downloads";
import "../download.css";

export default function Download() {
  return (
    <main className="download-page">
      <MarketingNav />
      <header className="download-hero">
        <div className="download-hero-copy">
          <p className="download-eyebrow">FamOS DESKTOP</p>
          <h1>More room for family life.</h1>
          <p className="download-lede">
            Bring FamOS to your computer for a calm, focused place to plan the day, keep everyone in sync, and stay close to home wherever you are.
          </p>
          <div className="download-hero-actions">
            <a className="download-primary" href="https://apps.apple.com/app/famos/id0000000000">
              <ArrowDownToLine size={18} /> Download on the App Store
            </a>
            <a className="download-secondary" href="https://home.fam-os.app/sign-up">
              Try FamOS free <ArrowRight size={16} />
            </a>
          </div>
          <p className="download-note">Free on the Mac App Store · Requires macOS 11.0+ · Your FamOS account stays the same</p>
        </div>
        <div className="download-hero-art" aria-hidden="true">
          <div className="download-window">
            <div className="download-window-bar"><i /><i /><i /><span>FamOS</span></div>
            <div className="download-window-body">
              <span className="download-window-mark"><img src="/icons/famos-app-icon.png" alt="" /></span>
              <strong>Your family, in sync.</strong>
              <small>Calendar · Meals · Shopping · Tasks</small>
              <div className="download-window-lines"><i /><i /><i /></div>
            </div>
          </div>
        </div>
      </header>

      <section className="download-options" aria-labelledby="download-options-title">
        <div className="download-section-heading">
          <p className="download-eyebrow">CHOOSE YOUR SCREEN</p>
          <h2>Start in a few clicks.</h2>
          <p id="download-options-title">The same FamOS space follows you from your phone to your desk.</p>
        </div>
        <div className="download-option-grid">
          <article className="download-option download-option-ready">
            <span className="download-option-icon"><MonitorDown size={22} /></span>
            <div>
              <p className="download-option-kicker">READY NOW</p>
              <h3>Mac desktop app</h3>
              <p>Download FamOS for Mac, open the file, and move FamOS into Applications. Then Control-click FamOS, choose Open once, and sign in as usual.</p>
              <a href="https://apps.apple.com/app/famos/id0000000000">Download on the App Store <ArrowDownToLine size={15} /></a>
            </div>
          </article>
          <article className="download-option">
            <span className="download-option-icon"><MonitorDown size={22} /></span>
            <div>
              <p className="download-option-kicker">COMING NEXT</p>
              <h3>Windows desktop app</h3>
              <p>We’re preparing the Windows installer now. Until then, FamOS works beautifully in Chrome or Edge.</p>
              <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer">See desktop releases <ExternalLink size={14} /></a>
            </div>
          </article>
          <article className="download-option">
            <span className="download-option-icon"><Smartphone size={22} /></span>
            <div>
              <p className="download-option-kicker">NO DOWNLOAD NEEDED</p>
              <h3>Phone and tablet</h3>
              <p>Open FamOS in Safari or Chrome and choose Add to Home Screen. It will feel just like an app.</p>
              <a href="https://home.fam-os.app">Open FamOS <ArrowRight size={15} /></a>
            </div>
          </article>
        </div>
      </section>

      <section className="download-steps" aria-labelledby="download-steps-title">
        <div className="download-section-heading">
          <p className="download-eyebrow">NO TECH KNOWLEDGE NEEDED</p>
          <h2>From download to home base.</h2>
        </div>
        <div className="download-step-grid" id="download-steps-title">
          <article><b>1</b><h3>Find FamOS</h3><p>Search for FamOS in the Mac App Store or click the download button above.</p></article>
          <article><b>2</b><h3>Install</h3><p>Click Get and FamOS installs automatically — no extra steps, no warnings.</p></article>
          <article><b>3</b><h3>Open and sign in</h3><p>Launch FamOS from your Applications folder or Launchpad and sign in as usual.</p></article>
          <article><b>4</b><h3>Pick up where you left off</h3><p>Your family, schedule, and lists are right there — same FamOS, bigger screen.</p></article>
        </div>
        <div className="download-trust"><CheckCircle2 size={17} /> Your family data stays connected across every screen.</div>
      </section>
      <MarketingFooter />
    </main>
  );
}
