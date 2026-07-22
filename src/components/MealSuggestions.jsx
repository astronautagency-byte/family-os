import { useEffect, useRef, useState } from "react";
import { Check, ChefHat, ChevronDown, LoaderCircle, ShoppingBasket, Sparkles, WandSparkles } from "lucide-react";
import { normaliseDietaryPreferences } from "../data/recipeBox";
import { useFamily } from "../context/FamilyContext";
import { invokeEdgeFunction, supabase } from "../lib/supabase";
import { cookableRecipes } from "../lib/cookableTonight";

const MEAL_TYPES = ["breakfast", "lunch", "dinner"];
const ROULETTE_QUERIES = [
  { cuisine: "Italian", ingredients: "pasta, garlic, olive oil" },
  { cuisine: "Mexican", ingredients: "chicken, beans, lime" },
  { cuisine: "Indian", ingredients: "chickpeas, ginger, tomato" },
  { cuisine: "Japanese", ingredients: "salmon, rice, soy sauce" },
  { cuisine: "Chinese", ingredients: "beef, broccoli, garlic" },
  { cuisine: "Thai", ingredients: "coconut milk, lemongrass, lime" },
  { cuisine: "Mediterranean", ingredients: "feta, cucumber, olive oil" },
  { cuisine: "American Comfort", ingredients: "ground beef, cheese, onion" },
];

// Pull a recipe list out of the recipe-search response — strict API Ninjas
// shape `{recipes: [...]}` is the canonical one.
const recipesFromSearch = (data) => {
  if (!data) return [];
  const root = data?.data && typeof data.data === "object" ? data.data : data;
  return Array.isArray(root?.recipes) ? root.recipes : [];
};

const errorFromSearch = (data, error) =>
  String(data?.error || error?.message || "").trim();

const buildSearchBody = ({ query = "", mealType, ingredients = "", cuisine = "", dietary }) => {
  const diet = normaliseDietaryPreferences(dietary);
  return {
    query: String(query || "").trim(),
    ingredients: String(ingredients || "").trim(),
    cuisine: String(cuisine || "").trim(),
    dietary: diet.restrictions.join(" "),
    mealType,
    dietaryRestrictions: diet.restrictions,
    avoidIngredients: diet.avoidIngredients,
    dietaryNotes: diet.notes,
  };
};

export default function MealSuggestions({ onPick, mealType: fixedMealType, dietaryPreferences }) {
  const [ingredientInput, setIngredientInput] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedMealType, setSelectedMealType] = useState("dinner");
  const [aiMeals, setAiMeals] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const mealType = fixedMealType || selectedMealType;
  const diet = normaliseDietaryPreferences(dietaryPreferences);
  const dietSummary = [
    ...diet.restrictions,
    diet.avoidIngredients ? `avoids ${diet.avoidIngredients}` : "",
  ].filter(Boolean).join(" · ");
  const hasDietPrefs = Boolean(dietSummary);
  const lastQueryRef = useRef("");

  // Soft tier: split results into "needs ingredients" (active list) and
  // "you can make this tonight" (collapsed accordion below). Mirrors the
  // muted-events pattern from Calendar.jsx — hard-filter preserves the
  // active list's quietness while letting the user peek at cookable meals
  // without committing up front.
  const { groceries } = useFamily();
  const cookableList = cookableRecipes(recipes, groceries);
  const cookableIds = new Set(cookableList.map((recipe) => recipe.title));
  const activeRecipes = recipes.filter((recipe) => !cookableIds.has(recipe.title));

  // Run a recipe-search whenever the ingredient input has stable text. Debounce
  // so each keystroke isn't an API call; cancel the previous request so an
  // outdated response never overwrites a newer one.
  useEffect(() => {
    const query = ingredientInput.trim();
    if (!query) {
      setRecipes([]);
      setError("");
      setBusy(false);
      return undefined;
    }
    let cancelled = false;
    setBusy(true);
    setError("");
    const handle = setTimeout(async () => {
      try {
        const data = await invokeEdgeFunction("recipe-search", buildSearchBody({
          query,
          ingredients: query,
          mealType,
          dietary: dietaryPreferences,
        }));
        if (cancelled) return;
        const dataError = errorFromSearch(data);
        if (dataError) {
          setError(dataError);
          setRecipes([]);
        } else {
          const list = recipesFromSearch(data);
          setRecipes(list);
          if (!list.length) setError("API Ninjas returned no matches. Try a broader search.");
        }
        lastQueryRef.current = query;
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Recipe lookup failed.");
        setRecipes([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [ingredientInput, mealType, dietaryPreferences]);

  const roulette = async () => {
    setBusy(true);
    setError("");
    setIngredientInput("");
    const choice = ROULETTE_QUERIES[Math.floor(Math.random() * ROULETTE_QUERIES.length)];
    try {
      const data = await invokeEdgeFunction("recipe-search", buildSearchBody({
        query: choice.cuisine,
        ingredients: choice.ingredients,
        cuisine: choice.cuisine,
        mealType,
        dietary: dietaryPreferences,
      }));
      const dataError = errorFromSearch(data);
      if (dataError) {
        setError(dataError);
        setRecipes([]);
        return;
      }
      const list = recipesFromSearch(data);
      const pick = list[Math.floor(Math.random() * Math.max(list.length, 1))];
      if (pick?.title) {
        onPick(pick.title, `Meal roulette · ${pick.cuisine || choice.cuisine}`);
        return;
      }
      setError("API Ninjas returned no recipes for that cuisine. Try typing an ingredient instead.");
    } catch (err) {
      setError(err?.message || "Roulette fetch failed.");
      setRecipes([]);
    } finally {
      setBusy(false);
    }
  };

  const askAI = async () => {
    if (!ingredientInput.trim()) return;
    setAiBusy(true);
    setAiError("");
    try {
      if (!supabase?.functions) throw new Error("Fam AI is not configured in this build.");
      const { data, error: invokeError } = await supabase.functions.invoke("meal-suggestions", {
        body: {
          ingredients: ingredientInput,
          mealType,
          dietaryPreferences: diet,
          dietaryRestrictions: diet.restrictions,
          avoidIngredients: diet.avoidIngredients,
          dietaryNotes: diet.notes,
        },
      });
      if (invokeError) {
        const detail = data?.error || invokeError.message;
        throw new Error(detail || invokeError.message);
      }
      setAiMeals(data?.meals || []);
      if (!(data?.meals || []).length) setAiError("Fam AI had no suggestions. Try a different ingredient set.");
    } catch (err) {
      setAiError(err?.message || "Fam AI could not respond.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] p-3.5 mb-5 notion-shadow meal-suggestions-card">
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles size={14} color="var(--color-accent)" />
        <p className="text-[12.5px] font-semibold text-[var(--color-ink)]">Dinner brain stuck?</p>
        <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">via API Ninjas</span>
      </div>

      {fixedMealType ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)] mb-3">Ideas for {mealType}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {MEAL_TYPES.map((type) => <button key={type} onClick={() => setSelectedMealType(type)} className="rounded-lg py-1.5 text-[11.5px] font-semibold capitalize border" style={{ borderColor: mealType === type ? "var(--color-accent)" : "var(--color-border)", background: mealType === type ? "var(--color-accent-soft)" : "white", color: mealType === type ? "var(--color-accent-strong)" : "var(--color-ink-soft)" }}>{type}</button>)}
        </div>
      )}

      {hasDietPrefs && <p className="meal-suggestion-diet-note">Tuned for {dietSummary}.</p>}

      <button onClick={roulette} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-[12.5px] font-semibold text-[var(--color-accent)] mb-3 disabled:opacity-50">
        {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ChefHat size={15} />}
        Spin dinner roulette
      </button>

      <input
        value={ingredientInput}
        onChange={(e) => setIngredientInput(e.target.value)}
        placeholder="What's hanging around? e.g. chicken, rice, broccoli"
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] mb-3"
      />

      {error && <p className="text-[11.5px] text-[var(--color-warn)] mb-2">{error.includes("not configured") ? "Recipe search is not configured yet. Set RECIPE_API_NINJAS_KEY in Supabase Edge Function Secrets." : error.includes("429") ? "API Ninjas rate limit reached. Try again in a few minutes." : error}</p>}
      {busy && recipes.length === 0 && (
        <p className="text-[12px] text-[var(--color-ink-faint)] px-1 mb-2 inline-flex items-center gap-2"><LoaderCircle size={12} className="animate-spin" /> Searching API Ninjas…</p>
      )}
      {!error && recipes.length === 0 && !busy && ingredientInput.trim() === "" && (
        <p className="text-[12px] text-[var(--color-ink-faint)] px-1">Type a few ingredients and we'll find a way through dinner.</p>
      )}
      {activeRecipes.length > 0 && (
        <ul className="space-y-1">
          {activeRecipes.map((recipe) => (
            <li key={`${recipe.title}-${recipe.cuisine}`}>
              <button
                onClick={() => onPick(recipe.title, [recipe.cuisine, recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : ""].filter(Boolean).join(" · "))}
                className="w-full flex items-center justify-between gap-2 rounded-xl bg-[var(--color-surface)] px-3 py-2 text-left border border-[var(--color-border)] active:scale-[0.99] transition-transform"
              >
                <span className="text-[13.5px] font-medium text-[var(--color-ink)] truncate">{recipe.title}</span>
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)] shrink-0">
                  {recipe.cuisine || "API Ninjas"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Soft tier — meals the user has full pantry coverage for. Collapsed
          by default so the active list stays the primary surface; chevron +
          dashed-border treatment matches the muted-events soft tier. Adds
          nothing when no cookable meals exist (empty-state guard). */}
      {cookableList.length > 0 && (
        <details className="meal-soft-tier">
          <summary>
            <ChevronDown aria-hidden="true" size={14} />
            <div>
              <strong>
                <ShoppingBasket aria-hidden="true" size={13} /> {cookableList.length} you can cook tonight
              </strong>
              <small>tap to peek — every ingredient is already in your pantry</small>
            </div>
          </summary>
          <ul className="space-y-1 mt-2">
            {cookableList.map((recipe) => (
              <li key={`cook-${recipe.title}`}>
                <button
                  onClick={() => onPick(recipe.title, [recipe.cuisine, recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : ""].filter(Boolean).join(" · "))}
                  className="w-full flex items-center justify-between gap-2 rounded-xl bg-[var(--color-accent-soft)] px-3 py-2 text-left border border-dashed border-[var(--color-accent)] active:scale-[0.99] transition-transform"
                >
                  <span className="text-[13.5px] font-medium text-[var(--color-accent-strong)] truncate">{recipe.title}</span>
                  <span className="inline-flex items-center gap-4 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-accent)] shrink-0">
                    <Check aria-hidden="true" size={12} /> ready
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
        <button onClick={askAI} disabled={aiBusy || !ingredientInput.trim()} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-white py-2.5 text-[12.5px] font-semibold disabled:opacity-50">
          <WandSparkles size={15} /> {aiBusy ? "Thinking through dinner…" : "Ask Fam AI for ideas"}
        </button>
        {!ingredientInput.trim() && <p className="text-[11.5px] text-[var(--color-ink-faint)] mt-2 text-center">Add ingredients first, then Fam AI can riff.</p>}
        {aiError && <p className="text-[11.5px] text-[var(--color-warn)] mt-2">{aiError}</p>}
        {aiMeals.length > 0 && (
          <ul className="space-y-1 mt-2">
            {aiMeals.map((meal) => (
              <li key={meal.title}>
                <button onClick={() => onPick(meal.title, meal.notes)} className="w-full rounded-xl bg-white border border-[var(--color-border)] px-3 py-2 text-left flex items-start gap-2">
                  <Check size={14} className="text-[var(--color-good)] mt-0.5 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-medium">{meal.title}</span>
                    <span className="block text-[11px] text-[var(--color-ink-faint)] mt-0.5">{meal.notes}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
