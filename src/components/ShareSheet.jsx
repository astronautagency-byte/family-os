import { useState } from "react";
import { Check, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { Modal } from "./ui";
import { nativeShareWithFallback } from "../lib/share";

/**
 * ShareSheet — a modal that lets the user share an item (task, list, event,
 * meal plan, grocery list, …) with another person. The recipient gets a
 * FamOS deep link with a page slug so tapping it opens the right tab.
 *
 * Options:
 *  - Text message (SMS)  — opens the phone's SMS app pre-filled
 *  - Email               — opens the mail app pre-filled
 *  - Copy link           — clipboard fallback
 *  - More options        — the OS-level share sheet (iMessage/WhatsApp/etc.)
 *
 * The preview card shows the image + title + text the recipient will see, so
 * the sharer knows what they're sending before they send it.
 */
export default function ShareSheet({ open, onClose, title = "FamOS", text = "", url = "", image = "", imageAlt = "" }) {
  const [copied, setCopied] = useState(false);
  const combined = [text, url].filter(Boolean).join("\n");

  const smsHref = `sms:?&body=${encodeURIComponent(combined)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(combined)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(combined);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure context etc.) — fall back to the native sheet.
      await nativeShareWithFallback({ title, text, url });
      onClose();
    }
  };

  const moreOptions = async () => {
    await nativeShareWithFallback({ title, text, url });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Share">
      {image && (
        <div className="share-sheet-preview">
          <img src={image} alt={imageAlt || title} loading="lazy" />
        </div>
      )}
      <div className="share-sheet-copy">
        <strong>{title}</strong>
        {text && <p>{text}</p>}
        {url && <span>{url}</span>}
      </div>
      <div className="share-sheet-actions">
        <a className="share-sheet-action" href={smsHref} onClick={onClose} role="button" aria-label="Share by text message">
          <MessageCircle size={18} />
          <span>Text message</span>
        </a>
        <a className="share-sheet-action" href={mailHref} onClick={onClose} role="button" aria-label="Share by email">
          <Mail size={18} />
          <span>Email</span>
        </a>
        <button className="share-sheet-action" type="button" onClick={copyLink} aria-label="Copy share link">
          {copied ? <Check size={18} /> : <Link2 size={18} />}
          <span>{copied ? "Copied!" : "Copy link"}</span>
        </button>
        <button className="share-sheet-action" type="button" onClick={moreOptions} aria-label="More sharing options">
          <Share2 size={18} />
          <span>More options</span>
        </button>
      </div>
    </Modal>
  );
}
