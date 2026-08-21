import { useState } from "react";
import { CalendarPlus, ChefHat, Dices, Bookmark, Pencil, Trash2, Clock, Image as ImageIcon, Plus, Users } from "lucide-react";
import { Avatar, AvatarStack, Card } from "../components/ui";
import { formatDayLabel, todayISO } from "../lib/dates";

export function MealGridView({
  weekDays,
  mealFor,
  memberById,
  SLOT_ORDER,
  SLOT_META,
  kitchenIngredients,
  rouletteForSlot,
  setMealForSlot,
  openEditor,
  openCookRecipe,
  saveRecipeToLibrary,
  removeMeal,
}) {
  const [inlineInputs, setInlineInputs] = useState({});

  const handleInlineAdd = (date, slot, e) => {
    if (e.key === "Enter" && inlineInputs[`${date}-${slot}`]?.trim()) {
      const title = inlineInputs[`${date}-${slot}`].trim();
      setInlineInputs((prev) => ({ ...prev, [`${date}-${slot}`]: "" }));
      setMealForSlot(date, slot, { title, notes: "", cookIds: [], source: "manual" });
    }
  };

  const slotColors = {
    breakfast: "#22A06B",
    lunch: "#E85D3A",
    dinner: "#D94F4F",
  };

  return (
    <div className="meal-grid-view">
      <div className="meal-grid-header">
        <div className="meal-grid-corner">
          <span className="meal-grid-time-label">Time</span>
        </div>
        {weekDays.map((date) => {
          const isToday = date === todayISO();
          return (
            <button
              key={date}
              type="button"
              className={`meal-grid-day-header ${isToday ? "is-today" : ""}`}
              onClick={() => openEditor(date, "dinner")}
              aria-label={`Plan meals for ${formatDayLabel(date)}`}
              title={`Plan meals for ${formatDayLabel(date)}`}
            >
              <p className="font-[var(--font-display)] font-semibold text-[14px] text-[var(--color-ink)]">
                {formatDayLabel(date)}
              </p>
              {isToday && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)] bg-[var(--color-accent-soft)] px-1.5 py-0.5 rounded-full">
                  Today
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="meal-grid-body">
        {SLOT_ORDER.map((slot) => {
          const slotColor = slot === "breakfast" ? "#22A06B" : slot === "lunch" ? "#E85D3A" : "#D94F4F";
          const Icon = SLOT_META[slot].icon;

          return (
            <div key={slot} className="meal-grid-row" style={{ "--slot-color": slotColor }}>
              <div className="meal-grid-slot-label" style={{ borderLeftColor: slotColor }}>
                <span className="meal-slot-label" style={{ color: slotColor }}>
                  {SLOT_META[slot].label}
                </span>
              </div>

              {weekDays.map((date) => {
                const meal = mealFor(date, slot);
                const cooks = (meal?.cookIds ?? []).map((id) => memberById[id]).filter(Boolean);
                const inputKey = `${date}-${slot}`;
                const inlineInput = inlineInputs[inputKey] || "";
                const setInlineInput = (val) => setInlineInputs((prev) => ({ ...prev, [inputKey]: val }));

                return (
                  <div key={`${date}-${slot}`} className="meal-grid-cell" style={{ borderLeftColor: slotColor }}>
                    {meal?.title ? (
                      <div className="meal-grid-cell-filled" style={{ borderLeftColor: slotColor }}>
                        <div className="meal-grid-cell-header">
                          <div className="meal-grid-cell-title">{meal.title}</div>
                          {cooks.length > 0 && (
                            <AvatarStack members={cooks} size="xs" className="meal-grid-cell-avatars" />
                          )}
                        </div>
                        <div className="meal-grid-cell-actions">
                          {meal.source === "spoonacular" && (
                            <button className="meal-grid-action-btn meal-cook-mode-btn" onClick={() => openCookRecipe(meal)} title="Cook mode">
                              <ChefHat size={12} />
                            </button>
                          )}
                          <button className="meal-grid-action-btn meal-save-recipe-btn" onClick={() => saveRecipeToLibrary(meal)} title="Save recipe">
                            <Bookmark size={12} />
                          </button>
                          <button className="meal-grid-action-btn meal-edit-btn" onClick={() => openEditor(date, slot)} aria-label="Edit meal">
                            <Pencil size={12} />
                          </button>
                          <button className="meal-grid-action-btn meal-delete-btn" onClick={() => removeMeal(meal.id)} aria-label="Delete meal">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="meal-grid-cell-empty" style={{ borderLeftColor: slotColor }}>
                        <div className="meal-grid-cell-input-wrapper">
                          <Icon size={14} color={slotColor} className="shrink-0" />
                          <input
                            type="text"
                            value={inlineInput}
                            onChange={(e) => setInlineInput(e.target.value)}
                            onKeyDown={(e) => handleInlineAdd(date, slot, e)}
                            placeholder="What's cooking?"
                            className="meal-grid-cell-input"
                          />
                        </div>
                        <div className="meal-grid-cell-actions">
                          <button
                            className="meal-grid-action-btn meal-suggest-btn"
                            onClick={() => rouletteForSlot(date, slot, true)}
                            disabled={!kitchenIngredients.length}
                            aria-label={`Suggest a ${SLOT_META[slot].label.toLowerCase()} meal`}
                          >
                            <Dices size={12} />
                          </button>
                          <button
                            className="meal-grid-action-btn meal-saved-btn"
                            onClick={() => { openEditor(date, slot); }}
                            aria-label={`Choose a saved recipe for ${SLOT_META[slot].label.toLowerCase()}`}
                          >
                            <Bookmark size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}