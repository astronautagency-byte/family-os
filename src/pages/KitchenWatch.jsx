import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChefHat, Croissant, Drumstick, Milk, Minus, Package, Plus, Refrigerator, Search, Snowflake, X, Carrot, Sandwich, Trash2, Clock, Leaf, CalendarClock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import { Avatar } from "../components/ui";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { daysUntilExpiry, toLocalDay, suggestExpiryDate, getSuggestedExpiryDate } from "../lib/inventoryExpiry";
import { categorizeGroceryItem } from "../lib/groceryCategories";
import { isIngredientOnList } from "../lib/mealIngredientCache";
import PullToRefresh from "../components/PullToRefresh";
import PageHeader from "../components/PageHeader";
import { Modal, TextField, DateField, PrimaryButton } from "../components/ui";

export const KITCHEN_WATCH_CATEGORIES = ["Produce", "Deli & Prepared Foods", "Dairy & Eggs", "Meat & Seafood", "Bakery"];

const CATEGORY_ICONS = { Produce: Carrot, "Deli & Prepared Foods": Sandwich, "Dairy & Eggs": Milk, "Meat & Seafood": Drumstick, Bakery: Croissant };
const LOCATION_ICONS = { fridge: Refrigerator, freezer: Snowflake, pantry: Package };
const LOCATION_LABELS = { fridge: "Fridge", freezer: "Freezer", pantry: "Pantry" };
const CATEGORY_COLORS = {
  Produce: { bg: "#E8F5E9", icon: "#2E7D32" },
  "Deli & Prepared Foods": { bg: "#FFF3E0", icon: "#E65100" },
  "Dairy & Eggs": { bg: "#F3E5F5", icon: "#7B1FA2" },
  "Meat & Seafood": { bg: "#FFEBEE", icon: "#C62828" },
  Bakery: { bg: "#FFF8E1", icon: "#F57F17" }
};
const emptyDraft = { name: "", quantity: 1, unit: "", location: "fridge", expiresOn: "", sourceGroceryId: null, category: KITCHEN_WATCH_CATEGORIES[0], brand: "", barcode: "", imageUrl: "" };
const isWatched = (category) => KITCHEN_WATCH_CATEGORIES.includes(category);


function expiryGroup(item) {
  const days = daysUntilExpiry(item.expiresOn);
  if (days === null) return "no-date";
  if (days < 0) return "expired";
  if (days <= 3) return "soon";
  return "later";
}

function expiryLabel(item) {
  const days = daysUntilExpiry(item.expiresOn);
  if (days === null) return null;
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function expiryDateDisplay(expiresOn) {
  const day = toLocalDay(expiresOn);
  if (!day) return expiresOn || "";
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const GROUP_ORDER = ["expired", "soon", "later", "no-date"];
const GROUP_META = {
  expired: { label: "Expired", color: "var(--color-warn)", icon: AlertTriangle },
  soon: { label: "Expiring Soon", color: "#E07C24", icon: Clock },
  later: { label: "Good for Later", color: "var(--color-good)", icon: Leaf },
  "no-date": { label: "Needs Date", color: "var(--color-ink-faint)", icon: Clock },
};

export default function KitchenWatch() {
  const { household, user } = useAuth();
  const { groceries, addGrocery, refreshData, memberById } = useFamily();
  const { items, addItem, updateItem, removeItem } = useKitchenInventory(household?.id, user?.id);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Non-null when the modal is editing an existing item (e.g. "Change date")
  // rather than adding a brand-new one — so save updates instead of duplicating.
  const [editingItemId, setEditingItemId] = useState(null);
  const [expirySuggestion, setExpirySuggestion] = useState(null);

  // Auto-suggest expiry date when name, category, or location changes
  useEffect(() => {
    if (!adding || editingItemId) return;
    const s = suggestExpiryDate(draft.name, draft.category, draft.location);
    setExpirySuggestion(s);
    // Auto-fill the date if the field is still empty and we have a suggestion
    if (s && !draft.expiresOn) {
      const suggested = getSuggestedExpiryDate(draft.name, draft.category, draft.location);
      if (suggested) {
        const yyyy = suggested.getFullYear();
        const mm = String(suggested.getMonth() + 1).padStart(2, "0");
        const dd = String(suggested.getDate()).padStart(2, "0");
        setDraft((c) => ({ ...c, expiresOn: `${yyyy}-${mm}-${dd}` }));
      }
    }
  }, [draft.name, draft.category, draft.location, adding, editingItemId]);

  const watchedItems = useMemo(() => items.filter((item) => isWatched(item.category)), [items]);
  const inventoriedSourceIds = useMemo(() => new Set(items.map((item) => item.sourceGroceryId).filter(Boolean)), [items]);
  const purchaseQueue = useMemo(() => groceries.filter((item) => {
    const category = categorizeGroceryItem(item.name, item.category);
    return item.checked && !inventoriedSourceIds.has(item.id) && isWatched(category);
  }), [groceries, inventoriedSourceIds]);

  const categories = useMemo(() => {
    const cats = new Set(watchedItems.map((i) => i.category).filter(Boolean));
    return ["all", ...Array.from(cats).sort()];
  }, [watchedItems]);

  const filteredItems = useMemo(() => watchedItems
    .filter((item) => `${item.name} ${item.brand || ""} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((item) => activeCategory === "all" || item.category === activeCategory),
    [watchedItems, query, activeCategory]);

  const grouped = useMemo(() => {
    const groups = { expired: [], soon: [], later: [], "no-date": [] };
    for (const item of filteredItems) {
      const group = expiryGroup(item);
      groups[group].push(item);
    }
    for (const key of GROUP_ORDER) {
      groups[key].sort((a, b) => {
        const da = daysUntilExpiry(a.expiresOn);
        const db = daysUntilExpiry(b.expiresOn);
        return (da ?? 999) - (db ?? 999);
      });
    }
    return groups;
  }, [filteredItems]);

  const expiringCount = grouped.expired.length + grouped.soon.length;

  const openDraft = (item = null, nextLocation = "fridge", isEdit = false) => {
    const category = item ? categorizeGroceryItem(item.name, item.category) : KITCHEN_WATCH_CATEGORIES[0];
    setDraft(item ? { ...emptyDraft, name: item.name, quantity: item.quantity || 1, unit: item.unit || "", location: nextLocation, expiresOn: isEdit ? item.expiresOn || "" : "", sourceGroceryId: isEdit ? null : item.id, category: isWatched(category) ? category : KITCHEN_WATCH_CATEGORIES[0], brand: item.brand || "", barcode: item.barcode || "", imageUrl: item.imageUrl || "" } : { ...emptyDraft });
    setEditingItemId(isEdit ? item.id : null);
    setError("");
    setAdding(true);
  };

  const saveItem = async () => {
    if (!draft.name.trim() || !draft.expiresOn || saving) return;
    setSaving(true); setError("");
    try {
      if (editingItemId) {
        // Change-date flow: update the existing item's expiry (and location)
        // instead of adding a new row or bumping the quantity.
        await updateItem(editingItemId, { expiresOn: draft.expiresOn, location: draft.location });
      } else {
        await addItem({ ...draft, name: draft.name.trim() });
      }
      setDraft(emptyDraft); setEditingItemId(null); setAdding(false);
    } catch (saveError) {
      setError(saveError?.message || "This item could not be saved.");
    } finally { setSaving(false); }
  };

  const replaceItem = async (item) => {
    if (isIngredientOnList(item.name, groceries)) return;
    await addGrocery({ name: item.name, category: item.category, quantity: item.quantity || 1, unit: item.unit || "" });
  };

  const handleDelete = async (item) => {
    await removeItem(item.id);
    setConfirmDelete(null);
  };

  return <PullToRefresh onRefresh={refreshData}><div className="kw-page">
    <PageHeader eyebrow="Track what's expiring" title="Kitchen Watch" subtitle="A few taps now can prevent a kitchen-table summit later." illustration="groceries" action={<button type="button" className="kw-add-btn" onClick={() => openDraft()}><Plus size={15}/> Add item</button>} />

    {purchaseQueue.length > 0 && <section className="kw-purchase-queue"><div className="kw-pq-header"><p>From Shopping</p><h2>Put fresh purchases away</h2><small>Add a date so reminders start.</small></div><div className="kw-pq-items">{purchaseQueue.slice(0, 6).map((item) => <article key={item.id} className="kw-pq-item"><span>{item.name}</span><div><button onClick={() => openDraft(item, "fridge")}>Fridge</button><button onClick={() => openDraft(item, "freezer")}>Freezer</button><button onClick={() => openDraft(item, "pantry")}>Pantry</button></div></article>)}</div></section>}

    {expiringCount > 0 && <div className="kw-alert-banner"><AlertTriangle size={16}/> <span>{expiringCount} item{expiringCount === 1 ? "" : "s"} expiring soon</span></div>}

    <section className="kw-search-bar"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your kitchen" aria-label="Search Kitchen Watch"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={13}/></button>}</section>

    <div className="kw-category-tabs">
      {categories.map((cat) => (
        <button
          key={cat}
          className={`kw-category-tab ${activeCategory === cat ? "kw-category-tab--active" : ""}`}
          onClick={() => setActiveCategory(cat)}
        >
          {cat === "all" ? "All" : cat}
        </button>
      ))}
    </div>

    {GROUP_ORDER.map((groupKey) => {
      const items = grouped[groupKey];
      if (!items.length) return null;
      const meta = GROUP_META[groupKey];
      const GroupIcon = meta.icon;
      return <section key={groupKey} className={`kw-group kw-group--${groupKey}`}>
        <div className="kw-group-header" style={{ borderColor: meta.color }}>
          <span className="kw-group-indicator" style={{ backgroundColor: meta.color }}/>
          <h3 style={{ color: meta.color }}>{meta.label}</h3>
          <span className="kw-group-count">({items.length})</span>
        </div>
        <div className="kw-group-items">
          {items.map((item) => {
            const days = daysUntilExpiry(item.expiresOn);
            const CatIcon = CATEGORY_ICONS[item.category] || Package;
            const catColors = CATEGORY_COLORS[item.category] || { bg: "var(--color-surface-sunken)", icon: "var(--color-ink-soft)" };
            const onList = isIngredientOnList(item.name, groceries);
            const isExpired = groupKey === "expired";
            const isSoon = groupKey === "soon";
            const expiryText = days !== null ? (days <= 0 ? "Expired" : days === 0 ? "Expires today" : days === 1 ? "Expires tomorrow" : `Expires in ${days} days`) : null;
            return (
              <article key={item.id} className={`kw-card ${isExpired ? "kw-card--expired" : ""} ${isSoon ? "kw-card--soon" : ""}`}>
                <div className="kw-card-body">
                  <div className="kw-card-left">
                    <div className="kw-card-cat" style={{ background: "transparent", padding: "4px 0" }}>
                      <CatIcon size={14} style={{ color: "var(--color-ink-soft)" }} />
                      <span className="kw-card-cat-label">{item.category}</span>
                    </div>
                    <div className="kw-card-name-row">
                      <h4 className="kw-card-name">{item.name}</h4>
                      {(() => {
                        const adder = memberById[item.addedBy];
                        return adder ? <Avatar member={adder} size="xs" title={`Added by ${adder.name}`} /> : null;
                      })()}
                    </div>
                    {expiryText && (
                      <p className={`kw-card-expiry ${isExpired ? "kw-card-expiry--expired" : ""} ${isSoon ? "kw-card-expiry--soon" : ""}`}>
                        {expiryText}
                      </p>
                    )}
                    {item.expiresOn && (
                      <p className="kw-card-date">
                        <CalendarClock size={12} />
                        {expiryDateDisplay(item.expiresOn)}
                      </p>
                    )}
                    <p className="kw-card-location">
                      {LOCATION_LABELS[item.location] || item.location}
                      {item.quantity > 1 && ` · x${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
                    </p>
                    <div className="kw-card-actions">
                      <button type="button" className="kw-change-date-btn" onClick={() => openDraft(item, item.location, true)}>
                        <CalendarClock size={14}/> Change date
                      </button>
                    </div>
                  </div>
                  <div className="kw-card-right">
                    <button type="button" className="kw-delete-btn" onClick={() => setConfirmDelete(item)} aria-label={`Remove ${item.name}`}><Trash2 size={18}/></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>;
    })}

    {watchedItems.length === 0 && <div className="kw-empty"><Refrigerator size={32}/><h3>Your kitchen is empty</h3><p>Add fresh food to start tracking expiry dates.</p><PrimaryButton onClick={() => openDraft()}>Add your first item</PrimaryButton></div>}

    {watchedItems.length > 0 && filteredItems.length === 0 && query && <div className="kw-empty"><Search size={24}/><p>No items match "{query}"</p></div>}

    <Modal open={adding} onClose={() => { if (!saving) { setAdding(false); setError(""); setEditingItemId(null); } }} title={editingItemId ? "Change date" : "Add fresh food"}>
      <p className="kw-modal-intro">{editingItemId ? "Update when this item needs to be used by." : "Track produce, dairy, meat, bakery, and deli items that can spoil."}</p>
      <TextField label="Item" placeholder="e.g. Milk, chicken, strawberries" value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}/>
      <div className="kw-modal-grid"><label className="kw-select-field"><span>Category</span><select value={draft.category} onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value }))}>{KITCHEN_WATCH_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}</select></label><TextField label="Brand (optional)" placeholder="e.g. Compliments" value={draft.brand} onChange={(e) => setDraft((c) => ({ ...c, brand: e.target.value }))}/></div>
      <div className="kw-modal-grid"><TextField label="Quantity" inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft((c) => ({ ...c, quantity: Math.max(Number(e.target.value) || 1, 1) }))}/><TextField label="Unit (optional)" placeholder="bag, carton, lb" value={draft.unit} onChange={(e) => setDraft((c) => ({ ...c, unit: e.target.value }))}/></div>
      <label className="kw-location-select"><span>Store in</span><div>{[["fridge","Fridge",Refrigerator],["freezer","Freezer",Snowflake],["pantry","Pantry",Package]].map(([id,label,Icon]) => <button type="button" key={id} className={draft.location === id ? "selected" : ""} onClick={() => setDraft((c) => ({ ...c, location: id }))}><Icon size={15}/>{label}</button>)}</div></label>
      <DateField label="Use by or best before" value={draft.expiresOn} onChange={(expiresOn) => setDraft((c) => ({ ...c, expiresOn }))}/>
      {expirySuggestion && !editingItemId && (
        <p className="kw-suggestion-hint">💡 Suggested: {expirySuggestion.label}{draft.expiresOn ? ` (${draft.expiresOn})` : ""}</p>
      )}
      {error && <p className="kw-error" role="alert">{error}</p>}
      <PrimaryButton onClick={saveItem} disabled={saving || !draft.name.trim() || !draft.expiresOn}>{saving ? "Saving…" : editingItemId ? "Save date" : "Start watching"}</PrimaryButton>
    </Modal>

    <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={`Remove ${confirmDelete?.name || ""}?`}>
      <p style={{ fontSize: 12.5, color: "var(--color-ink-soft)", marginBottom: 16 }}>This will stop tracking expiry for this item. You can add it back anytime.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="kw-cancel-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
        <button type="button" className="kw-confirm-delete-btn" onClick={() => handleDelete(confirmDelete)}>Remove</button>
      </div>
    </Modal>
  </div></PullToRefresh>;
}
