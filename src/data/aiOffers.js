// Approved household launch prices. Checkout remains gated until billing is ready.
export const AI_OFFERS = [
  {
    id: 'chat',
    name: 'AI Chat',
    priceMonthly: 4.99,
    currency: 'USD',
    copy: 'For the ideas worth talking through.',
    features: ['Text conversations & helpful suggestions', 'Meal, task and shopping plans', 'Review before anything is saved'],
  },
  {
    id: 'voice',
    name: 'Mia Voice',
    priceMonthly: 7.99,
    currency: 'USD',
    copy: 'For the moments your hands are full.',
    features: ['Natural, expressive AI voice', 'Follow-up conversations', 'Spoken confirmation before saving'],
  },
  {
    id: 'both',
    name: 'Chat + Voice',
    priceMonthly: 9.99,
    currency: 'USD',
    copy: 'Your home assistant. Both ways.',
    features: ['Everything in AI Chat', 'Everything in Mia Voice', 'One household, your choice'],
  },
];
