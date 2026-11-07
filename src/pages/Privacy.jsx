import {privacySections,LEGAL_UPDATED} from '../data/legalContent';
import MarketingNav from '../components/MarketingNav';
import '../landing.css';
import '../feature.css';
import { ArrowLeft, LockKeyhole } from "../components/icons";
import MarketingFooter from "../components/MarketingFooter";

const go = (route) => {
  const target = route === "landing" ? "/" : `/#${route}`;
  window.history.pushState(null, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export default function Privacy({ signedIn = false }) {
  return <div className="legal-page">
    {signedIn ? (<header className="legal-nav">
      <button className="landing-brand" onClick={()=>go("landing")}><img src="/icons/famos-app-icon.png" alt=""/><strong>Fam<span>OS</span></strong></button>
      <button className="legal-back" onClick={()=>go(signedIn?"settings":"landing")}><ArrowLeft/> {signedIn?"Back to settings":"Back to home"}</button>
    </header>) : <MarketingNav/>}
    <main className="legal-content">
      <div className="legal-heading"><span><LockKeyhole/> Privacy policy</span><h1>Your family life stays yours.</h1><p>Last updated {LEGAL_UPDATED}</p></div>

      {privacySections.map(([title,paragraphs])=><section key={title}><h2>{title}</h2>{paragraphs.map((text,index)=><p key={index}>{text}</p>)}</section>)}
      <section><h2>Contact</h2><p><a href="mailto:support@fam-os.app">support@fam-os.app</a> · <a href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noreferrer">EEA data-protection authorities</a> · <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">UK Information Commissioner</a></p></section>

      <aside className="legal-disclaimer"><h2>Copyright and product disclaimer</h2><p>© 2026 Astronaut Digital Inc. All rights reserved. FamOS, its original interface, branding, copy, and associated assets are protected by applicable intellectual-property laws. Third-party names, trademarks, services, and content remain the property of their respective owners.</p><p>FamOS is a family-organization tool and does not provide legal, medical, financial, or professional advice. AI suggestions may be incomplete or inaccurate and should be reviewed before use.</p></aside>
    </main>
    <MarketingFooter />
  </div>;
}
