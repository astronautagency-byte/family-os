export function checkoutOffer(input: { onboarding?: boolean; feature?: string; billing?: string }) {
  const onboarding = input.onboarding === true;
  return {
    onboarding,
    feature: onboarding ? "pro" : input.feature === "plus" ? "plus" : "pro",
    billing: input.billing === "yearly" || input.billing === "annual" ? "yearly" : "monthly",
    trial: onboarding ? {trial_period_days:7, trial_settings:{end_behavior:{missing_payment_method:"cancel" as const}}} : {},
  } as const;
}
