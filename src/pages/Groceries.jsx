import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Baby, Bone, Camera, Carrot, Check, CheckCircle2, ChevronDown, Clipboard, Clock3, Coffee, Cookie, Croissant, CupSoda, Download, Drumstick, ExternalLink, FlaskConical, Globe2, GripVertical, HeartPulse, Image as ImageIcon, ListChecks, LoaderCircle, Maximize2, Milk, Minus, Package, Pencil, Plus, Refrigerator, RotateCcw, Sandwich, ScanLine, ScrollText, Search, Share2, ShoppingBag, ShoppingBasket, Snowflake, Soup, Sparkles, SprayCan, Star, Store, Trash2, Truck, Upload, Wheat, Wine, X } from "lucide-react";
import { uploadGroceryPhoto, isUploadableImage, deleteGroceryPhoto, compressImage } from "../lib/groceryPhotoUpload";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import { Avatar, Card, Checkbox, DateField, EmptyState, Modal, PrimaryButton, SecondaryButton, Stepper, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import ConfirmAction from "../components/ConfirmAction";
import CelebrationConfetti from "../components/CelebrationConfetti";
import NativeAdBanner from "../components/NativeAdBanner";
import { AD_PLACEMENTS } from "../lib/adNetwork";
import { FocusShoppingItem } from "../components/FocusShoppingItem";
import { canonicalIngredientName, isIngredientOnList, loadIngredientCache, saveIngredientCache } from "../lib/mealIngredientCache";
import { formatDayLabel, todayISO } from "../lib/dates";
import { GROCERY_CATEGORIES } from "../data/mockData";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { supabase } from "../lib/supabase";
import { categorizeGroceryItem } from "../lib/groceryCategories";
import { inventoryExpiryStatus, suggestExpiryDate } from "../lib/inventoryExpiry";
import { buildShareUrl } from "../lib/share";
import ShareSheet from "../components/ShareSheet";

const emptyDraft = { name: "", category: "Other", categoryManual: false, quantity: 1, unit: "", brand: "", imageUrl: "", assigneeIds: [] };
const INVENTORY_CATEGORIES = ["Produce", "Deli & Prepared Foods", "Dairy & Eggs", "Meat & Seafood", "Bakery"];
const isKitchenWatchCategory = (category) => INVENTORY_CATEGORIES.includes(category);
const emptyPhoto = { file: null, previewUrl: "", remoteUrl: "", uploading: false, error: "" };
const emptyBarcodeDraft = { ...emptyDraft, code: "", brand: "", price: "", imageUrl: "" };
const emptyInventoryDraft = { name: "", quantity: 1, unit: "", location: "fridge", expiresOn: "", sourceGroceryId: null, category: INVENTORY_CATEGORIES[0], brand: "", barcode: "", imageUrl: "" };
const STAPLES_KEY = "family-os:grocery-staples:v1";
const PRODUCT_LOOKUP_ENDPOINT = "https://world.openfoodfacts.org/api/v2/product";
const safeRevokeObjectUrl = (url) => {
  if (url && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
};
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

export function GroceryIcon({ category, size = 16 }) {
  const Icon = CATEGORY_ICONS[category] || Package;
  const palette = {
    "Produce": ["#DDF7E9", "#228766"], "Bakery": ["#FFF0D4", "#C76E22"],
    "Dairy & Eggs": ["#E1F0FF", "#397BCB"], "Meat & Seafood": ["#FFE2E6", "#D64C5C"],
    "Frozen": ["#E2F6FF", "#3185A8"], "Snacks & Candy": ["#FFE2EF", "#C64882"],
    "Beverages": ["#EEE9FF", "#7255D9"], "Household & Cleaning": ["#E7F3FF", "#356FA8"],
    "Baby": ["#FFF2B8", "#A97900"], "Pet Supplies": ["#FFE8D9", "#B86332"],
  };
  const [background, foreground] = palette[category] || ["#F0E9FF", "#7255D9"];
  return <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: background }}><Icon size={size} color={foreground} /></span>;
}

function GroceryItemImage({ item, memberById, focus = false }) {
  const src = item.photoUrl || item.imageUrl || "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <GroceryIcon category={item.category} />;
  const uploader = item.photoUrl && item.photoUploadedBy ? memberById[item.photoUploadedBy] : null;
  const size = focus ? 48 : 34;
  const radius = focus ? 11 : 9;
  return (
    <span
      className={`grocery-photo-thumb ${focus ? "grocery-photo-thumb-focus" : "grocery-photo-thumb-list"}`}
      role="img"
      aria-label={item.photoUrl ? `Photo of ${item.name}` : `Product image for ${item.name}`}
      style={{ position: "relative", display: "grid", placeItems: "center", width: size, height: size, borderRadius: radius, border: "none", overflow: "hidden", flex: "0 0 auto", background: "var(--color-accent-soft)" }}
    >
      <img src={src} alt="" onError={() => setFailed(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
    </span>
  );
}

const GROCERY_DELIVERY_APPS = [
  {
    id: "uber",
    name: "Uber Eats",
    url: "https://www.ubereats.com/category/grocery",
    logo: "/logos/grocery/ubereats.png",
    brandColor: "#06C167",
    brandSoft: "#EAFBF2",
    brandBorder: "#BDEFD2",
  },
  {
    id: "doordash",
    name: "DoorDash",
    url: "https://www.doordash.com/grocery/",
    logo: "/logos/grocery/doordash.png",
    brandColor: "#FF3008",
    brandSoft: "#FFF0EC",
    brandBorder: "#FFC8BC",
  },
  {
    id: "instacart",
    name: "Instacart",
    url: "https://www.instacart.com/store",
    logo: "/logos/grocery/instacart.png",
    brandColor: "#43B02A",
    brandSoft: "#F0FAE8",
    brandBorder: "#CFEFBD",
  },
];

function GroceryDeliveryLogo({ app }) {
  return (
    <img
      src={app.logo}
      alt={`${app.name} logo`}
      className="max-h-[18px] max-w-[92px] object-contain sm:max-h-[20px] sm:max-w-[112px]"
      loading="lazy"
    />
  );
}

const PRODUCT_CATEGORY_RULES = [
  { category: "Produce", pattern: /fruit|vegetable|produce|fresh-food|fresh-vegetable|fresh-fruit|plant-based-food/i },
  { category: "Bakery", pattern: /bread|bakery|baked-good|bun|bagel|croissant|pastry|tortilla/i },
  { category: "Deli & Prepared Foods", pattern: /prepared|deli|ready-meal|ready-to-eat|meal/i },
  { category: "Dairy & Eggs", pattern: /dairy|milk|cheese|yogurt|yoghurt|egg|cream|butter/i },
  { category: "Meat & Seafood", pattern: /meat|seafood|fish|chicken|beef|pork|turkey|poultry|sausage/i },
  { category: "Breakfast & Cereal", pattern: /breakfast|cereal|granola|oatmeal|muesli/i },
  { category: "Canned & Jarred", pattern: /canned|jarred|preserve|pickled/i },
  { category: "Pasta, Rice & Grains", pattern: /pasta|rice|grain|noodle|quinoa|couscous/i },
  { category: "Condiments & Sauces", pattern: /condiment|sauce|ketchup|mustard|mayonnaise|dressing|salsa/i },
  { category: "Spices & Baking", pattern: /spice|baking|flour|sugar|extract|yeast|baking-powder/i },
  { category: "Snacks & Candy", pattern: /snack|candy|confectionery|chocolate|chips|crisps|cookie|cracker|biscuit/i },
  { category: "Beverages", pattern: /beverage|drink|juice|coffee|tea|water|soda|soft-drink/i },
  { category: "International Foods", pattern: /asian|mexican|italian|indian|international/i },
  { category: "Frozen", pattern: /frozen/i },
  { category: "Beer, Wine & Spirits", pattern: /beer|wine|spirit|alcohol/i },
  { category: "Health & Personal Care", pattern: /health|personal-care|hygiene|cosmetic|supplement|vitamin/i },
  { category: "Baby", pattern: /baby|infant|toddler/i },
  { category: "Pet Supplies", pattern: /pet|dog|cat|animal-food/i },
  { category: "Paper & Disposable", pattern: /paper|disposable|napkin|tissue|toilet-paper/i },
  { category: "Household & Cleaning", pattern: /household|cleaning|detergent|laundry|dishwasher|soap/i },
  { category: "Pantry", pattern: /pantry|grocery|shelf-stable|oil|beans|legumes|nuts|seeds/i },
];

const ITEM_NAME_CATEGORY_RULES = [
  { category: "Produce", pattern: /\b(apple|apples|banana|bananas|berry|berries|blueberry|blueberries|strawberry|strawberries|grape|grapes|orange|oranges|lemon|lemons|lime|limes|avocado|avocados|tomato|tomatoes|lettuce|spinach|kale|broccoli|carrot|carrots|celery|pepper|peppers|onion|onions|potato|potatoes|cucumber|cucumbers|mushroom|mushrooms|cilantro|parsley|garlic|ginger)\b/i },
  { category: "Bakery", pattern: /\b(bread|sourdough|bagel|bagels|bun|buns|roll|rolls|croissant|croissants|muffin|muffins|pita|naan|tortilla|tortillas)\b/i },
  { category: "Deli & Prepared Foods", pattern: /\b(deli|rotisserie|prepared|ready meal|hummus|sandwich|wrap|sushi|salad kit|salad bowl)\b/i },
  { category: "Dairy & Eggs", pattern: /\b(milk|cream|half and half|cheese|cheddar|mozzarella|parmesan|yogurt|yoghurt|greek yogurt|butter|eggs?|cottage cheese|sour cream|cream cheese|oat milk|almond milk|soy milk)\b/i },
  { category: "Meat & Seafood", pattern: /\b(chicken|beef|steak|pork|turkey|ham|bacon|sausage|salmon|tuna|shrimp|fish|cod|ground meat|ground beef|ground turkey)\b/i },
  { category: "Breakfast & Cereal", pattern: /\b(cereal|granola|oatmeal|oats|pancake mix|waffles|waffle|breakfast bars?)\b/i },
  { category: "Canned & Jarred", pattern: /\b(canned|can of|jar of|tomato sauce|pickles|olives|jam|jelly|chickpeas|black beans|kidney beans|soup can)\b/i },
  { category: "Pasta, Rice & Grains", pattern: /\b(pasta|spaghetti|penne|fusilli|macaroni|rice|quinoa|couscous|noodles|ramen|grain|grains)\b/i },
  { category: "Condiments & Sauces", pattern: /\b(ketchup|mustard|mayo|mayonnaise|hot sauce|bbq sauce|barbecue sauce|soy sauce|salsa|dressing|vinaigrette|marinade|pesto)\b/i },
  { category: "Spices & Baking", pattern: /\b(flour|sugar|baking soda|baking powder|yeast|vanilla|cinnamon|spice|spices|salt|pepper|chocolate chips)\b/i },
  { category: "Snacks & Candy", pattern: /\b(chips|crisps|crackers|cookies|cookie|candy|chocolate|popcorn|pretzels|nuts|trail mix|granola bar|snack)\b/i },
  { category: "Beverages", pattern: /\b(water|sparkling water|juice|soda|pop|coffee|tea|kombucha|sports drink|drink|beverage)\b/i },
  { category: "International Foods", pattern: /\b(curry paste|miso|sriracha|kimchi|tahini|harissa|samosa|gnocchi|soba|udon)\b/i },
  { category: "Frozen", pattern: /\b(frozen|ice cream|popsicles|frozen pizza|frozen peas|frozen berries)\b/i },
  { category: "Beer, Wine & Spirits", pattern: /\b(beer|wine|vodka|gin|rum|whiskey|whisky|tequila|cider|lager|ipa)\b/i },
  { category: "Health & Personal Care", pattern: /\b(shampoo|conditioner|toothpaste|toothbrush|deodorant|soap|body wash|vitamin|supplement|medicine|bandage)\b/i },
  { category: "Baby", pattern: /\b(diapers|diaper|wipes|formula|baby food|pacifier|toddler)\b/i },
  { category: "Pet Supplies", pattern: /\b(dog food|cat food|pet food|treats|litter|cat litter|poop bags)\b/i },
  { category: "Household & Cleaning", pattern: /\b(dish soap|dishwasher|detergent|laundry|cleaner|cleaning|bleach|spray|sponges|sponge|trash bags|garbage bags)\b/i },
  { category: "Paper & Disposable", pattern: /\b(paper towels|toilet paper|tissues|napkins|paper plates|paper cups|foil|plastic wrap|parchment)\b/i },
  { category: "Pantry", pattern: /\b(oil|olive oil|vinegar|beans|lentils|peanut butter|almond butter|honey|maple syrup|broth|stock|flour tortillas)\b/i },
];

const normalizeBarcode = (value = "") => value.replace(/[^\d]/g, "");
const barcodeCandidates = (code) => [...new Set([
  code,
  code.length === 12 ? `0${code}` : "",
  code.length === 13 && code.startsWith("0") ? code.slice(1) : "",
].filter(Boolean))];

// ZXing is loaded only for browsers without BarcodeDetector and only once per
// tab. Restricting its decoder to grocery barcode formats avoids the expensive
// multi-format search across QR, PDF, Data Matrix, and other formats.
let zxingModulePromise;
const loadZxing = () => {
  if (!zxingModulePromise) {
    zxingModulePromise = Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  }
  return zxingModulePromise;
};

async function prepareBarcodeImage(file) {
  if (typeof URL === "undefined" || !URL.createObjectURL) return "";
  if (typeof createImageBitmap !== "function") return URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const resized = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return URL.createObjectURL(resized || file);
  } catch {
    return URL.createObjectURL(file);
  }
}

const firstCommaValue = (value = "") => value.split(",").map((part) => part.trim()).filter(Boolean)[0] || "";

function productNameFromApi(product = {}) {
  const productName = (product.product_name_en || product.product_name || product.generic_name_en || product.generic_name || "").trim();
  const brand = firstCommaValue(product.brands || "");
  return productName || brand;
}

function categoryFromApi(product = {}) {
  const categoryText = [
    product.categories,
    ...(Array.isArray(product.categories_tags) ? product.categories_tags : []),
  ].filter(Boolean).join(" ");
  const match = PRODUCT_CATEGORY_RULES.find((rule) => rule.pattern.test(categoryText));
  return match?.category || "Pantry";
}

function categoryFromItemName(name = "", fallback = GROCERY_CATEGORIES[0]) {
  const normalized = name.trim();
  if (!normalized) return fallback;
  return ITEM_NAME_CATEGORY_RULES.find((rule) => rule.pattern.test(normalized))?.category || fallback;
}

function GroceryCategorySelect({ value, itemName, onChange }) {
  const suggested = categoryFromItemName(itemName, "Other");
  const isSuggested = Boolean(itemName.trim()) && value === suggested && suggested !== "Other";
  return (
    <label className="grocery-category-select">
      <span>Category {isSuggested && <em>Suggested from item name</em>}</span>
      <div><GroceryIcon category={value}/><select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Grocery category">{GROCERY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select><ChevronDown size={16} aria-hidden="true"/></div>
    </label>
  );
}

export default function Groceries() {
  const { groceries, groceryLists = [], addGroceryList, removeGroceryList, meals, addGrocery: addGroceryBase, toggleGrocery, updateGrocery, removeGrocery, clearCheckedGroceries, clearGroceries, members, memberById, refreshData } = useFamily();
  const auth = useAuth();
  const household = auth?.household;
  const { items: inventoryItems, addItem: addInventoryItem, updateItem: updateInventoryItem, removeItem: removeInventoryItem } = useKitchenInventory(household?.id, auth?.user?.id);
  const [inventoryLocation, setInventoryLocation] = useState("fridge");
  const [inventoryAdding, setInventoryAdding] = useState(false);
  const [activeGroceryListId, setActiveGroceryListId] = useState("all");
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListError, setNewListError] = useState("");
  const [deletingList, setDeletingList] = useState(null);
  const [inventoryDraft, setInventoryDraft] = useState(emptyInventoryDraft);
  const [inventorySaving, setInventorySaving] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [watchPromptItem, setWatchPromptItem] = useState(null);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryStatus, setInventoryStatus] = useState("all");
  const [editingId, setEditingId] = useState(null); // null closed, "new" for add, or item id
  const [draft, setDraft] = useState(emptyDraft);
  const [staples, setStaples] = useState(loadStaples);
  const pendingStaplesRef = useRef(new Set());
  // Latest groceries, kept in a ref so staple-add dedupe never reads a stale
  // closure after an optimistic add re-renders the page.
  const groceriesRef = useRef(groceries);
  useEffect(() => { groceriesRef.current = groceries; }, [groceries]);
  const [dragging, setDragging] = useState(false);
  const [masterEditing, setMasterEditing] = useState(null);
  const [masterDraft, setMasterDraft] = useState(emptyDraft);
  const [showAllStaples, setShowAllStaples] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearingChecked, setClearingChecked] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [barcodeModal, setBarcodeModal] = useState(false);
  const [barcodeDraft, setBarcodeDraft] = useState(emptyBarcodeDraft);
  const [barcodeStatus, setBarcodeStatus] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [returnToFocus, setReturnToFocus] = useState(false);
  const [listCelebration, setListCelebration] = useState(false);
  const [photoDraft, setPhotoDraft] = useState(emptyPhoto);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const photoCameraInputRef = useRef(null);
  const photoLibraryInputRef = useRef(null);
  const photoPickIdRef = useRef(0);
  const celebrationTimerRef = useRef(null);

  const onPickPhotoFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const check = isUploadableImage(file);
    if (!check.ok) {
      setPhotoDraft((current) => ({ ...current, error: check.reason }));
      return;
    }
    const pickId = ++photoPickIdRef.current;
    setPhotoDraft((current) => ({ ...current, file: null, uploading: true, error: "" }));
    try {
      // Never decode the original 12–48 MP iPhone photo in the modal.
      // Compress once first, then use the small blob for both preview and
      // upload. This prevents iOS from terminating the PWA under memory
      // pressure while the camera sheet is closing.
      const prepared = await compressImage(file);
      if (pickId !== photoPickIdRef.current) return;
      const previewUrl = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(prepared) : "";
      setPhotoDraft((current) => {
        if (current.previewUrl && current.previewUrl !== previewUrl) safeRevokeObjectUrl(current.previewUrl);
        return { file: prepared, previewUrl, remoteUrl: "", uploading: true, error: "" };
      });
      await uploadPhotoNow(prepared, pickId);
    } catch (error) {
      if (pickId === photoPickIdRef.current) setPhotoDraft((current) => ({ ...current, uploading: false, error: error?.message || "Could not prepare the photo." }));
    }
  };

  const uploadPhotoNow = async (file, pickId = photoPickIdRef.current) => {
    const householdId = household?.id;
    if (!householdId) {
      setPhotoDraft((current) => ({ ...current, uploading: false, error: "Sign in to attach a photo." }));
      return;
    }
    try {
      const { url } = await uploadGroceryPhoto({ householdId, file, supabase });
      if (pickId === photoPickIdRef.current) setPhotoDraft((current) => ({ ...current, uploading: false, remoteUrl: url }));
    } catch (error) {
      if (pickId === photoPickIdRef.current) setPhotoDraft((current) => ({ ...current, uploading: false, error: error?.message || "Could not upload the photo." }));
    }
  };

  const clearPhoto = () => {
    photoPickIdRef.current += 1;
    if (photoDraft.previewUrl && !photoDraft.remoteUrl) safeRevokeObjectUrl(photoDraft.previewUrl);
    setPhotoDraft(emptyPhoto);
  };

  // Shared close path for the editor modal — the X button, the Cancel
  // button (if there is one), and the backdrop tap all funnel through
  // here. We revoke any pending preview blob URL so picking a photo
  // and then closing without saving doesn't leak the heap reference,
  // AND we clean up the storage object that may have already been
  // uploaded if the upload won the race against the user's tap on X.
  // Best-effort: storage cleanup errors are non-fatal because the row
  // was never saved — leftover files are just bucket cost, not data.
  const closeEditorModal = () => {
    photoPickIdRef.current += 1;
    safeRevokeObjectUrl(photoDraft.previewUrl);
    if (photoDraft.remoteUrl && editingId === "new") {
      deleteGroceryPhoto(photoDraft.remoteUrl, supabase).then(({ error }) => {
        if (error) console.warn("Could not remove orphaned grocery photo on cancel.", error);
      });
    }
    setPhotoDraft(emptyPhoto);
    setEditingId(null);
  };
  const scannerVideoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const scannerHandledRef = useRef(false);
  const scannerSessionRef = useRef(0);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [groceryShare, setGroceryShare] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  // Plan-aware ingredients: Groceries.jsx reads the same cache Meals.jsx
  // writes after a recipe lookup, then surfaces the cross-reference so the
  // user can see + add items their planned meals need. The cache lives in
  // localStorage so the list is correct on a fresh page load and survives
  // a reload — both pages reach it via src/lib/mealIngredientCache.js.
  const [mealIngredientsCache, setMealIngredientsCache] = useState(() => loadIngredientCache());
  // Cross-page sync. The util dispatches `famos:meal-ingredients-changed`
  // every time Meals.jsx writes a new ingredient list to the cache, and
  // the native `storage` event picks up writes from sibling tabs/windows.
  // Either path → we re-read the cache so the "Missing N" pill stays
  // accurate after a recipe lookup, without waiting for a reload.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refresh = () => setMealIngredientsCache(loadIngredientCache());
    window.addEventListener("famos:meal-ingredients-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("famos:meal-ingredients-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [missingBulkBusy, setMissingBulkBusy] = useState(false);

  useEffect(() => { localStorage.setItem(STAPLES_KEY, JSON.stringify(staples)); }, [staples]);

  const activeGroceries = useMemo(() => activeGroceryListId === "all" ? groceries : groceries.filter((item) => item.listId === activeGroceryListId), [groceries, activeGroceryListId]);
  const addGrocery = useCallback((item) => addGroceryBase({ ...item, listId: activeGroceryListId === "all" ? null : activeGroceryListId }), [addGroceryBase, activeGroceryListId]);
  const grouped = useMemo(() => {
    const map = {};
    for (const cat of GROCERY_CATEGORIES) map[cat] = [];
    for (const g of activeGroceries) {
      const category = categorizeGroceryItem(g.name, g.category);
      if (!map[category]) map[category] = [];
      map[category].push(category === g.category ? g : { ...g, category });
    }
    return map;
  }, [activeGroceries]);

  const checkedCount = activeGroceries.filter((g) => g.checked).length;
  const inventoriedSourceIds = useMemo(() => new Set(inventoryItems.map((item) => item.sourceGroceryId).filter(Boolean)), [inventoryItems]);
  const kitchenWatchItems = useMemo(() => inventoryItems.filter((item) => isKitchenWatchCategory(item.category)), [inventoryItems]);
  const purchasedForInventory = useMemo(() => groceries.filter((item) => {
    const category = categorizeGroceryItem(item.name, item.category);
    return item.checked && !inventoriedSourceIds.has(item.id) && isKitchenWatchCategory(category);
  }), [groceries, inventoriedSourceIds]);
  const visibleInventory = useMemo(() => kitchenWatchItems
    .filter((item) => item.location === inventoryLocation)
    .filter((item) => `${item.name} ${item.brand} ${item.category}`.toLowerCase().includes(inventoryQuery.trim().toLowerCase()))
    .filter((item) => {
      const expiry = inventoryExpiryStatus(item);
      if (inventoryStatus === "use-soon") return expiry && expiry.state !== "expired";
      if (inventoryStatus === "expired") return expiry?.state === "expired";
      if (inventoryStatus === "no-date") return !item.expiresOn;
      return true;
    })
    .sort((left, right) => {
      const leftExpiry = inventoryExpiryStatus(left);
      const rightExpiry = inventoryExpiryStatus(right);
      if (leftExpiry || rightExpiry) return (leftExpiry?.urgency ?? 99) - (rightExpiry?.urgency ?? 99);
      return left.name.localeCompare(right.name);
    }), [kitchenWatchItems, inventoryLocation, inventoryQuery, inventoryStatus]);
  const inventoryPulse = useMemo(() => kitchenWatchItems.reduce((summary, item) => {
    const status = inventoryExpiryStatus(item);
    if (status?.state === "expired") summary.expired += 1;
    else if (status) summary.soon += 1;
    return summary;
  }, { expired: 0, soon: 0 }), [kitchenWatchItems]);
  const priorityInventory = useMemo(() => kitchenWatchItems
    .map((item) => ({ item, expiry: inventoryExpiryStatus(item) }))
    .filter(({ expiry }) => expiry)
    .sort((left, right) => left.expiry.urgency - right.expiry.urgency)
    .slice(0, 4), [kitchenWatchItems]);
  const openInventoryDraft = (item = null, location = inventoryLocation) => {
    const suggestedCategory = item ? (item.category || categorizeGroceryItem(item.name, item.category)) : INVENTORY_CATEGORIES[0];
    const suggestion = item ? suggestExpiryDate(item.name, suggestedCategory, location) : null;
    const suggestedExpiry = suggestion ? (() => { const d = new Date(); d.setDate(d.getDate() + suggestion.days); return d.toISOString().slice(0,10); })() : "";
    setInventoryDraft(item ? {
      ...emptyInventoryDraft,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || "",
      location,
      sourceGroceryId: item.id,
      category: isKitchenWatchCategory(suggestedCategory) ? suggestedCategory : INVENTORY_CATEGORIES[0],
      brand: item.brand || "",
      barcode: item.barcode || "",
      imageUrl: item.imageUrl || "",
      expiresOn: item.expiresOn || suggestedExpiry,
    } : { ...emptyInventoryDraft, location });
    setInventoryError("");
    setInventoryAdding(true);
  };
  const saveInventoryItem = async () => {
    if (!inventoryDraft.name.trim() || inventorySaving) return;

    setInventorySaving(true); setInventoryError("");
    try {
      await addInventoryItem({ ...inventoryDraft, name: inventoryDraft.name.trim() });
      setInventoryDraft(emptyInventoryDraft); setInventoryAdding(false);
    } catch (error) {
      setInventoryError(error?.message || "This item could not be added.");
    } finally { setInventorySaving(false); }
  };
  const findMealsFromInventory = () => {
    window.sessionStorage.setItem("famos:meal-ideas-intent:v1", JSON.stringify({ date: todayISO(), slot: "dinner", kitchenOnly: true }));
    window.history.pushState({ tab: "meals" }, "", "/meals");
    window.dispatchEvent(new Event("popstate"));
  };
  const changeInventoryQuantity = (item, delta) => updateInventoryItem(item.id, { quantity: Math.max(1, Number(item.quantity || 1) + delta) });
  const handleToggleGrocery = async (item) => {
    const completesList = !item.checked && groceries.filter((grocery) => !grocery.checked).length === 1;
    await toggleGrocery(item.id);
    const purchasedCategory = categorizeGroceryItem(item.name, item.category);
    if (!item.checked && isKitchenWatchCategory(purchasedCategory) && !inventoriedSourceIds.has(item.id)) {
      setWatchPromptItem({ ...item, category: purchasedCategory });
    }
    if (!completesList) return;
    window.clearTimeout(celebrationTimerRef.current);
    setListCelebration(false);
    window.requestAnimationFrame(() => setListCelebration(true));
    celebrationTimerRef.current = window.setTimeout(() => setListCelebration(false), 2800);
  };

  useEffect(() => () => window.clearTimeout(celebrationTimerRef.current), []);
  const deliveryItems = useMemo(() => activeGroceries.filter((item) => !item.checked), [activeGroceries]);
  const deliveryListText = useMemo(() => {
    if (!deliveryItems.length) return "";
    return deliveryItems.map((item) => {
      const quantity = [item.quantity || 1, item.unit].filter(Boolean).join(" ");
      return `• ${item.name}${item.brand ? ` — ${item.brand}` : ""}${quantity ? ` — ${quantity}` : ""}${item.category ? ` (${item.category})` : ""}`;
    }).join("\n");
  }, [deliveryItems]);
  const deliveryShareText = useMemo(() => {
    const header = `FamOS grocery list — ${deliveryItems.length} item${deliveryItems.length === 1 ? "" : "s"}`;
    return deliveryListText ? `${header}\n\n${deliveryListText}` : header;
  }, [deliveryItems.length, deliveryListText]);
  const focusItems = useMemo(
    () => [...groceries].sort((a, b) => Number(a.checked) - Number(b.checked) || a.category.localeCompare(b.category)),
    [groceries]
  );

  // Per-meal missing-ingredient breakdown. Skips meals with no cached
  // ingredient list (e.g., a roulette-spun meal that has not been looked
  // up via Cook Mode yet) so the cross-reference only shows surface-able
  // gaps. Sort: chronological by date, then by typical slot order so the
  // modal reads Monday-breakfast → Monday-lunch → Monday-dinner → ...
  const SLOT_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
  const missingByMeal = useMemo(() => {
    const result = [];
    for (const meal of meals) {
      const names = mealIngredientsCache[meal.id];
      if (!Array.isArray(names) || !names.length) continue;
      const missing = Array.from(new Set(names.map(canonicalIngredientName).filter(Boolean)))
        .filter((name) => !isIngredientOnList(name, groceries));
      if (missing.length) {
        result.push({ meal, dateISO: meal.date, slot: meal.slot, title: meal.title || "Untitled meal", missing });
      }
    }
    return result.sort((a, b) => {
      if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
      return (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99);
    });
  }, [meals, mealIngredientsCache, groceries]);
  const totalMissingCount = useMemo(() => missingByMeal.reduce((acc, entry) => acc + entry.missing.length, 0), [missingByMeal]);
  // Deduped across-meal list — used for the bulk "Add all N missing" pill
  // in the modal header so adding doesn't double-add items shared between
  // two meals (e.g., a marinade shared by dinner + lunch the day after).
  const uniqueMissingNames = useMemo(() => {
    const seen = new Set();
    const unique = [];
    for (const entry of missingByMeal) {
      for (const name of entry.missing) {
        const key = String(name).trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(name);
      }
    }
    return unique;
  }, [missingByMeal]);

  const addMissingItem = async (rawName) => {
    const name = canonicalIngredientName(rawName);
    if (!name) return;
    if (isIngredientOnList(name, groceries)) {
      // Already on the list — no-op so the button doesn't re-add.
      return;
    }
    await addGrocery({ name, quantity: 1, unit: "" });
    // The ingredients-cache stays untouched; this is a forward increment
    // and the user's grocery-list state already reflects the new item.
  };
  const addAllMissingItems = async () => {
    if (!uniqueMissingNames.length) return;
    setMissingBulkBusy(true);
    // Sequential so a single failure stops the bulk instead of partially
    // succeeding silently. Also surfaces one row-per-write to the
    // realtime channel so sibling devices see cascading grocery entries
    // — same muscle memory as the per-day clear pattern. The try/finally
    // resets `missingBulkBusy` even on a thrown write so the button
    // re-enables; we keep the modal open so the user sees the partial
    // state and can retry.
    try {
      for (const name of uniqueMissingNames) {
        await addGrocery({ name, quantity: 1, unit: "" });
      }
      setShowMissingModal(false);
    } finally {
      setMissingBulkBusy(false);
    }
  };

  // Abandon any in-flight "new"-item draft whose upload landed in
  // storage but never wrote a row. Without this, switching from
  // Add back to Add (or hitting a sibling row's pencil icon) would
  // orphan the previously-uploaded photo in the bucket. Same shape
  // as closeEditorModal — revoke preview, fire-and-forget remove,
  // then drop the local draft.
  const abandonDraftPhoto = () => {
    photoPickIdRef.current += 1;
    safeRevokeObjectUrl(photoDraft.previewUrl);
    if (photoDraft.remoteUrl && editingId === "new") {
      deleteGroceryPhoto(photoDraft.remoteUrl, supabase).then(({ error }) => {
        if (error) console.warn("Could not remove orphaned grocery photo on draft-switch.", error);
      });
    }
  };

  const openNew = () => {
    abandonDraftPhoto();
    setDraft(emptyDraft);
    setPhotoDraft(emptyPhoto);
    setSaveError("");
    setEditingId("new");
  };

  const openEdit = (item) => {
    abandonDraftPhoto();
    setDraft({ name: item.name, category: item.category, categoryManual: true, quantity: item.quantity ?? 1, unit: item.unit ?? "", brand: item.brand || "", imageUrl: item.imageUrl || "", assigneeIds: item.assigneeIds || [] });
    setPhotoDraft({ file: null, previewUrl: "", remoteUrl: item.photoUrl || "", uploading: false, error: "" });
    setSaveError("");
    setEditingId(item.id);
  };

  const updateDraftName = (name) => {
    setDraft((current) => ({
      ...current,
      name,
      category: current.categoryManual ? current.category : categoryFromItemName(name, "Other"),
    }));
  };

  const updateMasterName = (name) => {
    setMasterDraft((current) => ({
      ...current,
      name,
      category: current.categoryManual ? current.category : categoryFromItemName(name, "Other"),
    }));
  };

  const updateBarcodeName = (name) => {
    setBarcodeDraft((current) => ({
      ...current,
      name,
      category: current.categoryManual ? current.category : categoryFromItemName(name, "Other"),
    }));
  };

  const submit = async () => {
    if (!draft.name.trim() || saveBusy) return;
    setSaveBusy(true);
    setSaveError("");
    const photoUrl = photoDraft.remoteUrl || "";
    const previousPhotoUrl = editingId !== "new" ? (groceries.find((g) => g.id === editingId)?.photoUrl || "") : "";
    try {
      if (editingId === "new") {
        await addGrocery({ name: draft.name.trim(), category: draft.category, quantity: draft.quantity, unit: draft.unit.trim(), brand: draft.brand?.trim() || "", imageUrl: draft.imageUrl || "", assigneeIds: draft.assigneeIds || [], addedBy: null, photoUrl });
      } else {
        await updateGrocery(editingId, { name: draft.name.trim(), category: draft.category, quantity: draft.quantity, unit: draft.unit.trim(), brand: draft.brand?.trim() || "", imageUrl: draft.imageUrl || "", assigneeIds: draft.assigneeIds || [], photoUrl, previousPhotoUrl });
      }
      setEditingId(null);
      photoPickIdRef.current += 1;
      safeRevokeObjectUrl(photoDraft.previewUrl);
      setPhotoDraft(emptyPhoto);
    } catch (error) {
      setSaveError(error?.message || "This item couldn't be saved. Try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const addStapleToList = async (staple) => {
    const nameKey = staple.name.trim().toLowerCase();
    const listKey = activeGroceryListId === "all" ? "all" : activeGroceryListId;
    const pendingKey = `${listKey}:${nameKey}`;
    if (!nameKey || pendingStaplesRef.current.has(pendingKey)) return;
    pendingStaplesRef.current.add(pendingKey);
    try {
      const currentGroceries = groceriesRef.current || groceries;
      const existing = currentGroceries.find((item) => item.name.trim().toLowerCase() === nameKey && (listKey === "all" || item.listId === listKey));
      if (existing) {
        if (existing.checked) await updateGrocery(existing.id, { checked: false });
        return;
      }
      await addGrocery({ ...staple, assigneeIds: [...new Set(staple.assigneeIds || [])], addedBy: null });
    } finally {
      // Keep the guard for a beat after the write settles so a trailing click
      // from the same gesture (touch drag-release, fast double-tap) can't slip
      // past with a stale closure and add a duplicate row.
      window.setTimeout(() => pendingStaplesRef.current.delete(pendingKey), 500);
    }
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
    setMasterDraft(item ? { name: item.name, category: item.category, categoryManual: true, quantity: item.quantity || 1, unit: item.unit || "" } : emptyDraft);
  };

  const saveMasterItem = () => {
    if (!masterDraft.name.trim()) return;
    const item = { ...masterDraft, name: masterDraft.name.trim(), unit: masterDraft.unit.trim() };
    if (masterEditing === "new") setStaples((current) => [...current, { id: `staple_${Date.now()}`, ...item }]);
    else setStaples((current) => current.map((staple) => staple.id === masterEditing ? { ...staple, ...item } : staple));
    setMasterEditing(null);
  };

  const stopBarcodeScanner = useCallback(() => {
    scannerSessionRef.current += 1;
    scannerControlsRef.current?.stop?.();
    scannerControlsRef.current = null;
    const stream = scannerVideoRef.current?.srcObject;
    stream?.getTracks?.().forEach((track) => track.stop());
    if (scannerVideoRef.current) scannerVideoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopBarcodeScanner(), [stopBarcodeScanner]);

  const closeBarcodeModal = () => {
    stopBarcodeScanner();
    setScannerOpen(false);
    setBarcodeModal(false);
    if (returnToFocus) setFocusMode(true);
    setReturnToFocus(false);
  };

  const resetBarcodeDraft = () => {
    setBarcodeDraft(emptyBarcodeDraft);
    setBarcodeStatus("");
    setBarcodeLoading(false);
    setScannerError("");
    scannerHandledRef.current = false;
  };

  const lookupBarcodeProduct = async (code) => {
    const cleanCode = normalizeBarcode(code);
    if (!cleanCode) {
      setBarcodeStatus("Enter or scan a barcode first.");
      return null;
    }

    setBarcodeLoading(true);
    setBarcodeStatus("Looking up product details…");
    try {
      if (supabase) {
        for (const candidate of barcodeCandidates(cleanCode)) {
          const { data: spoonacularData } = await supabase.functions.invoke("food-product-lookup", { body: { upc: candidate } });
          const spoonacularProduct = spoonacularData?.product;
          if (!spoonacularProduct?.name) continue;
          const category = categorizeGroceryItem(spoonacularProduct.name, spoonacularProduct.aisle || "Other");
          setBarcodeDraft((draft) => ({
            ...draft,
            code: candidate,
            name: spoonacularProduct.name,
            brand: spoonacularProduct.brand || draft.brand,
            category,
            quantity: draft.quantity || 1,
            unit: spoonacularProduct.servingSize || "",
            imageUrl: spoonacularProduct.imageUrl || draft.imageUrl,
          }));
          setBarcodeStatus(`Found ${spoonacularProduct.name}. Review the details, then save it to your list.`);
          return spoonacularProduct;
        }
      }

      // Open Food Facts remains a resilient fallback when Spoonacular has no
      // matching UPC, is rate-limited, or the household is temporarily offline.
      let data = null;
      let resolvedCode = cleanCode;
      for (const candidate of barcodeCandidates(cleanCode)) {
        const url = `${PRODUCT_LOOKUP_ENDPOINT}/${encodeURIComponent(candidate)}.json?fields=code,product_name,product_name_en,generic_name,generic_name_en,brands,categories,categories_tags,quantity,serving_size,image_front_small_url,image_front_url`;
        const response = await fetch(url);
        if (!response.ok) continue;
        const result = await response.json();
        if (result.status === 1 && result.product) {
          data = result;
          resolvedCode = candidate;
          break;
        }
      }
      if (!data?.product) {
        setBarcodeDraft((draft) => ({ ...draft, code: cleanCode }));
        setBarcodeStatus("Barcode captured, but no product data was found. You can type the item details and save it.");
        return null;
      }

      const product = data.product;
      const productName = productNameFromApi(product);
      const category = categoryFromApi(product);
      setBarcodeDraft((draft) => ({
        ...draft,
        code: resolvedCode,
        name: productName || draft.name,
        brand: firstCommaValue(product.brands || "") || draft.brand,
        category,
        quantity: draft.quantity || 1,
        unit: "",
        imageUrl: product.image_front_small_url || product.image_front_url || draft.imageUrl,
      }));
      setBarcodeStatus(productName ? `Found ${productName}. Review the details, then save it to your list.` : "Product found. Review the details, then save it to your list.");
      return product;
    } catch {
      setBarcodeDraft((draft) => ({ ...draft, code: cleanCode }));
      setBarcodeStatus("Could not reach the product database. You can still type the item details and save it.");
      return null;
    } finally {
      setBarcodeLoading(false);
    }
  };

  const readBarcodeFromImage = async (file) => {
    if (!file) return;
    setBarcodeStatus("Reading barcode from photo…");
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await loadZxing();
      const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ]]]);
      const reader = new BrowserMultiFormatReader(hints);
      const objectUrl = await prepareBarcodeImage(file);
      let result;
      try {
        result = await reader.decodeFromImageUrl(objectUrl);
      } finally {
        safeRevokeObjectUrl(objectUrl);
      }
      const code = result?.getText?.() || "";
      if (!code) {
        setBarcodeStatus("No barcode found. Try a brighter photo, or type the barcode manually.");
        return;
      }
      setBarcodeDraft((draft) => ({ ...draft, code }));
      await lookupBarcodeProduct(code);
    } catch {
      setBarcodeStatus("No barcode found. Hold the camera square to the code, or enter the numbers manually.");
    }
  };

  const startBarcodeScanner = async () => {
    if (scannerStarting || scannerOpen) return;
    const sessionId = ++scannerSessionRef.current;
    setScannerOpen(true);
    setScannerStarting(true);
    setScannerError("");
    scannerHandledRef.current = false;
    // Let the modal paint once so the video ref exists, instead of waiting two
    // animation frames before requesting camera permission.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const video = scannerVideoRef.current;
      if (!video || !navigator.mediaDevices?.getUserMedia) throw new Error("Camera is unavailable in this browser.");
      // Prefer the platform detector on supported phones. It avoids loading
      // ZXing's continuous decoder beside a live camera stream — a combination
      // that can exceed iOS PWA memory limits and reload the whole app.
      if (typeof window.BarcodeDetector === "function") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 640, max: 960 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 12, max: 20 } },
        });
        if (sessionId !== scannerSessionRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        let stopped = false;
        const controls = { stop: () => { stopped = true; stream.getTracks().forEach((track) => track.stop()); } };
        scannerControlsRef.current = controls;
        const scan = async () => {
          if (stopped || sessionId !== scannerSessionRef.current || scannerHandledRef.current) return;
          try {
            const matches = await detector.detect(video);
            const code = matches?.[0]?.rawValue || "";
            if (code) {
              scannerHandledRef.current = true;
              controls.stop();
              scannerControlsRef.current = null;
              setScannerOpen(false);
              setBarcodeDraft((draft) => ({ ...draft, code }));
              await lookupBarcodeProduct(code);
              return;
            }
          } catch { /* A frame can be unavailable while Safari focuses. */ }
          window.setTimeout(scan, 160);
        };
        window.setTimeout(scan, 120);
        return;
      }
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await loadZxing();
      const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ]]]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 140, delayBetweenScanSuccess: 400 });
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 640, max: 960 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 12, max: 20 } } },
        video,
        async (result) => {
          if (!result || scannerHandledRef.current || sessionId !== scannerSessionRef.current) return;
          scannerHandledRef.current = true;
          const code = result.getText();
          stopBarcodeScanner();
          setScannerOpen(false);
          setBarcodeDraft((draft) => ({ ...draft, code }));
          await lookupBarcodeProduct(code);
        }
      );
      if (sessionId !== scannerSessionRef.current) { controls.stop?.(); return; }
      scannerControlsRef.current = controls;
    } catch (error) {
      stopBarcodeScanner();
      const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      setScannerError(denied
        ? "Camera access is off. Allow camera access in Safari settings, then try again."
        : "The camera could not start. You can scan a saved photo or enter the UPC below.");
    } finally {
      setScannerStarting(false);
    }
  };

  const barcodeItem = () => ({
    name: barcodeDraft.name.trim(),
    category: barcodeDraft.category,
    quantity: barcodeDraft.quantity || 1,
    unit: "",
    barcode: normalizeBarcode(barcodeDraft.code),
    brand: barcodeDraft.brand.trim(),
    price: barcodeDraft.price === "" ? null : Number(barcodeDraft.price),
    imageUrl: barcodeDraft.imageUrl,
    addedBy: null,
  });

  const saveBarcodeFavourite = () => {
    if (!barcodeDraft.name.trim()) return;
    const item = {
      id: `staple_${Date.now()}`,
      ...barcodeItem(),
    };
    setStaples((current) => {
      const normalizedName = item.name.toLowerCase();
      const withoutDuplicate = current.filter((staple) => {
        const sameBarcode = item.barcode && staple.barcode === item.barcode;
        const sameName = staple.name.toLowerCase() === normalizedName;
        return !sameBarcode && !sameName;
      });
      return [...withoutDuplicate, item];
    });
    setBarcodeStatus(`${item.name} is saved to favourites.`);
  };

  const addScannedItem = async (openFocus = false) => {
    if (!barcodeDraft.name.trim()) return;
    await addGrocery(barcodeItem());
    setReturnToFocus(false);
    setBarcodeModal(false);
    if (openFocus || returnToFocus) setFocusMode(true);
  };

  const openDelivery = () => {
    setDeliveryStatus("");
    setDeliveryModal(true);
  };

  const copyDeliveryList = async () => {
    if (!deliveryItems.length) {
      setDeliveryStatus("Add a few groceries first, then FamOS can package them up for another app.");
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(deliveryShareText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = deliveryShareText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setDeliveryStatus("Copied. Open DoorDash or Instacart and paste/import the list there.");
    } catch {
      setDeliveryStatus("Copy did not work in this browser. You can still select the list text and copy it manually.");
    }
  };

  const shareDeliveryList = () => {
    if (!deliveryItems.length) {
      setDeliveryStatus("Your active grocery list is empty.");
      return;
    }
    // Build a deep link so the recipient opens FamOS directly into the list,
    // not a pasted text dump. The share sheet offers SMS/email/copy/native.
    const link = buildShareUrl("list", household?.id || "active");
    setGroceryShare({
      title: `Grocery list · ${deliveryItems.length} item${deliveryItems.length === 1 ? "" : "s"}`,
      text: deliveryShareText,
      url: link,
      image: "/banners/banner-shopping-lists.jpg",
      imageAlt: "FamOS shopping list",
    });
  };

  const downloadDeliveryList = () => {
    if (!deliveryItems.length) {
      setDeliveryStatus("Your active grocery list is empty.");
      return;
    }
    const blob = new Blob([deliveryShareText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "famos-grocery-list.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDeliveryStatus("Downloaded as a text list you can import or paste.");
  };

  const openGroceryPartner = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <PullToRefresh onRefresh={refreshData}><div className="pb-28 reference-groceries famos-noscroll">
      {listCelebration && (
        <><CelebrationConfetti intensity={52} /><div className="shopping-complete-celebration" role="status" aria-live="polite">
          <span className="shopping-complete-particles" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</span>
          <span className="shopping-complete-icon" aria-hidden="true"><CheckCircle2 size={24} /></span>
          <span><strong>Cart conquered</strong><small>Every last item. Nicely done.</small></span>
        </div></>
      )}
      <PageHeader
        title="Shopping"
        illustration="groceries"
        subtitle="A shared memory for everything the fridge forgot to mention."
      />

      <NativeAdBanner placement={AD_PLACEMENTS.SHOPPING} />

      <div className="shopping-list-switcher" role="tablist" aria-label="Shopping lists">
        <button type="button" role="tab" aria-selected={activeGroceryListId === "all"} className={activeGroceryListId === "all" ? "selected" : ""} onClick={() => setActiveGroceryListId("all")}><ShoppingBasket size={15}/><span>All shopping</span><em>{groceries.filter((item) => !item.checked).length}</em></button>
        {groceryLists.map((list) => <div className={`shopping-list-tab ${activeGroceryListId === list.id ? "selected" : ""}`} style={{ "--list-tone": list.color }} key={list.id}><button type="button" role="tab" aria-selected={activeGroceryListId === list.id} onClick={() => setActiveGroceryListId(list.id)}><ListChecks size={15}/><span>{list.name}</span><em>{groceries.filter((item) => item.listId === list.id && !item.checked).length}</em></button><button type="button" className="shopping-list-delete" onClick={() => setDeletingList(list)} aria-label={`Delete ${list.name}`} title={`Delete ${list.name}`}><Trash2 size={13}/></button></div>)}
        <button type="button" className="shopping-list-add" onClick={() => setNewListOpen(true)}><Plus size={15}/><span>New list</span></button>
      </div>

      <div className="grocery-actions-row">
        {totalMissingCount > 0 && (
          <button
            type="button"
            onClick={() => setShowMissingModal(true)}
            aria-label={`View ${totalMissingCount} missing ingredients from planned meals`}
            title="Cross-reference planned meals against your list"
          >
            <ListChecks size={14} /> Missing {totalMissingCount}
          </button>
        )}
        <button onClick={() => { resetBarcodeDraft(); setReturnToFocus(false); setBarcodeModal(true); }}><ScanLine size={14} /> Scan product</button>
        {groceries.length > 0 && <button onClick={() => setFocusMode(true)}><Maximize2 size={14} /> Focus shop</button>}
        {checkedCount > 0 && <button onClick={() => setClearingChecked(true)}>Clear {checkedCount} checked</button>}
        {groceries.length > 0 && <button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>}
      </div>

      {false && <><section className="kitchen-inventory-card" aria-labelledby="kitchen-inventory-title">
        <header>
          <span className="kitchen-inventory-mark"><Refrigerator size={20} /></span>
          <div><p>Kitchen watch</p><h2 id="kitchen-inventory-title">Fresh food at home</h2><small>Watch the dairy, meat, produce, deli, and bakery items most likely to spoil.</small></div>
          <button type="button" className="inventory-add-button" onClick={() => openInventoryDraft()}><Plus size={15}/> Add fresh item</button>
        </header>
        <div className="inventory-pulse" aria-label="Kitchen inventory summary">
          <div className={inventoryPulse.expired ? "urgent" : ""}><span><Clock3 size={15}/></span><strong>{inventoryPulse.expired}</strong><small>Expired</small></div>
          <div className={inventoryPulse.soon ? "soon" : ""}><span><HeartPulse size={15}/></span><strong>{inventoryPulse.soon}</strong><small>Use soon</small></div>
          <div><span><Package size={15}/></span><strong>{kitchenWatchItems.length}</strong><small>Being watched</small></div>
        </div>
        {kitchenWatchItems.length > 0 && <div className="inventory-meal-ideas"><span><Sparkles size={16}/></span><div><strong>Need inspiration?</strong><small>Find recipes that use some of the fresh food you already have.</small></div><button type="button" onClick={findMealsFromInventory}>Find meal ideas</button></div>}
        {priorityInventory.length > 0 && <div className="inventory-use-first"><div><span><Clock3 size={15}/></span><div><strong>Use first</strong><small>Start here before the next grocery run.</small></div></div><div>{priorityInventory.map(({ item, expiry }) => <button type="button" key={item.id} onClick={() => { setInventoryLocation(item.location); setInventoryStatus(expiry.state === "expired" ? "expired" : "use-soon"); setInventoryQuery(item.name); }}><span>{item.name}</span><em>{expiry.label}</em></button>)}</div></div>}
        {purchasedForInventory.length > 0 && (
          <div className="inventory-purchased-strip">
            <strong>Just bought</strong>
            {purchasedForInventory.slice(0, 4).map((item) => (
              <div key={item.id}><span>{item.name}</span><div>
                <button onClick={() => openInventoryDraft(item, "fridge")}>Fridge</button>
                <button onClick={() => openInventoryDraft(item, "freezer")}>Freezer</button>
                <button onClick={() => openInventoryDraft(item, "pantry")}>Pantry</button>
              </div></div>
            ))}
          </div>
        )}
        <div className="inventory-tools">
          <label className="inventory-search"><Search size={15}/><input value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} placeholder="Search item, brand or category" aria-label="Search kitchen inventory"/>{inventoryQuery && <button type="button" onClick={() => setInventoryQuery("")} aria-label="Clear inventory search"><X size={13}/></button>}</label>
          <div className="inventory-status-filter" role="group" aria-label="Filter inventory by expiry">
            {[["all","All"],["use-soon","Use soon"],["expired","Expired"],["no-date","Needs date"]].map(([id,label]) => <button type="button" key={id} className={inventoryStatus === id ? "selected" : ""} onClick={() => setInventoryStatus(id)}>{label}</button>)}
          </div>
        </div>
        <div className="inventory-location-tabs" role="tablist" aria-label="Kitchen storage location">
          {[['fridge','Fridge',Refrigerator],['freezer','Freezer',Snowflake],['pantry','Pantry',Package]].map(([id,label,Icon]) => <button key={id} className={inventoryLocation === id ? "selected" : ""} onClick={() => setInventoryLocation(id)} role="tab" aria-selected={inventoryLocation === id}><Icon size={14}/>{label}<span>{kitchenWatchItems.filter((item) => item.location === id).length}</span></button>)}
        </div>
        {visibleInventory.length ? <div className="inventory-item-grid">{visibleInventory.map((item) => { const expiry = inventoryExpiryStatus(item); const onList = isIngredientOnList(item.name, groceries); return <article key={item.id} className={expiry ? `is-${expiry.state}` : ""}>
          <div className="inventory-item-copy">{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <GroceryIcon category={item.category}/>}<div><span>{item.category || "Other"}</span><strong>{item.name}</strong>{item.brand && <small>{item.brand}</small>}{expiry && <em>{expiry.label}</em>}</div></div>
          <DateField compact label="Use by" value={item.expiresOn} onChange={(expiresOn) => updateInventoryItem(item.id, { expiresOn })}/>
          <div className="inventory-item-actions"><div className="inventory-quantity" aria-label={`${item.name} quantity`}><button type="button" onClick={() => changeInventoryQuantity(item, -1)} disabled={Number(item.quantity) <= 1} aria-label={`Decrease ${item.name} quantity`}><Minus size={12}/></button><strong>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</strong><button type="button" onClick={() => changeInventoryQuantity(item, 1)} aria-label={`Increase ${item.name} quantity`}><Plus size={12}/></button></div>{expiry?.state === "expired" && <button type="button" disabled={onList} onClick={() => addMissingItem(item.name)}><RotateCcw size={13}/>{onList ? "On list" : "Replace"}</button>}<button type="button" onClick={() => removeInventoryItem(item.id)} aria-label={`Mark ${item.name} used up`}><Check size={13}/>Used up</button></div>
        </article>;})}</div> : <div className="inventory-empty"><span>{inventoryQuery || inventoryStatus !== "all" ? <Search size={20}/> : <Refrigerator size={20}/>}</span><strong>{inventoryQuery || inventoryStatus !== "all" ? "No matching fresh items" : `No fresh food being watched in the ${inventoryLocation}`}</strong><p>{inventoryQuery || inventoryStatus !== "all" ? "Try another search or expiry filter." : <>Use <b>Add fresh item</b> for dairy, meat, produce, deli, or bakery food. Checked perishables from Shopping also appear here for a quick review.</>}</p>{inventoryQuery || inventoryStatus !== "all" ? <button type="button" onClick={() => { setInventoryQuery(""); setInventoryStatus("all"); }}>Clear filters</button> : null}</div>}
      </section>

      <Modal open={inventoryAdding} onClose={() => { if (!inventorySaving) { setInventoryAdding(false); setInventoryError(""); } }} title="Add fresh food to Kitchen Watch">
        <p className="inventory-add-intro">Kitchen Watch is only for short-life perishables: produce, dairy and eggs, meat and seafood, deli food, and bakery items. Everything else stays on the Shopping list.</p>
        <TextField label="Item" placeholder="e.g. Milk, chicken, or strawberries" value={inventoryDraft.name} onChange={(event) => {
          const name = event.target.value;
          setInventoryDraft((current) => {
            const s = suggestExpiryDate(name, current.category, current.location);
            const expiry = s ? (() => { const d = new Date(); d.setDate(d.getDate() + s.days); return d.toISOString().slice(0,10); })() : current.expiresOn;
            return { ...current, name, expiresOn: expiry };
          });
        }}/>
        <div className="inventory-add-grid"><label className="inventory-select-field"><span>Category</span><select value={inventoryDraft.category} onChange={(event) => {
          const cat = event.target.value;
          setInventoryDraft((current) => {
            const s = suggestExpiryDate(current.name, cat, current.location);
            const expiry = s ? (() => { const d = new Date(); d.setDate(d.getDate() + s.days); return d.toISOString().slice(0,10); })() : current.expiresOn;
            return { ...current, category: cat, expiresOn: expiry };
          });
        }}>{INVENTORY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><TextField label="Brand (optional)" placeholder="e.g. Compliments" value={inventoryDraft.brand} onChange={(event) => setInventoryDraft((current) => ({ ...current, brand: event.target.value }))}/></div>
        <div className="inventory-add-grid"><TextField label="Quantity" inputMode="decimal" value={inventoryDraft.quantity} onChange={(event) => setInventoryDraft((current) => ({ ...current, quantity: Math.max(Number(event.target.value) || 1, 1) }))}/><TextField label="Unit (optional)" placeholder="bag, carton, lb" value={inventoryDraft.unit} onChange={(event) => setInventoryDraft((current) => ({ ...current, unit: event.target.value }))}/></div>
        <label className="inventory-add-location"><span>Store in</span><div>{[["fridge","Fridge",Refrigerator],["freezer","Freezer",Snowflake],["pantry","Pantry",Package]].map(([id,label,Icon]) => <button type="button" key={id} className={inventoryDraft.location === id ? "selected" : ""} onClick={() => {
          setInventoryDraft((current) => {
            const s = suggestExpiryDate(current.name, current.category, id);
            const expiry = s ? (() => { const d = new Date(); d.setDate(d.getDate() + s.days); return d.toISOString().slice(0,10); })() : current.expiresOn;
            return { ...current, location: id, expiresOn: expiry };
          });
        }}><Icon size={15}/>{label}</button>)}</div></label>
        <DateField label="Use by or best before" value={inventoryDraft.expiresOn} onChange={(expiresOn) => setInventoryDraft((current) => ({ ...current, expiresOn }))}/>
        {inventoryDraft.name && (() => { const s = suggestExpiryDate(inventoryDraft.name, inventoryDraft.category, inventoryDraft.location); return s ? <p className="inventory-suggestion-hint" style={{fontSize:'0.75rem',color:'var(--accent)',marginTop:'-0.5rem',marginBottom:'0.5rem'}}>Suggested: {s.label} (from {s.source} data)</p> : null; })()}
        {inventoryError && <p className="inventory-add-error" role="alert">{inventoryError}</p>}
        <PrimaryButton onClick={saveInventoryItem} disabled={inventorySaving || !inventoryDraft.name.trim() || !inventoryDraft.expiresOn}>{inventorySaving ? "Adding…" : "Add to inventory"}</PrimaryButton>
      </Modal></>}

      <div className="px-5 space-y-5 mt-2">
        {false && <Card
          className="delivery-banner-card relative overflow-hidden p-5 border-white/10 shadow-[0_22px_55px_rgba(18,16,43,0.24)]"
        >
          <img src="/marketing/delivery-banner.png" alt="" className="delivery-banner-art" aria-hidden="true" />
          <div className="delivery-banner-shade" aria-hidden="true" />
          <div className="relative flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl bg-[color-mix(in_srgb,var(--color-surface)_95%,transparent)] flex items-center justify-center shrink-0 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ring-1 ring-[var(--color-border-strong)]/60">
              <Truck size={21} color="var(--color-accent)" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-[var(--font-display)] text-[19px] font-semibold tracking-[-0.025em] text-white">Take your list to checkout</p>
                  <p className="text-[13px] text-white/75 mt-0.5">Copy or share your list, then paste it into your grocery delivery app.</p>
                </div>
                <button
                  onClick={openDelivery}
                  disabled={!deliveryItems.length}
                  className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-surface)_95%,transparent)] text-[var(--color-accent)] border border-[var(--color-border)]/60 px-3 py-2 text-[12px] font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.16)] disabled:opacity-45"
                >
                  <ShoppingBag size={14} />
                  {deliveryItems.length ? `${deliveryItems.length} item${deliveryItems.length === 1 ? "" : "s"}` : "List empty"}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {GROCERY_DELIVERY_APPS.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => openGroceryPartner(app.url)}
                    className="min-h-[48px] rounded-2xl bg-[var(--color-surface)] px-3 flex items-center justify-center transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                    style={{ border: `1px solid ${app.brandBorder}`, boxShadow: `0 11px 24px ${app.brandColor}1c` }}
                    aria-label={`Open ${app.name}`}
                  >
                    <GroceryDeliveryLogo app={app} />
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button onClick={copyDeliveryList} disabled={!deliveryItems.length} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3 py-2 text-[11.5px] font-semibold text-[var(--color-ink)] border border-black/5 shadow-sm disabled:opacity-45"><Clipboard size={13} /> Copy</button>
                <button onClick={shareDeliveryList} disabled={!deliveryItems.length} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3 py-2 text-[11.5px] font-semibold text-[var(--color-ink)] border border-black/5 shadow-sm disabled:opacity-45"><Share2 size={13} /> Share</button>
                <button onClick={downloadDeliveryList} disabled={!deliveryItems.length} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3 py-2 text-[11.5px] font-semibold text-[var(--color-ink)] border border-black/5 shadow-sm disabled:opacity-45"><Download size={13} /> Save</button>
              </div>
            </div>
          </div>
        </Card>}

        <section>
          <div className="flex items-end justify-between mb-3 px-1">
            <div><p className="page-eyebrow">Saved staples</p><h2 className="grocery-section-title">Quick add</h2></div>
            <button onClick={() => openMasterItem()} className="flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-accent)]"><Plus size={13} /> New staple</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(showAllStaples ? staples : staples.slice(0, 6)).map((staple) => <div key={staple.id} draggable onDragStart={(event) => { event.dataTransfer.setData("application/json", JSON.stringify(staple)); setDragging(true); }} onDragEnd={() => setDragging(false)} className="group relative min-w-0 flex items-center rounded-2xl bg-[var(--color-surface)] notion-shadow overflow-hidden cursor-grab active:cursor-grabbing">
              <button onClick={() => addStapleToList(staple)} className="flex flex-1 min-w-0 items-center gap-2.5 p-2.5 text-left active:bg-[var(--color-accent-soft)] transition-colors" aria-label={`Add ${staple.name} to grocery list`}>
                <GroceryIcon category={staple.category} size={15} />
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium truncate">{staple.name}</span><span className="block text-[10.5px] text-[var(--color-ink-faint)] truncate">{staple.quantity}{staple.unit ? ` ${staple.unit}` : ""}</span></span>
                <span className="w-6 h-6 rounded-full bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0"><Plus size={13} color="var(--color-accent)" strokeWidth={2.5} /></span>
              </button>
              <button onClick={() => openMasterItem(staple)} className="self-stretch px-2 border-l border-[var(--color-border)] bg-[var(--color-surface-sunken)]" aria-label={`Edit ${staple.name}`}><Pencil size={12} color="var(--color-ink-faint)" /></button>
            </div>)}
          </div>
          {staples.length > 6 && (
            <button onClick={() => setShowAllStaples((shown) => !shown)} className="w-full mt-2.5 text-center text-[11.5px] font-medium text-[var(--color-accent)] py-1">
              {showAllStaples ? "Show fewer staples" : `Show all ${staples.length} staples`}
            </button>
          )}
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[10.5px] text-[var(--color-ink-faint)]">
            <GripVertical size={12} />
            <p>Tap to add, or drag a staple into your list.</p>
          </div>
        </section>

        <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={dropStaple} className={`rounded-2xl transition-all ${dragging ? "ring-2 ring-[var(--color-accent)] bg-[var(--color-accent-soft)] p-2" : ""}`}>
          {dragging && <p className="text-center text-[12px] font-semibold text-[var(--color-accent)] py-3">Drop here to add to your list</p>}
        {groceries.length === 0 ? (
          <EmptyState title="The list is gloriously empty" subtitle="Add the first thing before someone remembers it in the parking lot." />
        ) : (
          Object.entries(grouped).map(([cat, items]) =>
            items.length === 0 ? null : (
              <section key={cat}>
                <div className="grocery-category-title"><h2>{cat}</h2><span>{items.filter((i) => !i.checked).length} item{items.filter((i) => !i.checked).length === 1 ? "" : "s"}</span></div>
                <Card className="p-1">
                  <ul>
                    {items.map((item) => {
                      const adder = item.addedBy ? memberById[item.addedBy] : null;
                      const assignedPeople = [...new Set(item.assigneeIds || [])].map((id) => memberById[id]).filter((person, index, people) => person && people.findIndex((candidate) => candidate.id === person.id) === index);
                      const qtyLabel = [item.quantity > 1 || item.unit ? item.quantity : null, item.unit]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <li
                          key={item.id}
                          className={`grocery-list-row flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)] last:border-0 ${item.checked ? "is-checked" : ""}`}
                        >
                          <Checkbox checked={item.checked} onChange={() => handleToggleGrocery(item)} />
                          <GroceryItemImage item={item} memberById={memberById} />
                          <button onClick={() => openEdit(item)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                            <span
                              className={`min-w-0 text-[14.5px] ${
                                item.checked ? "line-through text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"
                              }`}
                            >
                              <span className="block truncate">{item.name}</span>
                              {item.brand && <small className="block truncate text-[11px] text-[var(--color-ink-soft)] no-underline">{item.brand}</small>}
                            </span>
                            {qtyLabel && (
                              <span
                                className="text-[11.5px] font-medium text-[var(--color-accent-strong)] bg-[var(--color-accent-soft)] rounded-full px-2 py-0.5 shrink-0"
                              >
                                {qtyLabel}
                              </span>
                            )}
                          </button>
                           {assignedPeople.length > 0 && !item.checked && (
                            <div className="assignment-avatars grocery-assignees" aria-label={`For ${assignedPeople.map((person) => person.name).join(", ")}`} title={`For ${assignedPeople.map((person) => person.name).join(", ")}`}>
                              {assignedPeople.slice(0, 3).map((person) => <Avatar key={person.id} member={person} size="xs" />)}
                              {assignedPeople.length > 3 && <span>+{assignedPeople.length - 3}</span>}
                            </div>
                          )}
                          {(function isFavourite() {
                            const isFav = staples.some((staple) => staple.name.toLowerCase() === item.name.toLowerCase());
                            return (
                              <button
                                onClick={() => saveAsStaple(item)}
                                className="flex items-center gap-1 shrink-0 text-[var(--color-ink-faint)]"
                                aria-label={isFav ? `Remove ${item.name} from favourites` : `Save ${item.name} as a frequent item`}
                                title={isFav ? "Saved as favourite" : "Save as favourite"}
                              >
                                <Star size={15} fill={isFav ? "#f5a623" : "none"} color={isFav ? "#f5a623" : "currentColor"} />
                                {isFav && <span className="text-[10px] font-semibold text-[#f5a623]">Fav</span>}
                              </button>
                            );
                          })()}
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

      <Modal open={!!editingId} onClose={closeEditorModal} title={editingId === "new" ? "Add a grocery" : "Edit grocery"}>
        <TextField
          label="Item"
          placeholder="e.g. Sourdough bread"
          value={draft.name}
          onChange={(e) => updateDraftName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <TextField label="Brand (optional)" placeholder="e.g. Liberté" value={draft.brand || ""} onChange={(e) => setDraft((current) => ({ ...current, brand: e.target.value }))} />

        <GroceryCategorySelect value={draft.category} itemName={draft.name} onChange={(category) => setDraft((current) => ({ ...current, category, categoryManual: true }))}/>

        <div className="grocery-quantity-row mb-4">
          <div className="form-field grocery-quantity-field">
            <span className="form-label">Quantity</span>
            <Stepper value={draft.quantity} onChange={(v) => setDraft((d) => ({ ...d, quantity: v }))} />
          </div>
          <div>
            <TextField
              label="Unit (optional)"
              placeholder="e.g. lb, bag, dozen"
              value={draft.unit}
              onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
            />
          </div>
        </div>

        <p className="task-assignee-label">For family members <small>Optional · choose one or more</small></p>
        <div className="task-assignee-picker grocery-member-picker">
          {members.map((member) => {
            const selected = (draft.assigneeIds || []).includes(member.id);
            return <button type="button" key={member.id} aria-pressed={selected} className={selected ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, assigneeIds: selected ? current.assigneeIds.filter((id) => id !== member.id) : [...new Set([...(current.assigneeIds || []), member.id])] }))}><Avatar member={member}/><span>{member.name}</span>{selected && <Check size={14}/>}</button>;
          })}
        </div>

        {/* Photo pick — mobile uses capture="environment" so the picker
            opens the rear camera; desktop falls back to a plain file
            input. Either way land in onPickPhotoFile, which uploads
            client-side and surfaces the signed URL in the card + focus
            shop on every device in the household via realtime. */}
        <div className="grocery-photo-section">
          <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Photo (optional)</p>
          <div className="flex items-center gap-3">
            <div className="grocery-photo-thumb" aria-hidden={(photoDraft.previewUrl || photoDraft.remoteUrl) ? "false" : "true"}>
              {(photoDraft.previewUrl || photoDraft.remoteUrl) ? (
                <img src={photoDraft.previewUrl || photoDraft.remoteUrl} alt="" />
              ) : (
                <ImageIcon size={18} />
              )}
              {photoDraft.uploading && <span className="grocery-photo-spinner" aria-label="Uploading photo" />}
            </div>
            <div className="grow flex flex-wrap gap-2">
              <input ref={photoCameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickPhotoFile} />
              <input ref={photoLibraryInputRef} type="file" accept="image/*" hidden onChange={onPickPhotoFile} />
              <button type="button" onClick={() => photoCameraInputRef.current?.click()} className="primary-action-button small"><Camera size={14} /> Take photo</button>
              <button type="button" onClick={() => photoLibraryInputRef.current?.click()} className="secondary-action-button small"><Upload size={14} /> Upload</button>
              {(photoDraft.remoteUrl || photoDraft.previewUrl) && <button type="button" onClick={clearPhoto} className="secondary-action-button small"><X size={14} /> Remove</button>}
            </div>
          </div>
          {photoDraft.error && <p className="text-[12px] text-[var(--color-warn)] mt-2">{photoDraft.error}</p>}
          <p className="text-[11.5px] text-[var(--color-ink-faint)] mt-2 leading-snug">Photos stay private to your household and sync to every device realtime when the list changes.</p>
        </div>

        <div className="flex gap-2 mt-4">
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
          <PrimaryButton onClick={submit} disabled={!draft.name.trim() || saveBusy || photoDraft.uploading}>
            {saveBusy ? "Saving…" : editingId === "new" ? "Add it" : "Save"}
          </PrimaryButton>
        </div>
        {saveError && <p className="text-[12px] text-[var(--color-warn)] mt-3">{saveError}</p>}
      </Modal>
      <Modal open={!!watchPromptItem} onClose={() => setWatchPromptItem(null)} title="Add this to Kitchen Watch?">
        <div className="watch-purchase-prompt">
          <span><Refrigerator size={20}/></span>
          <div><strong>{watchPromptItem?.name}</strong><p>Track its use-by date and get a reminder before it expires.</p></div>
        </div>
        <div className="watch-purchase-actions">
          <SecondaryButton onClick={() => setWatchPromptItem(null)}>Not this time</SecondaryButton>
          <PrimaryButton onClick={() => { const item = watchPromptItem; setWatchPromptItem(null); openInventoryDraft(item, item?.category === "Frozen" ? "freezer" : "fridge"); }}>Add expiry date</PrimaryButton>
        </div>
      </Modal>
      <Modal open={clearing} onClose={()=>setClearing(false)} title="Clear the grocery list?"><p className="reset-confirm-copy">This clears the active list. Your saved staples stay ready for next time.</p><div className="reset-confirm-actions"><button onClick={()=>setClearing(false)}>Cancel</button><PrimaryButton onClick={async()=>{await clearGroceries(activeGroceryListId === "all" ? null : activeGroceryListId);setClearing(false)}}>Clear list</PrimaryButton></div></Modal>
      <Modal open={newListOpen} onClose={() => { setNewListOpen(false); setNewListError(""); }} title="New shopping list"><TextField label="List name" value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="Costco run"/>{newListError && <p className="inventory-add-error" role="alert">{newListError}</p>}<PrimaryButton disabled={!newListName.trim()} onClick={async () => { try { const list = await addGroceryList({ name: newListName }); setActiveGroceryListId(list.id); setNewListName(""); setNewListOpen(false); } catch (error) { setNewListError(error?.message || "Could not create this list."); } }}>Create list</PrimaryButton></Modal>
      <ConfirmAction open={!!deletingList} onClose={() => setDeletingList(null)} onConfirm={async () => { const id = deletingList?.id; if (!id) return; await removeGroceryList(id); if (activeGroceryListId === id) setActiveGroceryListId("all"); setDeletingList(null); }} title={`Delete ${deletingList?.name || "this list"}?`} copy="The custom list will be removed. Its items will stay available under All shopping so nothing is lost." confirmLabel="Delete list" />
      <ConfirmAction
        open={clearingChecked}
        onClose={() => setClearingChecked(false)}
        onConfirm={async () => { await clearCheckedGroceries(activeGroceryListId === "all" ? null : activeGroceryListId); setClearingChecked(false); }}
        title={checkedCount === 1 ? "Clear the 1 checked item?" : `Clear the ${checkedCount} checked items?`}
        copy="These items you've already shopped will be removed from the list. Anything unchecked stays put so you can carry it over to the next trip."
        confirmLabel={checkedCount === 1 ? "Clear 1 checked" : `Clear ${checkedCount} checked`}
      />

      <Modal open={!!masterEditing} onClose={() => setMasterEditing(null)} title={masterEditing === "new" ? "Save a favourite" : "Edit favourite"}>
        <TextField label="Item" placeholder="e.g. Greek yogurt" value={masterDraft.name} onChange={(e) => updateMasterName(e.target.value)} autoFocus />
        <GroceryCategorySelect value={masterDraft.category} itemName={masterDraft.name} onChange={(category) => setMasterDraft((current) => ({ ...current, category, categoryManual: true }))}/>
        <div className="grocery-quantity-row mb-5"><div className="form-field grocery-quantity-field"><span className="form-label">Default quantity</span><Stepper value={masterDraft.quantity} onChange={(quantity) => setMasterDraft((draft) => ({ ...draft, quantity }))} /></div><div><TextField label="Unit" placeholder="bag, dozen, lb" value={masterDraft.unit} onChange={(e) => setMasterDraft((draft) => ({ ...draft, unit: e.target.value }))} /></div></div>
        <div className="flex gap-2">{masterEditing !== "new" && <SecondaryButton onClick={() => { setStaples((current) => current.filter((item) => item.id !== masterEditing)); setMasterEditing(null); }}>Remove</SecondaryButton>}<PrimaryButton onClick={saveMasterItem} disabled={!masterDraft.name.trim()}>Save favourite</PrimaryButton></div>
      </Modal>

      <Modal open={barcodeModal} onClose={closeBarcodeModal} title="Scan a product">
        <p className="barcode-note">Point your camera at a UPC or EAN barcode. FamOS will identify the product, then let you review where it goes.</p>
        {scannerOpen ? (
          <div className="barcode-camera">
            <video ref={scannerVideoRef} autoPlay muted playsInline aria-label="Live barcode camera preview" />
            <div className="barcode-camera-guide" aria-hidden="true"><span /></div>
            <div className="barcode-camera-footer">
              <span>{scannerStarting ? "Starting camera…" : "Hold the barcode inside the frame"}</span>
              <button onClick={() => { stopBarcodeScanner(); setScannerOpen(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="barcode-actions">
            <button type="button" onClick={startBarcodeScanner}><ScanLine size={17} /> Scan live</button>
            <label>
              <input type="file" accept="image/*" capture="environment" onChange={(event) => {
                readBarcodeFromImage(event.target.files?.[0]);
                event.target.value = "";
              }} />
              <ScanLine size={17} /> Scan a photo
            </label>
          </div>
        )}
        {scannerError && <p className="barcode-error">{scannerError}</p>}
        {barcodeStatus && <p className="barcode-result">{barcodeStatus}</p>}
        <div className="barcode-lookup-row">
          <TextField label="Barcode" placeholder="e.g. 012345678905" value={barcodeDraft.code} onChange={(event) => setBarcodeDraft((draft) => ({ ...draft, code: event.target.value }))} inputMode="numeric" />
          <SecondaryButton onClick={() => lookupBarcodeProduct(barcodeDraft.code)} disabled={!normalizeBarcode(barcodeDraft.code) || barcodeLoading}>
            {barcodeLoading ? "Looking…" : "Look up"}
          </SecondaryButton>
        </div>
        <div className="barcode-product-fields">
          {barcodeDraft.imageUrl && <img src={barcodeDraft.imageUrl} alt="" className="barcode-product-image" />}
          <div>
            <TextField label="Product name" placeholder="e.g. Whole grain bread" value={barcodeDraft.name} onChange={(event) => updateBarcodeName(event.target.value)} />
            <TextField label="Brand" placeholder="e.g. Dave's Killer Bread" value={barcodeDraft.brand} onChange={(event) => setBarcodeDraft((draft) => ({ ...draft, brand: event.target.value }))} />
          </div>
        </div>
        <GroceryCategorySelect value={barcodeDraft.category} itemName={barcodeDraft.name} onChange={(category) => setBarcodeDraft((current) => ({ ...current, category, categoryManual: true }))}/>
        <div className="barcode-detail-grid">
          <div className="form-field barcode-quantity-field"><span className="form-label">Quantity</span><Stepper value={barcodeDraft.quantity} onChange={(quantity) => setBarcodeDraft((draft) => ({ ...draft, quantity }))} /></div>
          <TextField label="Price (optional)" type="number" inputMode="decimal" min="0" step="0.01" placeholder="$0.00" value={barcodeDraft.price} onChange={(event) => setBarcodeDraft((draft) => ({ ...draft, price: event.target.value }))} />
        </div>
        <p className="barcode-price-note">Prices vary by store and are not encoded in UPC barcodes, so confirm the current shelf price.</p>
        <div className="barcode-save-actions">
          <PrimaryButton onClick={() => addScannedItem(false)} disabled={!barcodeDraft.name.trim()}>Add to grocery list</PrimaryButton>
          <SecondaryButton onClick={saveBarcodeFavourite} disabled={!barcodeDraft.name.trim()}><Star size={15} /> Save favourite</SecondaryButton>
          <SecondaryButton onClick={() => addScannedItem(true)} disabled={!barcodeDraft.name.trim()}><Maximize2 size={15} /> Add & open Focus Shop</SecondaryButton>
        </div>
      </Modal>

      {false && <Modal open={deliveryModal} onClose={() => setDeliveryModal(false)} title="Export grocery list">
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--color-good-soft)] border border-[var(--color-border)] p-3 flex items-start gap-3">
            <Store size={18} color="var(--color-good)" className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-ink)]">{deliveryItems.length} active grocery item{deliveryItems.length === 1 ? "" : "s"}</p>
              <p className="text-[11.5px] text-[var(--color-ink-soft)] leading-snug">FamOS will package your list so you can paste it into DoorDash, Instacart, notes, messages, or wherever the grocery run is happening.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
            <div className="px-3 py-2 bg-[var(--color-surface-sunken)] flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[var(--color-ink)]">Ready-to-copy list</p>
              <p className="text-[11.5px] text-[var(--color-ink-soft)]">{deliveryItems.length} items</p>
            </div>
            <textarea
              readOnly
              value={deliveryListText || "Your active grocery list is empty."}
              className="w-full min-h-[170px] resize-none bg-transparent px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] outline-none"
              aria-label="Grocery list export text"
            />
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3">
            <p className="text-[12.5px] text-[var(--color-ink-soft)] leading-relaxed">
              FamOS gets the list clean and ready. DoorDash or Instacart can handle the store choice, prices, substitutions, and delivery details inside their own checkout flow.
            </p>
          </div>

          {deliveryStatus && <p className="text-[12.5px] leading-snug text-[var(--color-good)]">{deliveryStatus}</p>}

          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">Choose where to shop</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GROCERY_DELIVERY_APPS.map((app) => (
                <button
                  key={app.id}
                  onClick={() => openGroceryPartner(app.url)}
                  className="min-h-[52px] rounded-2xl bg-[var(--color-surface)] px-3 flex items-center justify-between shadow-sm transition-transform active:scale-[0.98]"
                  style={{ border: `1px solid ${app.brandColor}44` }}
                >
                  <GroceryDeliveryLogo app={app} />
                  <ExternalLink size={15} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">List actions</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <PrimaryButton onClick={copyDeliveryList} disabled={!deliveryItems.length}><span className="inline-flex items-center justify-center gap-2"><Clipboard size={15} /> Copy list</span></PrimaryButton>
              <SecondaryButton onClick={shareDeliveryList} disabled={!deliveryItems.length}><span className="inline-flex items-center justify-center gap-2"><Share2 size={15} /> Share</span></SecondaryButton>
              <SecondaryButton onClick={downloadDeliveryList} disabled={!deliveryItems.length}><span className="inline-flex items-center justify-center gap-2"><Download size={15} /> Download</span></SecondaryButton>
            </div>
          </div>
        </div>
      </Modal>}

      {focusMode && (
        <div className="focus-shopping-overlay" role="dialog" aria-modal="true" aria-label="Focus shopping mode">
          <div className="focus-shopping-header">
            <div>
              <p>Focus shopping</p>
              <h2>{groceries.length - checkedCount} items left</h2>
            </div>
            <div className="focus-shopping-header-actions">
              <button
                className="focus-shopping-scan"
                onClick={() => {
                  resetBarcodeDraft();
                  setFocusMode(false);
                  setReturnToFocus(true);
                  setBarcodeModal(true);
                }}
              >
                <ScanLine size={15} /> Scan item
              </button>
              <button onClick={() => setFocusMode(false)} aria-label="Close focus shopping"><X size={20} /></button>
            </div>
          </div>
          <div className="focus-shopping-list">
            {focusItems.map((item) => (
              <FocusShoppingItem
                key={item.id}
                item={item}
                memberById={memberById}
                onToggle={handleToggleGrocery}
                onUpdateExpiry={updateGrocery}
              />
            ))}
          </div>
          <button className="focus-shopping-done" onClick={() => setFocusMode(false)}>Done shopping</button>
        </div>
      )}

      {/* Cross-reference: planned meals vs the current grocery list.
          Opened from the "Missing N" pill in the page header. Per-meal
          sections list what's still missing, with per-item Add buttons
          and a deduped "Add all N missing" pill at the top. Empty state
          when nothing's missing so the modal always feels intentional. */}
      <Modal open={showMissingModal} onClose={() => setShowMissingModal(false)} title="Missing ingredients for planned meals">
        {missingByMeal.length === 0 ? (
          <p className="groceries-missing-empty">Every planned meal is fully covered by the list. Add a new meal on the Meals tab to see suggestions next time.</p>
        ) : (
          <>
            <div className="groceries-missing-modal-summary">
              <p>
                <strong>{uniqueMissingNames.length}</strong> distinct ingredient{uniqueMissingNames.length === 1 ? "" : "s"} to add, across <strong>{missingByMeal.length}</strong> planned meal{missingByMeal.length === 1 ? "" : "s"}
                {totalMissingCount !== uniqueMissingNames.length ? <> · <small>{totalMissingCount - uniqueMissingNames.length} repeat{totalMissingCount - uniqueMissingNames.length === 1 ? "" : "s"} re-used</small></> : null}.
              </p>
              <button
                type="button"
                onClick={addAllMissingItems}
                disabled={missingBulkBusy}
                aria-label={`Add all ${uniqueMissingNames.length} distinct missing ingredients to grocery list`}
              >
                <Plus size={14} /> {missingBulkBusy ? `Adding ${uniqueMissingNames.length}…` : `Add all ${uniqueMissingNames.length} missing`}
              </button>
            </div>
            <div className="groceries-missing-modal-list">
              {missingByMeal.map((entry) => (
                <section key={`${entry.meal.id}-${entry.slot}`} className="groceries-missing-meal-block">
                  <header>
                    <small className="groceries-missing-meal-day">{formatDayLabel(entry.dateISO)} · {entry.slot}</small>
                    <strong>{entry.title}</strong>
                  </header>
                  <ul className="groceries-missing-ingredient-list">
                    {entry.missing.map((name) => (
                      <li key={`${entry.meal.id}-${name}`}>
                        <span>{name}</span>
                        <button type="button" onClick={() => addMissingItem(name)} aria-label={`Add ${name} to grocery list`} title="Add to grocery list"><Plus size={13} /></button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </Modal>
      <ShareSheet open={!!groceryShare} onClose={()=>setGroceryShare(null)} title={groceryShare?.title} text={groceryShare?.text} url={groceryShare?.url} image={groceryShare?.image} imageAlt={groceryShare?.imageAlt}/>
    </div></PullToRefresh>
  );
}
