import { PRICING_PLAN } from '../data/pricingPlan';
import HouseholdOffers from './HouseholdOffers';
import './billing-plans.css';
import {IS_APP_STORE} from '../lib/distribution';

export default function BillingPlans({subscription, loaded, error, isOwner, busy, onManage, storeBuild=IS_APP_STORE}) {
  if (!loaded) return <p role="status">Checking your plan…</p>;
  if (error) return <p role="alert">We couldn’t verify your subscription. Refresh to check your current access.</p>;
  const plan = PRICING_PLAN.plans.find(plan => plan.id === subscription?.plan);
  const hasBilling = subscription && subscription.plan !== 'core' && subscription.status !== 'incomplete';
  const trial = ['trial', 'trialing'].includes(subscription?.status);
  const date = subscription?.trial_ends_at && new Date(subscription.trial_ends_at);
  const trialEnd = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, {month:'short',day:'numeric',year:'numeric'}) : null;
  if (storeBuild) return <div className="billing-plans">
    <section className="billing-plan-option" aria-label="Your account plan">
      <h3>FamOS Core</h3>
      <p>Your family’s shared calendar, tasks and shopping lists are available in this app.</p>
      <p>No subscription purchase is available in this version.</p>
    </section>
    {hasBilling && <section className="billing-plan-option" aria-label="Existing subscription">
      <h3>Existing subscription</h3>
      <p>{plan?.name || 'Household subscription'}{trial ? ' trial' : ''}</p>
      {trial && trialEnd && <p>Trial ends {trialEnd}.</p>}
      <p>{subscription.cancel_at_period_end ? 'Renewal is cancelled. Your current billing period will not renew.' : 'Check your current renewal details below.'}</p>
      {isOwner ? <a href="mailto:support@fam-os.app?subject=FamOS%20billing%20support">Billing and cancellation support</a> : <p>The household owner manages this subscription.</p>}
    </section>}
  </div>;
  return <div className="billing-plans">
    {hasBilling && <section className="billing-plan-option">
      <h3>{plan?.name || 'Your current plan'}{trial ? ' trial' : ''}</h3>
      <p>Existing plan access follows your subscription. Manage billing to see your renewal price, payment currency and cancellation options.</p>
      {trial && <p>{trialEnd ? `Trial ends ${trialEnd}. ` : ''}{subscription.cancel_at_period_end ? 'Renewal is cancelled. You’ll return to Free when your current access ends.' : 'Renews automatically unless you cancel before your trial ends.'}</p>}
      {plan && <ul className="billing-plan-inclusions">{plan.featureList.map(feature => <li key={feature}>{feature}</li>)}</ul>}
      <button type="button" disabled={!isOwner || busy !== null} onClick={onManage}>Manage billing</button>
      {!isOwner && <p>Only the household owner can change billing.</p>}
    </section>}
    <HouseholdOffers/>
  </div>;
}
