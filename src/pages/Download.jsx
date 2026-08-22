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
            <a className="download-primary" href={DESKTOP_DOWNLOAD_URL}>
              <ArrowDownToLine size={18} /> Download for Mac
            </a>
            <a className="download-secondary" href="https://home.fam-os.app/sign-up">
              Try FamOS free <ArrowRight size={16} />
            </a>
          </div>
          <p className="download-note">For Mac with Apple silicon · Free to download · Your FamOS account stays the same</p>
          <p className="download-security-note">First time opening it? Control-click FamOS in Applications, choose Open, then confirm Open. This is expected for a free, unsigned Mac download.</p>
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
              <p>Download FamOS for Mac, open the file, and move FamOS into Applications. Then sign in as usual.</p>
              <a href={DESKTOP_DOWNLOAD_URL}>Download for Mac <ArrowDownToLine size={15} /></a>
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
          <article><b>1</b><h3>Download</h3><p>Select Download for Mac above. The file will appear in your Downloads folder.</p></article>
          <article><b>2</b><h3>Move to Applications</h3><p>Open the downloaded file and drag FamOS into your Applications folder.</p></article>
          <article><b>3</b><h3>Sign in and settle in</h3><p>Open FamOS, sign in with your normal account, and pick up right where you left off.</p></article>
        </div>
        <div className="download-trust"><CheckCircle2 size={17} /> Your family data stays connected across every screen.</div>
      </section>
      <MarketingFooter />
    </main>
  );
}
