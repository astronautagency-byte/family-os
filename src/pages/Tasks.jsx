import { useMemo, useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { Avatar, Card, Checkbox, EmptyState, Modal, PrimaryButton, TextField, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { addDays, formatDayLabel, todayISO } from "../lib/dates";

export default function Tasks() {
  const { members, memberById, tasks, addTask, toggleTask, removeTask } = useFamily();
  const [filterId, setFilterId] = useState("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", assigneeId: members[0]?.id ?? "", due: todayISO() });

  const dueOptions = useMemo(
    () => [
      { label: "Today", value: todayISO() },
      { label: "Tomorrow", value: addDays(todayISO(), 1) },
      { label: "This weekend", value: addDays(todayISO(), (6 - new Date().getDay() + 7) % 7 || 7) },
    ],
    []
  );

  const filtered = tasks.filter((t) => filterId === "all" || t.assigneeId === filterId);
  const open = filtered.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const done = filtered.filter((t) => t.done);

  const submit = () => {
    if (!draft.title.trim()) return;
    addTask({ title: draft.title.trim(), assigneeId: draft.assigneeId, due: draft.due, recurring: "" });
    setDraft({ title: "", assigneeId: members[0]?.id ?? "", due: todayISO() });
    setAdding(false);
  };

  const TaskRow = ({ t }) => {
    const assignee = memberById[t.assigneeId];
    return (
      <li className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
        <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} color={assignee?.color} />
        <div className="flex-1 min-w-0">
          <span className={`text-[14.5px] block truncate ${t.done ? "line-through text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"}`}>
            {t.title}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-[var(--color-ink-soft)]">{formatDayLabel(t.due, { withWeekday: true })}</span>
            {t.recurring && (
              <span className="text-[11px] text-[var(--color-ink-faint)] flex items-center gap-0.5">
                <Repeat size={10} /> {t.recurring}
              </span>
            )}
          </div>
        </div>
        {assignee && <Avatar member={assignee} size="sm" />}
        <button onClick={() => removeTask(t.id)} className="p-1 -mr-1 text-[var(--color-ink-faint)]">
          <Trash2 size={15} />
        </button>
      </li>
    );
  };

  return (
    <div className="pb-24">
      <PageHeader eyebrow={`${open.length} open`} title="Tasks" subtitle="Chores and to-dos, split by family member." />

      <div className="px-5 mt-1 mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterId("all")}
          className="rounded-full px-3 py-1.5 text-[12.5px] font-medium border shrink-0"
          style={{
            borderColor: filterId === "all" ? "var(--color-accent)" : "var(--color-border)",
            backgroundColor: filterId === "all" ? "var(--color-accent-soft)" : "var(--color-surface)",
            color: filterId === "all" ? "var(--color-accent-strong)" : "var(--color-ink-soft)",
          }}
        >
          Everyone
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setFilterId(m.id)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium border shrink-0"
            style={{
              borderColor: filterId === m.id ? colorVar(m.color) : "var(--color-border)",
              backgroundColor: filterId === m.id ? `color-mix(in srgb, ${colorVar(m.color)} 14%, white)` : "var(--color-surface)",
              color: filterId === m.id ? colorVar(m.color) : "var(--color-ink-soft)",
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorVar(m.color) }} />
            {m.name}
          </button>
        ))}
      </div>

      <div className="px-5 space-y-5">
        <section>
          <Card className="p-1">
            {open.length === 0 ? (
              <EmptyState title="All clear" subtitle="No open tasks for this view." />
            ) : (
              <ul>{open.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
            )}
          </Card>
        </section>

        {done.length > 0 && (
          <section>
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)] mb-2 px-1">
              Completed
            </p>
            <Card className="p-1">
              <ul>{done.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
            </Card>
          </section>
        )}
      </div>

      <button
        onClick={() => setAdding(true)}
        className="fixed bottom-24 right-5 rounded-full bg-[var(--color-accent)] shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ width: 52, height: 52 }}
        aria-label="Add task"
      >
        <Plus color="white" size={24} />
      </button>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add task">
        <TextField
          label="Task"
          placeholder="e.g. Pack swim bag"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          autoFocus
        />
        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Assign to</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setDraft((d) => ({ ...d, assigneeId: m.id }))}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium border transition-colors"
              style={{
                borderColor: draft.assigneeId === m.id ? colorVar(m.color) : "var(--color-border)",
                backgroundColor: draft.assigneeId === m.id ? `color-mix(in srgb, ${colorVar(m.color)} 14%, white)` : "transparent",
                color: draft.assigneeId === m.id ? colorVar(m.color) : "var(--color-ink-soft)",
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Due</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {dueOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDraft((d) => ({ ...d, due: opt.value }))}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium border transition-colors"
              style={{
                borderColor: draft.due === opt.value ? "var(--color-accent)" : "var(--color-border)",
                backgroundColor: draft.due === opt.value ? "var(--color-accent-soft)" : "transparent",
                color: draft.due === opt.value ? "var(--color-accent-strong)" : "var(--color-ink-soft)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <PrimaryButton onClick={submit} disabled={!draft.title.trim()}>
          Add task
        </PrimaryButton>
      </Modal>
    </div>
  );
}
