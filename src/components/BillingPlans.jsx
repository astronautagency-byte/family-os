import { PRICING_PLAN, formatMoney } from '../data/pricingPlan';
import './billing-plans.css';

export default function BillingPlans({subscription,loaded,error,isOwner,busy,interval,onInterval,onCheckout,onManage}) {
 const hasSubscription=['active','trial','trialing','past_due','paused'].includes(subscription?.status);
 const canTry=loaded&&!error&&(!subscription||subscription.status==='incomplete');
 const trial=['trial','trialing'].includes(subscription?.status);
 const current=hasSubscription?subscription.plan:'core';
 const pro=PRICING_PLAN.plans.find(plan=>plan.id==='pro');
 const date=subscription?.trial_ends_at&&new Date(subscription.trial_ends_at);
 const trialEnd=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):null;
 return <div className="billing-plans">
  <header><span className="billing-eyebrow">One subscription for your household</span><h3>{!loaded?'Checking your plan…':error?'Subscription status unavailable':trial?`${PRICING_PLAN.plans.find(p=>p.id===current)?.name||'FamOS'} trial`:hasSubscription?PRICING_PLAN.plans.find(p=>p.id===current)?.name||'Your current plan':'FamOS Free'}</h3>
   {error&&<p role="alert">We couldn’t verify your subscription. No plan changes have been made. Refresh before starting checkout.</p>}
   {trial&&<p>{trialEnd?`Trial ends ${trialEnd}.`:'Check Manage billing for your trial end date.'} {subscription.cancel_at_period_end?'Renewal is cancelled. You’ll return to Free when your current access ends.':'Renews automatically unless you cancel before your trial ends.'}</p>}
  </header>
  {!hasSubscription&&<section className="billing-trial-offer"><h4>Try FamOS Pro for {PRICING_PLAN.trial.days} days</h4><p>Card required. No subscription charge today. Then CAD {formatMoney(pro.price[interval])}/{interval==='yearly'?'year':'month'}, plus applicable taxes, unless you cancel before your trial ends.</p><p>Your trial starts after secure checkout succeeds. Cancel renewal in Manage billing to return to Free. Available to eligible households that haven’t subscribed before.</p></section>}
  <div className="billing-cadence-toggle" role="group" aria-label="Billing cadence">{['monthly','yearly'].map(value=><button type="button" key={value} className={interval===value?'selected':''} aria-pressed={interval===value} onClick={()=>onInterval(value)}>{value==='monthly'?'Monthly':'Yearly'}</button>)}</div>
  <div className="billing-plan-grid">{PRICING_PLAN.plans.map(plan=>{
   const selected=loaded&&!error&&current===plan.id;
   const yearly=interval==='yearly';
   const saving=plan.price.monthly?Math.round((1-plan.price.yearly/(plan.price.monthly*12))*100):0;
   return <article className={`billing-plan-option ${selected?'is-current':''}`} key={plan.id}>
    <h4>{plan.isFree?'FamOS Free':plan.name}</h4>
    <p className="billing-plan-price">{formatMoney(plan.price[interval])}<small>{plan.isFree?'':yearly?' CAD/year':' CAD/month'}</small></p>
    <p>{plan.isFree?'Free forever':yearly?`${formatMoney(plan.price.yearly/12)}/month equivalent · save ${saving}%`:`CAD ${formatMoney(plan.price.yearly)}/year available`}</p>
    <p>{plan.isFree?'Core tools for your household':plan.tagline}</p>
    {selected?<strong>Current plan</strong>:plan.isFree?(hasSubscription&&<button type="button" disabled={!isOwner||busy!==null} onClick={onManage}>Manage renewal / Free plan</button>):<button type="button" disabled={!isOwner||!loaded||!!error||busy!==null} onClick={()=>hasSubscription?onManage():onCheckout(plan.id,interval,plan.id==='pro'&&canTry)}>{busy===plan.id?'Opening checkout…':hasSubscription?'Change plan in billing':plan.id==='pro'&&canTry?`Start ${PRICING_PLAN.trial.days}-day Pro trial`:`Choose ${plan.name}`}</button>}
   </article>;
  })}</div>
  {!isOwner&&<p>Only the household owner can start a trial or change billing.</p>}
 </div>;
}
