export const FREE_FEATURES = ["calendar", "tasks", "groceries", "chat", "kitchen"];

export const PLAN_FEATURES = [
  {
    id: "plus",
    name: "FamOS Plus",
    tagline: "$14.99/month or $149/year",
    price: 14.99,
    priceYearly: 149,
    priceCents: 1499,
    priceYearlyCents: 14900,
    description: "Calendar sync, recipes, meal planning, kitchen suggestions, product lookup, smart capture, automations, and 75–100 FamAI queries/month.",
    features: [
      "Google & Outlook two-way calendar sync",
      "Recipe discovery, meal planning, and Cook Mode",
      "Kitchen inventory meal suggestions",
      "Product and barcode enrichment",
      "Places-powered event details",
      "Smart Capture and household automations",
      "75–100 FamAI queries per month",
    ],
  },
  {
    id: "pro",
    name: "FamOS Pro",
    tagline: "$19.99/month or $199/year",
    price: 19.99,
    priceYearly: 199,
    priceCents: 1999,
    priceYearlyCents: 19900,
    description: "Everything in Plus with higher limits, more calendars, priority support, and future premium integrations.",
    features: [
      "Everything in Plus",
      "Up to 5 connected calendar accounts",
      "250–300 FamAI queries per month",
      "Higher recipe and product lookup limits",
      "Expanded activity history and insights",
      "Priority support",
      "Future partner benefits and premium integrations",
    ],
  },
];

export const PREMIUM_FEATURES = PLAN_FEATURES.map((plan) => ({
  id: plan.id,
  name: plan.name,
  description: plan.tagline,
  price: plan.price,
  priceCents: plan.priceCents,
}));

export const ALL_FEATURE_IDS = [...FREE_FEATURES, ...PLAN_FEATURES.map(({ id }) => id)];
export const PREMIUM_FEATURE_IDS = PLAN_FEATURES.map(({ id }) => id);
export const featureById = (id) => PLAN_FEATURES.find((plan) => plan.id === id);
