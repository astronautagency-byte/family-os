import { useState } from "react";
import { Dices, Sparkles, WandSparkles } from "lucide-react";
import { CUISINES, recipesByCuisine, suggestByIngredients } from "../data/recipeBox";
import { supabase } from "../lib/supabase";

const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

export default function MealSuggestions({ onPick, mealType: fixedMealType }) {
  const [mode, setMode] = useState("ingredients"); // "ingredients" | "cuisine"
  const [ingredientInput, setIngredientInput] = useState("");
  const [cuisine, setCuisine] = useState(null);
  const [aiMeals, setAiMeals] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [selectedMealType, setSelectedMealType] = useState("dinner");
  const mealType = fixedMealType || selectedMealType;

  const matches = mode === "ingredients" ? suggestByIngredients(ingredientInput, 8, mealType) : cuisine ? recipesByCuisine(cuisine, mealType) : [];
  const roulette = () => {
    const choices = CUISINES.flatMap((item) => recipesByCuisine(item, mealType));
    const recipe = choices[Math.floor(Math.random() * choices.length)];
    if (recipe) onPick(recipe.title, `Meal roulette · ${recipe.cuisine}`);
  };
  const askAI = async () => {
    if (!ingredientInput.trim()) return;
    setAiBusy(true); setAiError("");
    const { data, error } = await supabase.functions.invoke("meal-suggestions", { body: { ingredients: ingredientInput, mealType } });
    if (error) {
      let message = error.message;
      try {
        const details = await error.context?.json();
        message = details?.error || message;
      } catch { /* response body was not JSON */ }
      setAiError(message);
    } else setAiMeals(data?.meals || []);
    setAiBusy(false);
  };

  return (
    <div className="rounded-2xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] p-3.5 mb-5 notion-shadow">
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles size={14} color="var(--color-accent)" />
        <p className="text-[12.5px] font-semibold text-[var(--color-ink)]">Need ideas?</p>
      </div>

      {fixedMealType ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)] mb-3">Ideas for {mealType}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {MEAL_TYPES.map((type) => <button key={type} onClick={() => { setSelectedMealType(type); setAiMeals([]); }} className="rounded-lg py-1.5 text-[11.5px] font-semibold capitalize border" style={{ borderColor: mealType === type ? "var(--color-accent)" : "var(--color-border)", background: mealType === type ? "var(--color-accent-soft)" : "white", color: mealType === type ? "var(--color-accent-strong)" : "var(--color-ink-soft)" }}>{type}</button>)}
        </div>
      )}

      <button onClick={roulette} className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-[12.5px] font-semibold text-[var(--color-accent)] mb-3">
        <Dices size={15} /> Meal roulette
      </button>

      <div className="flex gap-1.5 mb-3 bg-[var(--color-surface)] rounded-xl p-1 border border-[var(--color-border)]">
        <button
          onClick={() => setMode("ingredients")}
          className="flex-1 rounded-lg py-1.5 text-[12.5px] font-medium transition-colors"
          style={{
            background: mode === "ingredients" ? "var(--color-accent-soft)" : "transparent",
            color: mode === "ingredients" ? "var(--color-accent-strong)" : "var(--color-ink-soft)",
          }}
        >
          By ingredients
        </button>
        <button
          onClick={() => setMode("cuisine")}
          className="flex-1 rounded-lg py-1.5 text-[12.5px] font-medium transition-colors"
          style={{
            background: mode === "cuisine" ? "var(--color-accent-soft)" : "transparent",
            color: mode === "cuisine" ? "var(--color-accent-strong)" : "var(--color-ink-soft)",
          }}
        >
          By cuisine
        </button>
      </div>

      {mode === "ingredients" ? (
        <input
          value={ingredientInput}
          onChange={(e) => setIngredientInput(e.target.value)}
          placeholder="What's in the fridge? e.g. chicken, rice, broccoli"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] mb-3"
        />
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3">
          {CUISINES.map((c) => (
            <button
              key={c}
              onClick={() => setCuisine(c)}
              className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium border transition-colors"
              style={{
                borderColor: cuisine === c ? "var(--color-accent)" : "var(--color-border)",
                backgroundColor: cuisine === c ? "var(--color-accent-soft)" : "var(--color-surface)",
                color: cuisine === c ? "var(--color-accent-strong)" : "var(--color-ink-soft)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {mode === "ingredients" && ingredientInput.trim() === "" ? (
        <p className="text-[12px] text-[var(--color-ink-faint)] px-1">Type a few ingredients to get quick matches.</p>
      ) : matches.length === 0 ? (
        <p className="text-[12px] text-[var(--color-ink-faint)] px-1">
          {mode === "ingredients" ? "No matches yet — try different ingredients." : "Pick a cuisine above."}
        </p>
      ) : (
        <ul className="space-y-1">
          {matches.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onPick(r.title, r.tags.slice(0, 4).join(", "))}
                className="w-full flex items-center justify-between gap-2 rounded-xl bg-[var(--color-surface)] px-3 py-2 text-left border border-[var(--color-border)] active:scale-[0.99] transition-transform"
              >
                <span className="text-[13.5px] font-medium text-[var(--color-ink)] truncate">{r.title}</span>
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)] shrink-0">
                  {r.cuisine}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "ingredients" && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <button onClick={askAI} disabled={aiBusy || !ingredientInput.trim()} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-white py-2.5 text-[12.5px] font-semibold disabled:opacity-50">
            <WandSparkles size={15} /> {aiBusy ? "Creating ideas…" : "Ask AI for fresh ideas"}
          </button>
          {!ingredientInput.trim() && <p className="text-[11.5px] text-[var(--color-ink-faint)] mt-2 text-center">Enter ingredients above to enable AI suggestions.</p>}
          {aiError && <p className="text-[11.5px] text-[var(--color-warn)] mt-2">{aiError}</p>}
          {aiMeals.length > 0 && <ul className="space-y-1 mt-2">{aiMeals.map((meal) => <li key={meal.title}><button onClick={() => onPick(meal.title, meal.notes)} className="w-full rounded-xl bg-white border border-[var(--color-border)] px-3 py-2 text-left"><span className="block text-[13.5px] font-medium">{meal.title}</span><span className="block text-[11px] text-[var(--color-ink-faint)] mt-0.5">{meal.notes}</span></button></li>)}</ul>}
        </div>
      )}
    </div>
  );
}
