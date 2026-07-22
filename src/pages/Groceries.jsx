import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Baby, Bone, Carrot, Check, ChevronDown, Clipboard, Coffee, Cookie, Croissant, CupSoda, Download, Drumstick, ExternalLink, FlaskConical, Globe2, GripVertical, HeartPulse, LoaderCircle, Maximize2, Milk, Package, Pencil, Plus, Sandwich, ScanLine, ScrollText, Share2, ShoppingBag, ShoppingBasket, Snowflake, Soup, SprayCan, Star, Store, Trash2, Truck, Wheat, Wine, X } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { Avatar, Card, Checkbox, EmptyState, Modal, PrimaryButton, SecondaryButton, Stepper, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import { cookableRecipes } from "../lib/cookableTonight";
import { invokeEdgeFunction } from "../lib/supabase";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import { useLocalCache } from "../hooks/useLocalCache";
import ConfirmAction from "../components/ConfirmAction";
import { GROCERY_CATEGORIES } from "../data/mockData";

// The Groceries-page soft-tier cache key + parser still live here: the key
// shape (p:pantry + x:extras, sort, join) is Groceries-specific, but TTL'd
// localStorage read/write/clear are now sourced from `useLocalCache`. The
// feature gate ("cookable-soft-tier") is sourced from `useFeatureFlag`,
// shared by all three soft-tier surfaces so admin can flip them in unison.
const GROCERY_RECIPES_CACHE_PREFIX = "famos_grocery_recipes_v1:";
const GROCERY_RECIPES_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const parseExtraIngredientNames = (raw) => String(raw || "").split(",").map((part) => part.toLowerCase().trim()).filter(Boolean);
const buildGroceryRecipeCacheKey = (names, extras) => {
  const tokens = [...names.map((name) => `p:${name}`), ...extras.map((name) => `x:${name}`)].filter(Boolean).sort();
  return `${GROCERY_RECIPES_CACHE_PREFIX}${tokens.join("|")}`;
};

const emptyDraft = { name: "", category: GROCERY_CATEGORIES[0], quantity: 1, unit: "" };
const emptyBarcodeDraft = { ...emptyDraft, code: "", brand: "", price: "", imageUrl: "" };
const STAPLES_KEY = "family-os:grocery-staples:v1";
const PRODUCT_LOOKUP_ENDPOINT = "https://world.openfoodfacts.org/api/v2/product";
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

export default function Groceries() {
  const { groceries, addGrocery, toggleGrocery, updateGrocery, removeGrocery, clearCheckedGroceries, clearGroceries, memberById, refreshData } = useFamily();
  const [editingId, setEditingId] = useState(null); // null closed, "new" for add, or item id
  const [draft, setDraft] = useState(emptyDraft);
  const [staples, setStaples] = useState(loadStaples);
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
  const scannerVideoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const scannerHandledRef = useRef(false);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState("");

  useEffect(() => { localStorage.setItem(STAPLES_KEY, JSON.stringify(staples)); }, [staples]);

  // Cookable-from-pantry: fetch API Ninjas recipes indexed by the user's
  // CHECKED grocery names on mount / toggle-change. The list is then
  // filtered in-memory by the same cookableTonight helper the Meals page
  // uses, so the grocery-page soft tier inherits the active-vs-cookable
  // split semantics — same contract, different feed surface.
  const [extraIngredients, setExtraIngredients] = useState("");
  const [cookableRecipesData, setCookableRecipesData] = useState({ recipes: [], busy: false, error: "" });
  const [cookableEnabled] = useFeatureFlag("cookable-soft-tier");

  // Memoised cache accessor. The cache key is pantry-tokens + extras,
  // so it changes when groceries toggle or extras type. Rebuilding
  // `useLocalCache` on key change is intentional — the new helper
  // bundle locks onto the new localStorage key in a single pass.
  const groceryCacheKey = useMemo(() => {
    const checkedNames = groceries
      .filter((g) => g && g.checked && typeof g.name === "string")
      .map((g) => g.name.toLowerCase().trim())
      .filter(Boolean);
    if (!checkedNames.length || !cookableEnabled) return null;
    const extraNames = parseExtraIngredientNames(extraIngredients);
    return buildGroceryRecipeCacheKey(checkedNames, extraNames);
  }, [groceries, extraIngredients, cookableEnabled]);
  const groceryCache = useLocalCache(groceryCacheKey, GROCERY_RECIPES_CACHE_TTL_MS);

  useEffect(() => {
    if (!cookableEnabled) {
      setCookableRecipesData({ recipes: [], busy: false, error: "" });
      return undefined;
    }
    const checkedNames = groceries
      .filter((g) => g && g.checked && typeof g.name === "string")
      .map((g) => g.name.toLowerCase().trim())
      .filter(Boolean);
    if (!checkedNames.length) {
      setCookableRecipesData({ recipes: [], busy: false, error: "" });
      return undefined;
    }
    const extraNames = parseExtraIngredientNames(extraIngredients);
    const cached = groceryCache.read();
    const cachedRecipes = cached && Array.isArray(cached.recipes) ? cached.recipes : null;
    if (cachedRecipes) {
      setCookableRecipesData({ recipes: cachedRecipes, busy: false, error: "" });
      return undefined;
    }
    let cancelled = false;
    setCookableRecipesData((current) => ({ recipes: current.recipes, busy: true, error: "" }));
    const handle = setTimeout(async () => {
      try {
        // Send extras as the seed when present so API Ninjas narrows
        // toward what the user typed; otherwise fall back to the
        // checked-grocery name list (today's behaviour). Capped at 12
        // total to stay within the function's request body budget.
        const ingredientQuery = [...checkedNames.slice(0, 8), ...extraNames.slice(0, 8)].filter((value, index, array) => array.indexOf(value) === index).slice(0, 12).join(", ");
        const seedQuery = extraNames.length ? extraNames.slice(0, 5).join(" ") : checkedNames.slice(0, 5).join(" ");
        const data = await invokeEdgeFunction("recipe-search", {
          query: seedQuery,
          ingredients: ingredientQuery,
          mealType: "dinner",
        });
        if (cancelled) return;
        const list = Array.isArray(data?.recipes) ? data.recipes : [];
        setCookableRecipesData({ recipes: list, busy: false, error: "" });
        groceryCache.write({ recipes: list });
      } catch (err) {
        if (!cancelled) setCookableRecipesData({ recipes: [], busy: false, error: err?.message || "Recipe lookup failed." });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [groceries, extraIngredients, cookableEnabled, groceryCache]);

  const cookableList = useMemo(
    () => cookableRecipes(cookableRecipesData.recipes, groceries),
    [cookableRecipesData.recipes, groceries]
  );

  const grouped = useMemo(() => {
    const map = {};
    for (const cat of GROCERY_CATEGORIES) map[cat] = [];
    for (const g of groceries) {
      if (!map[g.category]) map[g.category] = [];
      map[g.category].push(g);
    }
    return map;
  }, [groceries]);

  const checkedCount = groceries.filter((g) => g.checked).length;
  const deliveryItems = useMemo(() => groceries.filter((item) => !item.checked), [groceries]);
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

  const openNew = () => {
    setDraft(emptyDraft);
    setEditingId("new");
  };

  const openEdit = (item) => {
    setDraft({ name: item.name, category: item.category, quantity: item.quantity ?? 1, unit: item.unit ?? "" });
    setEditingId(item.id);
  };

  const updateDraftName = (name) => {
    setDraft((current) => ({
      ...current,
      name,
      category: categoryFromItemName(name, current.category),
    }));
  };

  const updateMasterName = (name) => {
    setMasterDraft((current) => ({
      ...current,
      name,
      category: categoryFromItemName(name, current.category),
    }));
  };

  const updateBarcodeName = (name) => {
    setBarcodeDraft((current) => ({
      ...current,
      name,
      category: categoryFromItemName(name, current.category),
    }));
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

  const stopBarcodeScanner = useCallback(() => {
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
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const objectUrl = URL.createObjectURL(file);
      let result;
      try {
        result = await reader.decodeFromImageUrl(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
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
    setScannerOpen(true);
    setScannerStarting(true);
    setScannerError("");
    scannerHandledRef.current = false;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        scannerVideoRef.current,
        async (result) => {
          if (!result || scannerHandledRef.current) return;
          scannerHandledRef.current = true;
          const code = result.getText();
          stopBarcodeScanner();
          setScannerOpen(false);
          setBarcodeDraft((draft) => ({ ...draft, code }));
          await lookupBarcodeProduct(code);
        }
      );
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

  const shareDeliveryList = async () => {
    if (!deliveryItems.length) {
      setDeliveryStatus("Your active grocery list is empty.");
      return;
    }
    if (navigator?.share) {
      try {
        await navigator.share({ title: "FamOS grocery list", text: deliveryShareText });
        setDeliveryStatus("Shared. Tiny domestic victory.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await copyDeliveryList();
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
    <PullToRefresh onRefresh={refreshData}><div className="pb-24 reference-groceries">
      <PageHeader
        title="Groceries"
        illustration="groceries"
        subtitle="One shared list for staples, favourites, and store runs."
        action={<div className="grocery-mode-actions">
          <button onClick={() => { resetBarcodeDraft(); setReturnToFocus(false); setBarcodeModal(true); }}><ScanLine size={14} /> Scan product</button>
          {groceries.length > 0 && <button onClick={() => setFocusMode(true)}><Maximize2 size={14} /> Focus shop</button>}
          {checkedCount > 0 && <button onClick={() => setClearingChecked(true)}>Clear {checkedCount} checked</button>}
          {groceries.length > 0 && <button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>}
        </div>}
      />

      <div className="px-5 space-y-5 mt-2">
        {cookableEnabled && checkedCount > 0 && (
          <Card className="p-4 grocery-cookable-card">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-10 h-10 rounded-xl bg-[var(--color-good-soft)] flex items-center justify-center shrink-0">
                <ShoppingBasket size={18} color="var(--color-good)" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-[var(--font-display)] text-[15px] font-semibold tracking-[-0.02em]">What can I make with what's checked?</p>
                <small className="block text-[11.5px] text-[var(--color-ink-soft)] leading-snug">
                  {checkedCount} pantry item{checkedCount === 1 ? "" : "s"} · {cookableList.length} recipe{cookableList.length === 1 ? "" : "s"} you can cook right now
                </small>
              </div>
            </div>
            <input
              value={extraIngredients}
              onChange={(event) => setExtraIngredients(event.target.value)}
              placeholder="Add extra ingredients you have on hand (soy sauce, butter)…"
              className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13.5px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] mb-3"
              aria-label="Extra ingredients on hand"
            />
            {cookableRecipesData.busy && cookableList.length === 0 && (
              <p className="flex items-center gap-2 text-[12px] text-[var(--color-ink-faint)] px-1 mb-2"><LoaderCircle size={13} className="animate-spin" /> Searching API Ninjas…</p>
            )}
            {cookableRecipesData.error && (
              <p className="text-[11.5px] text-[var(--color-warn)] px-1 mb-2">{cookableRecipesData.error}</p>
            )}
            {!cookableRecipesData.busy && cookableList.length > 0 && (
              <details className="famos-soft-tier meal-soft-tier grocery-cookable-tier" open>
                <summary>
                  <ChevronDown aria-hidden="true" size={14} />
                  <div>
                    <strong>
                      <ShoppingBasket aria-hidden="true" size={13} /> {cookableList.length} you can cook now
                    </strong>
                    <small>tap to peek — every ingredient is already in your pantry</small>
                  </div>
                </summary>
                <ul className="grocery-cookable-list">
                  {cookableList.map((recipe) => (
                    <li key={recipe.title} className="grocery-cookable-row">
                      <strong>{recipe.title}</strong>
                      {recipe.cuisine && <small className="grocery-cookable-cuisine">{recipe.cuisine}</small>}
                      <ul className="grocery-cookable-ingredients">
                        {(Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((ingredient, index) => (
                          <li key={`${recipe.title}-${index}`}><Check aria-hidden="true" size={11} /> {ingredient}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                {extraIngredients.trim() && (
                  <p className="grocery-cookable-extra-note">
                    Extra on hand: <strong>{extraIngredients.trim()}</strong> — those go in too if the recipe matches.
                  </p>
                )}
              </details>
            )}
            {!cookableRecipesData.busy && !cookableRecipesData.error && cookableList.length === 0 && (
              <p className="text-[12px] text-[var(--color-ink-soft)] leading-snug px-1">
                API Ninjas had no recipes that combine your pantry{extraIngredients.trim() ? ` with ${extraIngredients.trim()}` : ""} yet. Check off a few more staples, or simplify your extras to widen the search.
              </p>
            )}
          </Card>
        )}
        <Card
          className="delivery-banner-card relative overflow-hidden p-5 border-white/10 shadow-[0_22px_55px_rgba(18,16,43,0.24)]"
        >
          <img src="/marketing/delivery-banner.png" alt="" className="delivery-banner-art" aria-hidden="true" />
          <div className="delivery-banner-shade" aria-hidden="true" />
          <div className="relative flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white/95 flex items-center justify-center shrink-0 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ring-1 ring-white/20">
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
                  className="inline-flex items-center gap-2 rounded-full bg-white/95 text-[var(--color-accent)] border border-white/40 px-3 py-2 text-[12px] font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.16)] disabled:opacity-45"
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
                    className="min-h-[48px] rounded-2xl bg-white px-3 flex items-center justify-center transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                    style={{ border: `1px solid ${app.brandBorder}`, boxShadow: `0 11px 24px ${app.brandColor}1c` }}
                    aria-label={`Open ${app.name}`}
                  >
                    <GroceryDeliveryLogo app={app} />
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button onClick={copyDeliveryList} disabled={!deliveryItems.length} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11.5px] font-semibold text-[#19172b] border border-black/5 shadow-sm disabled:opacity-45"><Clipboard size={13} /> Copy</button>
                <button onClick={shareDeliveryList} disabled={!deliveryItems.length} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11.5px] font-semibold text-[#19172b] border border-black/5 shadow-sm disabled:opacity-45"><Share2 size={13} /> Share</button>
                <button onClick={downloadDeliveryList} disabled={!deliveryItems.length} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11.5px] font-semibold text-[#19172b] border border-black/5 shadow-sm disabled:opacity-45"><Download size={13} /> Save</button>
              </div>
            </div>
          </div>
        </Card>

        <section>
          <div className="flex items-end justify-between mb-3 px-1">
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">Saved staples</p><h2 className="font-[var(--font-display)] text-[17px] font-semibold">Quick add</h2></div>
            <button onClick={() => openMasterItem()} className="flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-accent)]"><Plus size={13} /> New staple</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(showAllStaples ? staples : staples.slice(0, 6)).map((staple) => <div key={staple.id} draggable onDragStart={(event) => { event.dataTransfer.setData("application/json", JSON.stringify(staple)); setDragging(true); }} onDragEnd={() => setDragging(false)} className="group relative min-w-0 flex items-center rounded-2xl bg-white border border-[var(--color-border)] notion-shadow overflow-hidden cursor-grab active:cursor-grabbing">
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
          <EmptyState title="List’s empty" subtitle="Add the first thing before someone remembers it at checkout." />
        ) : (
          Object.entries(grouped).map(([cat, items]) =>
            items.length === 0 ? null : (
              <section key={cat}>
                <div className="grocery-category-title"><h2>{cat}</h2><span>{items.filter((i) => !i.checked).length} item{items.filter((i) => !i.checked).length === 1 ? "" : "s"}</span></div>
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
                          {adder && !item.checked && (
                            <Avatar member={adder} size="xs" className="shrink-0" aria-label={`Added by ${adder.name}`} />
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

      <Modal open={!!editingId} onClose={() => setEditingId(null)} title={editingId === "new" ? "Add a grocery" : "Edit grocery"}>
        <TextField
          label="Item"
          placeholder="e.g. Sourdough bread"
          value={draft.name}
          onChange={(e) => updateDraftName(e.target.value)}
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
            {editingId === "new" ? "Add it" : "Save"}
          </PrimaryButton>
        </div>
      </Modal>
      <Modal open={clearing} onClose={()=>setClearing(false)} title="Clear the grocery list?"><p className="reset-confirm-copy">This clears the active list. Your saved staples stay ready for next time.</p><div className="reset-confirm-actions"><button onClick={()=>setClearing(false)}>Cancel</button><PrimaryButton onClick={async()=>{await clearGroceries();setClearing(false)}}>Clear list</PrimaryButton></div></Modal>
      <ConfirmAction
        open={clearingChecked}
        onClose={() => setClearingChecked(false)}
        onConfirm={async () => { await clearCheckedGroceries(); setClearingChecked(false); }}
        title={checkedCount === 1 ? "Clear the 1 checked item?" : `Clear the ${checkedCount} checked items?`}
        copy="These items you've already shopped will be removed from the list. Anything unchecked stays put so you can carry it over to the next trip."
        confirmLabel={checkedCount === 1 ? "Clear 1 checked" : `Clear ${checkedCount} checked`}
      />

      <Modal open={!!masterEditing} onClose={() => setMasterEditing(null)} title={masterEditing === "new" ? "Save a favourite" : "Edit favourite"}>
        <TextField label="Item" placeholder="e.g. Greek yogurt" value={masterDraft.name} onChange={(e) => updateMasterName(e.target.value)} autoFocus />
        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Category</p>
        <div className="flex flex-wrap gap-2 mb-4">{GROCERY_CATEGORIES.map((category) => <button key={category} onClick={() => setMasterDraft((draft) => ({ ...draft, category }))} className="rounded-full px-3 py-1.5 text-[13px] font-medium border" style={{ borderColor: masterDraft.category === category ? "var(--color-accent)" : "var(--color-border)", backgroundColor: masterDraft.category === category ? "var(--color-accent-soft)" : "transparent" }}>{category}</button>)}</div>
        <div className="flex items-end gap-3 mb-5"><div><p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Default quantity</p><Stepper value={masterDraft.quantity} onChange={(quantity) => setMasterDraft((draft) => ({ ...draft, quantity }))} /></div><div className="flex-1"><TextField label="Unit" placeholder="bag, dozen, lb" value={masterDraft.unit} onChange={(e) => setMasterDraft((draft) => ({ ...draft, unit: e.target.value }))} /></div></div>
        <div className="flex gap-2">{masterEditing !== "new" && <SecondaryButton onClick={() => { setStaples((current) => current.filter((item) => item.id !== masterEditing)); setMasterEditing(null); }}>Remove</SecondaryButton>}<PrimaryButton onClick={saveMasterItem} disabled={!masterDraft.name.trim()}>Save favourite</PrimaryButton></div>
      </Modal>

      <Modal open={barcodeModal} onClose={closeBarcodeModal} title="Scan a product">
        <p className="barcode-note">Point your camera at a UPC or EAN barcode. FamOS will identify the product, then let you review where it goes.</p>
        {scannerOpen ? (
          <div className="barcode-camera">
            <video ref={scannerVideoRef} muted playsInline aria-label="Live barcode camera preview" />
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
        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Category</p>
        <div className="flex flex-wrap gap-2 mb-4">{GROCERY_CATEGORIES.map((category) => <button key={category} onClick={() => setBarcodeDraft((draft) => ({ ...draft, category }))} className="rounded-full px-3 py-1.5 text-[13px] font-medium border" style={{ borderColor: barcodeDraft.category === category ? "var(--color-accent)" : "var(--color-border)", backgroundColor: barcodeDraft.category === category ? "var(--color-accent-soft)" : "transparent" }}>{category}</button>)}</div>
        <div className="barcode-detail-grid">
          <div><p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Quantity</p><Stepper value={barcodeDraft.quantity} onChange={(quantity) => setBarcodeDraft((draft) => ({ ...draft, quantity }))} /></div>
          <TextField label="Price (optional)" type="number" inputMode="decimal" min="0" step="0.01" placeholder="$0.00" value={barcodeDraft.price} onChange={(event) => setBarcodeDraft((draft) => ({ ...draft, price: event.target.value }))} />
        </div>
        <p className="barcode-price-note">Prices vary by store and are not encoded in UPC barcodes, so confirm the current shelf price.</p>
        <div className="barcode-save-actions">
          <PrimaryButton onClick={() => addScannedItem(false)} disabled={!barcodeDraft.name.trim()}>Add to grocery list</PrimaryButton>
          <SecondaryButton onClick={saveBarcodeFavourite} disabled={!barcodeDraft.name.trim()}><Star size={15} /> Save favourite</SecondaryButton>
          <SecondaryButton onClick={() => addScannedItem(true)} disabled={!barcodeDraft.name.trim()}><Maximize2 size={15} /> Add & open Focus Shop</SecondaryButton>
        </div>
      </Modal>

      <Modal open={deliveryModal} onClose={() => setDeliveryModal(false)} title="Export grocery list">
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--color-good-soft)] border border-[var(--color-border)] p-3 flex items-start gap-3">
            <Store size={18} color="var(--color-good)" className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-ink)]">{deliveryItems.length} active grocery item{deliveryItems.length === 1 ? "" : "s"}</p>
              <p className="text-[11.5px] text-[var(--color-ink-soft)] leading-snug">FamOS will package your list so you can paste it into DoorDash, Instacart, notes, messages, or wherever the grocery run is happening.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-white dark:bg-[var(--color-surface)]">
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
                  className="min-h-[52px] rounded-2xl bg-white px-3 flex items-center justify-between shadow-sm transition-transform active:scale-[0.98]"
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
      </Modal>

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
            {focusItems.map((item) => {
              const qtyLabel = [item.quantity > 1 || item.unit ? item.quantity : null, item.unit].filter(Boolean).join(" ");
              return (
                <button key={item.id} className={`focus-shopping-item ${item.checked ? "is-checked" : ""}`} onClick={() => toggleGrocery(item.id)}>
                  <span className="focus-shopping-check" aria-hidden="true">{item.checked ? "✓" : ""}</span>
                  <GroceryIcon category={item.category} />
                  <span className="focus-shopping-copy"><strong>{item.name}</strong><small>{item.category}{qtyLabel ? ` · ${qtyLabel}` : ""}</small></span>
                </button>
              );
            })}
          </div>
          <button className="focus-shopping-done" onClick={() => setFocusMode(false)}>Done shopping</button>
        </div>
      )}
    </div></PullToRefresh>
  );
}
