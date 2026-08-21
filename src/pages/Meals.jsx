import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, BarChart3, Bookmark, CalendarPlus, Check, ChefHat, Clock, Coffee, Dices, Image as ImageIcon, ListChecks, Mic, MicOff, Pencil, Plus, ShoppingCart, Soup, Sparkles, Trash2, Users, X } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarStack, Card, Modal, PrimaryButton, ProgressBar, SecondaryButton, TextField, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import ConfirmAction from "../components/ConfirmAction";
import ErrorBoundary from "../components/ErrorBoundary";
import NativeAdBanner from "../components/NativeAdBanner";
import { AD_PLACEMENTS } from "../lib/adNetwork";
import { MEAL_SLOTS } from "../data/mockData";
import { buildCookSearchLadder, recipeSearchProfileForMeal } from "../data/recipeBox";
import { addDays, formatDayLabel, todayISO } from "../lib/dates";
import { canonicalIngredientName, isIngredientOnList } from "../lib/mealIngredientCache";
import { invokeEdgeFunction, supabase } from "../lib/supabase";
import { searchRecipes } from "../lib/recipeSearch";
import { getRecipeCost, formatCost, getIngredientSubstitutes } from "../lib/spoonacularFeatures";
import useVoiceCommands, { requestScreenWakeLock } from "../hooks/useVoiceCommands";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { SHARED_RECIPE_KEY } from "../lib/sharedContent";
import { lockBodyScroll } from "../lib/bodyScrollLock";

function ShelfLifeRing({ progress, size = 90, strokeWidth = 7 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const remaining = Math.max(0, Math.min(100, progress?.remainingPercent ?? 0));
  const offset = circumference * (1 - remaining / 100);
  let color = "#E85D3A";
  if (remaining > 50) color = "#22A06B";
  else if (remaining > 25) color = "#F59E0B";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
      />
    </svg>
  );
}

const SLOT_META = {
  breakfast: { label: "Breakfast", icon: Coffee },
  lunch: { label: "Lunch", icon: Soup },
  dinner: { label: "Dinner", icon: ChefHat },
};

// Hover tooltip for the meal card's corner avatar stack. Shows each cook's
// photo + name and which slots (Breakfast/Lunch/Dinner) they cooked. Portaled
// to <body> because the card clips overflow.
function MealCooksTooltip({ cooks }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 210;
    setPos({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: rect.bottom + 8,
    });
    setOpen(true);
  };
  const hide = () => setOpen(false);
  return (
    <>
      <div
        ref={anchorRef}
        className="meal-card-avatars meal-card-header-avatars"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        role="button"
        aria-label="Who's cooking each meal"
      >
        {cooks.slice(0, 3).map((c) => (
          <Avatar key={c.id} member={c.member} size="sm" className="meal-card-avatar" />
        ))}
      </div>
      {open && pos && createPortal(
        <div className="meal-card-tooltip" style={{ left: pos.left, top: pos.top }} role="tooltip">
          {cooks.map((c) => (
            <div key={c.id} className="meal-card-tooltip-row">
              <Avatar member={c.member} size="xs" />
              <span>
                <strong>{c.member.name}</strong>
                <small>{c.slots.join(" · ")}</small>
              </span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

const SLOT_ORDER = ["breakfast", "lunch", "dinner"];

const SAVED_RECIPES_KEY = "famos:saved-recipes:v1";
const RECIPE_DETAIL_CACHE_KEY = "famos:recipe-details:v2";
const DIETARY_PREFERENCES_KEY = "famos:dietary-preferences:v1";

const friendlyRecipeSearchError = (error) => {
  const message = error?.message || String(error || "");
  // Match the monthly allowance gate too — its message reads “Monthly
  // allowance reached…”, which must land here and not in the /reach|network/
  // branch below.
  if (/quota|429|402|allowance|limit/i.test(message)) return "Recipe ideas have hit your household’s monthly allowance for this month. It resets on the 1st — your existing meal plan is safe.";
  if (/configured|api.?key/i.test(message)) return "Recipe suggestions need the Spoonacular connection configured by your FamOS admin.";
  if (/session|sign in|401|403/i.test(message)) return "Your session needs refreshing. Sign in again, then retry the meal ideas.";
  if (/reach|network|offline|fetch/i.test(message)) return "Recipe suggestions are temporarily offline. Check your connection and try again.";
  return "Recipe suggestions could not refresh right now. Your current options are still here—try again in a moment.";
};
const DEFAULT_DIETARY_PREFERENCES = { restrictions: [], avoidIngredients: "", notes: "" };

const readStoredJson = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const recipeKey = (recipe = {}) => String(recipe.id || recipe.title || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

const normaliseSavedRecipe = (recipe = {}) => ({
  ...recipe,
  id: recipeKey(recipe) || `recipe-${Date.now()}`,
  title: recipe.title || "Saved recipe",
  cuisine: recipe.cuisine || "Family favourite",
  readyInMinutes: recipe.readyInMinutes || 35,
  servings: recipe.servings || 4,
  ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
  instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
  source: recipe.source || "spoonacular",
  sourceUrl: recipe.sourceUrl || "",
  savedAt: recipe.savedAt || new Date().toISOString(),
});

// Pull a single recipe out of a recipe-search response — normalized Spoonacular
// shape (returns `{recipes: [...]}`; older clients/tests may wrap that in
// `{data: {recipes}}`).
const recipeFromSearch = (data) => {
  if (!data) return null;
  const root = data?.data && typeof data.data === "object" ? data.data : data;
  const list = Array.isArray(root?.recipes) ? root.recipes : [];
  return list[0] || null;
};

// Pull all recipes from a search response (used by the roulette picker
// which now requests 3 results so the family can choose).
const recipesFromSearch = (data) => {
  if (!data) return [];
  const root = data?.data && typeof data.data === "object" ? data.data : data;
  return Array.isArray(root?.recipes) ? root.recipes : [];
};

// Skinny recipe used while we wait for Spoonacular. Cook Mode renders the
// title alone so the family still gets a holdable target even when the
// instructions blob hasn't arrived yet.
const placeholderRecipe = (title, slot) => ({
  title: title || "Untitled recipe",
  cuisine: "Family favourite",
  readyInMinutes: 35,
  servings: 4,
  ingredients: [],
  instructions: [],
  source: "library",
  sourceUrl: "",
  slot,
});

const INGREDIENT_CACHE_KEY = "famos:meal-ingredients:v1";

const loadIngredientCache = () => {
  try {
    const raw = window.localStorage.getItem(INGREDIENT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveIngredientCache = (cache) => {
  try { window.localStorage.setItem(INGREDIENT_CACHE_KEY, JSON.stringify(cache)); } catch { /* storage unavailable */ }
};

const recipeTitleKey = (title) => String(title || "").trim().toLowerCase();
const isCookModeReady = (recipe) => Boolean(
  recipe?.title
  && Array.isArray(recipe?.ingredients) && recipe.ingredients.length
  && Array.isArray(recipe?.instructions) && recipe.instructions.length
);
const cacheRecipeDetail = (recipe) => {
  const key = recipeTitleKey(recipe?.title);
  if (!key || !isCookModeReady(recipe)) return;
  try {
    const current = JSON.parse(window.localStorage.getItem(RECIPE_DETAIL_CACHE_KEY) || "{}");
    const next = { ...current, [key]: normaliseSavedRecipe(recipe) };
    const entries = Object.entries(next).slice(-30);
    window.localStorage.setItem(RECIPE_DETAIL_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage unavailable */ }
};
const cachedRecipeDetail = (title) => {
  try {
    const current = JSON.parse(window.localStorage.getItem(RECIPE_DETAIL_CACHE_KEY) || "{}");
    const recipe = current[recipeTitleKey(title)] || null;
    return isCookModeReady(recipe) ? recipe : null;
  } catch { return null; }
};

const CUISINE_LIST = [
  "Italian", "Mexican", "Indian", "Japanese", "Chinese",
  "Thai", "Mediterranean", "American Comfort",
];

const titleFromMeal = (meal) => String(meal?.title || "").trim();

const youtubeEmbedUrl = (value = "") => {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const id = host === "youtu.be" ? url.pathname.slice(1) : host.endsWith("youtube.com") ? url.searchParams.get("v") : "";
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "";
  } catch { return ""; }
};

export default function Meals() {
  const { members, memberById, meals, groceries, addGrocery, setMealForSlot, removeMeal, clearMeals, refreshData } = useFamily();
  const { householdProfileExtra, household, user } = useAuth();
  const { items: inventoryItems, ingredientNames: inventoryIngredientNames, removeItem: removeInventoryItem } = useKitchenInventory(household?.id, user?.id);
  const [horizon, setHorizon] = useState(7);
  const [clearing, setClearing] = useState(false);
  const [editing, setEditing] = useState(null); // { date, slot, mealId }
  const [previewMeal, setPreviewMeal] = useState(null);
  const [draft, setDraft] = useState({ title: "", notes: "", cookIds: [] });
  const [showSavedRecipes, setShowSavedRecipes] = useState(false);
  const [cookMeal, setCookMeal] = useState(null);
  const [cookRecipe, setCookRecipe] = useState(null);
  const [recipeCost, setRecipeCost] = useState(null);
  const [substituteModal, setSubstituteModal] = useState(null);
  const [substituteLoading, setSubstituteLoading] = useState(false);
  const [substituteResult, setSubstituteResult] = useState(null);
  const [cookLoading, setCookLoading] = useState(false);
  const [cookError, setCookError] = useState("");
  const [cookMode, setCookMode] = useState(false);
  const [cookStep, setCookStep] = useState(0);
  const [cookIngredientsAdded, setCookIngredientsAdded] = useState(false);
  const [cookNutrition, setCookNutrition] = useState(null);
  const [cookNutritionLoading, setCookNutritionLoading] = useState(false);
  const [consumeReview, setConsumeReview] = useState(null);
  const [consumeSelection, setConsumeSelection] = useState([]);
  // Voice-hands-free cook navigation. Bound to next/previous/finish so a
  // flour-covered hand never has to tap the phone screen.
  const wakeLockRef = useRef(null);
  const finishCookMode = useCallback(() => {
    const recipeNames = new Set((cookRecipe?.ingredients || []).map((item) => canonicalIngredientName(typeof item === "string" ? item : item?.name)).filter(Boolean));
    const matched = inventoryItems.filter((item) => recipeNames.has(canonicalIngredientName(item.name)));
    setCookMeal(null);
    if (matched.length) { setConsumeReview(matched); setConsumeSelection(matched.map((item) => item.id)); }
  }, [cookRecipe?.ingredients, inventoryItems]);
  const advanceCookStep = useCallback((delta) => {
    setCookStep((step) => {
      const total = cookRecipe?.instructions?.length || 0;
      const max = Math.max(total - 1, 0);
      return Math.min(Math.max(step + delta, 0), max);
    });
  }, [cookRecipe?.instructions?.length]);
  const { supported: voiceSupported, listening: voiceListening, transcript: voiceTranscript, error: voiceError, start: startVoice, stop: stopVoice } = useVoiceCommands({
    commands: [
      { match: /\b(next|forward|continue|go)\b/i, action: "next" },
      { match: /\b(back|previous|prev|undo)\b/i, action: "previous" },
      { match: /\b(finish|done|stop|complete|exit)\b/i, action: "finish" },
    ],
    onAction: (action) => {
      if (action === "next") advanceCookStep(1);
      else if (action === "previous") advanceCookStep(-1);
      else if (action === "finish") finishCookMode();
    },
  });
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch { /* sentinel already released */ }
      wakeLockRef.current = null;
    }
  }, []);
  const toggleVoice = useCallback(async () => {
    if (voiceListening) {
      stopVoice();
      releaseWakeLock();
      return;
    }
    startVoice();
    if (!wakeLockRef.current && typeof navigator !== "undefined" && navigator.wakeLock?.request) {
      wakeLockRef.current = await requestScreenWakeLock();
    }
  }, [voiceListening, startVoice, stopVoice, releaseWakeLock]);
  // Release the wake lock whenever Cook Mode closes (or the page unmounts)
  // so the screen can sleep normally again.
  useEffect(() => {
    if (!cookMeal || !cookMode) releaseWakeLock();
  }, [cookMeal, cookMode, releaseWakeLock]);
  useEffect(() => () => releaseWakeLock(), [releaseWakeLock]);
  // Fetch recipe cost when Cook Mode opens
  useEffect(() => {
    if (!cookRecipe?.id) { setRecipeCost(null); return; }
    let cancelled = false;
    getRecipeCost(cookRecipe.id).then((cost) => {
      if (!cancelled) setRecipeCost(cost);
    });
    return () => { cancelled = true; };
  }, [cookRecipe?.id]);
  // Fetch ingredient substitutes
  const fetchSubstitutes = useCallback(async (ingredientName) => {
    setSubstituteModal(ingredientName);
    setSubstituteLoading(true);
    setSubstituteResult(null);
    try {
      const result = await getIngredientSubstitutes(ingredientName);
      setSubstituteResult(result);
    } catch {
      setSubstituteResult({ ingredient: ingredientName, substitutes: [], message: "Could not find substitutes." });
    } finally {
      setSubstituteLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!cookMeal) return undefined;
    const unlockBodyScroll = lockBodyScroll();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setCookMeal(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      unlockBodyScroll();
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [cookMeal]);
  // Deep-link intent: when Today taps "Cook tonight's ___" it writes the
  // meal id to sessionStorage and routes to /meals. We consume the intent
  // here so the cook modal opens straight into the requested meal, then
  // remove the key so a refresh doesn't re-trigger.
  const COOK_INTENT_KEY = "famos:cook-intent:v1";
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(COOK_INTENT_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(COOK_INTENT_KEY);
    // Pick up the requested meal once it lands in state (FamilyContext
    // may still be hydrating on first paint).
    const target = meals.find((meal) => (
      meal.id === raw
      || `${meal.date}:${meal.slot}` === raw
    ));
    if (target?.title) openCookRecipe(target);
  // Re-run when meals hydrate so a deep-link arriving during initial load
  // still finds its target. The intent is single-use (we remove the key
  // above before looking it up) so this won't loop.
  }, [meals]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem("famos:meal-ideas-intent:v1");
    if (!raw) return;
    window.sessionStorage.removeItem("famos:meal-ideas-intent:v1");
    try {
      const intent = JSON.parse(raw);
      if (intent?.date && MEAL_SLOTS.includes(intent?.slot)) rouletteForSlot(intent.date, intent.slot, Boolean(intent.kitchenOnly));
    } catch { /* ignore malformed intent */ }
  }, []);
  // Cached ingredient names per meal ID — populated once a recipe has been
  // looked up, persists across sessions so the grocery badge works immediately.
  const [mealIngredientsCache, setMealIngredientsCache] = useState(() => loadIngredientCache());
  // Track which meal badges have been tapped for "Added!" feedback (ephemeral, not persisted).
  const badgeAddedRef = useRef(new Set());
  const badgeTimerRef = useRef(null);
  const [, forceUpdate] = useState(0);
  useEffect(() => () => { if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current); }, []);
  const [rouletteOptions, setRouletteOptions] = useState(null); // { date, slot, recipes[] }
  const [rouletteBusy, setRouletteBusy] = useState(false);
  const [rouletteError, setRouletteError] = useState("");
  const [rouletteCuisine, setRouletteCuisine] = useState(null); // null = any cuisine
  const [savedRecipes, setSavedRecipes] = useState(() => readStoredJson(SAVED_RECIPES_KEY, []));
  const [planningRecipe, setPlanningRecipe] = useState(null);
  const [dietaryPreferences] = useState(() => {
    const onboardingPreferences = householdProfileExtra ? {
      restrictions: householdProfileExtra.dietaryRestrictions || [],
      avoidIngredients: householdProfileExtra.avoidIngredients || "",
      notes: householdProfileExtra.mealNotes || "",
    } : {};
    return {
      ...DEFAULT_DIETARY_PREFERENCES,
      ...onboardingPreferences,
      ...readStoredJson(DIETARY_PREFERENCES_KEY, {}),
    };
  });

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(savedRecipes));
  }, [savedRecipes]);

  // For each meal with cached ingredients, compute how many are missing from the
  // grocery list. Returns { missing, total } or null when no cache entry exists.
  const mealMissingCount = useMemo(() => {
    const result = {};
    for (const [mealId, names] of Object.entries(mealIngredientsCache)) {
      const namesList = Array.isArray(names) ? Array.from(new Set(names.map(canonicalIngredientName).filter(Boolean))) : [];
      const missing = namesList.filter((name) => !isIngredientOnList(name, groceries));
      result[mealId] = { missing: missing.length, total: namesList.length };
    }
    return result;
  }, [mealIngredientsCache, groceries]);

  // Checked shopping items represent food that made it home. Reuse that
  // household-owned data for PicMeal-style "cook from what we have" ideas;
  // nothing leaves the existing Spoonacular recipe request.
  const kitchenIngredients = useMemo(() => Array.from(new Set(inventoryIngredientNames)).slice(0, 15), [inventoryIngredientNames]);

  const addMissingGroceriesForMeal = (meal, badge) => {
    if (!meal?.id || !badge || badgeAddedRef.current.has(meal.id)) return;
    const names = mealIngredientsCache[meal.id];
    if (!Array.isArray(names)) return;
    const missingNames = Array.from(new Set(names.map(canonicalIngredientName).filter(Boolean)))
      .filter((name) => !isIngredientOnList(name, groceries));
    if (!missingNames.length) return;
    for (const name of missingNames) addGrocery({ name, quantity: 1, unit: "" });
    badgeAddedRef.current.add(meal.id);
    forceUpdate((n) => n + 1);
    if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = window.setTimeout(() => {
      badgeAddedRef.current.delete(meal.id);
      forceUpdate((n) => n + 1);
      badgeTimerRef.current = null;
    }, 2000);
  };

  const weekDays = useMemo(() => Array.from({ length: horizon }, (_, i) => addDays(todayISO(), i)), [horizon]);

  const mealFor = (date, slot) => meals.find((m) => m.date === date && m.slot === slot);

  const openEditor = (date, slot) => {
    const existing = mealFor(date, slot);
    setDraft({ title: existing?.title ?? "", notes: existing?.notes ?? "", cookIds: existing?.cookIds ?? [] });
    setShowSavedRecipes(false);
    setEditing({ date, slot, mealId: existing?.id || null });
  };

  const openMealPreview = (meal) => {
    if (!meal?.title) return;
    setDraft({ title: meal.title ?? "", notes: meal.notes ?? "", cookIds: meal.cookIds ?? [] });
    setShowSavedRecipes(false);
    setPreviewMeal({ date: meal.date, slot: meal.slot, mealId: meal.id || null });
  };

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SHARED_RECIPE_KEY);
      if (!raw) return;
      window.sessionStorage.removeItem(SHARED_RECIPE_KEY);
      const shared = JSON.parse(raw);
      setDraft({ title: shared.title || "Shared recipe", notes: shared.url || shared.text || "", cookIds: [] });
      setShowSavedRecipes(false);
      setEditing({ date: todayISO(), slot: "dinner", mealId: null, shared: true });
    } catch { /* sharing remains optional when storage is unavailable */ }
  }, []);

  const toggleCook = (id) =>
    setDraft((d) => ({ ...d, cookIds: d.cookIds.includes(id) ? d.cookIds.filter((x) => x !== id) : [...d.cookIds, id] }));

  const rouletteForSlot = async (date, slot, kitchenOnly = false, cuisineOverride) => {
    setRouletteBusy(true);
    setRouletteError("");
    const chosenCuisine = cuisineOverride !== undefined ? cuisineOverride : rouletteCuisine;
    try {
      const cuisine = chosenCuisine || "Any cuisine";
      setRouletteOptions((current) => ({
        date,
        slot,
        recipes: current?.date === date && current?.slot === slot ? current.recipes : [],
        cuisine,
        source: "spoonacular",
        kitchenOnly,
      }));
      const baseRequest = {
        ingredients: kitchenOnly ? kitchenIngredients.join(", ") : "",
        mealType: slot,
        offset: 0,
        number: 12,
        dietaryRestrictions: dietaryPreferences.restrictions || [],
        avoidIngredients: dietaryPreferences.avoidIngredients || "",
      };
      const data = await searchRecipes({
        ...baseRequest,
        cuisine: chosenCuisine === "American Comfort" ? "American" : chosenCuisine || "",
      });
      const list = recipesFromSearch(data);
      if (!list.length) {
        setRouletteError(`No ${slot} ideas matched ${chosenCuisine ? `${chosenCuisine} and ` : ""}those preferences. Try another cuisine or Any cuisine.`);
        setRouletteOptions((current) => ({ ...(current || {}), date, slot, recipes: [], cuisine, source: "spoonacular", kitchenOnly }));
        return;
      }
      setRouletteOptions({
        date,
        slot,
        recipes: list,
        cuisine,
        source: "spoonacular",
        kitchenOnly,
        offset: Number(data?.offset || 0),
        pageSize: Number(data?.number || 12),
        totalResults: Number(data?.totalResults || list.length),
      });
    } catch (error) {
      const quotaLimited = /quota|429|402|allowance|limit/i.test(error?.message || "");
      const savedFallback = quotaLimited ? savedRecipes.slice(0, 3) : [];
      setRouletteError(savedFallback.length
        ? "The recipe provider is taking a breather, so here are ideas you already saved."
        : friendlyRecipeSearchError(error));
      setRouletteOptions((current) => ({
        ...(current || {}), date, slot,
        recipes: current?.recipes?.length ? current.recipes : savedFallback,
        cuisine: chosenCuisine || "Any cuisine",
        source: savedFallback.length ? "saved" : "spoonacular",
        kitchenOnly,
      }));
    } finally {
      setRouletteBusy(false);
    }
  };

  const loadMoreMealIdeas = async () => {
    if (!rouletteOptions || rouletteBusy) return;
    setRouletteBusy(true);
    setRouletteError("");
    try {
      const nextOffset = (rouletteOptions.offset || 0) + (rouletteOptions.pageSize || 12);
      const chosenCuisine = rouletteCuisine;
      const data = await searchRecipes({
        ingredients: rouletteOptions.kitchenOnly ? kitchenIngredients.join(", ") : "",
        mealType: rouletteOptions.slot,
        cuisine: chosenCuisine === "American Comfort" ? "American" : chosenCuisine || "",
        offset: nextOffset,
        number: 12,
        dietaryRestrictions: dietaryPreferences.restrictions || [],
        avoidIngredients: dietaryPreferences.avoidIngredients || "",
      });
      const incoming = recipesFromSearch(data);
      setRouletteOptions((current) => {
        const seen = new Set(current.recipes.map((recipe) => String(recipe.id || recipe.title)));
        const unique = incoming.filter((recipe) => !seen.has(String(recipe.id || recipe.title)));
        return {
          ...current,
          recipes: [...current.recipes, ...unique],
          offset: Number(data?.offset ?? nextOffset),
          pageSize: Number(data?.number || 12),
          totalResults: Number(data?.totalResults || current.totalResults || current.recipes.length + unique.length),
        };
      });
    } catch (error) {
      setRouletteError(friendlyRecipeSearchError(error));
    } finally {
      setRouletteBusy(false);
    }
  };

  const chooseSavedRecipe = async (recipeToPlan) => {
    if (!editing || !recipeToPlan?.title) return;
    await setMealForSlot(editing.date, editing.slot, {
      title: recipeToPlan.title,
      notes: `Saved recipe · ${recipeToPlan.cuisine || "Family favourite"}`,
      cookIds: draft.cookIds,
    });
    setEditing(null);
    setShowSavedRecipes(false);
  };

  const save = () => {
    setMealForSlot(editing.date, editing.slot, draft);
    setEditing(null);
  };

  const missingIngredients = (cookRecipe?.ingredients || []).filter((ingredient) => {
    const name = typeof ingredient === "string" ? ingredient : ingredient?.name;
    return name ? !isIngredientOnList(name, groceries) : false;
  });

  const addCookIngredients = async () => {
    for (const raw of cookRecipe?.ingredients || []) {
      const name = canonicalIngredientName(typeof raw === "string" ? raw : raw?.name);
      if (!name || isIngredientOnList(name, groceries)) continue;
      await addGrocery({ name, quantity: 1, unit: "" });
    }
    setCookIngredientsAdded(true);
  };

  // Strict sourcing: Cook Mode opens immediately on the placeholder (title
  // only) so the user sees the cook screen at once. The recipe-search edge
  // function fills in real ingredients + instructions in the background.
  const openCookRecipe = async (meal) => {
    if (!titleFromMeal(meal)) return;
    setCookMeal(meal);
    setCookRecipe(placeholderRecipe(meal.title, meal.slot));
    setCookMode(false);
    setCookStep(0);
    setCookIngredientsAdded(false);
    setCookError("");
    setCookNutrition(null);
    setCookLoading(true);

    if (!supabase) {
      setCookError("offline");
      setCookLoading(false);
      return;
    }

    try {
      let recipe = cachedRecipeDetail(meal.title);
      let lastError = "";
      if (!recipe) {
        const ladder = buildCookSearchLadder(meal, dietaryPreferences);
        for (const rung of ladder) {
          const { data, error } = await supabase.functions.invoke("recipe-search", { body: rung });
          const recipeErr = data?.error || error?.message;
          if (recipeErr) { lastError = recipeErr; continue; }
          const found = recipeFromSearch(data);
          if (found) { recipe = found; break; }
        }
      }
      if (!isCookModeReady(recipe)) {
        setCookError(lastError || "Could not find a recipe for this meal. Try a different title.");
        return;
      }
      setCookRecipe({ ...placeholderRecipe(meal.title, meal.slot), ...recipe });
      cacheRecipeDetail(recipe);

      // Show the complete recipe first so the family can review the photo,
      // ingredients, nutrition and all steps before starting focused mode.
      setCookMode(false);

      // Cache ingredient names for the grocery badge on the meal card.
      const ingredientNames = recipe.ingredients
        .map((item) => typeof item === "string" ? item.trim().toLowerCase() : (item?.name || "").trim().toLowerCase())
        .filter(Boolean);
      if (ingredientNames.length && meal?.id) {
        setMealIngredientsCache((current) => {
          const next = { ...current, [meal.id]: ingredientNames };
          saveIngredientCache(next);
          return next;
        });
      }

      // Fetch nutrition data in parallel with the recipe display.
      setCookNutritionLoading(true);
      supabase.functions.invoke("recipe-nutrition", {
        body: { title: recipe.title, servings: recipe.servings, ingredients: recipe.ingredients },
      }).then(({ data: nutData, error: nutError }) => {
        if (!nutError && nutData?.totals) setCookNutrition(nutData.totals);
        setCookNutritionLoading(false);
      }).catch(() => setCookNutritionLoading(false));
    } catch (error) {
      setCookError(error?.message || "Recipe lookup failed.");
    } finally {
      setCookLoading(false);
    }
  };

  const cookSteps = cookRecipe?.instructions?.length
    ? cookRecipe.instructions
    : [];
  const currentCookStep = Math.min(cookStep, Math.max(cookSteps.length - 1, 0));
  const cookProgress = cookSteps.length ? ((currentCookStep + 1) / cookSteps.length) * 100 : 0;
  const cookVideoEmbed = youtubeEmbedUrl(cookRecipe?.videoUrl || "");

  const savedRecipeIds = useMemo(() => new Set(savedRecipes.map((recipe) => recipeKey(recipe))), [savedRecipes]);
  const cookRecipeSaved = cookRecipe ? savedRecipeIds.has(recipeKey(cookRecipe)) : false;

  const saveRecipeToLibrary = (recipeToSave = cookRecipe) => {
    if (!recipeToSave?.title) return;
    const saved = normaliseSavedRecipe({ ...recipeToSave, savedById: user?.id || null });
    setSavedRecipes((current) => [saved, ...current.filter((recipe) => recipeKey(recipe) !== saved.id)]);
  };

  const removeSavedRecipe = (id) => {
    setSavedRecipes((current) => current.filter((recipe) => recipeKey(recipe) !== id));
  };

  const openSavedRecipe = (recipeToOpen) => {
    const saved = normaliseSavedRecipe(recipeToOpen);
    setCookMeal({ id: `saved-${saved.id}`, date: todayISO(), slot: "dinner", title: saved.title, notes: "From your saved recipes" });
    setCookRecipe(saved);
    setCookMode(false);
    setCookStep(0);
    setCookError("");
    setCookLoading(false);
    setCookIngredientsAdded(true);
    setCookNutrition(null);
    setCookNutritionLoading(false);
    // Cache ingredient names for the grocery badge on the meal card.
    const ingredientNames = saved.ingredients
      .map((item) => typeof item === "string" ? item.trim().toLowerCase() : (item?.name || "").trim().toLowerCase())
      .filter(Boolean);
    if (ingredientNames.length) {
      setMealIngredientsCache((current) => {
        const next = { ...current, [cookMeal?.id || `saved-${saved.id}`]: ingredientNames };
        saveIngredientCache(next);
        return next;
      });
    }
    // Fetch nutrition data for saved recipes that have ingredients.
    if (saved.ingredients?.length && supabase) {
      setCookNutritionLoading(true);
      supabase.functions.invoke("recipe-nutrition", {
        body: { ingredients: saved.ingredients },
      }).then(({ data: nutData, error: nutError }) => {
        if (!nutError && nutData?.totals) setCookNutrition(nutData.totals);
        setCookNutritionLoading(false);
      }).catch(() => setCookNutritionLoading(false));
    }
  };

  const addSavedRecipeToPlan = async (date, slot) => {
    if (!planningRecipe?.title) return;
    await setMealForSlot(date, slot, {
      title: planningRecipe.title,
      notes: `Saved recipe · ${planningRecipe.cuisine || "Family favourite"}`,
      cookIds: [],
    });
    setPlanningRecipe(null);
  };

  // Use a single object to track all inline inputs instead of individual useState calls
  const [inlineInputs, setInlineInputs] = useState({});
  const handleInlineAdd = (date, slot, e) => {
    if (e.key === "Enter" && inlineInputs[`${date}-${slot}`]?.trim()) {
      const title = inlineInputs[`${date}-${slot}`].trim();
      setInlineInputs((prev) => ({ ...prev, [`${date}-${slot}`]: "" }));
      setMealForSlot(date, slot, { title, notes: "", cookIds: [], source: "manual" });
    }
  };
  const setInlineInput = (date, slot, val) => setInlineInputs((prev) => ({ ...prev, [`${date}-${slot}`]: val }));

  const listView = (
    <div className="px-5 space-y-4 mt-2">
      {weekDays.map((date) => {
        const isToday = date === todayISO();
        const dayMeals = MEAL_SLOTS.map((slot) => ({ slot, meal: mealFor(date, slot) }));
        return (
          <div key={date} className="meal-card-new">
            <div className="meal-card-header">
              <p className="meal-card-date">{formatDayLabel(date)}</p>
              {(() => {
                const cookEntries = dayMeals.flatMap(({ slot, meal }) =>
                  (meal?.cookIds ?? []).map((id) => ({ id, slot, member: memberById[id] })).filter((entry) => entry.member)
                );
                const uniqueCooks = [...new Map(cookEntries.map((c) => [c.id, c])).values()]
                  .map((c) => ({
                    ...c,
                    slots: SLOT_ORDER.filter((slot) => cookEntries.some((e) => e.id === c.id && e.slot === slot)).map((slot) => SLOT_META[slot].label),
                  }));
                return uniqueCooks.length > 0 ? <MealCooksTooltip cooks={uniqueCooks} /> : null;
              })()}
            </div>
            <div className="meal-card-slots">
              {dayMeals.map(({ slot, meal }) => {
                const Icon = SLOT_META[slot].icon;
                const slotColor = slot === 'breakfast' ? 'var(--color-good)' : slot === 'lunch' ? '#E85D3A' : '#D94F4F';
                return (
                  <div key={slot} className={`meal-card-slot ${meal?.title ? '' : 'meal-card-slot--empty'}`}>
                    <div className="meal-card-slot-top">
                      <div className="meal-card-slot-info">
                        <p className="meal-card-slot-name" style={{ color: slotColor }}>{SLOT_META[slot].label}</p>
                        {meal?.title ? (
                          <div className="meal-card-slot-dish">
                            <Icon size={14} color="var(--color-ink-soft)" className="shrink-0" />
                            <span>{meal.title}</span>
                          </div>
                        ) : (
                          <div className="meal-card-slot-dish meal-card-slot-empty-text">
                            <span>Nothing planned yet</span>
                          </div>
                        )}
                      </div>
                      {meal?.title ? (
                        <div className="meal-card-slot-actions">
                          {(() => {
                            const cooks = (meal.cookIds ?? []).map((id) => memberById[id]).filter(Boolean);
                            const uniqueCooks = [...new Map(cooks.map((c) => [c.id, c])).values()];
                            return uniqueCooks.length > 0 ? (
                              <div className="meal-card-avatars meal-card-slot-avatars" title={uniqueCooks.map((c) => c.name).join(", ")}>
                                {uniqueCooks.slice(0, 3).map((c) => (
                                  <Avatar key={c.id} member={c} size="sm" className="meal-card-avatar" />
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <div className="meal-card-slot-actions">
                          <button className="meal-card-add-slot-btn" onClick={() => openEditor(date, slot)}>
                            <Plus size={14} /> Add meal
                          </button>
                        </div>
                      )}
                    </div>
                    {meal?.title && (
                      <div className="meal-card-slot-buttons">
                        {meal.source === 'spoonacular' && (
                          <button className="meal-card-btn meal-card-btn-dark" onClick={() => openCookRecipe(meal)}>
                            <ChefHat size={14} /> Cook Mode
                          </button>
                        )}
                        <button className="meal-card-btn meal-card-btn-outline" onClick={() => saveRecipeToLibrary(meal)}>
                          <Bookmark size={14} /> Save recipe
                        </button>
                        <div className="meal-card-slot-actions meal-card-slot-actions-right">
                          <button className="meal-card-icon-btn" onClick={() => openEditor(date, slot)} aria-label="Edit meal">
                            <Pencil size={15} />
                          </button>
                          <button className="meal-card-icon-btn" onClick={() => removeMeal(meal.id)} aria-label="Delete meal">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <PullToRefresh onRefresh={refreshData}><div className="pb-28 reference-meals">
      <PageHeader eyebrow="Nourish & connect" title="Meal planner" illustration="meals" subtitle="Answer “what’s for dinner?” before anyone asks it." action={meals.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null} />

      <NativeAdBanner placement={AD_PLACEMENTS.MEALS} />


      <div className="meal-plan-toolbar px-5" aria-label="Meal plan controls">
        <div className="meal-range-toggle" aria-label="Meal planning range"><button className={horizon===7?"selected":""} onClick={()=>setHorizon(7)}>1 week</button><button className={horizon===14?"selected":""} onClick={()=>setHorizon(14)}>2 weeks</button></div>
      </div>

      {listView}

      {savedRecipes.length > 0 && (
        <section className="saved-recipes-section" aria-label="Saved recipes">
          <div className="saved-recipes-head">
            <div>
              <p>Saved recipes</p>
              <h3>Recipes your household already likes.</h3>
            </div>
            <span>{savedRecipes.length} saved</span>
          </div>
          <div className="saved-recipe-grid">
            {savedRecipes.map((savedRecipe) => {
              const id = recipeKey(savedRecipe);
              return (
                <article className="saved-recipe-card" key={id}>
                  <button className="saved-recipe-main" onClick={() => openSavedRecipe(savedRecipe)}>
                    <span className="saved-recipe-media">
                      {savedRecipe.thumbnail ? <img src={savedRecipe.thumbnail} alt="" loading="lazy" /> : <ImageIcon size={22} aria-hidden="true" />}
                      {(() => {
                        const saver = memberById[savedRecipe.savedById];
                        return saver ? <Avatar member={saver} size="xs" className="saved-recipe-saver" title={`Saved by ${saver.name}`} /> : null;
                      })()}
                    </span>
                    <span className="saved-recipe-copy">
                      <span>{savedRecipe.title}</span>
                      <small><Clock size={12} /> {savedRecipe.readyInMinutes || 35} min <Users size={12} /> Serves {savedRecipe.servings || 4}</small>
                      <strong><ChefHat size={14} /> View recipe</strong>
                    </span>
                  </button>
                  <button className="saved-recipe-plan" onClick={() => setPlanningRecipe(savedRecipe)}>
                    <CalendarPlus size={14} /><span>Add to plan</span>
                  </button>
                  <button className="saved-recipe-remove" onClick={() => removeSavedRecipe(id)} aria-label={`Remove ${savedRecipe.title}`}><X size={14} /></button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Meal Preview Modal — read-only preview for manual meals */}
      <Modal open={!!previewMeal} onClose={() => setPreviewMeal(null)} title={previewMeal ? `${SLOT_META[previewMeal.slot].label} · ${formatDayLabel(previewMeal.date)}` : ""}>
        <div className="meal-preview">
          <p className="font-[var(--font-display)] text-[19px] font-semibold mb-4">{draft.title}</p>
          {draft.notes && <p className="text-[14px] text-[var(--color-ink-soft)] mb-4">{draft.notes}</p>}
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Who's cooking:</p>
            {draft.cookIds.length > 0 && (
              <AvatarStack members={draft.cookIds.map(id => memberById[id]).filter(Boolean)} size="xs" />
            )}
          </div>
          {draft.notes && <p className="text-[14px] text-[var(--color-ink-soft)] mb-4">{draft.notes}</p>}
          <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Assign cooks:</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {members.map((m) => {
              const active = draft.cookIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleCook(m.id)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium border transition-colors"
                  style={{
                    borderColor: active ? colorVar(m.color) : "var(--color-border)",
                    backgroundColor: active ? `color-mix(in srgb, ${colorVar(m.color)} 14%, white)` : "transparent",
                    color: active ? colorVar(m.color) : "var(--color-ink-soft)",
                  }}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setPreviewMeal(null); openCookRecipe(previewMeal); }} className="rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] px-4 py-3 flex items-center justify-center gap-1.5 text-[13px] font-medium shrink-0 w-full">
              <ChefHat size={16} /> Cook
            </button>
            <SecondaryButton onClick={() => { setPreviewMeal(null); openEditor(previewMeal.date, previewMeal.slot); }}>Edit</SecondaryButton>
            <SecondaryButton onClick={() => setPreviewMeal(null)}>Close</SecondaryButton>
          </div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `${SLOT_META[editing.slot].label} · ${formatDayLabel(editing.date)}` : ""}>
        <TextField
          label="What are we cooking?"
          placeholder="e.g. Sheet-pan chicken fajitas"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          autoFocus
        />

        <TextField
          label="Notes (optional)"
          placeholder="Prep notes, sides, reminders..."
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />

        <div className="meal-editor-tools">
          <button onClick={() => { if (editing) { rouletteForSlot(editing.date, editing.slot); setEditing(null); } }}><Dices size={16} /> Roulette</button>
          <button onClick={() => setShowSavedRecipes((value) => !value)}><Bookmark size={16} /> Saved recipes</button>
        </div>
        {showSavedRecipes && (
          <div className="saved-recipe-picker">
            <div><strong>Saved recipes</strong><span>{savedRecipes.length ? "Choose one for this meal." : "Save recipes from Cook Mode and they'll appear here."}</span></div>
            {savedRecipes.length > 0 && <ul>{savedRecipes.map((saved) => <li key={saved.id}><button onClick={() => chooseSavedRecipe(saved)}><span>{saved.title}</span><small>{saved.cuisine} · {saved.readyInMinutes} min</small></button></li>)}</ul>}
          </div>
        )}

        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Who's cooking?</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {members.map((m) => {
            const active = draft.cookIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleCook(m.id)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium border transition-colors"
                style={{
                  borderColor: active ? colorVar(m.color) : "var(--color-border)",
                  backgroundColor: active ? `color-mix(in srgb, ${colorVar(m.color)} 14%, white)` : "transparent",
                  color: active ? colorVar(m.color) : "var(--color-ink-soft)",
                }}
              >
                {m.name}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          {editing?.mealId && (
            <button
              onClick={async () => { await removeMeal(editing.mealId); setEditing(null); }}
              className="rounded-xl border border-[var(--color-warn)] text-[var(--color-warn)] px-3 py-3 flex items-center justify-center gap-1.5 text-[13px] font-medium shrink-0"
              aria-label="Clear this meal"
              title="Clear meal"
            >
              <Trash2 size={16} /> Clear
            </button>
          )}
          <SecondaryButton onClick={() => setEditing(null)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save}>Save</PrimaryButton>
        </div>
      </Modal>
      <ConfirmAction
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={async () => { await clearMeals(); setClearing(false); }}
        title="Clear the meal plan?"
        copy={
          meals.length === 0
            ? "There are no meals to clear right now."
            : meals.length === 1
              ? "This clears the 1 planned meal. Your ideas and family members stay put."
              : `This clears all ${meals.length} planned meals. Your ideas and family members stay put.`
        }
        confirmLabel={meals.length === 1 ? "Clear 1 meal" : `Clear ${meals.length} meals`}
      />

      {/* Meal ideas — Spoonacular results are filtered to the selected meal slot. */}
      <Modal open={!!rouletteOptions} onClose={() => setRouletteOptions(null)} title={rouletteOptions ? `${SLOT_META[rouletteOptions.slot].label} meal ideas` : ""}>
        <div className="roulette-picker">
          {/* Cuisine chip row — filter the roulette to a specific cuisine type */}
          <div className="roulette-cuisine-chips" role="group" aria-label="Filter roulette by cuisine">
            <button
              type="button"
              className={`roulette-cuisine-chip ${rouletteCuisine === null ? "selected" : ""}`}
              onClick={() => { setRouletteCuisine(null); rouletteForSlot(rouletteOptions.date, rouletteOptions.slot, rouletteOptions.kitchenOnly, null); }}
              aria-pressed={rouletteCuisine === null}
            >
              Any cuisine
            </button>
            {CUISINE_LIST.map((cuisine) => (
              <button
                key={cuisine}
                type="button"
                className={`roulette-cuisine-chip ${rouletteCuisine === cuisine ? "selected" : ""}`}
                onClick={() => { setRouletteCuisine(cuisine); rouletteForSlot(rouletteOptions.date, rouletteOptions.slot, rouletteOptions.kitchenOnly, cuisine); }}
                aria-pressed={rouletteCuisine === cuisine}
              >
                {cuisine}
              </button>
            ))}
          </div>
          {rouletteOptions && (
            <>
              <p className="roulette-picker-intro">
                {rouletteBusy
                  ? `Finding ${rouletteOptions.slot} ideas…`
                  : rouletteOptions.kitchenOnly
                    ? `Found ${rouletteOptions.recipes.length} ${rouletteOptions.slot} idea${rouletteOptions.recipes.length === 1 ? "" : "s"} using what is already in your kitchen.`
                    : `Showing ${rouletteOptions.recipes.length}${rouletteOptions.totalResults > rouletteOptions.recipes.length ? ` of ${rouletteOptions.totalResults}` : ""} ${rouletteOptions.slot} recipe${rouletteOptions.recipes.length === 1 ? "" : "s"} for ${rouletteOptions.cuisine}. Pick the one that sounds good.`}
              </p>
              {rouletteError && <p className="roulette-picker-error" role="alert">{rouletteError}</p>}
              <div className={`roulette-picker-list ${rouletteBusy ? "is-refreshing" : ""}`} aria-busy={rouletteBusy}>
                {rouletteOptions.recipes.map((recipe, index) => (
                  <button
                    key={`${recipe.title}-${index}`}
                    className="roulette-picker-card"
                    onClick={async () => {
                      await setMealForSlot(rouletteOptions.date, rouletteOptions.slot, {
                        title: recipe.title,
                        notes: `Spoonacular recipe${recipe.id ? ` · ${recipe.id}` : ""}`,
                        cookIds: [],
                        source: "spoonacular",
                      });
                      // Discovery only returns recipes already verified to have
                      // ingredients and instructions, so Cook Mode can open the
                      // exact selected recipe without a fragile title lookup.
                      cacheRecipeDetail(recipe);
                      // Cache ingredient names so the grocery-status badge
                      // shows immediately on the meal card without needing
                      // to open Cook Mode first. Deferred to next render
                      // cycle so the meal is available via mealFor().
                      const ingredientNames = (recipe.ingredients || [])
                        .map((item) => typeof item === "string" ? item.trim().toLowerCase() : (item?.name || "").trim().toLowerCase())
                        .filter(Boolean);
                      if (ingredientNames.length) {
                        setTimeout(() => {
                          const created = mealFor(rouletteOptions.date, rouletteOptions.slot);
                          if (created?.id) {
                            setMealIngredientsCache((current) => {
                              const next = { ...current, [created.id]: ingredientNames };
                              saveIngredientCache(next);
                              return next;
                            });
                          }
                        }, 0);
                      }
                      setRouletteOptions(null);
                    }}
                  >
                    {recipe.thumbnail ? (
                      <img className="roulette-picker-thumb" src={recipe.thumbnail} alt="" loading="lazy" />
                    ) : (
                      <span className="roulette-picker-index">{index + 1}</span>
                    )}
                    <div className="roulette-picker-copy">
                      <strong>{recipe.title}</strong>
                      <small>
                        {recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : ""}
                        {recipe.servings ? ` · Serves ${recipe.servings}` : ""}
                        {recipe.cuisine ? ` · ${recipe.cuisine}` : ""}
                      </small>
                      {rouletteOptions.kitchenOnly && (recipe.usedIngredientCount > 0 || recipe.missedIngredientCount > 0) && (
                        <small className="roulette-ingredient-match">Uses {recipe.usedIngredientCount} at home · {recipe.missedIngredientCount} missing</small>
                      )}
                      <small className="roulette-cost-hint">Tap for cost estimate</small>
                    </div>
                    <ChefHat size={16} className="roulette-picker-arrow" />
                  </button>
                ))}
              </div>
              <div className="roulette-picker-actions">
                <button className="roulette-picker-spin" disabled={rouletteBusy || rouletteOptions.recipes.length < 2} onClick={() => setRouletteOptions((current) => ({ ...current, recipes: [...current.recipes.slice(1), current.recipes[0]] }))}>
                  <Dices size={14} /> Shuffle ideas
                </button>
                {rouletteOptions.source === "spoonacular" && rouletteOptions.recipes.length < rouletteOptions.totalResults && (
                  <button className="roulette-picker-spin" disabled={rouletteBusy} onClick={loadMoreMealIdeas}>
                    {rouletteBusy ? "Finding more…" : "Load more recipes"}
                  </button>
                )}
                <button className="roulette-picker-close" onClick={() => setRouletteOptions(null)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!planningRecipe} onClose={() => setPlanningRecipe(null)} title={planningRecipe ? `Add ${planningRecipe.title}` : "Add recipe to plan"}>
        <p className="saved-plan-intro">Choose when you want to make it. Selecting an occupied meal replaces the current plan.</p>
        <div className="saved-plan-days">
          {weekDays.map((date) => (
            <section key={date}>
              <strong>{formatDayLabel(date)}</strong>
              <div>
                {MEAL_SLOTS.map((slot) => {
                  const existing = mealFor(date, slot);
                  const Icon = SLOT_META[slot].icon;
                  return (
                    <button key={slot} onClick={() => addSavedRecipeToPlan(date, slot)}>
                      <Icon size={15} />
                      <span>{SLOT_META[slot].label}</span>
                      <small>{existing?.title || "Open"}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Modal>
      <Modal open={!!consumeReview} onClose={() => setConsumeReview(null)} title="Update kitchen inventory?">
        <div className="consume-review">
          <p>FamOS found ingredients from this recipe in your kitchen. Review what was finished—nothing changes until you confirm.</p>
          <div>{(consumeReview || []).map((item) => {
            const selected = consumeSelection.includes(item.id);
            return <button key={item.id} className={selected ? "selected" : ""} onClick={() => setConsumeSelection((current) => selected ? current.filter((id) => id !== item.id) : [...current, item.id])}><span>{selected ? <Check size={14}/> : null}</span><strong>{item.name}</strong><small>{item.quantity}{item.unit ? ` ${item.unit}` : ""} in {item.location}</small></button>;
          })}</div>
          <div className="consume-review-actions"><SecondaryButton onClick={() => setConsumeReview(null)}>Keep everything</SecondaryButton><PrimaryButton disabled={!consumeSelection.length} onClick={async () => { for (const id of consumeSelection) await removeInventoryItem(id); setConsumeReview(null); }}>Mark {consumeSelection.length} used</PrimaryButton></div>
        </div>
      </Modal>
      <Modal open={!!substituteModal} onClose={() => { setSubstituteModal(null); setSubstituteResult(null); }} title={`Substitutes for ${substituteModal || ""}`}>
        {substituteLoading && <p className="cook-status"><Sparkles size={16} /> Looking up substitutes…</p>}
        {!substituteLoading && substituteResult && (
          <div className="substitute-result">
            {substituteResult.substitutes.length > 0 ? (
              <>
                <p className="substitute-intro">Here are alternatives for <strong>{substituteResult.ingredient}</strong>:</p>
                <ul className="substitute-list">
                  {substituteResult.substitutes.map((sub, i) => (
                    <li key={i}>{sub}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="substitute-empty">{substituteResult.message || `No substitutes found for ${substituteResult.ingredient}.`}</p>
            )}
          </div>
        )}
      </Modal>
      {cookMeal && cookRecipe && createPortal(
        <div className={`app-shell cook-mode-portal ${document.querySelector(".app-shell")?.classList.contains("theme-dark") ? "theme-dark" : ""}`}>
        <ErrorBoundary
          fallback={(error) => (
            <div className="cook-focus-screen cook-focus-crash" role="alert">
              <div className="cook-focus-shell">
                <div className="cook-focus-topbar">
                  <button onClick={() => setCookMeal(null)}><ArrowLeft size={18} /> Back to meals</button>
                </div>
                <section className="cook-focus-hero no-photo">
                  <div className="cook-focus-copy">
                    <p className="eyebrow">COOK MODE</p>
                    <h2>{cookRecipe.title}</h2>
                    <p>Cook Mode hit an unexpected snag. Your meal is still in the planner — finishing cooking and trying again usually clears it.</p>
                    <button className="cook-primary-action" onClick={() => setCookMeal(null)}>
                      <ChefHat size={21} />
                      <span><strong>Back to meal planner</strong><small>You can re-open Cook Mode any time</small></span>
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}
        >
          <div className="cook-focus-screen" role="dialog" aria-modal="true" aria-label={`Recipe for ${cookRecipe.title}`}>
          <div className="cook-focus-shell">
            <div className="cook-focus-topbar">
              <button onClick={() => setCookMeal(null)}><ArrowLeft size={18} /> Back to meals</button>
              <div className="cook-focus-topbar-actions">
                <button className={`recipe-save-button ${cookRecipeSaved ? "saved" : ""}`} onClick={() => saveRecipeToLibrary(cookRecipe)} disabled={!cookRecipe.instructions.length} title={cookRecipe.instructions.length ? "Save recipe to your library" : "Recipe is still loading"}><Bookmark size={16} /> {cookRecipeSaved ? "Saved" : "Save recipe"}</button>
                <button onClick={() => { setCookMeal(null); openEditor(cookMeal.date, cookMeal.slot); }}>Edit meal</button>
              </div>
            </div>

            <section className={`cook-focus-hero ${cookRecipe.thumbnail ? "has-photo" : "no-photo"}`}>
              {cookRecipe.thumbnail && <img className="cook-focus-hero-image" src={cookRecipe.thumbnail} alt={`Prepared ${cookRecipe.title}`} />}
              {cookRecipe.thumbnail && <span className="cook-focus-hero-shade" aria-hidden="true" />}
              <div className="cook-focus-copy">
                <p className="eyebrow">{cookMode ? "COOK MODE" : "READY TO COOK"}</p>
                <h2>{cookRecipe.title}</h2>
                <p>{cookMeal.notes || "FamOS will pull the ingredients and walk you through every step."}</p>
                <div className="cook-meta-row">
                  <span><Clock size={15} /> {cookRecipe.readyInMinutes || 35} min</span>
                  <span><Users size={15} /> Serves {cookRecipe.servings || 4}</span>
                  <span><ChefHat size={15} /> {cookRecipe.cuisine || "Family favourite"}</span>
                  {recipeCost && recipeCost.totalCostPerServing > 0 && (
                    <span className="cook-cost-badge">~{formatCost(recipeCost.totalCostPerServing)}/serving</span>
                  )}
                </div>
              </div>
            </section>

            {cookLoading && <div className="cook-status"><Sparkles size={16} /> Looking up the recipe…</div>}
            {cookError && <div className="cook-status subtle"><Sparkles size={16} /> {cookError.includes("429") ? "Hit our request limit just now. Try again in a few minutes." : cookError.includes("not configured") ? "Recipe lookup isn't set up on this build yet." : cookError.includes("no recipe") || cookError.includes("Rate") ? "No match for this meal yet. Try a different title, or skip Cook Mode and just use the planner." : `Could not load this recipe (${cookError}).`}</div>}

            {!cookMode ? (
              <div className="cook-focus-layout">
                <Card className="cook-panel">
                  <div className="cook-panel-head"><ListChecks size={18} /><h3>Ingredients</h3></div>
                  <p className="cook-panel-note">{cookRecipe.ingredients.length ? "Tap below to push missing ingredients to your weekly grocery list." : "Ingredients load as soon as the recipe arrives."}</p>
                  <ul className="cook-plain-list">
                    {cookRecipe.ingredients.length ? (
                      cookRecipe.ingredients.map((item, index) => {
                        const name = typeof item === "string" ? item : item?.name;
                        return (
                          <li key={`${item}-${index}`} className="cook-ingredient-item">
                            <span>{name}</span>
                            <button
                              type="button"
                              className="cook-substitute-btn"
                              onClick={() => fetchSubstitutes(name)}
                              title={`Find substitutes for ${name}`}
                            >
                              Swap
                            </button>
                          </li>
                        );
                      })
                    ) : (
                      <li className="cook-empty-line">No ingredients yet — wait for the lookup to finish.</li>
                    )}
                  </ul>
                  <button
                    className={`recipe-grocery-button ${missingIngredients.length && !cookIngredientsAdded ? "needs-items" : ""}`}
                    disabled={missingIngredients.length === 0 || cookIngredientsAdded}
                    onClick={addCookIngredients}
                    title={missingIngredients.length ? `Add ${missingIngredients.length} ingredients to groceries` : "All ingredients already on list"}
                  >
                    <ShoppingCart size={15} />
                    {cookIngredientsAdded
                      ? "✓ Ingredients added to list"
                      : missingIngredients.length
                        ? `➕ Add ${missingIngredients.length} missing to grocery list`
                        : cookRecipe.ingredients.length
                          ? "✓ All groceries covered"
                          : "No ingredients to add yet"}
                  </button>
                </Card>
                <Card className="cook-panel cook-nutrition-card">
                  <div className="cook-panel-head"><BarChart3 size={18} /><h3>Nutrition facts</h3></div>
                  {cookNutrition ? (
                    <div className="cook-nutrition-grid">
                      <div className="cook-nutrition-main">
                        <strong>{Math.round(cookNutrition.calories)}</strong>
                        <span>calories</span>
                      </div>
                      <div className="cook-nutrition-row"><span>Protein</span><b>{cookNutrition.protein_g}g</b></div>
                      <div className="cook-nutrition-row"><span>Carbs</span><b>{cookNutrition.carbohydrates_total_g}g</b></div>
                      <div className="cook-nutrition-row"><span>Fat</span><b>{cookNutrition.fat_total_g}g</b></div>
                      <div className="cook-nutrition-row"><span>Saturated</span><b>{cookNutrition.fat_saturated_g}g</b></div>
                      <div className="cook-nutrition-row"><span>Fiber</span><b>{cookNutrition.fiber_g}g</b></div>
                      <div className="cook-nutrition-row"><span>Sugar</span><b>{cookNutrition.sugar_g}g</b></div>
                      <div className="cook-nutrition-row"><span>Sodium</span><b>{Math.round(cookNutrition.sodium_mg)}mg</b></div>
                    </div>
                  ) : cookNutritionLoading ? (
                    <p className="cook-nutrition-loading">Looking up nutrition data…</p>
                  ) : (
                    <p className="cook-panel-note">Nutrition facts appear as soon as the ingredients are ready.</p>
                  )}
                </Card>
                <Card className="cook-panel">
                  <div className="cook-panel-head"><ChefHat size={18} /><h3>Steps ahead</h3></div>
                  <p className="cook-panel-note">{cookRecipe.instructions.length ? "Step-by-step cooking instructions. Use Cook Mode for hands-free navigation." : cookLoading ? "Loading verified cooking instructions…" : "This meal does not have verified cooking instructions."}</p>
                  {cookRecipe.instructions.length ? (
                    <ol className="cook-plain-list ordered">
                      {cookRecipe.instructions.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                    </ol>
                  ) : (
                    <p className="cook-empty-line">No steps loaded yet.</p>
                  )}
                </Card>
                <button className="cook-primary-action" disabled={!cookRecipe.instructions.length} onClick={() => { setCookMode(true); setCookStep(0); }}>
                  <ChefHat size={21} />
                  <span><strong>{cookRecipe.instructions.length ? "Start Cook Mode" : cookLoading ? "Loading recipe" : "Recipe unavailable"}</strong><small>{cookRecipe.instructions.length ? "Hands-friendly, one step at a time" : cookLoading ? "Checking ingredients and steps" : "Choose another meal idea"}</small></span>
                </button>
              </div>
            ) : (
              <div className="cook-guide-layout">
                <section className="cook-step-media" aria-label="Recipe visual">
                  {cookVideoEmbed ? (
                    <iframe src={cookVideoEmbed} title={`${cookRecipe.title} cooking video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  ) : cookRecipe.thumbnail ? (
                    <img src={cookRecipe.thumbnail} alt={`Prepared ${cookRecipe.title}`} />
                  ) : (
                    <span><ChefHat size={34} /><small>Step-by-step Cook Mode</small></span>
                  )}
                  <div className="cook-step-media-label"><span>Now cooking</span><strong>{cookRecipe.title}</strong></div>
                </section>
                <div className="cook-progress-card">
                  <div>
                    <span>Step {currentCookStep + 1} of {cookSteps.length}</span>
                    <strong>{Math.round(cookProgress)}%</strong>
                  </div>
                  <ProgressBar value={cookProgress} color="var(--color-fam-coral)" size="lg" />
                </div>

                <Card className="cook-step-card">
                  <div className="cook-step-kicker">
                    <ChefHat size={18} />
                    <span>Cook along</span>
                  </div>
                  <h3>{cookSteps[currentCookStep]}</h3>
                  <p>When this step is done, tap next. FamOS will keep the recipe moving without turning this into another checklist.</p>
        <div className="cook-guide-actions">
          {/* Listen toggle — hidden entirely if SpeechRecognition is unsupported so we never tease a feature we can't deliver. */}
          {voiceSupported && (
            <button
              type="button"
              className={`cook-listen-toggle ${voiceListening ? "is-listening" : ""}`}
              onClick={toggleVoice}
              aria-pressed={voiceListening}
              aria-label={voiceListening ? "Stop listening for voice commands" : "Start listening for voice commands"}
              title={voiceListening ? "Listening — say ‘next’, ‘back’, or ‘finish’" : "Hands-free voice commands"}
            >
              {voiceListening ? <MicOff size={17} /> : <Mic size={17} />}
              <span>{voiceListening ? "Listening" : "Listen"}</span>
            </button>
          )}
          <button disabled={currentCookStep === 0} onClick={() => advanceCookStep(-1)}>Previous</button>
          {currentCookStep < cookSteps.length - 1 ? (
            <button className="primary" onClick={() => advanceCookStep(1)}>Next step</button>
          ) : (
            <button className="primary" onClick={finishCookMode}><Check size={17} /> Finish cooking</button>
          )}
        </div>
        {voiceSupported && (voiceListening || voiceTranscript || voiceError) && (
          <p
            className={`cook-voice-transcript ${voiceListening ? "is-listening" : ""} ${voiceError ? "is-error" : ""}`}
            role={voiceError ? "alert" : "status"}
            aria-live="polite"
          >
            {voiceError
              ? `Voice: ${voiceError}`
              : voiceTranscript
                ? `Heard: “${voiceTranscript}”`
                : `Say “next”, “back”, or “finish”`}
          </p>
        )}
                </Card>

                <Card className="cook-quiet-reference">
                  <div className="cook-panel-head"><ListChecks size={18} /><h3>Ingredients nearby</h3></div>
                  <div className="cook-ingredient-chips">
                    {cookRecipe.ingredients.slice(0, 10).map((item, index) => <span key={`${typeof item === "string" ? item : item?.name}-${index}`}>{typeof item === "string" ? item : item?.name}</span>)}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
        </ErrorBoundary>
        </div>
      , document.body)}
    </div></PullToRefresh>
  );
}
