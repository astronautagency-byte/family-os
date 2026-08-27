import { useState, useEffect, lazy, Suspense } from "react";
import { Check, Clock3, Plus, X } from "lucide-react";
import { Package } from "lucide-react";

const CATEGORY_ICONS = {
  Produce: "🥬",
  Bakery: "🍞",
  "Deli & Prepared Foods": "🥪",
  "Dairy & Eggs": "🥛",
  "Meat & Seafood": "🥩",
  "Breakfast & Cereal": "☕",
  Pantry: "🌾",
  "Canned & Jarred": "🥫",
  "Pasta, Rice & Grains": "🌾",
  "Condiments & Sauces": "🫙",
  "Spices & Baking": "🧂",
  "Snacks & Candy": "🍪",
  Beverages: "🥤",
  "International Foods": "🌍",
  Frozen: "🧊",
  "Beer, Wine & Spirits": "🍷",
  "Health & Personal Care": "💊",
  Baby: "👶",
  "Pet Supplies": "🐾",
  "Household & Cleaning": "🧴",
  "Paper & Disposable": "🧻",
  Household: "🧹",
  Other: "📦",
};

const CATEGORY_ICON_COLORS = {
  Produce: ['#DDF7E9', '#228766'],
  Bakery: ['#FFF0D4', '#C76E22'],
  'Dairy & Eggs': ['#E1F0FF', '#397BCB'],
  'Meat & Seafood': ['#FFE2E6', '#D64C5C'],
  Frozen: ['#E2F6FF', '#3185A8'],
  'Snacks & Candy': ['#FFE2EF', '#C64882'],
  Beverages: ['#EEE9FF', '#7255D9'],
  'Household & Cleaning': ['#E7F3FF', '#356FA8'],
  Baby: ['#FFF2B8', '#A97900'],
  'Pet Supplies': ['#FFE8D9', '#B86332'],
};

function FocusCategoryIcon({ category, size = 20 }) {
  const [bg, fg] = CATEGORY_ICON_COLORS[category] || ['#F0E9FF', '#7255D9'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size + 12, height: size + 12, borderRadius: 10, backgroundColor: bg, flexShrink: 0 }}>
      <span style={{ fontSize: size }}>{CATEGORY_ICONS[category] || '📦'}</span>
    </span>
  );
}

function GroceryItemImage({ item, focus = false }) {
  const [failed, setFailed] = useState(false);
  const src = item.photoUrl || item.imageUrl || "";
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return <FocusCategoryIcon category={item.category} size={focus ? 22 : 16} />;
  }
  const size = focus ? 48 : 34;
  const radius = focus ? 11 : 9;
  return (
    <span className={`grocery-photo-thumb ${focus ? "grocery-photo-thumb-focus" : "grocery-photo-thumb-list"}`} role="img" aria-label={`Photo of ${item.name}`} style={{ position: "relative", display: "grid", placeItems: "center", width: size, height: size, borderRadius: radius, border: "none", overflow: "hidden", flex: "0 0 auto", background: "var(--color-accent-soft)" }}>
      <img src={src} alt="" onError={() => setFailed(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
    </span>
  );
}

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
        <GroceryItemImage item={item} memberById={memberById} focus />
        <span className="focus-shopping-copy"><strong>{item.name}</strong><small>{item.category}{qtyLabel ? ` · ${qtyLabel}` : ""}{item.brand ? ` · ${item.brand}` : ""}</small></span>
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