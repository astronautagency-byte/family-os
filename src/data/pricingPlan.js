export const PRICING_PLAN = {
  /* ── Plans ── */
  plans: [
    {
      id: "core",
      name: "Core",
      tagline: "Everything a household needs",
      price: { monthly: 11.98, yearly: 119 },
      membersIncluded: 2,
      additionalMemberPrice: { monthly: 2.99 },
      features: [
        "sharedCalendar",
        "meals",
        "tasks",
        "groceries",
        "chat",
        "financePlanning",
        "privateHousehold",
        "multipleGoogleCalendars",
        "familyMemberRoles",
        "rewardsAndPoints",
      ],
      featureList: [
        "Shared calendar with Google sync",
        "Meal planning & cook mode",
        "Grocery lists & favourites",
        "Task assignment & rewards",
        "Family chat",
        "Finance tracking & budgets",
        "Roles & dietary preferences",
      ],
      isDefault: true,
    },
    {
      id: "smart_bundle",
      name: "Smart Family Bundle",
      tagline: "The practical upgrade",
      price: { monthly: 9.99 },
      features: ["localEvents", "productScanner", "extraCalendar"],
      featureList: [
        "Local event discovery",
        "Product & barcode scanner",
        "Extra connected calendar",
      ],
      description: "Save vs. adding each feature separately.",
      savingsNote: "$2.98 less than buying individually",
    },
    {
      id: "fam_ai",
      name: "Fam AI",
      tagline: "Your family assistant",
      price: { monthly: 5.99 },
      queryCapPerMonth: 100,
      features: ["famAI"],
      featureList: [
        "100 smart requests per month",
        "Meal ideas from your groceries",
        "Task plans from your calendar",
        "Always asks before changing anything",
      ],
      description: "Standalone — the clearest FamOS differentiator.",
      defaultEnabledInTrial: true,
    },
  ],

  /* ── Trial ── */
  trial: {
    days: 30,
    cardRequired: true,
    fullFeatureAccess: true,
    famAiPretoggled: true,
  },

  /* ── Backward-compat getters (kept so existing imports don't break) ── */
  get basePlan() {
    return this.plans.find((p) => p.id === "core");
  },
  get addOns() {
    return this.plans.filter((p) => p.id !== "core");
  },
};

export const formatMoney = (value) => `$${Number(value).toFixed(2)}`;
