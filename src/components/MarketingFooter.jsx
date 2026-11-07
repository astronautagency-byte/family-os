import { IS_MAC_APP_STORE } from '../lib/distribution';
import './marketing-footer.css';

// Keep detailed feature discovery on /features instead of repeating its catalog.
export default function MarketingFooter({signedIn=false}) {
 return <footer className="features-footer features-footer--compact">
  <div className="features-footer-inner">
   <div className="marketing-footer-brand"><h4>FamOS</h4><p>A little less planning. <br/>A lot more family.</p></div>
   <nav aria-label="Explore FamOS"><h4>Explore</h4><ul>
    <li><a href="/features">All features</a></li>
    <li><a href="/fam-ai">FamAI & Mia</a></li>
    {!IS_MAC_APP_STORE&&<li><a href="/pricing">Pricing</a></li>}
    <li><a href="/download">Use FamOS on your devices</a></li>
   </ul></nav>
   <nav aria-label="FamOS help and account"><h4>Help & account</h4><ul>
    <li><a href="/contact">Contact us</a></li>
    <li><a href="/compare">Compare organizers</a></li>
    <li><a href={signedIn?'https://home.fam-os.app/today':'https://home.fam-os.app/sign-in'}>{signedIn?'Open FamOS':'Sign in'}</a></li>
   </ul></nav>
  </div>
  <div className="features-footer-bottom"><span>© {new Date().getFullYear()} FamOS, Inc.</span><nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></div>
 </footer>
}
