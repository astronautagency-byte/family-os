// Share helper used by Tasks.jsx, Calendar.jsx, Groceries.jsx.
//
// Uses the OS-level share sheet when navigator.share is supported (iOS
// Safari, Android Chrome, modern desktop browsers) — recipient gets a real
// rich preview via Messages / WhatsApp / Mail / Notes. Falls back to
// clipboard copy so the URL still reaches the recipient.
//
// The recipient lands on `https://fam-os.app/?<type>=<id>` which App.jsx
// parses into a deep link — so tap-to-share turns into tap-to-open in
// FamOS without forcing the recipient to paste a list manually.

export function buildShareUrl(type, id) {
  if (!id) return "";
  const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://fam-os.app";
  return `${origin}/?${type}=${encodeURIComponent(id)}`;
}

// Try the OS share sheet first. If unsupported or cancelled, fall back to
// clipboard with a flash onCopy callback so the caller can show a toast.
export async function nativeShareWithFallback({ title, text, url, onCopy }) {
  const payload = { title, text, url };
  const combined = [text, url].filter(Boolean).join("\n");
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share(payload);
      return { mode: "native" };
    }
  } catch (error) {
    // AbortError from user-cancel is fine — don't surface as a failure.
    if (error?.name !== "AbortError") {
      // Network / permission / not-allowed — fall through to clipboard.
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(combined);
      onCopy?.("Link copied — paste into Messages, email, or Notes.");
      return { mode: "clipboard" };
    } catch {
      // Clipboard API also blocked (e.g. insecure context). Fall through.
    }
  }
  // Last resort: coerce a hidden textarea + execCommand("copy") so the
  // message still reaches the user even in unusual embed contexts.
  try {
    const textarea = document.createElement("textarea");
    textarea.value = combined;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    onCopy?.("Link copied.");
    return { mode: "exec-command" };
  } catch {
    onCopy?.("Could not copy automatically — long-press the message to copy.");
    return { mode: "failed" };
  }
}
