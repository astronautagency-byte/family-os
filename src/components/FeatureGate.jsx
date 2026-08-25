// FeatureGate — wraps a feature area and shows the paywall when the user
// doesn't have entitlement for it. Usage:
//
//   <FeatureGate feature="fam_ai" entitlements={entitlements} onUpgrade={startFeatureCheckout}>
//     <FamAI ... />
//   </FeatureGate>

import FeaturePaywall from "./FeaturePaywall";

// Maps feature keys from get_my_entitlements to billingCatalog plan IDs
const FEATURE_TO_PLAN = {
  fam_ai: "pro",
  meals: "pro",
  calendar_sync: "pro",
  groceries_enriched: "pro",
};

export default function FeatureGate({ feature, entitlements, onUpgrade, busy = false, error = "", children }) {
  const hasAccess = entitlements?.features?.[feature] !== false;

  if (hasAccess) return children;

  const planId = FEATURE_TO_PLAN[feature] || "pro";

  return (
    <FeaturePaywall
      featureId={planId}
      onChoose={onUpgrade}
      onBack={() => onUpgrade(null)}
      busy={busy}
      error={error}
    />
  );
}
