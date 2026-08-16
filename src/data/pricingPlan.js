import { PREMIUM_FEATURES } from "./billingCatalog";

export const PRICING_PLAN = {
  plans: [
    {
      id: "free",
      name: "FamOS Free",
      tagline: "The household essentials",
      price: { monthly: 0, yearly: 0 },
      membersIncluded: 99,
      additionalMemberPrice: { monthly: 0 },
      features: ["sharedCalendar", "tasks", "groceries"],
      featureList: ["Shared calendars", "Tasks and custom lists", "Shared shopping lists"],
      isDefault: true,
    },
    ...PREMIUM_FEATURES.map((feature) => ({
      id: feature.id,
      name: feature.name,
      tagline: feature.description,
      price: { monthly: feature.price },
      features: [feature.id],
      featureList: [feature.description],
    })),
  ],
  trial: { days: 0, cardRequired: false, fullFeatureAccess: false, famAiPretoggled: false },
  get basePlan() { return this.plans[0]; },
  get addOns() { return this.plans.slice(1); },
};

export const formatMoney = (value) => `$${Number(value).toFixed(2)}`;
