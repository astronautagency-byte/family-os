import { useEffect, useMemo, useState } from "react";
import { Baby, Bone, Carrot, Coffee, Cookie, Croissant, CupSoda, Drumstick, FlaskConical, Globe2, GripVertical, HeartPulse, Milk, Package, Pencil, Plus, Sandwich, ScrollText, Snowflake, Soup, SprayCan, Star, Trash2, Wheat, Wine } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { Card, Checkbox, EmptyState, Modal, PrimaryButton, SecondaryButton, Stepper, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { GROCERY_CATEGORIES } from "../data/mockData";

const emptyDraft = { name: "", category: GROCERY_CATEGORIES[0], quantity: 1, unit: "" };
const STAPLES_KEY = "family-os:grocery-staples:v1";
const DEFAULT_STAPLES = [
  { id: "milk", name: "Milk", category: "Dairy & Eggs", quantity: 1, unit: "" },
  { id: "eggs", name: "Eggs", category: "Dairy & Eggs", quantity: 1, unit: "dozen" },
  { id: "bread", name: "Bread", category: "Pantry", quantity: 1, unit: "loaf" },
  { id: "bananas", name: "Bananas", category: "Produce", quantity: 1, unit: "bunch" },
];

function loadStaples() {
  try { return JSON.parse(localStorage.getItem(STAPLES_KEY)) || DEFAULT_STAPLES; }
  catch { return DEFAULT_STAPLES; }
}

const CATEGORY_ICONS = {
  "Produce": Carrot,
  "Bakery": Croissant,
  "Deli & Prepared Foods": Sandwich,
  "Dairy & Eggs": Milk,
  "Meat & Seafood": Drumstick,
  "Breakfast & Cereal": Coffee,
  "Pantry": Wheat,
  "Canned & Jarred": Soup,
  "Pasta, Rice & Grains": Wheat,
  "Condiments & Sauces": FlaskConical,
  "Spices & Baking": FlaskConical,
  "Snacks & Candy": Cookie,
  "Beverages": CupSoda,
  "International Foods": Globe2,
  "Frozen": Snowflake,
  "Beer, Wine & Spirits": Wine,
  "Health & Personal Care": HeartPulse,
  "Baby": Baby,
  "Pet Supplies": Bone,
  "Household & Cleaning": SprayCan,
  "Paper & Disposable": ScrollText,
  "Household": SprayCan,
  "Other": Package,
};

function GroceryIcon({ category, size = 16 }) {
  const Icon = CATEGORY_ICONS[category] || Package;
  return <span className="w-8 h-8 rounded-lg bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0"><Icon size={size} color="var(--color-accent)" /></span>;
}

export default function Groceries() {
  const { groceries, addGrocery, toggleGrocery, updateGrocery, removeGrocery, clearCheckedGroceries, memberById } = useFamily();
  const [editingId, setEditingId] = useState(null); // null closed, "new" for add, or item id
  const [draft, setDraft] = useState(emptyDraft);
  const [staples, setStaples] = useState(loadStaples);
  const [dragging, setDragging] = useState(false);
  const [masterEditing, setMasterEditing] = useState(null);
  const [masterDraft, setMasterDraft] = useState(emptyDraft);

  useEffect(() => { localStorage.setItem(STAPLES_KEY, JSON.stringify(staples)); }, [staples]);

  const grouped = useMemo(() => {
    const map = {};
    for (const cat of GROCERY_CATEGORIES) map[cat] = [];
    for (const g of groceries) {
      if (!map[g.category]) map[g.category] = [];
      map[g.category].push(g);
    }
    return map;
  }, [groceries]);

  const remaining = groceries.filter((g) => !g.checked).length;
  const checkedCount = groceries.filter((g) => g.checked).length;

  const openNew = () => {
    setDraft(emptyDraft);
    setEditingId("new");
  };

  const openEdit = (item) => {
    setDraft({ name: item.name, category: item.category, quantity: item.quantity ?? 1, unit: item.unit ?? "" });
    setEditingId(item.id);
  };

  const submit = () => {
    if (!draft.name.trim()) return;
    if (editingId === "new") {
      addGrocery({ name: draft.name.trim(), category: draft.category, quantity: draft.quantity, unit: draft.unit.trim(), addedBy: null });
    } else {
      updateGrocery(editingId, { name: draft.name.trim(), category: draft.category, quantity: draft.quantity, unit: draft.unit.trim() });
    }
    setEditingId(null);
  };

  const addStapleToList = async (staple) => {
    const existing = groceries.find((item) => item.name.toLowerCase() === staple.name.toLowerCase());
    if (existing) {
      if (existing.checked) await updateGrocery(existing.id, { checked: false });
      return;
    }
    await addGrocery({ ...staple, addedBy: null });
  };

  const saveAsStaple = (item) => {
    const saved = staples.find((staple) => staple.name.toLowerCase() === item.name.toLowerCase());
    if (saved) { setStaples((current) => current.filter((staple) => staple.id !== saved.id)); return; }
    setStaples((current) => [...current, { id: `staple_${Date.now()}`, name: item.name, category: item.category, quantity: item.quantity || 1, unit: item.unit || "" }]);
  };

  const dropStaple = (event) => {
    event.preventDefault(); setDragging(false);
    try { addStapleToList(JSON.parse(event.dataTransfer.getData("application/json"))); } catch { /* invalid drag payload */ }
  };

  const openMasterItem = (item = null) => {
    setMasterEditing(item?.id || "new");
    setMasterDraft(item ? { name: item.name, category: item.category, quantity: item.quantity || 1, unit: item.unit || "" } : emptyDraft);
  };

  const saveMasterItem = () => {
    if (!masterDraft.name.trim()) return;
    const item = { ...masterDraft, name: masterDraft.name.trim(), unit: masterDraft.unit.trim() };
    if (masterEditing === "new") setStaples((current) => [...current, { id: `staple_${Date.now()}`, ...item }]);
    else setStaples((current) => current.map((staple) => staple.id === masterEditing ? { ...staple, ...item } : staple));
    setMasterEditing(null);
  };

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow={`${remaining} to get`}
        title="Groceries"
        action={
          checkedCount > 0 && (
            <button onClick={clearCheckedGroceries} className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
              Clear checked
            </button>
          )
        }
      />

      <div className="px-5 space-y-5 mt-2">
        <section>
          <div className="flex items-end justify-between mb-2 px-1">
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">Reusable staples</p><h2 className="font-[var(--font-display)] text-[17px] font-semibold">Master grocery list</h2></div>
            <button onClick={() => openMasterItem()} className="flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-accent)]"><Plus size={13} /> Add item</button>
          </div>
          <Card className="p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {staples.map((staple) => <div key={staple.id} draggable onDragStart={(event) => { event.dataTransfer.setData("application/json", JSON.stringify(staple)); setDragging(true); }} onDragEnd={() => setDragging(false)} className="shrink-0 flex items-center rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)]">
                <button onClick={() => addStapleToList(staple)} className="flex items-center gap-1.5 pl-2 pr-2 py-2 text-left"><GripVertical size={13} color="var(--color-ink-faint)" /><GroceryIcon category={staple.category} size={14} /><span><span className="block text-[13px] font-medium">{staple.name}</span><span className="block text-[9.5px] text-[var(--color-ink-faint)]">{staple.quantity}{staple.unit ? ` ${staple.unit}` : ""}</span></span></button>
                <button onClick={() => openMasterItem(staple)} className="p-2 border-l border-[var(--color-border)]" aria-label={`Edit ${staple.name}`}><Pencil size={12} color="var(--color-ink-faint)" /></button>
              </div>)}
            </div>
            <p className="text-[10.5px] text-[var(--color-ink-faint)] mt-2">Tap or drag to add with the saved quantity. Use the pencil to edit defaults.</p>
          </Card>
        </section>

        <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={dropStaple} className={`rounded-2xl transition-all ${dragging ? "ring-2 ring-[var(--color-accent)] bg-[var(--color-accent-soft)] p-2" : ""}`}>
          {dragging && <p className="text-center text-[12px] font-semibold text-[var(--color-accent)] py-3">Drop here to add to your list</p>}
        {groceries.length === 0 ? (
          <EmptyState title="List's empty" subtitle="Add your first item below." />
        ) : (
          Object.entries(grouped).map(([cat, items]) =>
            items.length === 0 ? null : (
              <section key={cat}>
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)] mb-2 px-1">
                  {cat} · {items.filter((i) => !i.checked).length}
                </p>
                <Card className="p-1">
                  <ul>
                    {items.map((item) => {
                      const adder = item.addedBy ? memberById[item.addedBy] : null;
                      const qtyLabel = [item.quantity > 1 || item.unit ? item.quantity : null, item.unit]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)] last:border-0"
                        >
                          <Checkbox checked={item.checked} onChange={() => toggleGrocery(item.id)} />
                          <GroceryIcon category={item.category} />
                          <button onClick={() => openEdit(item)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                            <span
                              className={`text-[14.5px] truncate ${
                                item.checked ? "line-through text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"
                              }`}
                            >
                              {item.name}
                            </span>
                            {qtyLabel && (
                              <span
                                className="text-[11.5px] font-medium text-[var(--color-accent-strong)] bg-[var(--color-accent-soft)] rounded-full px-2 py-0.5 shrink-0"
                              >
                                {qtyLabel}
                              </span>
                            )}
                          </button>
                          {adder && !item.checked && (
                            <span className="text-[11px] text-[var(--color-ink-faint)] shrink-0">{adder.name}</span>
                          )}
                          <button onClick={() => saveAsStaple(item)} className="p-1 text-[var(--color-ink-faint)] shrink-0" aria-label={`Save ${item.name} as a frequent item`} title="Save as frequent"><Star size={15} fill={staples.some((staple) => staple.name.toLowerCase() === item.name.toLowerCase()) ? "currentColor" : "none"} /></button>
                          <button onClick={() => removeGrocery(item.id)} className="p-1 -mr-1 text-[var(--color-ink-faint)] shrink-0">
                            <Trash2 size={15} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>
            )
          )
        )}
        </div>
      </div>

      <button
        onClick={openNew}
        className="fixed bottom-24 right-5 rounded-full bg-[var(--color-accent)] shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ width: 52, height: 52 }}
        aria-label="Add grocery item"
      >
        <Plus color="white" size={24} />
      </button>

      <Modal open={!!editingId} onClose={() => setEditingId(null)} title={editingId === "new" ? "Add item" : "Edit item"}>
        <TextField
          label="Item"
          placeholder="e.g. Sourdough bread"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Category</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {GROCERY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setDraft((d) => ({ ...d, category: cat }))}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium border transition-colors"
              style={{
                borderColor: draft.category === cat ? "var(--color-accent)" : "var(--color-border)",
                backgroundColor: draft.category === cat ? "var(--color-accent-soft)" : "transparent",
                color: draft.category === cat ? "var(--color-accent-strong)" : "var(--color-ink-soft)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-3 mb-5">
          <div>
            <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Quantity</p>
            <Stepper value={draft.quantity} onChange={(v) => setDraft((d) => ({ ...d, quantity: v }))} />
          </div>
          <div className="flex-1">
            <TextField
              label="Unit (optional)"
              placeholder="e.g. lb, bag, dozen"
              value={draft.unit}
              onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {editingId && editingId !== "new" && (
            <SecondaryButton
              onClick={() => {
                removeGrocery(editingId);
                setEditingId(null);
              }}
            >
              Remove
            </SecondaryButton>
          )}
          <PrimaryButton onClick={submit} disabled={!draft.name.trim()}>
            {editingId === "new" ? "Add to list" : "Save"}
          </PrimaryButton>
        </div>
      </Modal>

      <Modal open={!!masterEditing} onClose={() => setMasterEditing(null)} title={masterEditing === "new" ? "Add master item" : "Edit master item"}>
        <TextField label="Item" placeholder="e.g. Greek yogurt" value={masterDraft.name} onChange={(e) => setMasterDraft((draft) => ({ ...draft, name: e.target.value }))} autoFocus />
        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Category</p>
        <div className="flex flex-wrap gap-2 mb-4">{GROCERY_CATEGORIES.map((category) => <button key={category} onClick={() => setMasterDraft((draft) => ({ ...draft, category }))} className="rounded-full px-3 py-1.5 text-[13px] font-medium border" style={{ borderColor: masterDraft.category === category ? "var(--color-accent)" : "var(--color-border)", backgroundColor: masterDraft.category === category ? "var(--color-accent-soft)" : "transparent" }}>{category}</button>)}</div>
        <div className="flex items-end gap-3 mb-5"><div><p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Default quantity</p><Stepper value={masterDraft.quantity} onChange={(quantity) => setMasterDraft((draft) => ({ ...draft, quantity }))} /></div><div className="flex-1"><TextField label="Unit" placeholder="bag, dozen, lb" value={masterDraft.unit} onChange={(e) => setMasterDraft((draft) => ({ ...draft, unit: e.target.value }))} /></div></div>
        <div className="flex gap-2">{masterEditing !== "new" && <SecondaryButton onClick={() => { setStaples((current) => current.filter((item) => item.id !== masterEditing)); setMasterEditing(null); }}>Remove</SecondaryButton>}<PrimaryButton onClick={saveMasterItem} disabled={!masterDraft.name.trim()}>Save master item</PrimaryButton></div>
      </Modal>
    </div>
  );
}
