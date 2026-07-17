export const PRICING_PLAN = {
  basePlan: {
    price: { monthly: 6.99, yearly: 67 },
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
  },
  addOns: [
    {
      id: "fam_ai",
      label: "Fam AI",
      price: { monthly: 4.99 },
      queryCapPerMonth: 100,
      defaultEnabledInTrial: true,
    },
  ],
  trial: {
    days: 30,
    cardRequired: true,
    fullFeatureAccess: true,
    famAiPretoggled: true,
  },
};

export const formatMoney = (value) => `$${Number(value).toFixed(2)}`;
