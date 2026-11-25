import { PRICING_PLAN } from './pricingPlan.js';

export const FREE_FEATURES = ["calendar", "tasks", "groceries", "chat", "kitchen"];

export const PLAN_FEATURES = PRICING_PLAN.paidPlans.map(plan => ({
  id: plan.id,
  name: plan.name,
  tagline: `CAD $${plan.price.monthly.toFixed(2)}/month or CAD $${plan.price.yearly}/year`,
  price: plan.price.monthly,
  priceYearly: plan.price.yearly,
  priceCents: Math.round(plan.price.monthly * 100),
  priceYearlyCents: Math.round(plan.price.yearly * 100),
  description: plan.tagline,
  features: plan.featureList,
}));

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
    { name: "Basic manual meal planning", free: true, plus: true, pro: true },
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
