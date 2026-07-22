import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, Bookmark, CalendarPlus, CandyOff, Check, ChefHat, Clock, Coffee, Dices, FishOff, Leaf, ListChecks, MilkOff, NutOff, ShoppingCart, Soup, Sparkles, Sprout, Trash2, Users, WheatOff, X } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { AvatarStack, Card, Modal, PrimaryButton, SecondaryButton, TextField, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import { MEAL_SLOTS } from "../data/mockData";
import { recipeSearchProfileForMeal } from "../data/recipeBox";
import { addDays, formatDayLabel, todayISO } from "../lib/dates";
import { supabase } from "../lib/supabase";

const SLOT_META = {
  breakfast: { label: "Breakfast", icon: Coffee },
  lunch: { label: "Lunch", icon: Soup },
  dinner: { label: "Dinner", icon: ChefHat },
};

const SAVED_RECIPES_KEY = "famos:saved-recipes:v1";
const DIETARY_PREFERENCES_KEY = "famos:dietary-preferences:v1";
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Shellfish-free", "Low sugar"];
const DIETARY_META = {
  Vegetarian: { icon: Leaf, tone: "green" },
  Vegan: { icon: Sprout, tone: "mint" },
  "Gluten-free": { icon: WheatOff, tone: "amber" },
  "Dairy-free": { icon: MilkOff, tone: "blue" },
  "Nut-free": { icon: NutOff, tone: "rose" },
  "Shellfish-free": { icon: FishOff, tone: "aqua" },
  "Low sugar": { icon: CandyOff, tone: "grape" },
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
  source: recipe.source || "api-ninjas",
  sourceUrl: recipe.sourceUrl || "",
  savedAt: recipe.savedAt || new Date().toISOString(),
});

// Pull a single recipe out of a recipe-search response — strict API Ninjas
// shape (returns `{recipes: [...]}`; older clients/tests may wrap that in
// `{data: {recipes}}`).
const recipeFromSearch = (data) => {
  if (!data) return null;
  const root = data?.data && typeof data.data === "object" ? data.data : data;
  const list = Array.isArray(root?.recipes) ? root.recipes : [];
  return list[0] || null;
};

// Skinny recipe used while we wait for API Ninjas. Cook Mode renders the
// title alone so the family still gets a holdable target even when the
// instructions blob hasn't arrived yet.
const placeholderRecipe = (title, slot) => ({
  title: title || "Untitled recipe",
  cuisine: "Waiting for API Ninjas",
  readyInMinutes: 35,
  servings: 4,
  ingredients: [],
  instructions: [],
  source: "api-ninjas",
  sourceUrl: "https://api-ninjas.com/api/recipe",
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

const titleFromMeal = (meal) => String(meal?.title || "").trim();

export default function Meals() {
  const { members, memberById, meals, groceries, addGrocery, setMealForSlot, removeMeal, clearMeals, refreshData } = useFamily();
  const { householdProfileExtra } = useAuth();
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
  // Cached ingredient names per meal ID — populated once a recipe has been
  // looked up, persists across sessions so the grocery badge works immediately.
  const [mealIngredientsCache, setMealIngredientsCache] = useState(() => loadIngredientCache());
  // Track which meal badges have been tapped for "Added!" feedback (ephemeral, not persisted).
  const badgeAddedRef = useRef(new Set());
  const badgeTimerRef = useRef(null);
  const [, forceUpdate] = useState(0);
  useEffect(() => () => { if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current); }, []);
  const [savedRecipes, setSavedRecipes] = useState(() => readStoredJson(SAVED_RECIPES_KEY, []));
  const [planningRecipe, setPlanningRecipe] = useState(null);
  const [dietaryPreferences, setDietaryPreferences] = useState(() => {
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

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(DIETARY_PREFERENCES_KEY, JSON.stringify(dietaryPreferences));
  }, [dietaryPreferences]);

  // For each meal with cached ingredients, compute how many are missing from the
  // grocery list. Returns { missing, total } or null when no cache entry exists.
  const mealMissingCount = useMemo(() => {
    const result = {};
    for (const [mealId, names] of Object.entries(mealIngredientsCache)) {
      const namesList = Array.isArray(names) ? names : [];
      const missing = namesList.filter((name) => !groceries.some((grocery) => grocery.name.toLowerCase() === name));
      result[mealId] = { missing: missing.length, total: namesList.length };
    }
    return result;
  }, [mealIngredientsCache, groceries]);

  const weekDays = useMemo(() => Array.from({ length: horizon }, (_, i) => addDays(todayISO(), i)), [horizon]);

  const mealFor = (date, slot) => meals.find((m) => m.date === date && m.slot === slot);

  const openEditor = (date, slot) => {
    const existing = mealFor(date, slot);
    setDraft({ title: existing?.title ?? "", notes: existing?.notes ?? "", cookIds: existing?.cookIds ?? [] });
    setShowSavedRecipes(false);
    setEditing({ date, slot, mealId: existing?.id || null });
  };

  const toggleCook = (id) =>
    setDraft((d) => ({ ...d, cookIds: d.cookIds.includes(id) ? d.cookIds.filter((x) => x !== id) : [...d.cookIds, id] }));

  const rouletteForSlot = async (date, slot) => {
    const choices = ["Italian", "Mexican", "Indian", "Japanese", "Chinese", "Thai", "Mediterranean", "American Comfort"];
    const cuisine = choices[Math.floor(Math.random() * choices.length)];
    const ingredientsPool = ["chicken", "rice", "pasta", "tofu", "salmon", "beef", "eggs", "lentils"];
    const ingredients = ingredientsPool[Math.floor(Math.random() * ingredientsPool.length)];
    const profile = recipeSearchProfileForMeal("", slot, { ...dietaryPreferences, cuisine });
    const bodyPayload = { ...profile, cuisine, ingredients };
    const { data, error } = await supabase.functions.invoke("recipe-search", { body: bodyPayload }).catch(() => ({ data: null, error: new Error("offline") }));
    const recipeErr = data?.error || error?.message;
    const recipe = !recipeErr ? recipeFromSearch(data) : null;
    if (!recipe?.title) {
      await setMealForSlot(date, slot, {
        title: `${cuisine} ${slot} pick`,
        notes: recipeErr ? "Add a title above and tap Cook to look up steps." : "Add a title above and tap Cook.",
        cookIds: [],
      });
      return;
    }
    await setMealForSlot(date, slot, {
      title: recipe.title,
      notes: `${SLOT_META[slot].label} roulette · ${recipe.cuisine || cuisine}`,
      cookIds: [],
    });
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
    if (typeof ingredient === "string") return !groceries.some((grocery) => grocery.name.toLowerCase() === ingredient.trim().toLowerCase());
    if (ingredient && typeof ingredient === "object" && ingredient.name) return !groceries.some((grocery) => grocery.name.toLowerCase() === ingredient.name.toLowerCase());
    return false;
  });

  const addCookIngredients = async () => {
    for (const raw of cookRecipe?.ingredients || []) {
      const name = typeof raw === "string" ? raw.trim() : raw?.name;
      if (!name) continue;
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
      const profile = recipeSearchProfileForMeal(meal, meal.slot, dietaryPreferences);
      const { data, error } = await supabase.functions.invoke("recipe-search", { body: profile });
      const recipeErr = data?.error || error?.message;
      if (recipeErr) {
        setCookError(recipeErr);
        return;
      }
      const recipe = recipeFromSearch(data);
      if (!recipe) {
        setCookError("API Ninjas returned no recipe for this meal.");
        return;
      }
      setCookRecipe({ ...placeholderRecipe(meal.title, meal.slot), ...recipe });

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
        body: { ingredients: recipe.ingredients },
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

  const dietarySummary = useMemo(() => {
    const restrictions = dietaryPreferences.restrictions || [];
    const pieces = [
      ...restrictions,
      dietaryPreferences.avoidIngredients ? `avoiding ${dietaryPreferences.avoidIngredients}` : "",
      dietaryPreferences.notes,
    ].filter(Boolean);
    return pieces.length ? pieces.join(" · ") : "No restrictions set yet — everything is on the table.";
  }, [dietaryPreferences]);

  const toggleRestriction = (option) => {
    setDietaryPreferences((current) => {
      const restrictions = current.restrictions || [];
      const active = restrictions.includes(option);
      return {
        ...current,
        restrictions: active ? restrictions.filter((item) => item !== option) : [...restrictions, option],
      };
    });
  };

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
      <PageHeader eyebrow="Nourish & connect" title="Meal planner" illustration="meals" subtitle="Plan meals, save recipes, and start cook mode." action={meals.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null} />

      <div className="meal-range-toggle px-5" aria-label="Meal planning range"><button className={horizon===7?"selected":""} onClick={()=>setHorizon(7)}>1 week</button><button className={horizon===14?"selected":""} onClick={()=>setHorizon(14)}>2 weeks</button></div>

      <section className="meal-preferences-card" aria-label="Meal planning preferences">
        <div className="meal-preferences-copy">
          <p>Household tastes</p>
          <h3>Cook for the people at the table.</h3>
          <span>{dietarySummary}</span>
        </div>
        <div className="dietary-chip-row">
          {DIETARY_OPTIONS.map((option) => {
            const active = dietaryPreferences.restrictions?.includes(option);
            const meta = DIETARY_META[option] || { icon: Leaf, tone: "green" };
            const Icon = meta.icon;
            return (
              <button key={option} className={`dietary-chip dietary-chip--${meta.tone} ${active ? "active" : ""}`} onClick={() => toggleRestriction(option)}>
                <span className="dietary-chip-icon" aria-hidden="true">{active ? <Check size={14} /> : <Icon size={14} />}</span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
        <div className="meal-preferences-fields">
          <input value={dietaryPreferences.avoidIngredients} onChange={(event) => setDietaryPreferences((current) => ({ ...current, avoidIngredients: event.target.value }))} placeholder="Avoid ingredients, e.g. peanuts, cilantro" />
          <input value={dietaryPreferences.notes} onChange={(event) => setDietaryPreferences((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes, e.g. quick school-night dinners" />
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
                    <span>{savedRecipe.title}</span>
                    <small>{savedRecipe.readyInMinutes || 35} min · {savedRecipe.cuisine || "Family favourite"}</small>
                    <strong><ChefHat size={14} /> Cook this recipe</strong>
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
                          {meal?.title && <span className="meal-cook-hint"><ChefHat size={12} /> Cook</span>}
                          {(() => {
                            const badge = meal?.id && mealMissingCount[meal.id];
                            if (!badge) return null;
                            const allCovered = badge.missing === 0;
                            const justAdded = badgeAddedRef.current.has(meal.id);
                            const interactive = !allCovered && !justAdded;
                            const handleBadgeClick = (e) => {
                              e.stopPropagation();
                              if (!meal.id || badgeAddedRef.current.has(meal.id)) return;
                              const names = mealIngredientsCache[meal.id];
                              if (!Array.isArray(names)) return;
                              const missingNames = names.filter(
                                (name) => !groceries.some((grocery) => grocery.name.toLowerCase() === name)
                              );
                              if (!missingNames.length) return;
                              for (const name of missingNames) {
                                addGrocery({ name, quantity: 1, unit: "" });
                              }
                              badgeAddedRef.current.add(meal.id);
                              forceUpdate((n) => n + 1);
                              if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current);
                              badgeTimerRef.current = window.setTimeout(() => {
                                badgeAddedRef.current.delete(meal.id);
                                forceUpdate((n) => n + 1);
                                badgeTimerRef.current = null;
                              }, 2000);
                            };
                            return (
                              <span
                                className={`meal-grocery-badge ${justAdded ? "added" : allCovered ? "covered" : "needs"}`}
                                onClick={interactive ? handleBadgeClick : undefined}
                                role={interactive ? "button" : undefined}
                                tabIndex={interactive ? 0 : undefined}
                                onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleBadgeClick(e); } } : undefined}
                                aria-label={justAdded ? "Ingredients added" : allCovered ? "All groceries covered" : `Add ${badge.missing} missing ingredients to list`}
                                title={justAdded ? "Added!" : allCovered ? "All items already on grocery list" : `Tap to add ${badge.missing} missing ingredients`}
                              >
                                <ShoppingCart size={10} />
                                {justAdded ? "✓ Added" : allCovered ? "✓" : badge.missing}
                              </span>
                            );
                          })()}
                        </div>
                        {cooks.length > 0 && <AvatarStack members={cooks} size="sm" />}
                      </button>
                      <div className="meal-slot-actions">
                        {meal?.title && (
                          <button className="meal-start-cooking" onClick={() => openCookRecipe(meal)} aria-label={`Start cooking ${meal.title}`}>
                            <ChefHat size={15} /><span>Cook</span>
                          </button>
                        )}
                        <button className="meal-slot-tool" onClick={() => rouletteForSlot(date, slot)} aria-label={`Choose a random ${SLOT_META[slot].label.toLowerCase()}`} title="Meal roulette">
                          <Dices size={15} /><span>Surprise me</span>
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
          label="What's the plan?"
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
          <button onClick={() => editing && rouletteForSlot(editing.date, editing.slot).then(() => setEditing(null))}><Dices size={16} /> Roulette</button>
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
      <Modal open={clearing} onClose={()=>setClearing(false)} title="Clear the meal plan?"><p className="reset-confirm-copy">This clears planned meals. Your ideas and family members stay put.</p><div className="reset-confirm-actions"><button onClick={()=>setClearing(false)}>Cancel</button><PrimaryButton onClick={async()=>{await clearMeals();setClearing(false)}}>Clear meals</PrimaryButton></div></Modal>
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
      {cookMeal && cookRecipe && (
        <div className="cook-focus-screen" role="dialog" aria-modal="true" aria-label={`Recipe for ${cookRecipe.title}`}>
          <div className="cook-focus-shell">
            <div className="cook-focus-topbar">
              <button onClick={() => setCookMeal(null)}><ArrowLeft size={18} /> Back to meals</button>
              <div className="cook-focus-topbar-actions">
                <button className={`recipe-save-button ${cookRecipeSaved ? "saved" : ""}`} onClick={() => saveRecipeToLibrary(cookRecipe)} disabled={!cookRecipe.instructions.length} title={cookRecipe.instructions.length ? "Save recipe to your library" : "API Ninjas has not loaded the recipe yet"}><Bookmark size={16} /> {cookRecipeSaved ? "Saved" : "Save recipe"}</button>
                <button onClick={() => { setCookMeal(null); openEditor(cookMeal.date, cookMeal.slot); }}>Edit meal</button>
              </div>
            </div>

            <section className={`cook-focus-hero ${cookRecipe.image ? "" : "no-photo"}`}>
              <div className="cook-focus-copy">
                <p className="eyebrow">{cookMode ? "COOK MODE" : "READY TO COOK"}</p>
                <h2>{cookRecipe.title}</h2>
                <p>{cookMeal.notes || "Ingredients come from API Ninjas. FamOS will walk you through the recipe step by step."}</p>
                <div className="cook-meta-row">
                  <span><Clock size={15} /> {cookRecipe.readyInMinutes || 35} min</span>
                  <span><Users size={15} /> Serves {cookRecipe.servings || 4}</span>
                  <span><ChefHat size={15} /> {cookRecipe.cuisine || "Family favourite"}</span>
                </div>
              </div>
            </section>

            {cookLoading && <div className="cook-status"><Sparkles size={16} /> Asking API Ninjas for the recipe…</div>}
            {cookError && <div className="cook-status subtle"><Sparkles size={16} /> {cookError.includes("429") ? "API Ninjas rate limit reached. Try again in a few minutes." : cookError.includes("not configured") ? "Recipe search is not configured yet. Set RECIPE_API_NINJAS_KEY in Supabase Edge Function Secrets." : cookError.includes("no recipe") || cookError.includes("Rate") ? "API Ninjas has no match for this meal yet. Try a different title in Cook Mode, or skip Cook Mode and just use the planner." : `API Ninjas couldn't load this recipe (${cookError}).`}</div>}

            {!cookMode ? (
              <div className="cook-focus-layout">
                <Card className="cook-panel">
                  <div className="cook-panel-head"><ListChecks size={18} /><h3>Ingredients</h3></div>
                  <p className="cook-panel-note">{cookRecipe.ingredients.length ? "Tap below to push missing ingredients to your weekly grocery list." : "API Ninjas has not returned ingredients for this meal yet."}</p>
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
                    <p className="cook-panel-note">Nutrition facts load from API Ninjas when ingredients are available.</p>
                  )}
                </Card>
                <Card className="cook-panel">
                  <div className="cook-panel-head"><ChefHat size={18} /><h3>Steps ahead</h3></div>
                  <p className="cook-panel-note">{cookRecipe.instructions.length ? "Step-by-step cooking instructions from API Ninjas. Use Cook Mode for hands-friendly navigation." : "Step-by-step cooking instructions load from API Ninjas when the recipe is found."}</p>
                  {cookRecipe.instructions.length ? (
                    <ol className="cook-plain-list ordered">
                      {cookRecipe.instructions.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                    </ol>
                  ) : (
                    <p className="cook-empty-line">No steps loaded from API Ninjas yet.</p>
                  )}
                </Card>
                <button className="cook-primary-action" disabled={!cookRecipe.instructions.length} onClick={() => { setCookMode(true); setCookStep(0); }}>
                  <ChefHat size={21} />
                  <span><strong>{cookRecipe.instructions.length ? "Start Cook Mode" : "Awaiting instructions"}</strong><small>{cookRecipe.instructions.length ? "Hands-friendly, one step at a time" : "API Ninjas is still loading this recipe"}</small></span>
                </button>
              </div>
            ) : (
              <div className="cook-guide-layout">
                <div className="cook-progress-card">
                  <div>
                    <span>Step {currentCookStep + 1} of {cookSteps.length}</span>
                    <strong>{Math.round(cookProgress)}%</strong>
                  </div>
                  <div className="cook-progress-track"><i style={{ width: `${cookProgress}%` }} /></div>
                </div>

                <Card className="cook-step-card">
                  <div className="cook-step-kicker">
                    <ChefHat size={18} />
                    <span>Cook along</span>
                  </div>
                  <h3>{cookSteps[currentCookStep]}</h3>
                  <p>When this step is done, tap next. FamOS will keep the recipe moving without turning this into another checklist.</p>
                  <div className="cook-guide-actions">
                    <button disabled={currentCookStep === 0} onClick={() => setCookStep((step) => Math.max(step - 1, 0))}>Previous</button>
                    {currentCookStep < cookSteps.length - 1 ? (
                      <button className="primary" onClick={() => setCookStep((step) => Math.min(step + 1, cookSteps.length - 1))}>Next step</button>
                    ) : (
                      <button className="primary" onClick={() => setCookMeal(null)}><Check size={17} /> Finish cooking</button>
                    )}
                  </div>
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
      )}
    </div></PullToRefresh>
  );
}
