export const FREE_FEATURES = ["calendar", "tasks", "groceries", "chat", "kitchen"];

export const PREMIUM_FEATURES = [
  { id: "meals", name: "Meal planning", description: "Meal ideas, recipe saving, planning and Cook Mode." },
  { id: "fam_ai", name: "FamAI", description: "Review-first help with plans, meals, lists and schedules." },
  { id: "family", name: "Family tools", description: "Profiles, roles, requests, routines and rewards." },
].map((feature) => ({ ...feature, price: 4.99, priceCents: 499 }));

export const ALL_FEATURE_IDS = [...FREE_FEATURES, ...PREMIUM_FEATURES.map(({ id }) => id)];
export const PREMIUM_FEATURE_IDS = PREMIUM_FEATURES.map(({ id }) => id);
export const featureById = (id) => PREMIUM_FEATURES.find((feature) => feature.id === id);
