import { Check, LockKeyhole, Sparkles } from "lucide-react";
import { PREMIUM_FEATURES, featureById } from "../data/billingCatalog";
import { PRICING_PLAN } from "../data/pricingPlan";
import { Card, PrimaryButton, SecondaryButton } from "./ui";

export default function FeaturePaywall({ featureId, onChoose, onBack, busy = false, error = "" }) {
  const feature = featureById(featureId) || PREMIUM_FEATURES[0];
  const trialDays = PRICING_PLAN.trial.days;
  const price = feature.price || 14.99;
  const priceYearly = feature.priceYearly || 149;
  return (
    <section className="feature-paywall" aria-labelledby="feature-paywall-title">
      <Card className="feature-paywall-card">
        <div className="feature-paywall-icon"><LockKeyhole size={24} /></div>
        <p className="feature-paywall-eyebrow">FamOS {feature.name.replace("FamOS ", "")}</p>
        <h1 id="feature-paywall-title">Unlock {feature.name}</h1>
        <p className="feature-paywall-tagline">${price}/month or ${priceYearly}/year</p>
        <div className="feature-paywall-price"><strong>${price}</strong><span>CAD / month · for your whole household</span></div>
        <p className="feature-paywall-trial-note">Start a {trialDays}-day free trial. No charge until the trial ends. Cancel anytime.</p>
        <ul>
          <li><Check size={16} /> Calendar, Tasks, Shopping, Chat and Kitchen Watch stay free</li>
          <li><Check size={16} /> Everyone in your household gets access</li>
          <li><Check size={16} /> Change or cancel from Billing</li>
        </ul>
        <PrimaryButton onClick={() => onChoose(feature.id)} disabled={busy}><Sparkles size={17} />{busy ? "Opening secure checkout…" : `Start ${trialDays}-day free trial`}</PrimaryButton>
        <SecondaryButton onClick={onBack}>Not now</SecondaryButton>
        {error && <p className="feature-paywall-error" role="alert">{error}</p>}
      </Card>
    </section>
  );
}
