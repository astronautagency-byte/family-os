import { useEffect, useMemo, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "family-os:install-prompt-dismissed:v1";

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

export default function InstallPrompt() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "true");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  const device = useMemo(() => {
    const ua = window.navigator.userAgent || "";
    const iOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return { iOS };
  }, []);

  useEffect(() => {
    if (dismissed || isStandalone()) return undefined;
    if (device.iOS) {
      const timer = window.setTimeout(() => setVisible(true), 1600);
      return () => window.clearTimeout(timer);
    }

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [device.iOS, dismissed]);

  if (!visible || dismissed || isStandalone()) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  return (
    <aside className="install-prompt" role="status">
      <div className="install-prompt-icon"><Share size={18} /></div>
      <div>
        <p>Add FamOS to your iPhone</p>
        <span>{device.iOS ? "Tap Share, then Add to Home Screen for the best notification experience." : "Install FamOS for faster access and a more app-like experience."}</span>
      </div>
      {deferredPrompt && <button className="install-prompt-action" onClick={install}>Install</button>}
      <button className="install-prompt-close" onClick={dismiss} aria-label="Dismiss install prompt"><X size={16} /></button>
    </aside>
  );
}
