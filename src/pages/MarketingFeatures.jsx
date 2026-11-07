import {useEffect} from 'react';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import FamilyIllustration from '../components/FamilyIllustration';
import {ArrowRight, Check, CalendarDays, ChefHat, ListChecks, BookOpen, Refrigerator, MessageCircle, Users, Star, Sparkles, ShoppingCart, Tablet} from '../components/icons';
import {ALL_MARKETING_PAGES, MARKETING_PAGES, SEARCH_PAGES, marketingPageForPath} from '../data/marketingPages';
import '../landing.css';
import '../landing-theme.css';
import '../feature.css';
import '../theme/marketing-pages.css';
const icons = {today:Sparkles,calendar:CalendarDays,meals:ChefHat,tasks:ListChecks,recipes:BookOpen,kitchen:Refrigerator,chat:MessageCircle,family:Users,rewards:Star,'fam-ai':Sparkles,shopping:ShoppingCart,tablet:Tablet};
export const publicPageMeta = (path) => {
 const page = marketingPageForPath(path);
 return {title:page ? `${page.title} | FamOS` : 'Family Organizer Features: Calendar, Meals & Tasks | FamOS',description:page?.description || 'Explore FamOS shared calendars, meal planning, recipes, chores, rewards, shopping lists and family chat. Choose the tools that fit your household.',canonical:`https://fam-os.app${page?.path || '/features'}`};
};
export function pageSchema(page) {
 const meta=publicPageMeta(page?.path || '/features');
 return {'@context':'https://schema.org','@graph':[
 {'@type':'WebPage','@id':meta.canonical,name:meta.title,description:meta.description,url:meta.canonical},
 {'@type':'BreadcrumbList',itemListElement:[{ '@type':'ListItem',position:1,name:'Home',item:'https://fam-os.app/'},{'@type':'ListItem',position:2,name:'Features',item:'https://fam-os.app/features'},...(page?[{'@type':'ListItem',position:3,name:page.name,item:meta.canonical}]:[])]}
 ]};
}
function Metadata({path}) {
 useEffect(()=>{
  const meta=publicPageMeta(path);
  document.title=meta.title;
  const set=(selector,attr,value)=>document.querySelector(selector)?.setAttribute(attr,value);
  set('meta[name="description"]','content',meta.description);
  set('link[rel="canonical"]','href',meta.canonical);
  for(const [key,value] of Object.entries({title:meta.title,description:meta.description,url:meta.canonical})) set(`meta[property="og:${key}"]`,'content',value);
  set('meta[name="twitter:title"]','content',meta.title); set('meta[name="twitter:description"]','content',meta.description);
 },[path]);
 return null;
}
function PageVisual({page}) {
 return page.capture ? <figure className="mp-product"><img src={`/marketing/product-captures/${page.capture}-1280.webp`} srcSet={`/marketing/product-captures/${page.capture}-640.webp 640w, /marketing/product-captures/${page.capture}-1280.webp 1280w`} sizes="(max-width:760px) 92vw, 640px" width="1280" height="900" alt={`FamOS ${page.capture} screen with a sample household`} decoding="async"/><figcaption>Actual FamOS screen · sample household</figcaption></figure> : <div className="mp-art"><FamilyIllustration variant={page.art} eager/></div>;
}
function FeatureLink({page}) {
 const Icon=icons[page.id]||CalendarDays;
 return <a className="mp-feature-link" href={page.path}><Icon size={24}/><div><h3>{page.name}</h3><p>{page.description}</p><span>Explore {page.name.toLowerCase()} <ArrowRight size={17}/></span></div></a>;
}
export default function MarketingFeatures({path='/features'}) {
 const page=marketingPageForPath(path);
 const missing=path!=='/features'&&!page;
 const related=page?.related.map(id=>ALL_MARKETING_PAGES.find(p=>p.id===id)).filter(Boolean)||[];
 return <div className="landing-page mp-page">
  <Metadata path={path}/>
  {missing && <meta name="robots" content="noindex"/>}
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(pageSchema(page)).replaceAll('<','\\u003c')}}/>
  <a className="mp-skip" href="#main-content">Skip to content</a>
  <MarketingNav currentId={page?.id}/>
  <main id="main-content">
   <div className="mp-breadcrumb"><a href="/">Home</a><span>/</span><a href="/features">Features</a>{page&&<><span>/</span><span aria-current="page">{page.name}</span></>}</div>
   {missing ? <section className="mp-index-hero"><h1>That page isn’t here.</h1><a href="/features">Explore FamOS features</a></section> : page ? <>
    <section className="mp-hero"><div className="mp-hero-copy"><h1>{page.title}</h1><p>{page.description}</p><div className="mp-actions"><a className="mp-primary" href="https://home.fam-os.app/sign-up">Start free <ArrowRight size={18}/></a><a href="#how-to">See how it works <ArrowRight size={18}/></a></div><small><Check size={15}/> Start with Free. Optional paid tools and usage limits apply.</small></div><PageVisual page={page}/></section>
    <section className="mp-story" aria-label={`${page.name} details`}>{page.sections.map(([title,copy],i)=><article key={title}><span className="mp-step-number">0{i+1}</span><div><h2>{title}</h2><p>{copy}</p></div></article>)}</section>
    {(page.id==='meals'||page.id==='recipes')&&<section className="mp-photo"><img src="/marketing/lifestyle/cooking-1536.webp" srcSet="/marketing/lifestyle/cooking-640.webp 640w, /marketing/lifestyle/cooking-960.webp 960w, /marketing/lifestyle/cooking-1536.webp 1536w" sizes="(max-width:760px) 100vw, 1100px" width="1536" height="1024" loading="lazy" alt="A parent and child preparing a meal together"/><div><h2>Keep the recipe.<br/>Make the memory.</h2><p>A little planning leaves more room for the part of dinner you enjoy.</p></div></section>}
    <section className="mp-how" id="how-to"><h2>Get started with {page.name.toLowerCase()}</h2><ol>{page.steps.map(step=><li key={step}>{step}</li>)}</ol></section>
    <section className="mp-faq"><h2>Questions about {page.name.toLowerCase()}</h2>{page.faqs.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</section>
    <section className="mp-related"><h2>Make the next step easier</h2><div>{related.map(p=><FeatureLink key={p.id} page={p}/>)}</div></section>
   </> : <>
    <section className="mp-index-hero"><div><h1>Make room for<br/>family life.</h1><p>One family organizer. Choose the tools that help, and leave the rest for later.</p><a className="mp-primary" href="https://home.fam-os.app/sign-up">Start your family space <ArrowRight size={18}/></a></div><FamilyIllustration variant="welcome" eager/></section>
    <section className="mp-directory" aria-label="FamOS features">{MARKETING_PAGES.map(p=><FeatureLink page={p} key={p.id}/>)}</section>
    <section className="mp-related"><h2>Bring your existing plans with you</h2><div>{SEARCH_PAGES.map(p=><FeatureLink page={p} key={p.id}/>)}</div></section>
   </>}
   <section className="mp-final"><h2>Start with one useful habit.</h2><p>Add a plan, invite your people, and make tomorrow a little easier.</p><a className="mp-primary" href="https://home.fam-os.app/sign-up">Get started free <ArrowRight size={18}/></a><a href="/pricing">Compare plans</a></section>
  </main>
  <MarketingFooter/>
 </div>;
}
