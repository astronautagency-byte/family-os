import { Check, LockKeyhole, Sparkles } from "lucide-react";
import { PREMIUM_FEATURES, featureById } from "../data/billingCatalog";
import { Card, PrimaryButton, SecondaryButton } from "./ui";

export default function FeaturePaywall({ featureId, onChoose, onBack, busy = false, error = "" }) {
  const feature = featureById(featureId) || PREMIUM_FEATURES[0];
  return (
    <section className="feature-paywall" aria-labelledby="feature-paywall-title">
      <Card className="feature-paywall-card">
        <div className="feature-paywall-icon"><LockKeyhole size={24} /></div>
        <p className="feature-paywall-eyebrow">Optional FamOS extra</p>
        <h1 id="feature-paywall-title">Add {feature.name}</h1>
        <p>{feature.description}</p>
        <div className="feature-paywall-price"><strong>$4.99</strong><span>CAD / month · for your whole household</span></div>
        <ul>
          <li><Check size={16} /> Calendar, Tasks, Shopping, Chat and Kitchen Watch stay free</li>
          <li><Check size={16} /> Everyone in your household gets access</li>
          <li><Check size={16} /> Change or cancel from Billing</li>
        </ul>
        <PrimaryButton onClick={() => onChoose(feature.id)} disabled={busy}><Sparkles size={17} />{busy ? "Opening secure checkout…" : `Add ${feature.name}`}</PrimaryButton>
        <SecondaryButton onClick={onBack}>Not now</SecondaryButton>
        {error && <p className="feature-paywall-error" role="alert">{error}</p>}
      </Card>
    </section>
  );
}
