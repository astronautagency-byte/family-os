import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GroceryItem = {
  id?: string;
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  barcode?: string;
};

type GroceryStore = {
  id: string;
  name: string;
  pickupAddress?: string;
  externalBusinessId?: string;
  externalStoreId?: string;
  currency?: string;
};

const DOORDASH_BASE = Deno.env.get("DOORDASH_API_BASE") || "https://openapi.doordash.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function base64url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createDoorDashJwt() {
  const developerId = Deno.env.get("DOORDASH_DEVELOPER_ID");
  const keyId = Deno.env.get("DOORDASH_KEY_ID");
  const signingSecret = Deno.env.get("DOORDASH_SIGNING_SECRET");
  if (!developerId || !keyId || !signingSecret) return "";

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", "dd-ver": "DD-JWT-V1" };
  const payload = {
    aud: "doordash",
    iss: developerId,
    kid: keyId,
    iat: now,
    exp: now + 300,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

function configuredStores(): GroceryStore[] {
  const rawStores = Deno.env.get("DOORDASH_GROCERY_STORES");
  if (rawStores) {
    try {
      const stores = JSON.parse(rawStores);
      if (Array.isArray(stores)) return stores;
    } catch {
      // Fall back to single-store env vars below.
    }
  }

  const externalBusinessId = Deno.env.get("DOORDASH_EXTERNAL_BUSINESS_ID");
  const externalStoreId = Deno.env.get("DOORDASH_EXTERNAL_STORE_ID");
  const pickupAddress = Deno.env.get("DOORDASH_PICKUP_ADDRESS");
  if (!externalBusinessId && !externalStoreId && !pickupAddress) return [];
  return [{
    id: externalStoreId || "default-store",
    name: Deno.env.get("DOORDASH_STORE_NAME") || "Preferred grocery store",
    pickupAddress,
    externalBusinessId,
    externalStoreId,
    currency: Deno.env.get("DOORDASH_CURRENCY") || "CAD",
  }];
}

function normalizeItems(items: GroceryItem[] = []) {
  return items
    .filter((item) => item?.name?.trim())
    .map((item) => ({
      id: item.id,
      name: item.name.trim(),
      category: item.category || "Other",
      quantity: Math.max(1, Number(item.quantity || 1)),
      unit: item.unit || "",
      barcode: item.barcode || "",
    }));
}

function fallbackGrocerySubtotalCents(items: GroceryItem[]) {
  // DoorDash/store catalog pricing is the source of truth when available.
  // This fallback gives the UI a useful estimate while merchant catalog pricing is not connected.
  return normalizeItems(items).reduce((sum, item) => sum + Math.max(1, item.quantity) * 650, 0);
}

function buildDeliveryPayload({
  store,
  items,
  dropoffAddress,
  dropoffPhone,
  instructions,
}: {
  store: GroceryStore;
  items: GroceryItem[];
  dropoffAddress: string;
  dropoffPhone?: string;
  instructions?: string;
}) {
  const externalDeliveryId = `famos-grocery-${crypto.randomUUID()}`;
  const normalizedItems = normalizeItems(items);
  const itemDescription = normalizedItems
    .map((item) => `${item.quantity}${item.unit ? ` ${item.unit}` : ""} ${item.name}`)
    .join("; ");

  return {
    external_delivery_id: externalDeliveryId,
    pickup_address: store.pickupAddress,
    pickup_business_name: store.name,
    dropoff_address: dropoffAddress,
    dropoff_phone_number: dropoffPhone || undefined,
    dropoff_instructions: instructions || undefined,
    order_value: fallbackGrocerySubtotalCents(normalizedItems),
    items: normalizedItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      description: [item.category, item.unit, item.barcode ? `UPC ${item.barcode}` : ""].filter(Boolean).join(" · "),
    })),
    shopping_options: {
      enabled: true,
      instructions: instructions || `Shop these groceries for FamOS: ${itemDescription}`,
    },
    external_business_id: store.externalBusinessId,
    external_store_id: store.externalStoreId,
  };
}

async function callDoorDash(path: string, payload: unknown) {
  const token = await createDoorDashJwt();
  if (!token) {
    return {
      configured: false,
      data: null,
    };
  }

  const response = await fetch(`${DOORDASH_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`DoorDash returned ${response.status}: ${text.slice(0, 260)}`);
  }
  return { configured: true, data };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sign in to order groceries with DoorDash.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Your session has expired.");

    const body = await request.json();
    const action = body.action || "stores";
    const stores = configuredStores();

    if (action === "stores") {
      const token = await createDoorDashJwt();
      return json({
        mode: stores.length && token ? "live" : "not_configured",
        stores,
      });
    }

    const store = stores.find((item) => item.id === body.storeId) || stores[0];
    if (!store) throw new Error("DoorDash grocery stores are not configured yet.");
    if (!body.dropoffAddress) throw new Error("A delivery address is required.");

    const normalizedItems = normalizeItems(body.items || []);
    if (!normalizedItems.length) throw new Error("Your grocery list is empty.");

    const deliveryPayload = buildDeliveryPayload({
      store,
      items: normalizedItems,
      dropoffAddress: body.dropoffAddress,
      dropoffPhone: body.dropoffPhone,
      instructions: body.instructions,
    });
    const grocerySubtotalCents = fallbackGrocerySubtotalCents(normalizedItems);
    const currency = store.currency || "CAD";

    if (action === "quote") {
      const result = await callDoorDash("/drive/v2/quotes", deliveryPayload);
      const quoteData = result.data as Record<string, unknown> | null;
      const deliveryFeeCents = Number(
        quoteData?.fee ||
        quoteData?.delivery_fee ||
        quoteData?.delivery_fee_cents ||
        0,
      );
      return json({
        mode: result.configured ? "live" : "not_configured",
        message: result.configured
          ? "DoorDash quote ready. Review before placing the order."
          : "DoorDash credentials are not configured yet. Showing a local grocery subtotal estimate only.",
        quote: {
          live: result.configured,
          externalDeliveryId: deliveryPayload.external_delivery_id,
          deliveryFeeCents,
          grocerySubtotalCents,
          totalCents: grocerySubtotalCents + deliveryFeeCents,
          currency,
          raw: quoteData,
        },
      });
    }

    if (action === "create") {
      const result = await callDoorDash("/drive/v2/deliveries", deliveryPayload);
      const deliveryData = result.data as Record<string, unknown> | null;
      return json({
        mode: result.configured ? "live" : "not_configured",
        message: result.configured
          ? "DoorDash grocery delivery was created."
          : "DoorDash credentials are not configured yet, so no live order was placed.",
        delivery: deliveryData,
        quote: {
          deliveryFeeCents: Number(deliveryData?.fee || deliveryData?.delivery_fee || 0),
          grocerySubtotalCents,
          totalCents: grocerySubtotalCents + Number(deliveryData?.fee || deliveryData?.delivery_fee || 0),
          currency,
        },
      });
    }

    throw new Error("Unsupported DoorDash grocery action.");
  } catch (error) {
    return json({ error: error.message }, 400);
  }
});
