import { useMemo, useState } from "react";
import { Check, Clock3, Croissant, Drumstick, HeartPulse, Milk, Minus, Package, Plus, Refrigerator, RotateCcw, Search, Snowflake, Sparkles, Store, X, Carrot, Sandwich } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { inventoryExpiryProgress, inventoryExpiryStatus } from "../lib/inventoryExpiry";
import { categorizeGroceryItem } from "../lib/groceryCategories";
import { isIngredientOnList } from "../lib/mealIngredientCache";
import { todayISO } from "../lib/dates";
import { DateField, Modal, PrimaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";

export const KITCHEN_WATCH_CATEGORIES = ["Produce", "Deli & Prepared Foods", "Dairy & Eggs", "Meat & Seafood", "Bakery"];
const CATEGORY_ICONS = { Produce: Carrot, "Deli & Prepared Foods": Sandwich, "Dairy & Eggs": Milk, "Meat & Seafood": Drumstick, Bakery: Croissant };
const emptyDraft = { name: "", quantity: 1, unit: "", location: "fridge", expiresOn: "", sourceGroceryId: null, category: KITCHEN_WATCH_CATEGORIES[0], brand: "", barcode: "", imageUrl: "" };
const isWatched = (category) => KITCHEN_WATCH_CATEGORIES.includes(category);

function FreshItemIcon({ category }) {
  const Icon = CATEGORY_ICONS[category] || Refrigerator;
  return <span className="kitchen-watch-item-icon"><Icon size={17} /></span>;
}

export default function KitchenWatch({ goTo }) {
  const { household, user } = useAuth();
  const { groceries, addGrocery, refreshData } = useFamily();
  const { items, addItem, updateItem, removeItem } = useKitchenInventory(household?.id, user?.id);
  const [location, setLocation] = useState("fridge");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(emptyDraft);

  const watchedItems = useMemo(() => items.filter((item) => isWatched(item.category)), [items]);
  const inventoriedSourceIds = useMemo(() => new Set(items.map((item) => item.sourceGroceryId).filter(Boolean)), [items]);
  const purchaseQueue = useMemo(() => groceries.filter((item) => {
    const category = categorizeGroceryItem(item.name, item.category);
    return item.checked && !inventoriedSourceIds.has(item.id) && isWatched(category);
  }), [groceries, inventoriedSourceIds]);
  const pulse = useMemo(() => watchedItems.reduce((summary, item) => {
    const expiry = inventoryExpiryStatus(item);
    if (expiry?.state === "expired") summary.expired += 1;
    else if (expiry) summary.soon += 1;
    return summary;
  }, { expired: 0, soon: 0 }), [watchedItems]);
  const priorityItems = useMemo(() => watchedItems
    .map((item) => ({ item, expiry: inventoryExpiryStatus(item) }))
    .filter(({ expiry }) => expiry)
    .sort((left, right) => left.expiry.urgency - right.expiry.urgency)
    .slice(0, 5), [watchedItems]);
  const visibleItems = useMemo(() => watchedItems
    .filter((item) => item.location === location)
    .filter((item) => `${item.name} ${item.brand || ""} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((item) => {
      const expiry = inventoryExpiryStatus(item);
      if (status === "use-soon") return expiry && expiry.state !== "expired";
      if (status === "expired") return expiry?.state === "expired";
      if (status === "no-date") return !item.expiresOn;
      return true;
    })
    .sort((left, right) => (inventoryExpiryStatus(left)?.urgency ?? 99) - (inventoryExpiryStatus(right)?.urgency ?? 99)), [watchedItems, location, query, status]);

  const openDraft = (item = null, nextLocation = location) => {
    const category = item ? categorizeGroceryItem(item.name, item.category) : KITCHEN_WATCH_CATEGORIES[0];
    setDraft(item ? { ...emptyDraft, name: item.name, quantity: item.quantity || 1, unit: item.unit || "", location: nextLocation, sourceGroceryId: item.id, category: isWatched(category) ? category : KITCHEN_WATCH_CATEGORIES[0], brand: item.brand || "", barcode: item.barcode || "", imageUrl: item.imageUrl || "" } : { ...emptyDraft, location: nextLocation });
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
  const findMealIdeas = () => {
    window.sessionStorage.setItem("famos:meal-ideas-intent:v1", JSON.stringify({ date: todayISO(), slot: "dinner", kitchenOnly: true }));
    goTo?.("meals");
  };

  return <PullToRefresh onRefresh={refreshData}><div className="pb-24 kitchen-watch-page">
    <PageHeader title="Kitchen Watch" subtitle="Know what to use first, what has expired, and what needs replacing." illustration="groceries" action={<button type="button" className="inventory-add-button" onClick={() => openDraft()}><Plus size={15}/> Add fresh item</button>} />
    <section className="kitchen-watch-overview" aria-label="Kitchen Watch summary">
      <div className="inventory-pulse">
        <div className={pulse.expired ? "urgent" : ""}><span><Clock3 size={15}/></span><strong>{pulse.expired}</strong><small>Expired</small></div>
        <div className={pulse.soon ? "soon" : ""}><span><HeartPulse size={15}/></span><strong>{pulse.soon}</strong><small>Use soon</small></div>
        <div><span><Refrigerator size={15}/></span><strong>{watchedItems.length}</strong><small>Being watched</small></div>
      </div>
      {priorityItems.length > 0 ? <div className="inventory-use-first"><div><span><Clock3 size={15}/></span><div><strong>Use first</strong><small>Your shortest freshness window.</small></div></div><div>{priorityItems.map(({ item, expiry }) => <button type="button" key={item.id} onClick={() => { setLocation(item.location); setStatus(expiry.state === "expired" ? "expired" : "use-soon"); setQuery(item.name); }}><span>{item.name}</span><em>{expiry.label}</em></button>)}</div></div> : <div className="kitchen-watch-calm"><Check size={16}/><span><strong>Nothing needs attention</strong><small>Freshness reminders will appear here.</small></span></div>}
      {watchedItems.length > 0 && <div className="inventory-meal-ideas"><span><Sparkles size={16}/></span><div><strong>Cook before it turns</strong><small>Find meal ideas using the fresh food already at home.</small></div><button type="button" onClick={findMealIdeas}>Find meal ideas</button></div>}
    </section>

    {purchaseQueue.length > 0 && <section className="kitchen-watch-review"><div><p>From Shopping</p><h2>Put fresh purchases away</h2><small>Add a date now so reminders start immediately.</small></div><div>{purchaseQueue.slice(0, 6).map((item) => <article key={item.id}><span>{item.name}</span><div><button onClick={() => openDraft(item, "fridge")}>Fridge</button><button onClick={() => openDraft(item, "freezer")}>Freezer</button><button onClick={() => openDraft(item, "pantry")}>Pantry</button></div></article>)}</div></section>}

    <section className="kitchen-inventory-card" aria-labelledby="kitchen-watch-items-title">
      <header><span className="kitchen-inventory-mark"><Refrigerator size={20}/></span><div><p>Fresh food</p><h2 id="kitchen-watch-items-title">What’s at home</h2><small>Only short-life perishables are tracked here.</small></div></header>
      <div className="inventory-tools"><label className="inventory-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fresh food" aria-label="Search Kitchen Watch"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={13}/></button>}</label><div className="inventory-status-filter" role="group" aria-label="Filter by expiry">{[["all","All"],["use-soon","Use soon"],["expired","Expired"],["no-date","Needs date"]].map(([id,label]) => <button type="button" key={id} className={status === id ? "selected" : ""} onClick={() => setStatus(id)}>{label}</button>)}</div></div>
      <div className="inventory-location-tabs" role="tablist" aria-label="Storage location">{[["fridge","Fridge",Refrigerator],["freezer","Freezer",Snowflake],["pantry","Pantry",Package]].map(([id,label,Icon]) => <button key={id} className={location === id ? "selected" : ""} onClick={() => setLocation(id)} role="tab" aria-selected={location === id}><Icon size={14}/>{label}<span>{watchedItems.filter((item) => item.location === id).length}</span></button>)}</div>
      {visibleItems.length ? <div className="inventory-item-grid">{visibleItems.map((item) => { const expiry = inventoryExpiryStatus(item); const progress = inventoryExpiryProgress(item); const onList = isIngredientOnList(item.name, groceries); return <article key={item.id} className={expiry ? `is-${expiry.state}` : ""}><div className="inventory-item-copy">{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <FreshItemIcon category={item.category}/>}<div><span>{item.category}</span><strong>{item.name}</strong>{item.brand && <small>{item.brand}</small>}{expiry && <em>{expiry.label}</em>}{progress && <div className="inventory-expiry-progress"><span><i style={{ width: `${progress.percent}%` }}/></span><small>{progress.remainingPercent}% freshness left</small></div>}</div></div><DateField compact label="Use by" value={item.expiresOn} onChange={(expiresOn) => updateItem(item.id, { expiresOn })}/><div className="inventory-item-actions"><div className="inventory-quantity"><button type="button" onClick={() => updateItem(item.id, { quantity: Math.max(1, Number(item.quantity || 1) - 1) })} disabled={Number(item.quantity) <= 1}><Minus size={12}/></button><strong>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</strong><button type="button" onClick={() => updateItem(item.id, { quantity: Number(item.quantity || 1) + 1 })}><Plus size={12}/></button></div>{expiry?.state === "expired" && <button type="button" disabled={onList} onClick={() => replaceItem(item)}><RotateCcw size={13}/>{onList ? "On list" : "Replace"}</button>}<button type="button" onClick={() => removeItem(item.id)}><Check size={13}/>Used up</button></div></article>; })}</div> : <div className="inventory-empty"><span><Store size={20}/></span><strong>{query || status !== "all" ? "No matching fresh items" : `No fresh food in the ${location}`}</strong><p>{query || status !== "all" ? "Clear the filters or search another item." : "Add a fresh item, or check off perishables in Shopping and review them here."}</p>{query || status !== "all" ? <button type="button" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</button> : null}</div>}
    </section>

    <Modal open={adding} onClose={() => { if (!saving) { setAdding(false); setError(""); } }} title="Add fresh food to Kitchen Watch">
      <p className="inventory-add-intro">Kitchen Watch is for produce, dairy and eggs, meat and seafood, deli food, and bakery items that can spoil soon.</p>
      <TextField label="Item" placeholder="e.g. Milk, chicken, or strawberries" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}/>
      <div className="inventory-add-grid"><label className="inventory-select-field"><span>Category</span><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{KITCHEN_WATCH_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><TextField label="Brand (optional)" placeholder="e.g. Compliments" value={draft.brand} onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))}/></div>
      <div className="inventory-add-grid"><TextField label="Quantity" inputMode="decimal" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: Math.max(Number(event.target.value) || 1, 1) }))}/><TextField label="Unit (optional)" placeholder="bag, carton, lb" value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}/></div>
      <label className="inventory-add-location"><span>Store in</span><div>{[["fridge","Fridge",Refrigerator],["freezer","Freezer",Snowflake],["pantry","Pantry",Package]].map(([id,label,Icon]) => <button type="button" key={id} className={draft.location === id ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, location: id }))}><Icon size={15}/>{label}</button>)}</div></label>
      <DateField label="Use by or best before" value={draft.expiresOn} onChange={(expiresOn) => setDraft((current) => ({ ...current, expiresOn }))}/>
      {error && <p className="inventory-add-error" role="alert">{error}</p>}
      <PrimaryButton onClick={saveItem} disabled={saving || !draft.name.trim() || !draft.expiresOn}>{saving ? "Adding…" : "Start watching"}</PrimaryButton>
    </Modal>
  </div></PullToRefresh>;
}
