import {ArrowRight} from '../components/icons';
import MarketingFooter from '../components/MarketingFooter';
import MarketingNav from '../components/MarketingNav';
import FamilyIllustration from '../components/FamilyIllustration';
import '../landing.css';
import '../feature.css';
import '../theme/marketing-pages.css';
export default function Download(){
 return <div className="landing-page mp-page"><MarketingNav/><main><section className="mp-index-hero"><div><h1>Your family space.<br/>On your screens.</h1><p>Open FamOS in a supported browser on your phone, tablet or computer. Use the same household account wherever you plan your day.</p><a className="mp-primary" href="https://home.fam-os.app/sign-in">Open FamOS <ArrowRight size={18}/></a></div><FamilyIllustration variant="welcome" eager/></section><section className="mp-story"><article><span className="mp-step-number">01</span><div><h2>Phone or tablet</h2><p>Visit home.fam-os.app in Safari or Chrome and sign in. Where supported, choose Add to Home Screen from your browser’s menu for quick access.</p></div></article><article><span className="mp-step-number">02</span><div><h2>Laptop or desktop</h2><p>Use FamOS directly in your browser. Keep a bookmark for your family’s calendar, tasks and meal plan without installing special hardware or software.</p></div></article><article><span className="mp-step-number">03</span><div><h2>A shared family display</h2><p>Use tablet mode on a suitable device in your family space. Choose content that is appropriate for a shared screen and keep private conversations on personal devices.</p><a href="/features/tablet">Explore tablet mode →</a></div></article></section><section className="mp-final"><h2>New to FamOS?</h2><p>Start with a free household account and add the tools that help.</p><a className="mp-primary" href="https://home.fam-os.app/sign-up">Start free <ArrowRight size={18}/></a></section></main><MarketingFooter/></div>
}
