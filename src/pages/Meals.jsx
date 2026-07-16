import { useMemo, useState } from "react";
import { ChefHat, Coffee, Dices, Soup, Sparkles, Trash2 } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { AvatarStack, Card, Modal, PrimaryButton, SecondaryButton, TextField, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import MealSuggestions from "../components/MealSuggestions";
import { MEAL_SLOTS } from "../data/mockData";
import { addDays, formatDayLabel, todayISO } from "../lib/dates";

const SLOT_META = {
  breakfast: { label: "Breakfast", icon: Coffee },
  lunch: { label: "Lunch", icon: Soup },
  dinner: { label: "Dinner", icon: ChefHat },
};

export default function Meals() {
  const { members, memberById, meals, setMealForSlot, removeMeal } = useFamily();
  const [editing, setEditing] = useState(null); // { date, slot }
  const [draft, setDraft] = useState({ title: "", notes: "", cookIds: [] });
  const [showIdeas, setShowIdeas] = useState(false);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i)), []);

  const mealFor = (date, slot) => meals.find((m) => m.date === date && m.slot === slot);

  const openEditor = (date, slot) => {
    const existing = mealFor(date, slot);
    setDraft({ title: existing?.title ?? "", notes: existing?.notes ?? "", cookIds: existing?.cookIds ?? [] });
    setEditing({ date, slot, mealId: existing?.id || null });
  };

  const toggleCook = (id) =>
    setDraft((d) => ({ ...d, cookIds: d.cookIds.includes(id) ? d.cookIds.filter((x) => x !== id) : [...d.cookIds, id] }));

  const save = () => {
    setMealForSlot(editing.date, editing.slot, draft);
    setEditing(null);
  };

  return (
    <div className="pb-24 reference-meals">
      <PageHeader eyebrow="Nourish & connect" title="Weekly Table" subtitle="Simple meal planning for your household." />

      <div className="meal-ideas-launcher px-5">
        <button onClick={() => setShowIdeas((value) => !value)}><Dices /> Meal roulette</button>
        <button onClick={() => setShowIdeas(true)}><Sparkles /> AI suggestions</button>
      </div>
      {showIdeas && <div className="px-5"><MealSuggestions mealType="dinner" onPick={async (title, notes) => { await setMealForSlot(todayISO(), "dinner", { title, notes, cookIds: [] }); setShowIdeas(false); }} /></div>}

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
                      onClick={() => openEditor(date, slot)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                      style={{ backgroundColor: isDinner ? "var(--color-surface-sunken)" : "transparent" }}
                    >
                      <Icon size={16} color="var(--color-ink-faint)" className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
                          {SLOT_META[slot].label}
                        </p>
                        <p className={`text-[14px] truncate ${meal?.title ? "text-[var(--color-ink)] font-medium" : "text-[var(--color-ink-faint)]"}`}>
                          {meal?.title || "Tap to plan"}
                        </p>
                      </div>
                      {cooks.length > 0 && <AvatarStack members={cooks} size="sm" />}
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
          label="What's for it?"
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

        <MealSuggestions
          mealType={editing?.slot}
          onPick={(title, notes) => setDraft((d) => ({ ...d, title, notes: d.notes || notes }))}
        />

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
    </div>
  );
}
