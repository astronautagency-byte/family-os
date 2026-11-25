import { Check, LockKeyhole } from "./icons";
import { PREMIUM_FEATURES, featureById } from "../data/billingCatalog";
import { Card, SecondaryButton } from "./ui";

export default function FeaturePaywall({ featureId, onBack }) {
  const feature = featureById(featureId) || PREMIUM_FEATURES[0];
    return (
      <section className="feature-paywall" aria-labelledby="feature-paywall-title">
        <Card className="feature-paywall-card">
          <div className="feature-paywall-icon"><LockKeyhole size={24} /></div>
          <p className="feature-paywall-eyebrow">FamOS {feature.name.replace("FamOS ", "")}</p>
          <h1 id="feature-paywall-title">This feature is not included in your current access</h1>
          <p className="feature-paywall-tagline">FamOS Core includes shared calendars, tasks, shopping lists and family messaging at no charge.</p>
          <ul>
            <li><Check size={16} /> Calendar, Tasks, Shopping, Chat and Kitchen Watch remain available</li>
            <li><Check size={16} /> No purchase or subscription is required</li>
          </ul>
          <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        </Card>
      </section>
    );
}
