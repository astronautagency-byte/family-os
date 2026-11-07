import {useEffect} from 'react';
import {ArrowRight, Check, Smartphone, MonitorDown, Tablet} from '../components/icons';
import MarketingFooter from '../components/MarketingFooter';
import MarketingNav from '../components/MarketingNav';
import '../landing.css';
import '../landing-theme.css';
import '../feature.css';
import '../theme/marketing-refresh.css';
import '../theme/download.css';

export default function Download(){
 useEffect(()=>{
  document.title='Use FamOS on Your Phone, Tablet or Computer | FamOS';
  document.querySelector('link[rel="canonical"]')?.setAttribute('href','https://fam-os.app/download');
  document.querySelector('meta[name="description"]')?.setAttribute('content','Open FamOS on your phone, tablet or computer. Keep your family calendar, meals and tasks together, and add FamOS to your home screen where supported.');
 },[]);
 return <div className="landing-page download-page">
  <MarketingNav/>
  <main id="main-content">
   <section className="landing-hero landing-hero-editorial">
    <div className="landing-hero-copy">
     <h1>Your family.<br/>On every screen.</h1>
     <p>On your phone, at your desk, or in the heart of your home. Keep the same family plans close on the screens you already use.</p>
     <div className="download-actions"><a className="download-primary" href="https://home.fam-os.app/sign-in">Open FamOS <ArrowRight size={18}/></a><a className="download-secondary" href="#device-setup">Choose your device</a></div>
     <div className="landing-trust"><span><Check size={16}/> One household account</span><span><Check size={16}/> No special hardware</span></div>
    </div>
    <div className="hero-real-life">
     <img src="/marketing/lifestyle/family-1536.webp" srcSet="/marketing/lifestyle/family-640.webp 640w, /marketing/lifestyle/family-960.webp 960w, /marketing/lifestyle/family-1536.webp 1536w" sizes="(max-width:700px) 100vw, 50vw" width="1536" height="1024" fetchPriority="high" alt="A family planning their day together at home"/>
     <div className="hero-product-inset"><figure className="real-product-preview"><img src="/marketing/product-captures/calendar-1280.webp" srcSet="/marketing/product-captures/calendar-640.webp 640w, /marketing/product-captures/calendar-1280.webp 1280w" sizes="(max-width:700px) 75vw, 38vw" width="1280" height="900" alt="FamOS shared calendar with a sample household"/><figcaption>Actual FamOS screen · sample household</figcaption></figure></div>
    </div>
   </section>
   <section className="download-setup" id="device-setup">
    <h2>A familiar space on every screen.</h2>
    <p>Choose how you want to use FamOS. Your household account stays the same.</p>
    <div className="download-device-list">
     <article><Smartphone size={28} aria-hidden="true"/><div><h3>Phone or tablet</h3><p>Open FamOS in Safari or Chrome and sign in. For quick access, choose <strong>Add to Home Screen</strong> from your browser’s menu where supported.</p><a href="https://home.fam-os.app/sign-in">Open on this device <ArrowRight size={16}/></a></div></article>
     <article><MonitorDown size={28} aria-hidden="true"/><div><h3>Laptop or desktop</h3><p>Plan the week with a little more room. Use FamOS directly in your browser and bookmark it for next time.</p><a href="https://home.fam-os.app/sign-in">Open in your browser <ArrowRight size={16}/></a></div></article>
     <article><Tablet size={28} aria-hidden="true"/><div><h3>A shared family display</h3><p>Give the family plan a place in your home with tablet mode. Choose what belongs on a shared screen and keep private conversations on personal devices.</p><a href="/features/tablet">Explore tablet mode <ArrowRight size={16}/></a></div></article>
    </div>
   </section>
   <section className="landing-final"><div><h2>A little less organizing.<br/>A little more living.</h2><p>New to FamOS? Start with a free household account.</p><a className="download-primary" href="https://home.fam-os.app/sign-up">Start your family space <ArrowRight size={18}/></a></div></section>
  </main>
  <MarketingFooter/>
 </div>;
}
