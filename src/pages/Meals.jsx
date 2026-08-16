import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, BarChart3, Bookmark, CalendarPlus, Check, ChefHat, Clock, Coffee, Dices, Image as ImageIcon, ListChecks, Mic, MicOff, Refrigerator, ShoppingCart, Soup, Sparkles, Trash2, Users, X } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarStack, Card, Modal, PrimaryButton, ProgressBar, SecondaryButton, TextField, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import ConfirmAction from "../components/ConfirmAction";
import ErrorBoundary from "../components/ErrorBoundary";
import { MEAL_SLOTS } from "../data/mockData";
import { buildCookSearchLadder, recipeSearchProfileForMeal } from "../data/recipeBox";
import { addDays, formatDayLabel, todayISO } from "../lib/dates";
import { canonicalIngredientName, isIngredientOnList } from "../lib/mealIngredientCache";
import { invokeEdgeFunction, supabase } from "../lib/supabase";
import { searchRecipes } from "../lib/recipeSearch";
import useVoiceCommands, { requestScreenWakeLock } from "../hooks/useVoiceCommands";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { SHARED_RECIPE_KEY } from "../lib/sharedContent";

const SLOT_META = {
  breakfast: { label: "Breakfast", icon: Coffee },
  lunch: { label: "Lunch", icon: Soup },
  dinner: { label: "Dinner", icon: ChefHat },
};

const SAVED_RECIPES_KEY = "famos:saved-recipes:v1";
const RECIPE_DETAIL_CACHE_KEY = "famos:recipe-details:v1";
const DIETARY_PREFERENCES_KEY = "famos:dietary-preferences:v1";

const friendlyRecipeSearchError = (error) => {
  const message = error?.message || String(error || "");
  if (/quota|429|402/i.test(message)) return "Recipe suggestions have reached today’s provider limit. Your existing meal plan is safe—try again a little later.";
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
const cacheRecipeDetail = (recipe) => {
  const key = recipeTitleKey(recipe?.title);
  if (!key) return;
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
    return current[recipeTitleKey(title)] || null;
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
  const [editing, setEditing] = useState(null); // { date, slot }
  const [draft, setDraft] = useState({ title: "", notes: "", cookIds: [] });
  const [showSavedRecipes, setShowSavedRecipes] = useState(false);
  const [cookMeal, setCookMeal] = useState(null);
  const [cookRecipe, setCookRecipe] = useState(null);
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
  useEffect(() => {
    if (!cookMeal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setCookMeal(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
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
      const quotaLimited = /quota|429|402/i.test(error?.message || "");
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
      if (!recipe) {
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
    const saved = normaliseSavedRecipe(recipeToSave);
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

  return (
    <PullToRefresh onRefresh={refreshData}><div className="pb-24 reference-meals">
      <PageHeader eyebrow="Nourish & connect" title="Meal planner" illustration="meals" subtitle="Answer “what’s for dinner?” before anyone asks it." action={meals.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null} />

      <div className="meal-range-toggle px-5" aria-label="Meal planning range"><button className={horizon===7?"selected":""} onClick={()=>setHorizon(7)}>1 week</button><button className={horizon===14?"selected":""} onClick={()=>setHorizon(14)}>2 weeks</button></div>

      <section className="kitchen-ideas-card" aria-labelledby="kitchen-ideas-title">
        <span className="kitchen-ideas-icon" aria-hidden="true"><Refrigerator size={21} /></span>
        <div className="kitchen-ideas-copy">
          <p>Kitchen ideas</p>
          <h3 id="kitchen-ideas-title">Cook from what you have.</h3>
          <span>{kitchenIngredients.length ? `${kitchenIngredients.length} recently purchased item${kitchenIngredients.length === 1 ? "" : "s"} can inspire the next meal.` : "Complete items on your shopping list to build your kitchen inventory."}</span>
        </div>
        <div className="kitchen-ideas-actions" aria-label="Find recipes from kitchen items">
          {MEAL_SLOTS.map((slot) => {
            const Icon = SLOT_META[slot].icon;
            return <button key={slot} disabled={!kitchenIngredients.length} onClick={() => rouletteForSlot(todayISO(), slot, true)}><Icon size={15} /><span>{SLOT_META[slot].label}</span></button>;
          })}
        </div>
      </section>

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

      <div className="px-5 space-y-4 mt-2">
        {weekDays.map((date) => {
          const isToday = date === todayISO();
          return (
            <Card key={date} className="meal-day-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-[var(--font-display)] font-semibold text-[15px] text-[var(--color-ink)]">
                  {formatDayLabel(date)}
                </p>
                {isToday && (
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2 py-0.5 rounded-full">
                    Today
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {MEAL_SLOTS.map((slot) => {
                  const meal = mealFor(date, slot);
                  const Icon = SLOT_META[slot].icon;
                  const cooks = (meal?.cookIds ?? []).map((id) => memberById[id]).filter(Boolean);
                  const adder = meal?.createdBy ? memberById[meal.createdBy] : null;
                  return (
                    <div className={`meal-slot-row ${slot === "dinner" ? "is-dinner" : ""}`} key={slot}>
                      <button
                        onClick={() => meal?.title ? openCookRecipe(meal) : openEditor(date, slot)}
                        className="meal-slot-button flex items-center gap-3 text-left transition-colors"
                      >
                        {meal?.title && (
                          <span
                            className="meal-slot-clear"
                            onClick={(e) => { e.stopPropagation(); removeMeal(meal.id); }}
                            aria-label={`Clear ${meal.title}`}
                            title="Clear this meal"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); removeMeal(meal.id); } }}
                          >
                            <X size={14} />
                          </span>
                        )}
                        <Icon size={16} color="var(--color-ink-faint)" className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="meal-slot-label text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
                            {SLOT_META[slot].label}
                          </p>
                          <p className={`meal-slot-value text-[14px] truncate ${meal?.title ? "has-meal text-[var(--color-ink)] font-medium" : "is-empty text-[var(--color-ink-faint)]"}`}>
                            {meal?.title || "Add a meal"}
                          </p>
                          {meal?.title && <div className="meal-slot-meta">
                            {adder && <span className="meal-slot-adder"><Avatar member={adder} size="xs" aria-label={`Added by ${adder.name}`} /><small>Added by {adder.name}</small></span>}
                            <span className="meal-cook-hint"><ChefHat size={12} /> Cook</span>
                          </div>}
                        </div>
                        {cooks.length > 0 && <AvatarStack members={cooks} size="sm" />}
                      </button>
                      <div className="meal-slot-actions">
                        {(() => {
                          const badge = meal?.id && mealMissingCount[meal.id];
                          if (!badge) return null;
                          const allCovered = badge.missing === 0;
                          const justAdded = badgeAddedRef.current.has(meal.id);
                          return (
                            <button
                              className={`meal-grocery-action ${justAdded ? "added" : allCovered ? "covered" : "needs"}`}
                              onClick={() => addMissingGroceriesForMeal(meal, badge)}
                              disabled={allCovered || justAdded}
                              aria-label={justAdded ? "Ingredients added" : allCovered ? "Groceries ready" : `Add ${badge.missing} missing ingredients to shopping`}
                            >
                              <ShoppingCart size={15} />
                              <span>{justAdded ? "Added" : allCovered ? "Groceries ready" : `${badge.missing} missing`}</span>
                            </button>
                          );
                        })()}
                        {meal?.title && (
                          <button className="meal-start-cooking" onClick={() => openCookRecipe(meal)} aria-label={`Start cooking ${meal.title}`}>
                            <ChefHat size={15} /><span>Cook</span>
                          </button>
                        )}
                        <button className="meal-slot-tool meal-surprise-action" onClick={() => rouletteForSlot(date, slot)} aria-label={`Find ${SLOT_META[slot].label.toLowerCase()} meal ideas`} title="Find meal ideas">
                          <Sparkles size={15} /><span>Find Meal Ideas</span>
                        </button>
                        <button className="meal-slot-tool" onClick={() => { openEditor(date, slot); setShowSavedRecipes(true); }} aria-label={`Choose a saved recipe for ${SLOT_META[slot].label.toLowerCase()}`} title="Saved recipes">
                          <Bookmark size={15} /><span>Saved</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

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
                        notes: `Roulette pick`,
                        cookIds: [],
                      });
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
                      cookRecipe.ingredients.map((item, index) => (
                        <li key={`${item}-${index}`}>{typeof item === "string" ? item : item?.name}</li>
                      ))
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
                  <p className="cook-panel-note">{cookRecipe.instructions.length ? "Step-by-step cooking instructions. Use Cook Mode for hands-free navigation." : "Step-by-step instructions land as soon as the recipe arrives."}</p>
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
                  <span><strong>{cookRecipe.instructions.length ? "Start Cook Mode" : "Awaiting instructions"}</strong><small>{cookRecipe.instructions.length ? "Hands-friendly, one step at a time" : "Recipe is still loading"}</small></span>
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
