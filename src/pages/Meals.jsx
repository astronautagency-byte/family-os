import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, CandyOff, Check, ChefHat, Clock, Coffee, Dices, FishOff, Leaf, ListChecks, MilkOff, NutOff, Plus, Soup, Sparkles, Sprout, Trash2, Users, WheatOff, X } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { AvatarStack, Card, Modal, PrimaryButton, SecondaryButton, TextField, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import MealSuggestions from "../components/MealSuggestions";
import { MEAL_SLOTS } from "../data/mockData";
import { groceryItemsForMealTitle, recipeDetailForTitle, recipeSearchProfileForMeal } from "../data/recipeBox";
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
  image: recipe.image || "",
  sourceUrl: recipe.sourceUrl || "",
  savedAt: recipe.savedAt || new Date().toISOString(),
});


export default function Meals() {
  const { members, memberById, meals, groceries, addGrocery, setMealForSlot, removeMeal, clearMeals } = useFamily();
  const [horizon, setHorizon] = useState(7);
  const [clearing, setClearing] = useState(false);
  const [editing, setEditing] = useState(null); // { date, slot }
  const [draft, setDraft] = useState({ title: "", notes: "", cookIds: [] });
  const [showIdeas, setShowIdeas] = useState(false);
  const [showEditorIdeas, setShowEditorIdeas] = useState(false);
  const [ingredientsAdded, setIngredientsAdded] = useState(false);
  const [cookMeal, setCookMeal] = useState(null);
  const [cookRecipe, setCookRecipe] = useState(null);
  const [cookLoading, setCookLoading] = useState(false);
  const [cookError, setCookError] = useState("");
  const [cookMode, setCookMode] = useState(false);
  const [cookStep, setCookStep] = useState(0);
  const [savedRecipes, setSavedRecipes] = useState(() => readStoredJson(SAVED_RECIPES_KEY, []));
  const [dietaryPreferences, setDietaryPreferences] = useState(() => ({
    ...DEFAULT_DIETARY_PREFERENCES,
    ...readStoredJson(DIETARY_PREFERENCES_KEY, DEFAULT_DIETARY_PREFERENCES),
  }));

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(savedRecipes));
  }, [savedRecipes]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(DIETARY_PREFERENCES_KEY, JSON.stringify(dietaryPreferences));
  }, [dietaryPreferences]);

  const weekDays = useMemo(() => Array.from({ length: horizon }, (_, i) => addDays(todayISO(), i)), [horizon]);

  const mealFor = (date, slot) => meals.find((m) => m.date === date && m.slot === slot);

  const openEditor = (date, slot) => {
    const existing = mealFor(date, slot);
    setDraft({ title: existing?.title ?? "", notes: existing?.notes ?? "", cookIds: existing?.cookIds ?? [] });
    setShowEditorIdeas(false);
    setIngredientsAdded(false);
    setEditing({ date, slot, mealId: existing?.id || null });
  };

  const toggleCook = (id) =>
    setDraft((d) => ({ ...d, cookIds: d.cookIds.includes(id) ? d.cookIds.filter((x) => x !== id) : [...d.cookIds, id] }));

  const save = () => {
    setMealForSlot(editing.date, editing.slot, draft);
    setEditing(null);
  };

  const recipe = recipeDetailForTitle(draft.title);
  const missingIngredients = groceryItemsForMealTitle(draft.title).filter((item) => !groceries.some((grocery) => !grocery.checked && grocery.name.toLowerCase() === item.name.toLowerCase()));
  const addIngredients = async () => {
    for (const item of missingIngredients) await addGrocery(item);
    setIngredientsAdded(true);
  };

  const normalizeRecipePayload = (payload, fallbackTitle) => {
    const fallback = recipeDetailForTitle(fallbackTitle) || {
      title: fallbackTitle,
      cuisine: "Family favourite",
      readyInMinutes: 35,
      servings: 4,
      ingredients: groceryItemsForMealTitle(fallbackTitle).map((item) => item.name),
      instructions: [
        "Gather the ingredients and prep your cooking area.",
        "Cook the main ingredients until warmed through and seasoned.",
        "Taste, adjust seasoning, and serve family-style.",
      ],
    };

    const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
    const unwrapDataObject = (value) => {
      let current = value;
      const seen = new Set();
      while (current && typeof current === "object" && !Array.isArray(current) && current.data && !seen.has(current)) {
        seen.add(current);
        current = current.data;
      }
      return current;
    };
    const listCandidates = (value) => {
      const source = unwrapDataObject(value);
      if (Array.isArray(source)) return source;
      if (!source || typeof source !== "object") return [];
      return [
        source.recipe,
        source.result,
        source.item,
        ...(Array.isArray(source.recipes) ? source.recipes : []),
        ...(Array.isArray(source.results) ? source.results : []),
        ...(Array.isArray(source.items) ? source.items : []),
        ...(Array.isArray(source.meals) ? source.meals : []),
      ].filter(Boolean);
    };
    const recipePayload =
      unwrapDataObject(payload?.recipe) ||
      unwrapDataObject(payload?.data?.recipe) ||
      unwrapDataObject(payload?.result) ||
      listCandidates(payload)[0] ||
      listCandidates(payload?.search)[0] ||
      unwrapDataObject(payload) ||
      {};
    const recipe = Array.isArray(recipePayload) ? recipePayload[0] || {} : recipePayload;

    const textFromIngredient = (item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const nested = item.ingredient || item.food || item.product;
      const amount = [item.amount, item.quantity, item.qty].filter(Boolean).join(" ");
      const unit = item.unit || item.measure || item.measurement || "";
      const name =
        item.name ||
        item.originalName ||
        item.displayName ||
        item.display_name ||
        item.title ||
        item.value ||
        item.label ||
        (typeof nested === "string" ? nested : nested?.name || nested?.title || "");
      return item.original || item.originalString || item.original_string || item.text || item.display || item.display_text || item.description || [amount, unit, name].filter(Boolean).join(" ").trim();
    };

    const rawIngredientGroups = [
      ...(Array.isArray(recipe.ingredientGroups) ? recipe.ingredientGroups : []),
      ...(Array.isArray(recipe.ingredient_groups) ? recipe.ingredient_groups : []),
      ...(Array.isArray(recipe.sections) ? recipe.sections.filter((section) => section?.ingredients) : []),
    ];
    const groupedIngredients = rawIngredientGroups.flatMap((group) => group.ingredients || group.items || []);
    const rawIngredients =
      recipe.ingredients ||
      recipe.extendedIngredients ||
      recipe.extended_ingredients ||
      recipe.ingredientLines ||
      recipe.ingredient_lines ||
      recipe.usedIngredients ||
      recipe.used_ingredients ||
      recipe.missedIngredients ||
      recipe.missed_ingredients ||
      groupedIngredients ||
      fallback.ingredients;
    const ingredients = Array.isArray(rawIngredients)
      ? rawIngredients.flatMap((item) => (item?.ingredients || item?.items ? asArray(item.ingredients || item.items).map(textFromIngredient) : textFromIngredient(item))).filter(Boolean)
      : String(rawIngredients || "")
        .split(/\n|•|;/)
        .map((item) => item.trim())
        .filter(Boolean);

    const textFromStep = (step) => {
      if (typeof step === "string") return step;
      if (!step || typeof step !== "object") return "";
      return step.step || step.name || step.text || step.description || step.instruction || step.instructions || step.direction || "";
    };
    const analyzedSteps = recipe.analyzedInstructions?.flatMap((section) => section.steps || []).map(textFromStep);
    const groupedSteps = [
      ...(Array.isArray(recipe.instructionGroups) ? recipe.instructionGroups : []),
      ...(Array.isArray(recipe.instruction_groups) ? recipe.instruction_groups : []),
      ...(Array.isArray(recipe.sections) ? recipe.sections.filter((section) => section?.steps || section?.instructions || section?.directions) : []),
    ].flatMap((group) => group.steps || group.instructions || group.directions || []);
    const rawSteps = analyzedSteps?.length
      ? analyzedSteps
      : groupedSteps.length
        ? groupedSteps
        : recipe.instructions || recipe.instruction || recipe.steps || recipe.method || recipe.directions || recipe.direction || recipe.preparation_steps || recipe.preparationSteps || fallback.instructions;
    const instructions = Array.isArray(rawSteps)
      ? rawSteps.flatMap((step) => (step?.steps || step?.instructions || step?.directions ? asArray(step.steps || step.instructions || step.directions).map(textFromStep) : textFromStep(step))).filter(Boolean)
      : String(rawSteps || "")
        .replace(/<[^>]*>/g, "")
        .split(/\n|(?:\d+\.\s)|(?:Step\s+\d+:?\s)/i)
        .map((step) => step.trim())
        .filter(Boolean);

    const imageSource = recipe.image || recipe.imageUrl || recipe.image_url || recipe.photo || recipe.photoUrl || recipe.photo_url || recipe.thumbnail || recipe.thumbnailUrl || recipe.thumbnail_url || recipe.picture || recipe.cover || recipe.media?.image || recipe.media?.image_url || recipe.images?.[0] || "";
    const image = typeof imageSource === "string" ? imageSource : imageSource?.url || imageSource?.src || "";
    const prepTime = Number(recipe.prepTime || recipe.prep_time || 0);
    const cookTime = Number(recipe.cookTime || recipe.cook_time || 0);
    const sourceUrl = recipe.sourceUrl || recipe.source_url || recipe.url || recipe.originalUrl || recipe.original_url || recipe.website || recipe.canonical_url || "";
    const title = recipe.title || recipe.name || recipe.recipeName || recipe.recipe_name || recipe.label || fallback.title;
    const apiReturnedSomething = Object.keys(recipe || {}).length > 0;
    const instructionText = instructions.join(" ").toLowerCase();
    const looksGeneric = /prep (the )?ingredients/.test(instructionText) && /season to taste|serve family-style/.test(instructionText);
    const hasUsefulIngredients = ingredients.length >= Math.min(3, fallback.ingredients?.length || 3);
    const hasUsefulInstructions = !looksGeneric && (instructions.length >= 4 || instructionText.length > 180 || Boolean(sourceUrl));
    const finalIngredients = hasUsefulIngredients ? ingredients : fallback.ingredients;
    const finalInstructions = hasUsefulInstructions ? instructions : fallback.instructions;
    const apiEnhanced = apiReturnedSomething && (hasUsefulInstructions || Boolean(image) || Boolean(sourceUrl));

    return {
      ...fallback,
      id: recipe.id || recipe.recipeId || fallback.id || fallbackTitle,
      title,
      cuisine: recipe.cuisine || recipe.cuisines?.[0] || recipe.dish_type || recipe.dishType || fallback.cuisine || "Family favourite",
      readyInMinutes: Number(recipe.readyInMinutes || recipe.ready_in_minutes || recipe.totalTime || recipe.total_time || recipe.totalTimeMinutes || recipe.total_time_minutes || recipe.time || recipe.duration || prepTime + cookTime || fallback.readyInMinutes || 35),
      servings: recipe.servings || recipe.yield || recipe.serves || fallback.servings || 4,
      sourceUrl,
      image,
      ingredients: finalIngredients,
      instructions: finalInstructions,
      apiEnhanced,
    };
  };

  const openCookRecipe = async (meal) => {
    if (!meal?.title) return;
    const fallback = normalizeRecipePayload(null, meal.title);
    setCookMeal(meal);
    setCookRecipe(fallback);
    setCookMode(false);
    setCookStep(0);
    setCookError("");
    setCookLoading(Boolean(supabase));

    if (!supabase) {
      setCookError("fallback");
      return;
    }

    try {
      const recipeSearchProfile = recipeSearchProfileForMeal(meal, meal.slot, dietaryPreferences);
      const { data, error } = await supabase.functions.invoke("recipe-search", {
        body: recipeSearchProfile,
      });

      if (error || data?.error) {
        console.warn("Recipe enrichment failed", data?.error || error?.message);
        setCookError("fallback");
        setCookLoading(false);
        return;
      }

      const enhancedRecipe = normalizeRecipePayload(data, meal.title);
      setCookRecipe(enhancedRecipe);
      if (!enhancedRecipe.apiEnhanced) console.warn("Recipe enrichment returned a sparse payload", data);
    } catch (error) {
      console.warn("Recipe enrichment failed", error);
      setCookError("fallback");
    }
    setCookLoading(false);
  };

  const cookSteps = cookRecipe?.instructions?.length
    ? cookRecipe.instructions
    : ["Prep your station, then cook this meal until warmed through and ready to serve."];
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
  };

  return (
    <div className="pb-24 reference-meals">
      <PageHeader eyebrow="Nourish & connect" title="What’s for dinner? Less mystery." illustration="meals" subtitle="Plan the week, peek into the next, and keep hungry people moving." action={meals.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null} />

      <div className="meal-range-toggle px-5" aria-label="Meal planning range"><button className={horizon===7?"selected":""} onClick={()=>setHorizon(7)}>1 week</button><button className={horizon===14?"selected":""} onClick={()=>setHorizon(14)}>2 weeks</button></div>

      <div className="meal-ideas-launcher px-5">
        <button onClick={() => setShowIdeas((value) => !value)}><Dices /> Spin dinner roulette</button>
        <button onClick={() => setShowIdeas(true)}><Sparkles /> Help me choose</button>
      </div>
      {showIdeas && <div className="px-5"><MealSuggestions mealType="dinner" dietaryPreferences={dietaryPreferences} onPick={async (title, notes) => { await setMealForSlot(todayISO(), "dinner", { title, notes, cookIds: [] }); setShowIdeas(false); }} /></div>}

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
            <Card key={date} className="p-4">
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
                  const isDinner = slot === "dinner";
                  return (
                    <button
                      key={slot}
                      onClick={() => meal?.title ? openCookRecipe(meal) : openEditor(date, slot)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                      style={{ backgroundColor: isDinner ? "var(--color-surface-sunken)" : "transparent" }}
                    >
                      <Icon size={16} color="var(--color-ink-faint)" className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
                          {SLOT_META[slot].label}
                        </p>
                        <p className={`text-[14px] truncate ${meal?.title ? "text-[var(--color-ink)] font-medium" : "text-[var(--color-ink-faint)]"}`}>
                          {meal?.title || "Pick something"}
                        </p>
                        {meal?.title && <span className="meal-cook-hint">Tap to cook step by step</span>}
                      </div>
                      {cooks.length > 0 && <AvatarStack members={cooks} size="sm" />}
                      {!meal?.title && <Plus size={15} color="var(--color-ink-faint)" />}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `${SLOT_META[editing.slot].label} · ${formatDayLabel(editing.date)}` : ""}>
        <TextField
          label="What’s the plan?"
          placeholder="e.g. Sheet-pan chicken fajitas"
          value={draft.title}
          onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); setIngredientsAdded(false); }}
          autoFocus
        />
        <TextField
          label="Notes (optional)"
          placeholder="Prep notes, sides, reminders..."
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />

        <button className="modal-ideas-toggle" onClick={() => setShowEditorIdeas((value) => !value)}>
          <Sparkles size={17} /> {showEditorIdeas ? "Hide meal ideas" : "Stuck? Let’s find something"}
        </button>
        {showEditorIdeas && <MealSuggestions
          mealType={editing?.slot}
          dietaryPreferences={dietaryPreferences}
          onPick={(title, notes) => { setDraft((d) => ({ ...d, title, notes: d.notes || notes })); setIngredientsAdded(false); setShowEditorIdeas(false); }}
        />}

        {recipe && (
          <div className="recipe-detail-card">
            <div className="recipe-detail-head">
              <div>
                <p>Recipe</p>
                <h4>{recipe.title}</h4>
                <span>{recipe.cuisine} · {recipe.readyInMinutes} min · Serves {recipe.servings}</span>
              </div>
              <ChefHat size={22} />
            </div>
            <div className="recipe-detail-grid">
              <div>
                <strong>Ingredients</strong>
                <ul>{recipe.ingredients.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <strong>Steps</strong>
                <ol>{recipe.instructions.map((step) => <li key={step}>{step}</li>)}</ol>
              </div>
            </div>
            <button className="recipe-grocery-button" disabled={missingIngredients.length === 0 || ingredientsAdded} onClick={addIngredients}>
              {ingredientsAdded ? "Ingredients added" : missingIngredients.length ? `Add ${missingIngredients.length} ingredients to groceries` : "Ingredients already on list"}
            </button>
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
      {cookMeal && cookRecipe && (
        <div className="cook-focus-screen" role="dialog" aria-modal="true" aria-label={`Recipe for ${cookRecipe.title}`}>
          <div className="cook-focus-shell">
            <div className="cook-focus-topbar">
              <button onClick={() => setCookMeal(null)}><ArrowLeft size={18} /> Back to meals</button>
              <div className="cook-focus-topbar-actions">
                <button className={`recipe-save-button ${cookRecipeSaved ? "saved" : ""}`} onClick={() => saveRecipeToLibrary(cookRecipe)}><Bookmark size={16} /> {cookRecipeSaved ? "Saved" : "Save recipe"}</button>
                <button onClick={() => { setCookMeal(null); openEditor(cookMeal.date, cookMeal.slot); }}>Edit meal</button>
              </div>
            </div>

            <section className={`cook-focus-hero ${cookRecipe.image ? "" : "no-photo"}`}>
              <div className="cook-focus-copy">
                <p className="eyebrow">{cookMode ? "COOK MODE" : "READY TO COOK"}</p>
                <h2>{cookRecipe.title}</h2>
                <p>{cookMeal.notes || "Ingredients are assumed to be ready. FamOS will walk you through the recipe one step at a time."}</p>
                <div className="cook-meta-row">
                  <span><Clock size={15} /> {cookRecipe.readyInMinutes || 35} min</span>
                  <span><Users size={15} /> Serves {cookRecipe.servings || 4}</span>
                  <span><ChefHat size={15} /> {cookRecipe.cuisine || "Family favourite"}</span>
                </div>
              </div>
              {cookRecipe.image && (
                <div className="cook-photo-card">
                  <img src={cookRecipe.image} alt={cookRecipe.title} />
                </div>
              )}
            </section>

            {cookLoading && <div className="cook-status"><Sparkles size={16} /> Finding the best recipe details…</div>}
            {cookError && <div className="cook-status subtle"><Sparkles size={16} /> Using the saved FamOS recipe for now. You can still cook step by step.</div>}

            {!cookMode ? (
              <div className="cook-focus-layout">
                <Card className="cook-panel">
                  <div className="cook-panel-head"><ListChecks size={18} /><h3>Ingredients ready</h3></div>
                  <p className="cook-panel-note">A quick reference only — this flow assumes these are already in your kitchen.</p>
                  <ul className="cook-plain-list">
                    {cookRecipe.ingredients.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                  </ul>
                </Card>
                <Card className="cook-panel">
                  <div className="cook-panel-head"><ChefHat size={18} /><h3>What happens next</h3></div>
                  <p className="cook-panel-note">Start cook mode for a larger, hands-friendly step-by-step guide.</p>
                  <ol className="cook-plain-list ordered">
                    {cookRecipe.instructions.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                  </ol>
                  {cookRecipe.sourceUrl && <a className="cook-source-link" href={cookRecipe.sourceUrl} target="_blank" rel="noreferrer">Open original recipe</a>}
                </Card>
                <button className="cook-primary-action" onClick={() => { setCookMode(true); setCookStep(0); }}>Start cooking</button>
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
                    {cookRecipe.ingredients.slice(0, 10).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
