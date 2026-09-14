import { useState } from "react";
import { Check, Clock3, Plus, X } from "./icons";
import GroceryIllustration from "./GroceryIllustration";

export function FocusShoppingItem({ item, memberById, onToggle, onUpdateExpiry }) {
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [expiryDraft, setExpiryDraft] = useState(item.expiresOn || "");

  const saveExpiry = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!expiryDraft) return;
    try {
      await onUpdateExpiry(item.id, expiryDraft);
    } catch (err) {
      console.error("Failed to save expiry", err);
    }
    setEditingExpiry(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") saveExpiry(e);
    if (e.key === "Escape") setEditingExpiry(false);
  };

  const qtyLabel = [item.quantity > 1 || item.unit ? item.quantity : null, item.unit].filter(Boolean).join(" ");

  return (
    <div key={item.id} className={`focus-shopping-item ${item.checked ? "is-checked" : ""}`}>
      <button className="focus-shopping-toggle" onClick={() => onToggle(item)}>
        <span className="focus-shopping-check" aria-hidden="true">{item.checked ? "✓" : ""}</span>
        <GroceryIllustration name={item.name} category={item.category} size={48} />
        <span className="focus-shopping-copy"><strong>{item.name}</strong><small>{item.category}{qtyLabel ? ` · ${qtyLabel}` : ""}{item.brand ? ` · ${item.brand}` : ""}{item.preferredStore ? ` · Buy at ${item.preferredStore}` : ""}</small></span>
      </button>
      <div className="focus-shopping-expiry">
        {editingExpiry ? (
          <form onSubmit={saveExpiry} className="focus-expiry-form">
            <input
              type="date"
              value={expiryDraft}
              onChange={(e) => setExpiryDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="focus-expiry-input"
              aria-label="Set expiry date"
            />
            <button type="submit" className="focus-expiry-save" aria-label="Save expiry"><Check size={14} /></button>
            <button type="button" onClick={() => setEditingExpiry(false)} className="focus-expiry-cancel" aria-label="Cancel"><X size={14} /></button>
          </form>
        ) : (
          <button
            type="button"
            className={`focus-expiry-btn ${item.expiresOn ? "has-date" : ""}`}
            onClick={(e) => { e.stopPropagation(); setEditingExpiry(true); setExpiryDraft(item.expiresOn || ""); }}
            aria-label={item.expiresOn ? `Edit expiry: ${item.expiresOn}` : "Add expiry date"}
          >
            {item.expiresOn ? (
              <>
                <Clock3 size={13} />
                <span>{new Date(item.expiresOn + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </>
            ) : (
              <>
                <Plus size={13} />
                <span>Add expiry</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
