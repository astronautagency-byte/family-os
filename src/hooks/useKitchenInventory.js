import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { canonicalIngredientName } from "../lib/mealIngredientCache";

const EVENT = "famos:kitchen-inventory-changed";
const REMOTE_EVENT = "famos:kitchen-inventory-remote-change";
const keyFor = (householdId) => `famos:kitchen-inventory:v1:${householdId || "local"}`;
const makeId = () => `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const mapRow = (row) => ({ id: row.id, name: row.name, quantity: Number(row.quantity || 1), unit: row.unit || "", location: row.location || "fridge", expiresOn: row.expires_on || "", sourceGroceryId: row.source_grocery_id || null, category: row.category || "Other", brand: row.brand || "", barcode: row.barcode || "", imageUrl: row.image_url || "" });
const readLocal = (householdId) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(householdId)) || "[]");
    // Early Kitchen Watch prototypes stored an object keyed by location. Do
    // not let that legacy cache shape take down every page that reads stock.
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? Object.values(parsed).flatMap((value) => Array.isArray(value) ? value : [])
        : [];
    return rows.filter((item) => item && typeof item === "object" && item.name);
  } catch { return []; }
};
const writeLocal = (householdId, items) => { try { localStorage.setItem(keyFor(householdId), JSON.stringify(items)); window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* storage unavailable */ } };
const missingTable = (error) => /kitchen_inventory|schema cache|relation .* does not exist|could not find the table/i.test(error?.message || "");

export default function useKitchenInventory(householdId, userId) {
  const [items, setItems] = useState(() => readLocal(householdId));
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    let active = true;
    setItems(readLocal(householdId));
    if (!supabase || !householdId) return () => { active = false; };
    supabase.from("kitchen_inventory").select("*").eq("household_id", householdId).order("created_at").then(({ data, error }) => {
      if (!active || error) return;
      const mapped = (data || []).map(mapRow);
      setItems(mapped); writeLocal(householdId, mapped); setRemoteReady(true);
    });
    return () => { active = false; };
  }, [householdId]);

  useEffect(() => {
    const sync = () => setItems(readLocal(householdId));
    window.addEventListener(EVENT, sync); window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return undefined;
    const applyRemote = (event) => {
      const payload = event.detail || {};
      const row = payload.new;
      setItems((current) => {
        let next = current;
        if (payload.eventType === "DELETE") next = current.filter((item) => item.id !== payload.old?.id);
        else if (row?.id && payload.eventType === "UPDATE") next = current.map((item) => item.id === row.id ? mapRow(row) : item);
        else if (row?.id && !current.some((item) => item.id === row.id)) next = [...current, mapRow(row)];
        try { localStorage.setItem(keyFor(householdId), JSON.stringify(next)); } catch { /* storage unavailable */ }
        return next;
      });
    };
    window.addEventListener(REMOTE_EVENT, applyRemote);
    return () => window.removeEventListener(REMOTE_EVENT, applyRemote);
  }, [householdId]);

  // Keep a direct Postgres Changes subscription as a compatibility fallback
  // until every environment has the private Broadcast migration applied.
  useEffect(() => {
    if (!supabase || !householdId || !remoteReady) return undefined;
    const channel = supabase.channel(`kitchen-inventory:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_inventory", filter: `household_id=eq.${householdId}` }, (payload) => {
        window.dispatchEvent(new CustomEvent(REMOTE_EVENT, { detail: payload }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [householdId, remoteReady]);

  const persistLocal = useCallback((next) => { setItems(next); writeLocal(householdId, next); }, [householdId]);
  const addItem = useCallback(async (input) => {
    const name = canonicalIngredientName(input.name);
    if (!name) return null;
    const existing = items.find((item) => canonicalIngredientName(item.name) === name && item.location === (input.location || "fridge"));
    const local = existing
      ? { ...existing, quantity: Number(existing.quantity) + Number(input.quantity || 1), unit: input.unit || existing.unit, expiresOn: input.expiresOn || existing.expiresOn, category: input.category || existing.category, brand: input.brand || existing.brand, barcode: input.barcode || existing.barcode, imageUrl: input.imageUrl || existing.imageUrl }
      : { id: makeId(), name, quantity: Number(input.quantity || 1), unit: input.unit || "", location: input.location || "fridge", expiresOn: input.expiresOn || "", sourceGroceryId: input.sourceGroceryId || null, category: input.category || "Other", brand: input.brand || "", barcode: input.barcode || "", imageUrl: input.imageUrl || "" };
    persistLocal(existing ? items.map((item) => item.id === existing.id ? local : item) : [...items, local]);
    if (supabase && householdId) {
      const payload = { household_id: householdId, name, quantity: local.quantity, unit: local.unit, location: local.location, expires_on: local.expiresOn || null, source_grocery_id: local.sourceGroceryId, category: local.category || "Other", brand: local.brand || "", barcode: local.barcode || null, image_url: local.imageUrl || "", added_by: userId };
      const run = (row) => existing && remoteReady ? supabase.from("kitchen_inventory").update(row).eq("id", existing.id).select().single() : supabase.from("kitchen_inventory").insert(row).select().single();
      let { data, error } = await run(payload);
      if (error && /category|brand|barcode|image_url|schema cache|column/i.test(error.message || "")) {
        const { category: _category, brand: _brand, barcode: _barcode, image_url: _imageUrl, ...compatiblePayload } = payload;
        ({ data, error } = await run(compatiblePayload));
      }
      if (!error && data) persistLocal((existing ? items.filter((item) => item.id !== existing.id) : items).concat(mapRow(data)));
      else if (error && !missingTable(error)) console.warn("Could not sync kitchen inventory", error);
    }
    return local;
  }, [householdId, items, persistLocal, remoteReady, userId]);

  const updateItem = useCallback(async (id, patch) => {
    const next = items.map((item) => item.id === id ? { ...item, ...patch } : item); persistLocal(next);
    if (supabase && householdId && remoteReady) {
      const db = {};
      if (patch.quantity !== undefined) db.quantity = patch.quantity;
      if (patch.location !== undefined) db.location = patch.location;
      if (patch.expiresOn !== undefined) db.expires_on = patch.expiresOn || null;
      if (patch.unit !== undefined) db.unit = patch.unit;
      if (patch.category !== undefined) db.category = patch.category;
      if (patch.brand !== undefined) db.brand = patch.brand;
      if (patch.barcode !== undefined) db.barcode = patch.barcode || null;
      if (patch.imageUrl !== undefined) db.image_url = patch.imageUrl || "";
      const { error } = await supabase.from("kitchen_inventory").update(db).eq("id", id);
      if (error && !missingTable(error)) console.warn("Could not update kitchen inventory", error);
    }
  }, [householdId, items, persistLocal, remoteReady]);

  const removeItem = useCallback(async (id) => {
    persistLocal(items.filter((item) => item.id !== id));
    if (supabase && householdId && remoteReady) await supabase.from("kitchen_inventory").delete().eq("id", id);
  }, [householdId, items, persistLocal, remoteReady]);

  const ingredientNames = useMemo(() => items.filter((item) => Number(item.quantity) > 0).map((item) => canonicalIngredientName(item.name)), [items]);
  return { items, ingredientNames, addItem, updateItem, removeItem };
}
