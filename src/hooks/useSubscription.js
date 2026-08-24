// useSubscription — fetches the household's subscription status and provides
// feature gating helpers. Returns subscription data and a hasFeature() check.
//
// Usage:
//   const { subscription, hasFeature, isPro, isPlus, isTrial, trialDaysLeft } = useSubscription();
//   if (!hasFeature("famai")) return <FeaturePaywall featureId="plus" />;

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { FREE_FEATURES } from "../data/billingCatalog";

// Features that require a paid plan (Plus or Pro)
const PAID_FEATURES = {
  famai: { minPlan: "plus", label: "Fam AI" },
  calendar_sync: { minPlan: "plus", label: "Calendar Sync" },
  recipes: { minPlan: "plus", label: "Recipes & Meal Planning" },
  cook_mode: { minPlan: "plus", label: "Cook Mode" },
  meal_planning: { minPlan: "plus", label: "Meal Planning" },
  barcode_enrichment: { minPlan: "plus", label: "Product Enrichment" },
  smart_capture: { minPlan: "plus", label: "Smart Capture" },
  automations: { minPlan: "plus", label: "Household Automations" },
};

const PLAN_RANK = { core: 0, free: 0, plus: 1, pro: 2 };

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_my_subscription").then(({ data, error }) => {
      if (!cancelled) {
        setSubscription(!error && data?.[0] ? data[0] : null);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const planKey = subscription?.plan_key || "core";
  const status = subscription?.status || "none";
  const planRank = PLAN_RANK[planKey] ?? 0;

  const isTrial = status === "trial" || status === "trialing";
  const isActive = status === "active" || isTrial;
  const isPlus = planRank >= 1 && isActive;
  const isPro = planRank >= 2 && isActive;

  const trialDaysLeft = isTrial && subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null;

  const isTrialExpired = isTrial && trialDaysLeft !== null && trialDaysLeft === 0;

  // hasFeature returns true if the user's current plan includes the feature.
  const hasFeature = useCallback((featureKey) => {
    // Free features are always available
    if (FREE_FEATURES.includes(featureKey)) return true;
    // Check if the feature requires a paid plan
    const required = PAID_FEATURES[featureKey];
    if (!required) return true; // unknown features are allowed
    // User must have an active paid plan (trial counts)
    return isActive && planRank >= (PLAN_RANK[required.minPlan] ?? 1);
  }, [isActive, planRank]);

  return {
    subscription,
    loading,
    planKey,
    status,
    isTrial,
    isActive,
    isPlus,
    isPro,
    trialDaysLeft,
    isTrialExpired,
    hasFeature,
    PAID_FEATURES,
  };
}

export { PAID_FEATURES };
