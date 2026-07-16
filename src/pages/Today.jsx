import { ChefHat, ChevronRight, MapPin, Moon, ShoppingCart, Sun, WalletCards } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarStack, Card, Checkbox, EmptyState, SectionTitle, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { formatTime, fullDateLabel, greetingInfo, todayISO } from "../lib/dates";

export default function Today({ goTo }) {
  const { members, memberById, events, googleEvents, feedEvents, meals, tasks, groceries, toggleTask, expenses, weeklyBudget, monthlyBudget, financePeriod } = useFamily();
  const { profile, user } = useAuth();
  const today = todayISO();
  const greeting = greetingInfo();
  const GreetingIcon = greeting.icon === "sun" ? Sun : Moon;

  const todaysEvents = [...events, ...googleEvents, ...feedEvents]
    .filter((e) => e.start.slice(0, 10) === today)
    .sort((a, b) => a.start.localeCompare(b.start));

  const dinner = meals.find((m) => m.date === today && m.slot === "dinner");
  const dinnerCooks = (dinner?.cookIds ?? []).map((id) => memberById[id]).filter(Boolean);

  const todaysTasks = tasks
    .filter((t) => t.due === today)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const openTaskCount = todaysTasks.filter((t) => !t.done).length;

  const groceryCount = groceries.filter((g) => !g.checked).length;

  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  if (financePeriod === "monthly") periodStart.setDate(1);
  else periodStart.setDate(periodStart.getDate() - ((periodStart.getDay() + 6) % 7));
  const periodEnd = new Date(periodStart);
  if (financePeriod === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1, 0);
  else periodEnd.setDate(periodEnd.getDate() + 6);
  const localISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const periodSpent = expenses.filter((expense) => expense.spentOn >= localISO(periodStart) && expense.spentOn <= localISO(periodEnd)).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const activeBudget = financePeriod === "monthly" ? monthlyBudget : weeklyBudget;
  const budgetRemaining = activeBudget - periodSpent;
  const daysElapsed = financePeriod === "monthly" ? new Date().getDate() : ((new Date().getDay() + 6) % 7) + 1;
  const daysInPeriod = financePeriod === "monthly" ? periodEnd.getDate() : 7;
  const isOnTrack = activeBudget > 0 && periodSpent <= activeBudget * (daysElapsed / daysInPeriod);
  const budgetProgress = activeBudget > 0 ? Math.min((periodSpent / activeBudget) * 100, 100) : 0;
  const periodLabel = financePeriod === "monthly" ? "month" : "week";
  const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  const nextEvent = todaysEvents.find((e) => new Date(e.end) > new Date());
  const signedInMember = members.find((member) => member.id === user?.id);
  const firstName = (signedInMember?.name || profile?.display_name || "").trim().split(/\s+/)[0];
  const greetingName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";

  return (
    <div className="pb-24 reference-dashboard">
      <PageHeader
        eyebrow={fullDateLabel(today)}
        title={`${greeting.text}${greetingName ? `, ${greetingName}` : ""}`}
        titleIcon={
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0"
            style={{
              backgroundColor: greeting.icon === "sun" ? "var(--color-warn-soft)" : "var(--color-accent-soft)",
            }}
          >
            <GreetingIcon size={15} color={greeting.icon === "sun" ? "var(--color-warn)" : "var(--color-accent)"} strokeWidth={2.2} />
          </span>
        }
      />

      <div className="px-5 space-y-6 mt-2">
        {/* Ambient "right now" strip */}
        {nextEvent ? (
          <Card className="p-4 fade-up bg-[var(--color-accent-soft)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent-strong)] mb-1">
              Up next
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[15px] text-[var(--color-ink)] truncate">{nextEvent.title}</p>
                <p className="text-[13px] text-[var(--color-ink-soft)]">
                  {formatTime(nextEvent.start)} · {(nextEvent.memberIds || []).map((id) => memberById[id]?.name).filter(Boolean).join(", ")}
                </p>
              </div>
              <AvatarStack members={(nextEvent.memberIds || []).map((id) => memberById[id]).filter(Boolean)} />
            </div>
          </Card>
        ) : (
          <Card className="p-4 fade-up">
            <p className="text-[14px] text-[var(--color-ink-soft)]">Nothing left on the calendar today. Enjoy the evening. 🌙</p>
          </Card>
        )}

        {/* Agenda */}
        <section>
          <SectionTitle
            eyebrow="Agenda"
            title="Today's schedule"
            action={
              <button onClick={() => goTo("calendar")} className="text-[13px] font-medium text-[var(--color-accent)] flex items-center gap-0.5">
                Full week <ChevronRight size={14} />
              </button>
            }
          />
          <Card className="p-1">
            {todaysEvents.length === 0 ? (
              <EmptyState title="No events today" subtitle="Add something from the Calendar tab." />
            ) : (
              <ol className="relative">
                {todaysEvents.map((ev, i) => {
                  const evMembers = (ev.memberIds || []).map((id) => memberById[id]).filter(Boolean);
                  const isPast = new Date(ev.end) < new Date();
                  const isExternal = ev.source !== "local";
                  return (
                    <li key={ev.id} className="flex gap-3 px-3 py-3 relative">
                      <div className="flex flex-col items-center pt-0.5 w-14 shrink-0">
                        <span className={`text-[12.5px] font-semibold tabular-nums ${isPast ? "text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"}`}>
                          {formatTime(ev.start)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span
                          className="w-2.5 h-2.5 rounded-full mt-1 ring-4 ring-white"
                          style={{ backgroundColor: isExternal ? (ev.color || "#4C91F2") : evMembers[0] ? colorVar(evMembers[0].color) : "var(--color-ink-faint)" }}
                        />
                        {i < todaysEvents.length - 1 && <span className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
                      </div>
                      <div className={`flex-1 min-w-0 pb-1 ${isPast ? "opacity-45" : ""}`}>
                        <p className="font-medium text-[14.5px] text-[var(--color-ink)] truncate">{ev.title}</p>
                        {ev.location && (
                          <p className="text-[12.5px] text-[var(--color-ink-soft)] flex items-center gap-1 mt-0.5">
                            <MapPin size={11} /> {ev.location}
                          </p>
                        )}
                      </div>
                      <AvatarStack members={evMembers} size="sm" />
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </section>

        {/* Dinner plan */}
        <section>
          <SectionTitle
            eyebrow="Tonight"
            title="Dinner plan"
            action={
              <button onClick={() => goTo("meals")} className="text-[13px] font-medium text-[var(--color-accent)] flex items-center gap-0.5">
                Meal plan <ChevronRight size={14} />
              </button>
            }
          />
          <Card className="p-4">
            {dinner?.title ? (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
                  <ChefHat size={20} color="var(--color-accent)" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] text-[var(--color-ink)] truncate">{dinner.title}</p>
                  {dinner.notes && <p className="text-[13px] text-[var(--color-ink-soft)] truncate">{dinner.notes}</p>}
                </div>
                {dinnerCooks.length > 0 && <AvatarStack members={dinnerCooks} />}
              </div>
            ) : (
              <EmptyState title="No dinner planned yet" subtitle="Pick something in the meal planner." />
            )}
          </Card>
        </section>

        {/* Tasks due today */}
        <section>
          <SectionTitle
            eyebrow={`${openTaskCount} left`}
            title="Today's tasks"
            action={
              <button onClick={() => goTo("tasks")} className="text-[13px] font-medium text-[var(--color-accent)] flex items-center gap-0.5">
                All tasks <ChevronRight size={14} />
              </button>
            }
          />
          <Card className="p-1">
            {todaysTasks.length === 0 ? (
              <EmptyState title="Nothing due today" subtitle="You're all caught up." />
            ) : (
              <ul>
                {todaysTasks.map((t) => {
                  const assignee = memberById[t.assigneeId];
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
                      <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} color={assignee?.color} />
                      <span className={`flex-1 text-[14.5px] ${t.done ? "line-through text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"}`}>
                        {t.title}
                      </span>
                      {assignee && <Avatar member={assignee} size="sm" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        {/* Grocery reminder */}
        <section>
          <button onClick={() => goTo("groceries")} className="w-full text-left">
            <Card className="p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
              <div className="w-11 h-11 rounded-xl bg-[var(--color-good-soft)] flex items-center justify-center shrink-0">
                <ShoppingCart size={20} color="var(--color-good)" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[15px] text-[var(--color-ink)]">Grocery list</p>
                <p className="text-[13px] text-[var(--color-ink-soft)]">
                  {groceryCount === 0 ? "Nothing needed — nice." : `${groceryCount} item${groceryCount === 1 ? "" : "s"} still needed`}
                </p>
              </div>
              <ChevronRight size={18} color="var(--color-ink-faint)" />
            </Card>
          </button>
        </section>

        {/* Finance snapshot */}
        <section>
          <button onClick={() => goTo("finance")} className="w-full text-left">
            <Card className="p-4 active:scale-[0.99] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
                  <WalletCards size={20} color="var(--color-accent)" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[15px] text-[var(--color-ink)]">{financePeriod === "monthly" ? "Monthly" : "Weekly"} spending</p>
                    {activeBudget > 0 && <p className="text-[12px] font-semibold tabular-nums">{money.format(periodSpent)} / {money.format(activeBudget)}</p>}
                  </div>
                  <p className={`text-[13px] mt-0.5 ${budgetRemaining < 0 ? "text-[var(--color-warn)]" : "text-[var(--color-ink-soft)]"}`}>
                    {activeBudget <= 0
                      ? `Set a ${financePeriod} budget to track your household spending.`
                      : budgetRemaining < 0
                        ? `${money.format(Math.abs(budgetRemaining))} over budget this ${periodLabel}.`
                        : isOnTrack
                          ? `You're on track — ${money.format(budgetRemaining)} left this ${periodLabel}.`
                          : `${money.format(budgetRemaining)} left in your budget this ${periodLabel}.`}
                  </p>
                </div>
                <ChevronRight size={18} color="var(--color-ink-faint)" />
              </div>
              {activeBudget > 0 && <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden mt-3"><div className="h-full rounded-full" style={{ width: `${budgetProgress}%`, backgroundColor: budgetRemaining < 0 ? "var(--color-warn)" : "var(--color-accent)" }} /></div>}
            </Card>
          </button>
        </section>
      </div>
    </div>
  );
}
