import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChefHat, Croissant, Drumstick, Milk, Minus, Package, Plus, Refrigerator, Search, Snowflake, X, Carrot, Sandwich, Trash2, Clock, Leaf } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { daysUntilExpiry, inventoryExpiryProgress, toLocalDay } from "../lib/inventoryExpiry";

function shelfLifeColor(daysRemaining) {
  if (daysRemaining <= 0) return "var(--color-warn)";
  if (daysRemaining <= 2) return "#D97706";
  if (daysRemaining <= 5) return "#E07C24";
  return "var(--color-good)";
}

function ShelfLifeRing({ item, size = 56, strokeWidth = 6 }) {
  if (!item.expiresOn) return null;
  const days = daysUntilExpiry(item.expiresOn);
  if (days === null) return null;
  const progress = inventoryExpiryProgress(item);
  if (!progress) return null;
  const color = shelfLifeColor(days);
  const percent = Math.max(0, Math.min(100, progress.percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  
  const label = days <= 0 ? "Expired" : days === 1 ? "1 day" : `${days} days`;
  
  // Gradient ID for the progress ring
  const gradientId = `shelf-life-gradient-${item.id}`;
  
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 8 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.6s ease-out, stroke 0.3s ease",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
          }}
        />
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>
          {days <= 0 ? "Expired" : days === 1 ? "1 day left" : `${days} days left`}
        </div>
        <div style={{ fontSize: 10, color: "var(--color-ink-faint)", marginTop: 2 }}>
          Expires {days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}
        </div>
      </div>
    </div>
  );
}

// Keep backward compatibility
function ShelfLifeBar({ item }) {
  return <ShelfLifeRing item={item} size={56} strokeWidth={6} />;
}
import { categorizeGroceryItem } from "../lib/groceryCategories";
import { isIngredientOnList } from "../lib/mealIngredientCache";
import { Badge, DateField, Modal, PrimaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";

export const KITCHEN_WATCH_CATEGORIES = ["Produce", "Deli & Prepared Foods", "Dairy & Eggs", "Meat & Seafood", "Bakery"];
const CATEGORY_ICONS = { Produce: Carrot, "Deli & Prepared Foods": Sandwich, "Dairy & Eggs": Milk, "Meat & Seafood": Drumstick, Bakery: Croissant };
const LOCATION_ICONS = { fridge: Refrigerator, freezer: Snowflake, pantry: Package };
const LOCATION_LABELS = { fridge: "Fridge", freezer: "Freezer", pantry: "Pantry" };
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
  const { groceries, addGrocery, refreshData } = useFamily();
  const { items, addItem, updateItem, removeItem } = useKitchenInventory(household?.id, user?.id);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const watchedItems = useMemo(() => items.filter((item) => isWatched(item.category)), [items]);
  const inventoriedSourceIds = useMemo(() => new Set(items.map((item) => item.sourceGroceryId).filter(Boolean)), [items]);
  const purchaseQueue = useMemo(() => groceries.filter((item) => {
    const category = categorizeGroceryItem(item.name, item.category);
    return item.checked && !inventoriedSourceIds.has(item.id) && isWatched(category);
  }), [groceries, inventoriedSourceIds]);

  const filteredItems = useMemo(() => watchedItems
    .filter((item) => `${item.name} ${item.brand || ""} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase())),
    [watchedItems, query]);

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

  const openDraft = (item = null, nextLocation = "fridge") => {
    const category = item ? categorizeGroceryItem(item.name, item.category) : KITCHEN_WATCH_CATEGORIES[0];
    setDraft(item ? { ...emptyDraft, name: item.name, quantity: item.quantity || 1, unit: item.unit || "", location: nextLocation, sourceGroceryId: item.id, category: isWatched(category) ? category : KITCHEN_WATCH_CATEGORIES[0], brand: item.brand || "", barcode: item.barcode || "", imageUrl: item.imageUrl || "" } : { ...emptyDraft });
    setError("");
    setAdding(true);
  };

  const saveItem = async () => {
    if (!draft.name.trim() || !draft.expiresOn || saving) return;
    setSaving(true); setError("");
    try {
      await addItem({ ...draft, name: draft.name.trim() });
      setDraft(emptyDraft); setAdding(false);
    } catch (saveError) {
      setError(saveError?.message || "This item could not be added.");
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
    <PageHeader title="Kitchen Watch" subtitle="Track what's in your kitchen and know what to use first." illustration="groceries" action={<button type="button" className="kw-add-btn" onClick={() => openDraft()}><Plus size={15}/> Add item</button>} />

    {purchaseQueue.length > 0 && <section className="kw-purchase-queue"><div className="kw-pq-header"><p>From Shopping</p><h2>Put fresh purchases away</h2><small>Add a date so reminders start.</small></div><div className="kw-pq-items">{purchaseQueue.slice(0, 6).map((item) => <article key={item.id} className="kw-pq-item"><span>{item.name}</span><div><button onClick={() => openDraft(item, "fridge")}>Fridge</button><button onClick={() => openDraft(item, "freezer")}>Freezer</button><button onClick={() => openDraft(item, "pantry")}>Pantry</button></div></article>)}</div></section>}

    {expiringCount > 0 && <div className="kw-alert-banner"><AlertTriangle size={16}/> <span>{expiringCount} item{expiringCount === 1 ? "" : "s"} expiring soon</span></div>}

    <section className="kw-search-bar"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your kitchen" aria-label="Search Kitchen Watch"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={13}/></button>}</section>

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
            const LocIcon = LOCATION_ICONS[item.location] || Package;
            const onList = isIngredientOnList(item.name, groceries);
            const label = expiryLabel(item);
            const isExpired = groupKey === "expired";
            const isSoon = groupKey === "soon";
            return <article key={item.id} className={`kw-item ${isExpired ? "kw-item--expired" : ""} ${isSoon ? "kw-item--soon" : ""}`}>
              <div className="kw-item-left">
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="kw-item-img"/> : <span className="kw-item-icon" style={{ color: meta.color }}><LocIcon size={18}/></span>}
                <div className="kw-item-info">
                  <strong>{item.name}</strong>
                  {item.brand && <small>{item.brand}</small>}
                  <span className="kw-item-meta">
                    <LocIcon size={11}/> {LOCATION_LABELS[item.location] || item.location}
                    {item.quantity > 1 && <span className="kw-item-qty">x{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>}
                  </span>
                </div>
              </div>
              <div className="kw-item-right">
                {label && <span className={`kw-expiry-label ${isExpired ? "kw-expiry-label--expired" : ""} ${isSoon ? "kw-expiry-label--soon" : ""}`}>{label}</span>}
                {item.expiresOn && <span className="kw-expiry-date">{expiryDateDisplay(item.expiresOn)}</span>}
                <ShelfLifeBar item={item} />
                <div className="kw-item-actions">
                  <DateField compact label="" value={item.expiresOn} onChange={(expiresOn) => updateItem(item.id, { expiresOn })}/>
                  <div className="kw-qty-controls">
                    <button type="button" onClick={() => updateItem(item.id, { quantity: Math.max(1, Number(item.quantity || 1) - 1) })} disabled={Number(item.quantity) <= 1}><Minus size={12}/></button>
                    <strong>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</strong>
                    <button type="button" onClick={() => updateItem(item.id, { quantity: Number(item.quantity || 1) + 1 })}><Plus size={12}/></button>
                  </div>
                  {isExpired && <button type="button" className="kw-replace-btn" disabled={onList} onClick={() => replaceItem(item)}><ChefHat size={13}/> {onList ? "On list" : "Replace"}</button>}
                  <button type="button" className="kw-delete-btn" onClick={() => setConfirmDelete(item)} aria-label={`Remove ${item.name}`}><Trash2 size={13}/></button>
                </div>
              </div>
            </article>;
          })}
        </div>
      </section>;
    })}

    {watchedItems.length === 0 && <div className="kw-empty"><Refrigerator size={32}/><h3>Your kitchen is empty</h3><p>Add fresh food to start tracking expiry dates.</p><PrimaryButton onClick={() => openDraft()}>Add your first item</PrimaryButton></div>}

    {watchedItems.length > 0 && filteredItems.length === 0 && query && <div className="kw-empty"><Search size={24}/><p>No items match "{query}"</p></div>}

    <Modal open={adding} onClose={() => { if (!saving) { setAdding(false); setError(""); } }} title="Add fresh food">
      <p className="kw-modal-intro">Track produce, dairy, meat, bakery, and deli items that can spoil.</p>
      <TextField label="Item" placeholder="e.g. Milk, chicken, strawberries" value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}/>
      <div className="kw-modal-grid"><label className="kw-select-field"><span>Category</span><select value={draft.category} onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value }))}>{KITCHEN_WATCH_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}</select></label><TextField label="Brand (optional)" placeholder="e.g. Compliments" value={draft.brand} onChange={(e) => setDraft((c) => ({ ...c, brand: e.target.value }))}/></div>
      <div className="kw-modal-grid"><TextField label="Quantity" inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft((c) => ({ ...c, quantity: Math.max(Number(e.target.value) || 1, 1) }))}/><TextField label="Unit (optional)" placeholder="bag, carton, lb" value={draft.unit} onChange={(e) => setDraft((c) => ({ ...c, unit: e.target.value }))}/></div>
      <label className="kw-location-select"><span>Store in</span><div>{[["fridge","Fridge",Refrigerator],["freezer","Freezer",Snowflake],["pantry","Pantry",Package]].map(([id,label,Icon]) => <button type="button" key={id} className={draft.location === id ? "selected" : ""} onClick={() => setDraft((c) => ({ ...c, location: id }))}><Icon size={15}/>{label}</button>)}</div></label>
      <DateField label="Use by or best before" value={draft.expiresOn} onChange={(expiresOn) => setDraft((c) => ({ ...c, expiresOn }))}/>
      {error && <p className="kw-error" role="alert">{error}</p>}
      <PrimaryButton onClick={saveItem} disabled={saving || !draft.name.trim() || !draft.expiresOn}>{saving ? "Adding…" : "Start watching"}</PrimaryButton>
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
