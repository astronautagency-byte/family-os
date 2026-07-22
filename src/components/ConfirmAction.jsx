// ConfirmAction — tiered confirmation wrapper around the existing Modal.
//
// Two tiers of friction to defend against accidental destruction:
//   tier="confirm"          → single destructive button. Right for bulk
//                             operations on a contained list (a single
//                             household's active grocery list, etc).
//   tier="type-to-confirm"  → destructive button is disabled until the user
//                             types the exact word in the input. Right for
//                             cross-data-type or account-scope wipes
//                             (reset demo data, clear chat history, remove a
//                             household member) where the user MUST read a
//                             warning to know the impact.
//
// Built on the existing `Modal` primitive so Close behaviours (Escape key,
// scrim click, focus management) keep working without re-implementation.
import { useEffect, useState } from "react";
import { Modal, PrimaryButton, SecondaryButton, TextField } from "./ui";

// Reset the typed input when the modal closes so opening it fresh always
// requires retyping the word on each confirmation round.
const RESET_TYPED = "";

export default function ConfirmAction({
  open,
  onClose,
  onConfirm,
  title,
  copy,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  busyLabel = "Working…",
  // Either: tier="confirm" | tier="type-to-confirm".
  // For type-to-confirm, also pass `word` (the matched literal).
  tier = "confirm",
  word = "",
  // Optional ordinal to surface in the destructive button label without
  // re-deriving in the consumer (e.g. "Clear 7 checked").
  count = null,
}) {
  const [typed, setTyped] = useState(RESET_TYPED);

  // Reset the typed word every time the modal opens. Stops the destructive
  // button from staying armed across opens of the same page — keystrokes
  // during a canceled round should NOT carry over to the next one.
  useEffect(() => {
    if (!open) return;
    setTyped(RESET_TYPED);
  }, [open]);

  // Match against `word` case-insensitively + tolerate trailing whitespace
  // so a user typing "RESET " or "reset" still arms the button.
  const wordMatches = tier !== "type-to-confirm" || typed.trim().toUpperCase() === String(word || "").trim().toUpperCase();
  const labelWithCount = count != null && confirmLabel?.includes("%d")
    ? confirmLabel.replace("%d", String(count))
    : confirmLabel;

  const handleConfirm = async () => {
    if (busy) return;
    if (tier === "type-to-confirm" && !wordMatches) return;
    try {
      await onConfirm();
    } catch (error) {
      // Caller surfaces the error itself (via toast / state). We don't close
      // automatically so the user can react.
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      {copy && <p className="confirm-action-copy">{copy}</p>}
      {tier === "type-to-confirm" && (
        <div className="confirm-action-typed-block">
          <TextField
            label={<>Type <strong className="confirm-action-typed-token">{word}</strong> to confirm</>}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck="false"
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !wordMatches || busy) return;
              event.preventDefault();
              handleConfirm();
            }}
            placeholder={`Type ${word}`}
          />
          <small className="confirm-action-typed-hint">
            Capitalisation doesn't matter. {word} exactly.
          </small>
        </div>
      )}
      <div className="confirm-action-actions">
        <SecondaryButton onClick={busy ? () => {} : onClose} disabled={busy}>
          {cancelLabel}
        </SecondaryButton>
        <PrimaryButton
          className="confirm-destructive-action"
          onClick={handleConfirm}
          disabled={busy || (tier === "type-to-confirm" && !wordMatches)}
        >
          {busy ? busyLabel : labelWithCount}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
