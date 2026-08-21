export const PRICING_PLAN = {
  plans: [
    {
      id: "core",
      name: "FamOS Core",
      tagline: "Free forever",
      price: { monthly: 0, yearly: 0 },
      membersIncluded: 99,
      additionalMemberPrice: { monthly: 0 },
      featureList: [
        "Shared calendar",
        "Tasks and custom lists",
        "Grocery lists & favourites",
        "Family chat & broadcasts",
        "Kitchen Watch & expiry reminders",
      ],
      isDefault: true,
      isFree: true,
    },
    {
      id: "plus",
      name: "FamOS Plus",
      tagline: "Sync, recipes, and meal planning",
      price: { monthly: 14.99, yearly: 149 },
      featureList: [
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
      tagline: "Everything, with higher limits",
      price: { monthly: 19.99, yearly: 199 },
      featureList: [
        "Everything in Plus",
        "Up to 5 connected calendar accounts",
        "250–300 FamAI queries per month",
        "Higher recipe and product lookup limits",
        "Expanded activity history and insights",
        "Priority support",
        "Future partner benefits and premium integrations",
      ],
      isPopular: true,
    },
  ],
  trial: { days: 30, cardRequired: true, fullFeatureAccess: true },
  get basePlan() { return this.plans[0]; },
  get paidPlans() { return this.plans.slice(1); },
};

export const formatMoney = (value) => `$${Number(value).toFixed(2)}`;
