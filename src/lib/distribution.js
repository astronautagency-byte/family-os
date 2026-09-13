import { isTauriRuntime } from "./desktopRuntime";

// Distribution-specific behavior is selected at build time. Also detect the
// native shell at runtime because an authenticated Tauri webview can navigate
// to home.fam-os.app, where the deployed web bundle does not have the build-time
// VITE_DISTRIBUTION value. The ordinary browser/PWA remains unaffected.
export const DISTRIBUTION = import.meta.env.VITE_DISTRIBUTION || "web";
export const IS_IOS_APP_STORE = DISTRIBUTION === "ios-app-store";
export const IS_MAC_APP_STORE = DISTRIBUTION === "mac-app-store";
export const IS_APP_STORE = (
  IS_MAC_APP_STORE
  || IS_IOS_APP_STORE
  || isTauriRuntime()
);
