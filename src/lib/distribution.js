// Distribution-specific behavior is selected at build time. The default web,
// PWA, and direct desktop builds keep their existing behavior.
export const DISTRIBUTION = import.meta.env.VITE_DISTRIBUTION || "web";
export const IS_APP_STORE = DISTRIBUTION === "mac-app-store" || DISTRIBUTION === "ios-app-store";

// Kept as an alias so the existing companion-app UI remains a small,
// reviewable change while both Apple platforms share the same purchase-free
// behavior.
export const IS_MAC_APP_STORE = IS_APP_STORE;
