import { useMemo, useState } from "react";
import { Pencil, Plus, ReceiptText, Trash2, TrendingDown, WalletCards } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import PageHeader from "../components/PageHeader";
import { Card, EmptyState, Modal, PrimaryButton, TextField } from "../components/ui";
import { todayISO } from "../lib/dates";

const CATEGORIES = [
  { id: "Groceries", color: "#7168E8" },
  { id: "Dining", color: "#D65D49" },
  { id: "Transport", color: "#4D78B8" },
  { id: "Home", color: "#8B6F57" },
  { id: "Kids", color: "#C65391" },
  { id: "Health", color: "#397E73" },
  { id: "Entertainment", color: "#8A63B8" },
  { id: "Other", color: "#77736D" },
];

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const localISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function currentRange(period) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "monthly") start.setDate(1);
  else start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  if (period === "monthly") end.setMonth(end.getMonth() + 1, 0);
  else end.setDate(end.getDate() + 6);
  return {
    start: localISO(start),
    end: localISO(end),
    label: period === "monthly" ? start.toLocaleDateString("en-CA", { month: "long", year: "numeric" }) : `${start.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}–${end.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`,
  };
}

export default function Finance() {
  const { expenses, weeklyBudget, monthlyBudget, financePeriod, addExpense, removeExpense, setFinanceBudget, setFinancePeriod } = useFamily();
  const [adding, setAdding] = useState(false);
  const [settingBudget, setSettingBudget] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [budgetDraft, setBudgetDraft] = useState("");
  const [draft, setDraft] = useState({ description: "", amount: "", category: "Groceries", spentOn: todayISO() });
  const range = useMemo(() => currentRange(financePeriod), [financePeriod]);
  const activeBudget = financePeriod === "monthly" ? monthlyBudget : weeklyBudget;
  const periodExpenses = expenses.filter((expense) => expense.spentOn >= range.start && expense.spentOn <= range.end).sort((a, b) => b.spentOn.localeCompare(a.spentOn));
  const spent = periodExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const remaining = activeBudget - spent;
  const progress = activeBudget > 0 ? Math.min((spent / activeBudget) * 100, 100) : 0;
  const byCategory = CATEGORIES.map((category) => ({ ...category, total: periodExpenses.filter((expense) => expense.category === category.id).reduce((sum, expense) => sum + Number(expense.amount), 0) })).filter((category) => category.total > 0).sort((a, b) => b.total - a.total);

  const submitExpense = async () => {
    const amount = Number(draft.amount);
    if (!draft.description.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setBusy(true); setError("");
    try {
      await addExpense({ ...draft, description: draft.description.trim(), amount });
      setDraft({ description: "", amount: "", category: "Groceries", spentOn: todayISO() });
      setAdding(false);
    } catch (expenseError) { setError(expenseError.message || "Could not save expense."); }
    finally { setBusy(false); }
  };

  const saveBudget = async () => {
    const amount = Number(budgetDraft);
    if (!Number.isFinite(amount) || amount < 0) return;
    setBusy(true); setError("");
    try { await setFinanceBudget(financePeriod, amount); setSettingBudget(false); }
    catch (budgetError) { setError(budgetError.message || "Could not save budget."); }
    finally { setBusy(false); }
  };

  return (
    <div className="pb-24">
      <PageHeader eyebrow={range.label} title="Finance" subtitle={`Your household spending this ${financePeriod === "monthly" ? "month" : "week"}.`} />
      <div className="px-5 mt-2 space-y-5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] p-1">
          {["weekly", "monthly"].map((period) => <button key={period} onClick={() => setFinancePeriod(period)} className="rounded-lg py-2 text-[12.5px] font-semibold capitalize transition-colors" style={{ backgroundColor: financePeriod === period ? "white" : "transparent", color: financePeriod === period ? "var(--color-accent-strong)" : "var(--color-ink-soft)", boxShadow: financePeriod === period ? "0 1px 3px rgba(25,25,25,.08)" : "none" }}>{period}</button>)}
        </div>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Spent this {financePeriod === "monthly" ? "month" : "week"}</p><p className="font-[var(--font-display)] text-[30px] font-bold tracking-tight mt-1">{money.format(spent)}</p></div>
            <button onClick={() => { setBudgetDraft(String(activeBudget || "")); setSettingBudget(true); }} className="w-9 h-9 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center" aria-label={`Set ${financePeriod} budget`}><Pencil size={15} color="var(--color-accent)" /></button>
          </div>
          {activeBudget > 0 ? <>
            <div className="h-2 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden mt-4"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: remaining < 0 ? "var(--color-warn)" : "var(--color-accent)" }} /></div>
            <div className="flex justify-between mt-2 text-[12px]"><span className={remaining < 0 ? "text-[var(--color-warn)] font-medium" : "text-[var(--color-good)] font-medium"}>{remaining < 0 ? `${money.format(Math.abs(remaining))} over budget` : `${money.format(remaining)} remaining`}</span><span className="text-[var(--color-ink-faint)]">{money.format(activeBudget)} budget</span></div>
          </> : <button onClick={() => { setBudgetDraft(""); setSettingBudget(true); }} className="w-full mt-4 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)] py-2.5 text-[12.5px] font-semibold">Set a {financePeriod} budget</button>}
        </Card>

        {byCategory.length > 0 && <section><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)] mb-2 px-1">By category</p><Card className="p-4 space-y-3">{byCategory.map((category) => <div key={category.id}><div className="flex justify-between text-[12.5px] mb-1.5"><span className="flex items-center gap-2 font-medium"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />{category.id}</span><span>{money.format(category.total)}</span></div><div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(category.total / spent) * 100}%`, backgroundColor: category.color }} /></div></div>)}</Card></section>}

        <section>
          <div className="flex items-end justify-between mb-2 px-1"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Activity</p><h2 className="font-[var(--font-display)] text-[17px] font-semibold capitalize">{financePeriod} expenses</h2></div><span className="text-[12px] text-[var(--color-ink-faint)]">{periodExpenses.length} logged</span></div>
          <Card className="p-1">{periodExpenses.length === 0 ? <EmptyState icon={<WalletCards size={25} />} title={`No expenses this ${financePeriod === "monthly" ? "month" : "week"}`} subtitle="Log a purchase to start tracking your budget." /> : <ul>{periodExpenses.map((expense) => { const category = CATEGORIES.find((item) => item.id === expense.category) || CATEGORIES.at(-1); return <li key={expense.id} className="flex items-center gap-3 px-3 py-3 border-b border-[var(--color-border)] last:border-0"><span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ color: category.color, backgroundColor: `${category.color}18` }}><ReceiptText size={16} /></span><div className="flex-1 min-w-0"><p className="text-[14px] font-medium truncate">{expense.description}</p><p className="text-[11.5px] text-[var(--color-ink-faint)]">{expense.category} · {new Date(`${expense.spentOn}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</p></div><p className="text-[14px] font-semibold tabular-nums">{money.format(expense.amount)}</p><button onClick={() => removeExpense(expense.id)} className="p-1 text-[var(--color-ink-faint)]" aria-label={`Delete ${expense.description}`}><Trash2 size={14} /></button></li>; })}</ul>}</Card>
        </section>
      </div>

      <button onClick={() => setAdding(true)} className="fixed bottom-24 right-5 w-[52px] h-[52px] rounded-full bg-[var(--color-accent)] shadow-lg flex items-center justify-center active:scale-95 transition-transform" aria-label="Add expense"><Plus color="white" size={24} /></button>

      <Modal open={adding} onClose={() => { setAdding(false); setError(""); }} title="Log expense">
        <TextField label="What was it?" placeholder="e.g. Weekly groceries" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} autoFocus />
        <TextField label="Amount (CAD)" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} />
        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Category</p><div className="grid grid-cols-2 gap-2 mb-4">{CATEGORIES.map((category) => <button key={category.id} onClick={() => setDraft((current) => ({ ...current, category: category.id }))} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-medium" style={{ borderColor: draft.category === category.id ? category.color : "var(--color-border)", backgroundColor: draft.category === category.id ? `${category.color}12` : "white", color: draft.category === category.id ? category.color : "var(--color-ink-soft)" }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />{category.id}</button>)}</div>
        <TextField label="Date" type="date" value={draft.spentOn} onChange={(event) => setDraft((current) => ({ ...current, spentOn: event.target.value }))} />
        {error && <p className="text-[12px] text-[var(--color-warn)] mb-3">{error}</p>}<PrimaryButton onClick={submitExpense} disabled={busy || !draft.description.trim() || Number(draft.amount) <= 0}>{busy ? "Saving…" : "Add expense"}</PrimaryButton>
      </Modal>

      <Modal open={settingBudget} onClose={() => { setSettingBudget(false); setError(""); }} title={`${financePeriod === "monthly" ? "Monthly" : "Weekly"} budget`}>
        <div className="w-11 h-11 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center mb-4"><TrendingDown size={20} color="var(--color-accent)" /></div><TextField label={`${financePeriod === "monthly" ? "Monthly" : "Weekly"} household budget (CAD)`} type="number" inputMode="decimal" min="0" step="1" placeholder={financePeriod === "monthly" ? "2000" : "500"} value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} />
        <p className="text-[11.5px] text-[var(--color-ink-faint)] mb-4">Your comparison resets every {financePeriod === "monthly" ? "calendar month" : "Monday"}. Existing expenses remain in your history.</p>{error && <p className="text-[12px] text-[var(--color-warn)] mb-3">{error}</p>}<PrimaryButton onClick={saveBudget} disabled={busy || Number(budgetDraft) < 0}>{busy ? "Saving…" : "Save budget"}</PrimaryButton>
      </Modal>
    </div>
  );
}
