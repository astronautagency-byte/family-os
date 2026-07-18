import { useMemo, useState } from "react";
import { Camera, Pencil, Plus, ReceiptText, Sparkles, Trash2, TrendingDown, Upload, WalletCards } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import PageHeader from "../components/PageHeader";
import { Card, DateField, EmptyState, Modal, PrimaryButton, TextField } from "../components/ui";
import { todayISO } from "../lib/dates";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const CATEGORIES = [
  { id: "Groceries", color: "#7168E8", keywords: ["grocery", "market", "food", "superstore", "sobeys", "metro", "loblaws", "walmart", "costco", "instacart"] },
  { id: "Dining", color: "#D65D49", keywords: ["restaurant", "cafe", "coffee", "pizza", "ubereats", "doordash", "skip", "bistro", "grill"] },
  { id: "Transport", color: "#4D78B8", keywords: ["uber", "lyft", "gas", "fuel", "parking", "transit", "presto", "shell", "esso", "petro"] },
  { id: "Home", color: "#8B6F57", keywords: ["home", "hardware", "ikea", "canadian tire", "cleaning", "repair"] },
  { id: "Kids", color: "#C65391", keywords: ["school", "toy", "child", "kids", "daycare", "activity", "camp"] },
  { id: "Health", color: "#397E73", keywords: ["pharmacy", "drug", "health", "doctor", "dental", "clinic", "shoppers", "rexall"] },
  { id: "Entertainment", color: "#8A63B8", keywords: ["movie", "cinema", "netflix", "spotify", "tickets", "game", "museum"] },
  { id: "Other", color: "#77736D", keywords: [] },
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function categoryFromText(text = "") {
  const lower = text.toLowerCase();
  return CATEGORIES.find((category) => category.keywords.some((keyword) => lower.includes(keyword)))?.id || "Other";
}

function parseReceiptText(text = "") {
  const cleaned = text.replace(/\r/g, "\n");
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  const totalLine = lines.find((line) => /(grand\s+total|total|amount\s+due|balance)/i.test(line));
  const amountMatches = (totalLine || cleaned).match(/(?:\$|cad)?\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{2}))/gi) || [];
  const amounts = amountMatches
    .map((value) => Number(value.replace(/[^0-9.]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  const dateMatch = cleaned.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
  const merchant = lines.find((line) => line.length <= 42 && !/(receipt|invoice|total|visa|mastercard|debit|tax)/i.test(line));
  return {
    merchant: merchant || "",
    amount: amounts.length ? Math.max(...amounts).toFixed(2) : "",
    category: categoryFromText(cleaned),
    spentOn: normalizeReceiptDate(dateMatch?.[1]) || todayISO(),
    notes: cleaned ? "Extracted from pasted receipt text." : "",
    confidence: amounts.length ? 0.62 : 0.25,
  };
}

function normalizeReceiptDate(value) {
  if (!value) return "";
  const parts = value.replace(/\//g, "-").split("-").map((part) => part.padStart(2, "0"));
  if (parts[0]?.length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
  const year = parts[2]?.length === 2 ? `20${parts[2]}` : parts[2];
  if (!year) return "";
  return `${year}-${parts[0]}-${parts[1]}`;
}

const emptyReceipt = {
  file: null,
  previewUrl: "",
  text: "",
  status: "idle",
  message: "",
};

export default function Finance() {
  const { expenses, weeklyBudget, monthlyBudget, financePeriod, addExpense, removeExpense, setFinanceBudget, setFinancePeriod } = useFamily();
  const [adding, setAdding] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [settingBudget, setSettingBudget] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [error, setError] = useState("");
  const [budgetDraft, setBudgetDraft] = useState("");
  const [draft, setDraft] = useState({ description: "", amount: "", category: "Groceries", spentOn: todayISO(), merchant: "", receiptNotes: "", receiptSource: "manual" });
  const [receipt, setReceipt] = useState(emptyReceipt);
  const range = useMemo(() => currentRange(financePeriod), [financePeriod]);
  const activeBudget = financePeriod === "monthly" ? monthlyBudget : weeklyBudget;
  const periodExpenses = expenses.filter((expense) => expense.spentOn >= range.start && expense.spentOn <= range.end).sort((a, b) => b.spentOn.localeCompare(a.spentOn));
  const spent = periodExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const remaining = activeBudget - spent;
  const progress = activeBudget > 0 ? Math.min((spent / activeBudget) * 100, 100) : 0;
  const byCategory = CATEGORIES.map((category) => ({ ...category, total: periodExpenses.filter((expense) => expense.category === category.id).reduce((sum, expense) => sum + Number(expense.amount), 0) })).filter((category) => category.total > 0).sort((a, b) => b.total - a.total);

  const resetDraft = () => {
    setDraft({ description: "", amount: "", category: "Groceries", spentOn: todayISO(), merchant: "", receiptNotes: "", receiptSource: "manual" });
    setReceipt(emptyReceipt);
  };

  const openReceiptCapture = () => {
    resetDraft();
    setReceiptOpen(true);
    setError("");
  };

  const handleReceiptFile = async (file) => {
    if (!file) return;
    const previewUrl = await fileToDataUrl(file);
    const merchantGuess = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    setReceipt((current) => ({ ...current, file, previewUrl, status: "ready", message: "Receipt photo attached. Tap Analyze receipt to extract what we can." }));
    setDraft((current) => ({
      ...current,
      description: current.description || merchantGuess || "Receipt purchase",
      merchant: current.merchant || merchantGuess,
      category: categoryFromText(merchantGuess),
      receiptSource: "photo",
    }));
  };

  const applyReceiptAnalysis = (result, source = "receipt") => {
    const merchant = result.merchant || result.vendor || "";
    const amount = result.total || result.amount || result.subtotal || "";
    const category = result.category && CATEGORIES.some((item) => item.id === result.category) ? result.category : categoryFromText(`${merchant} ${result.notes || ""}`);
    setDraft((current) => ({
      ...current,
      description: merchant || current.description || "Receipt purchase",
      merchant: merchant || current.merchant,
      amount: amount ? String(amount).replace(/[^0-9.]/g, "") : current.amount,
      category: category || current.category,
      spentOn: result.spentOn || result.date || current.spentOn,
      receiptNotes: result.notes || current.receiptNotes,
      receiptConfidence: result.confidence || current.receiptConfidence,
      receiptSource: source,
    }));
  };

  const analyzeReceipt = async () => {
    setReceiptBusy(true);
    setError("");
    try {
      if (receipt.file && isSupabaseConfigured && supabase?.functions) {
        const image = receipt.previewUrl || await fileToDataUrl(receipt.file);
        const { data, error: functionError } = await supabase.functions.invoke("analyze-receipt", {
          body: { image, fileName: receipt.file.name, mimeType: receipt.file.type },
        });
        if (!functionError && data) {
          applyReceiptAnalysis(data, "ai_receipt");
          setReceipt((current) => ({ ...current, status: "done", message: "Receipt analyzed. Review the details below before saving." }));
          return;
        }
        console.warn("Receipt analysis Edge Function unavailable.", functionError);
      }

      const parsed = parseReceiptText(receipt.text || receipt.file?.name || "");
      applyReceiptAnalysis(parsed, receipt.file ? "photo_review" : "text_review");
      setReceipt((current) => ({
        ...current,
        status: "needs_review",
        message: receipt.file
          ? "Receipt photo is attached, but server OCR is not connected yet. I filled what I could from the filename/pasted text — please confirm before saving."
          : "I filled what I could from the pasted text. Please confirm before saving.",
      }));
    } catch (analysisError) {
      setReceipt((current) => ({ ...current, status: "error", message: "Could not analyze the receipt automatically. You can still confirm the details manually." }));
      setError(analysisError.message || "Receipt analysis failed.");
    } finally {
      setReceiptBusy(false);
    }
  };

  const submitExpense = async () => {
    const amount = Number(draft.amount);
    if (!draft.description.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);
    setError("");
    try {
      await addExpense({ ...draft, description: draft.description.trim(), amount });
      resetDraft();
      setAdding(false);
      setReceiptOpen(false);
    } catch (expenseError) {
      setError(expenseError.message || "Could not save expense.");
    } finally {
      setBusy(false);
    }
  };

  const saveBudget = async () => {
    const amount = Number(budgetDraft);
    if (!Number.isFinite(amount) || amount < 0) return;
    setBusy(true);
    setError("");
    try {
      await setFinanceBudget(financePeriod, amount);
      setSettingBudget(false);
    } catch (budgetError) {
      setError(budgetError.message || "Could not save budget.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = draft.description.trim() && Number(draft.amount) > 0;

  return (
    <div className="pb-24">
      <PageHeader eyebrow={range.label} title="Money without the mystery." illustration="finance" subtitle={`A calmer look at real dollars this ${financePeriod === "monthly" ? "month" : "week"}.`} />
      <div className="px-5 mt-2 space-y-5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] p-1">
          {["weekly", "monthly"].map((period) => (
            <button key={period} onClick={() => setFinancePeriod(period)} className="rounded-lg py-2 text-[12.5px] font-semibold capitalize transition-colors" style={{ backgroundColor: financePeriod === period ? "white" : "transparent", color: financePeriod === period ? "var(--color-accent-strong)" : "var(--color-ink-soft)", boxShadow: financePeriod === period ? "0 1px 3px rgba(25,25,25,.08)" : "none" }}>{period}</button>
          ))}
        </div>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Spent this {financePeriod === "monthly" ? "month" : "week"}</p>
              <p className="font-[var(--font-display)] text-[30px] font-bold tracking-tight mt-1">{money.format(spent)}</p>
            </div>
            <button onClick={() => { setBudgetDraft(String(activeBudget || "")); setSettingBudget(true); }} className="w-9 h-9 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center" aria-label={`Set ${financePeriod} budget`}><Pencil size={15} color="var(--color-accent)" /></button>
          </div>
          {activeBudget > 0 ? (
            <>
              <div className="h-2 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden mt-4"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: remaining < 0 ? "var(--color-warn)" : "var(--color-accent)" }} /></div>
              <div className="flex justify-between mt-2 text-[12px]"><span className={remaining < 0 ? "text-[var(--color-warn)] font-medium" : "text-[var(--color-good)] font-medium"}>{remaining < 0 ? `${money.format(Math.abs(remaining))} over budget` : `${money.format(remaining)} remaining`}</span><span className="text-[var(--color-ink-faint)]">{money.format(activeBudget)} budget</span></div>
            </>
          ) : (
            <button onClick={() => { setBudgetDraft(""); setSettingBudget(true); }} className="w-full mt-4 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)] py-2.5 text-[12.5px] font-semibold">Set a spending guardrail</button>
          )}
        </Card>

        <button onClick={openReceiptCapture} className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-left shadow-sm active:scale-[.99] transition-transform">
          <span className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center"><Camera size={19} /></span>
            <span className="flex-1">
              <span className="block font-[var(--font-display)] text-[15px] font-semibold">Scan a receipt</span>
              <span className="block text-[12px] text-[var(--color-ink-faint)]">Snap it, skim it, confirm the total. No spreadsheet cosplay.</span>
            </span>
            <Sparkles size={17} color="var(--color-accent)" />
          </span>
        </button>

        {byCategory.length > 0 && (
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)] mb-2 px-1">By category</p>
            <Card className="p-4 space-y-3">{byCategory.map((category) => (
              <div key={category.id}>
                <div className="flex justify-between text-[12.5px] mb-1.5"><span className="flex items-center gap-2 font-medium"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />{category.id}</span><span>{money.format(category.total)}</span></div>
                <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(category.total / spent) * 100}%`, backgroundColor: category.color }} /></div>
              </div>
            ))}</Card>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between mb-2 px-1">
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Activity</p><h2 className="font-[var(--font-display)] text-[17px] font-semibold capitalize">{financePeriod} expenses</h2></div>
            <span className="text-[12px] text-[var(--color-ink-faint)]">{periodExpenses.length} logged</span>
          </div>
          <Card className="p-1">
            {periodExpenses.length === 0 ? <EmptyState icon={<WalletCards size={25} />} title={`No expenses this ${financePeriod === "monthly" ? "month" : "week"}`} subtitle="Connect real spending later, or log the occasional purchase for now." /> : (
              <ul>{periodExpenses.map((expense) => {
                const category = CATEGORIES.find((item) => item.id === expense.category) || CATEGORIES.at(-1);
                return (
                  <li key={expense.id} className="flex items-center gap-3 px-3 py-3 border-b border-[var(--color-border)] last:border-0">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ color: category.color, backgroundColor: `${category.color}18` }}><ReceiptText size={16} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">{expense.description}</p>
                      <p className="text-[11.5px] text-[var(--color-ink-faint)]">{expense.category} · {new Date(`${expense.spentOn}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}{expense.receiptSource && expense.receiptSource !== "manual" ? " · receipt" : ""}</p>
                    </div>
                    <p className="text-[14px] font-semibold tabular-nums">{money.format(expense.amount)}</p>
                    <button onClick={() => removeExpense(expense.id)} className="p-1 text-[var(--color-ink-faint)]" aria-label={`Delete ${expense.description}`}><Trash2 size={14} /></button>
                  </li>
                );
              })}</ul>
            )}
          </Card>
        </section>
      </div>

      <button onClick={() => { resetDraft(); setAdding(true); }} className="fixed bottom-24 right-5 w-[52px] h-[52px] rounded-full bg-[var(--color-accent)] shadow-lg flex items-center justify-center active:scale-95 transition-transform" aria-label="Add expense"><Plus color="white" size={24} /></button>

      <Modal open={adding} onClose={() => { setAdding(false); setError(""); }} title="Add a spend">
        <ExpenseFields draft={draft} setDraft={setDraft} />
        {error && <p className="text-[12px] text-[var(--color-warn)] mb-3">{error}</p>}
        <PrimaryButton onClick={submitExpense} disabled={busy || !canSubmit}>{busy ? "Saving…" : "Add it"}</PrimaryButton>
      </Modal>

      <Modal open={receiptOpen} onClose={() => { setReceiptOpen(false); setError(""); }} title="Scan receipt">
        <label className="block rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-4 text-center mb-4 cursor-pointer">
          {receipt.previewUrl ? <img src={receipt.previewUrl} alt="Receipt preview" className="max-h-48 w-full object-contain rounded-xl bg-white mb-3" /> : <span className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-white text-[var(--color-accent)] flex items-center justify-center"><Upload size={22} /></span>}
          <span className="block text-[13px] font-semibold text-[var(--color-ink)]">{receipt.file ? receipt.file.name : "Upload or take a receipt photo"}</span>
          <span className="block text-[11.5px] text-[var(--color-ink-faint)] mt-1">On iPhone, choose Camera and let the tiny robot squint at it.</span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => handleReceiptFile(event.target.files?.[0])} />
        </label>

        <label className="block mb-4">
          <span className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Receipt text (optional)</span>
          <textarea value={receipt.text} onChange={(event) => setReceipt((current) => ({ ...current, text: event.target.value }))} placeholder="Paste receipt text here if you have it." className="w-full min-h-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-field)] px-4 py-3 text-[14px] outline-none focus:border-[var(--color-accent)]" />
        </label>

        <button onClick={analyzeReceipt} disabled={receiptBusy || (!receipt.file && !receipt.text.trim())} className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-[13px] font-semibold text-[var(--color-accent-strong)] disabled:opacity-45 mb-4">
          {receiptBusy ? "Analyzing receipt…" : "Analyze receipt"}
        </button>
        {receipt.message && <p className={`text-[12px] rounded-xl px-3 py-2 mb-4 ${receipt.status === "done" ? "bg-[var(--color-good-soft)] text-[var(--color-good)]" : "bg-[var(--color-accent-soft)] text-[var(--color-ink-soft)]"}`}>{receipt.message}</p>}

        <ExpenseFields draft={draft} setDraft={setDraft} />
        {error && <p className="text-[12px] text-[var(--color-warn)] mb-3">{error}</p>}
        <PrimaryButton onClick={submitExpense} disabled={busy || !canSubmit}>{busy ? "Saving…" : "Save expense"}</PrimaryButton>
      </Modal>

      <Modal open={settingBudget} onClose={() => { setSettingBudget(false); setError(""); }} title={`${financePeriod === "monthly" ? "Monthly" : "Weekly"} budget`}>
        <div className="w-11 h-11 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center mb-4"><TrendingDown size={20} color="var(--color-accent)" /></div>
        <TextField label={`${financePeriod === "monthly" ? "Monthly" : "Weekly"} household budget (CAD)`} type="number" inputMode="decimal" min="0" step="1" placeholder={financePeriod === "monthly" ? "2000" : "500"} value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} />
        <p className="text-[11.5px] text-[var(--color-ink-faint)] mb-4">Your comparison resets every {financePeriod === "monthly" ? "calendar month" : "Monday"}. Existing expenses remain in your history.</p>
        {error && <p className="text-[12px] text-[var(--color-warn)] mb-3">{error}</p>}
        <PrimaryButton onClick={saveBudget} disabled={busy || Number(budgetDraft) < 0}>{busy ? "Saving…" : "Save budget"}</PrimaryButton>
      </Modal>
    </div>
  );
}

function ExpenseFields({ draft, setDraft }) {
  return (
    <>
      <TextField label="What was it?" placeholder="e.g. Weekly groceries" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} autoFocus />
      <TextField label="Amount (CAD)" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} />
      <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Category</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {CATEGORIES.map((category) => (
          <button key={category.id} onClick={() => setDraft((current) => ({ ...current, category: category.id }))} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-medium" style={{ borderColor: draft.category === category.id ? category.color : "var(--color-border)", backgroundColor: draft.category === category.id ? `${category.color}12` : "white", color: draft.category === category.id ? category.color : "var(--color-ink-soft)" }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />{category.id}
          </button>
        ))}
      </div>
      <DateField label="Date" value={draft.spentOn} onChange={(spentOn) => setDraft((current) => ({ ...current, spentOn }))} />
    </>
  );
}
