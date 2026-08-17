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

export const FEATURE_COMPARISON = [
  { category: "Core Tools", features: [
    { name: "Shared calendar", free: true, plus: true, pro: true },
    { name: "Tasks & custom lists", free: true, plus: true, pro: true },
    { name: "Shared shopping lists", free: true, plus: true, pro: true },
    { name: "Family chat", free: true, plus: true, pro: true },
    { name: "Kitchen Watch (expiry tracker)", free: true, plus: true, pro: true },
  ]},
  { category: "Calendar", features: [
    { name: "Google two-way sync", free: false, plus: true, pro: true },
    { name: "Outlook two-way sync", free: false, plus: true, pro: true },
    { name: "Connected calendar accounts", free: "—", plus: "2", pro: "5" },
    { name: "Places-powered event details", free: false, plus: true, pro: true },
  ]},
  { category: "Meals & Recipes", features: [
    { name: "Recipe discovery", free: false, plus: true, pro: true },
    { name: "Meal planning", free: false, plus: true, pro: true },
    { name: "Cook Mode", free: false, plus: true, pro: true },
    { name: "Kitchen inventory suggestions", free: false, plus: true, pro: true },
  ]},
  { category: "Shopping", features: [
    { name: "Barcode scanning", free: true, plus: true, pro: true },
    { name: "Product & barcode enrichment", free: false, plus: true, pro: true },
    { name: "Focus Shop mode", free: false, plus: true, pro: true },
  ]},
  { category: "FamAI & Automation", features: [
    { name: "FamAI queries per month", free: "3", plus: "75–100", pro: "250–300" },
    { name: "Smart Capture", free: false, plus: true, pro: true },
    { name: "Household automations", free: false, plus: true, pro: true },
  ]},
  { category: "Support & Extras", features: [
    { name: "Activity history", free: "7 days", plus: "30 days", pro: "90 days" },
    { name: "Priority support", free: false, plus: false, pro: true },
    { name: "Future partner benefits", free: false, plus: false, pro: true },
  ]},
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
