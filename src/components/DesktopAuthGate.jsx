import { useState } from "react";
import { ExternalLink, LockKeyhole } from "lucide-react";
import { openDesktopSignIn } from "../lib/desktopRuntime";

export default function DesktopAuthGate({ status = "idle", error = "" }) {
  const [opening, setOpening] = useState(false);
  const busy = opening || status === "exchanging";

  const start = async () => {
    if (busy) return;
    setOpening(true);
    try {
      await openDesktopSignIn();
    } catch (nextError) {
      setOpening(false);
      // The app owns the visible state through the callback flow. This local
      // message is only for failures before the browser could open.
      window.dispatchEvent(new CustomEvent("famos:desktop-auth-error", { detail: nextError?.message || "Could not open the FamOS sign-in page." }));
    }
  };

  return (
    <main className="desktop-auth-gate">
      <section className="desktop-auth-card" aria-labelledby="desktop-auth-title">
        <div className="desktop-auth-mark" aria-hidden="true">Fam<span>OS</span></div>
        <p className="desktop-auth-eyebrow">FamOS desktop</p>
        <h1 id="desktop-auth-title">Your family, ready on your bigger screen.</h1>
        <p className="desktop-auth-copy">Sign in securely in your browser. We’ll bring you right back to the FamOS app when you’re done.</p>
        <button type="button" className="desktop-auth-button" onClick={start} disabled={busy}>
          <ExternalLink size={17} />
          {busy ? "Connecting…" : "Continue with FamOS"}
        </button>
        <p className="desktop-auth-note"><LockKeyhole size={13} /> Your sign-in stays protected by FamOS.</p>
        {error && <p className="desktop-auth-error" role="alert">{error}</p>}
        {status === "exchanging" && <p className="desktop-auth-status" role="status">Finishing secure sign-in…</p>}
      </section>
    </main>
  );
}
