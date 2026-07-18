import { CalendarDays, ChefHat, ChevronRight, Clock3, Home, ListChecks, MapPin, Moon, ShoppingCart, Sparkles, Sun, Users } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarStack, Card, Checkbox, EmptyState, Tag, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { addDays, dailyEncouragement, formatDayLabel, formatTime, fullDateLabel, greetingInfo, todayISO } from "../lib/dates";

function percent(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function MiniMetric({ icon: Icon, label, value, note, tone = "accent", onClick }) {
  const toneClass = {
    accent: "text-[var(--color-accent)]",
    good: "text-[var(--color-good)]",
    warn: "text-[var(--color-warn)]",
    rose: "text-[var(--color-fam-rose)]",
  }[tone] || "text-[var(--color-accent)]";
  const body = (
    <Card className={`today-metric-card today-metric-${tone} p-4 h-full active:scale-[0.99] transition-transform`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-white border border-[var(--color-border)] ${toneClass}`}>
          <Icon size={19} />
        </span>
        {onClick && <ChevronRight size={17} color="var(--color-ink-faint)" />}
      </div>
      <p className="mt-4 text-[26px] leading-none font-[var(--font-display)] font-semibold tracking-[-0.04em] text-[var(--color-ink)]">{value}</p>
      <p className="mt-1 text-[12px] font-semibold text-[var(--color-ink)]">{label}</p>
      {note && <p className="mt-1 text-[11.5px] leading-snug text-[var(--color-ink-soft)]">{note}</p>}
    </Card>
  );
  return onClick ? <button onClick={onClick} className="text-left w-full h-full">{body}</button> : body;
}

function ProgressLine({ label, value, total, color = "var(--color-accent)" }) {
  const progress = percent(value, total);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[12px] mb-1.5">
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        <span className="tabular-nums text-[var(--color-ink-soft)]">{value}/{total}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function Today({ goTo }) {
  const { members, memberById, events, googleEvents, feedEvents, meals, tasks, groceries, toggleTask } = useFamily();
  const { profile, user } = useAuth();
  const today = todayISO();
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const weekEnd = weekDays[weekDays.length - 1];
  const greeting = greetingInfo();
  const GreetingIcon = greeting.icon === "sun" ? Sun : Moon;
  const allEvents = [...events, ...googleEvents, ...feedEvents];

  const todaysEvents = allEvents
    .filter((e) => e.start.slice(0, 10) === today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const weekEvents = allEvents
    .filter((e) => {
      const date = e.start?.slice(0, 10);
      return date >= today && date <= weekEnd;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const dinner = meals.find((m) => m.date === today && m.slot === "dinner");
  const weekDinners = weekDays.map((date) => meals.find((m) => m.date === date && m.slot === "dinner" && m.title)).filter(Boolean);

  const todaysTasks = tasks
    .filter((t) => t.due === today)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const openTaskCount = todaysTasks.filter((t) => !t.done).length;
  const weekTasks = tasks.filter((t) => t.due >= today && t.due <= weekEnd);
  const weekDoneTasks = weekTasks.filter((t) => t.done);

  const activeGroceries = groceries.filter((g) => !g.checked);
  const groceryCount = activeGroceries.length;
  const groceryCategories = Object.entries(
    activeGroceries.reduce((acc, item) => {
      const category = item.category || "Other";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const memberStats = members.map((member) => {
    const memberTasks = weekTasks.filter((task) => task.assigneeId === member.id);
    const memberEvents = weekEvents.filter((event) => (event.memberIds || []).includes(member.id));
    return {
      member,
      tasksTotal: memberTasks.length,
      tasksOpen: memberTasks.filter((task) => !task.done).length,
      events: memberEvents.length,
      load: memberTasks.filter((task) => !task.done).length + memberEvents.length,
    };
  }).sort((a, b) => b.load - a.load);

  const busiestDay = weekDays
    .map((date) => ({
      date,
      count: weekEvents.filter((event) => event.start.slice(0, 10) === date).length + weekTasks.filter((task) => task.due === date && !task.done).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const mealCoverage = percent(weekDinners.length, 7);

  const nextEvent = todaysEvents.find((e) => new Date(e.end) > new Date());
  const todayBrief = [
    todaysEvents.length ? `${todaysEvents.length} event${todaysEvents.length === 1 ? "" : "s"}` : "No events",
    openTaskCount ? `${openTaskCount} task${openTaskCount === 1 ? "" : "s"} left` : "Tasks clear",
    dinner?.title ? "Dinner sorted" : "Dinner open",
    groceryCount ? `${groceryCount} groceries` : "List clear",
  ];
  const signedInMember = members.find((member) => member.id === user?.id);
  const firstName = (signedInMember?.name || profile?.display_name || "").trim().split(/\s+/)[0];
  const greetingName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";

  return (
    <div className="pb-24 reference-dashboard">
      <PageHeader
        eyebrow={fullDateLabel(today)}
        title={`${greeting.text}${greetingName ? `, ${greetingName}` : ""}`}
        subtitle={dailyEncouragement(today)}
        titleIcon={
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 bg-white border border-[var(--color-border)]"
          >
            <GreetingIcon size={15} color={greeting.icon === "sun" ? "var(--color-warn)" : "var(--color-accent)"} strokeWidth={2.2} />
          </span>
        }
      />

      <div className="px-5 space-y-6 mt-2">
        <section className="m3-grid grid-cols-2 lg:grid-cols-4">
          <MiniMetric icon={CalendarDays} label="Calendar today" value={todaysEvents.length} note={nextEvent ? `Next: ${formatTime(nextEvent.start)}` : "Beautifully empty"} onClick={() => goTo("calendar")} />
          <MiniMetric icon={ListChecks} label="Open tasks" value={openTaskCount} note={openTaskCount ? "A few tiny missions remain" : "Nothing due today"} tone="rose" onClick={() => goTo("tasks")} />
          <MiniMetric icon={ChefHat} label="Dinners this week" value={`${weekDinners.length}/7`} note={`${mealCoverage}% of dinner drama avoided`} tone="warn" onClick={() => goTo("meals")} />
          <MiniMetric icon={ShoppingCart} label="Grocery list" value={groceryCount} note={groceryCategories[0] ? `${groceryCategories[0][0]} needs a look` : "List is clear"} tone="good" onClick={() => goTo("groceries")} />
        </section>

        <section className="m3-grid lg:grid-cols-[1.15fr_.85fr]">
          <Card className="today-command-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-accent-strong)]">Today, sorted</p>
                <h2 className="mt-2 font-[var(--font-display)] text-[28px] leading-[1.02] font-semibold tracking-[-0.045em] text-[var(--color-ink)]">
                  {nextEvent ? "Today at a glance" : "Today is clear"}
                </h2>
              </div>
              <span className="w-12 h-12 rounded-2xl bg-white border border-[var(--color-border)] flex items-center justify-center shrink-0">
                <Home size={22} color="var(--color-accent)" />
              </span>
            </div>
            <div className="grid sm:grid-cols-4 gap-2 mt-5">
              {todayBrief.map((item) => (
                <div key={item} className="rounded-2xl bg-white border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-ink)]">
                  {item}
                </div>
              ))}
            </div>
            {nextEvent ? (
              <button onClick={() => goTo("calendar")} className="mt-5 w-full text-left rounded-2xl bg-white border border-[var(--color-border)] p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
                <span className="w-11 h-11 rounded-2xl bg-white border border-[var(--color-border)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
                  <Clock3 size={20} />
                </span>
                <span className="flex-1 min-w-0">
                  <small className="block text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent-strong)]">Up next · {formatTime(nextEvent.start)}</small>
                  <strong className="block text-[15px] text-[var(--color-ink)] truncate">{nextEvent.title}</strong>
                  {nextEvent.location && <em className="not-italic text-[12.5px] text-[var(--color-ink-soft)] flex items-center gap-1 mt-0.5"><MapPin size={11} /> {nextEvent.location}</em>}
                </span>
                <AvatarStack members={(nextEvent.memberIds || []).map((id) => memberById[id]).filter(Boolean)} />
              </button>
            ) : (
              <p className="mt-5 rounded-2xl bg-white border border-[var(--color-border)] p-4 text-[14px] text-[var(--color-ink-soft)]">Nothing urgent on the calendar. Take the win.</p>
            )}
          </Card>

          <Card className="today-pulse-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">This week</p>
                <h2 className="ui-section-title">This week</h2>
              </div>
              <span className="w-10 h-10 rounded-2xl bg-white border border-[var(--color-border)] flex items-center justify-center shrink-0">
                <Sparkles size={18} color="var(--color-accent)" />
              </span>
            </div>
            <div className="space-y-4">
              <ProgressLine label="Dinner plan coverage" value={weekDinners.length} total={7} color="var(--color-warn)" />
              <ProgressLine label="Task completion" value={weekDoneTasks.length} total={weekTasks.length || 1} color="var(--color-good)" />
              <div className="rounded-2xl bg-white border border-[var(--color-border)] p-3">
                <p className="text-[12px] font-semibold text-[var(--color-ink)]">Busiest day</p>
                <p className="text-[13px] text-[var(--color-ink-soft)]">{busiestDay?.count ? `${formatDayLabel(busiestDay.date)} has ${busiestDay.count} moving piece${busiestDay.count === 1 ? "" : "s"}.` : "No heavy days in the next week."}</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="m3-grid lg:grid-cols-3">
          <Card className="today-flow-card p-4 lg:col-span-2">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Today’s schedule</p>
                <h2 className="ui-section-title">Today’s schedule</h2>
              </div>
              <button onClick={() => goTo("calendar")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                Full calendar <ChevronRight size={14} />
              </button>
            </div>
            {todaysEvents.length === 0 ? (
              <EmptyState title="Nothing on the books" subtitle="Add something from the Calendar tab when real life inevitably happens." />
            ) : (
              <ol className="divide-y divide-[var(--color-border)]">
                {todaysEvents.slice(0, 5).map((ev) => {
                  const evMembers = (ev.memberIds || []).map((id) => memberById[id]).filter(Boolean);
                  const isPast = new Date(ev.end) < new Date();
                  const isExternal = ev.source !== "local";
                  const dotColor = isExternal ? (ev.color || "#4C91F2") : evMembers[0] ? colorVar(evMembers[0].color) : "var(--color-accent)";
                  return (
                    <li key={ev.id} className={`flex items-center gap-3 py-3 ${isPast ? "opacity-50" : ""}`}>
                      <span className="w-16 shrink-0 text-[12.5px] font-semibold tabular-nums text-[var(--color-ink-soft)]">{formatTime(ev.start)}</span>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                      <span className="flex-1 min-w-0">
                        <strong className="block text-[14px] text-[var(--color-ink)] truncate">{ev.title}</strong>
                        {ev.location && <small className="text-[12px] text-[var(--color-ink-soft)] truncate flex items-center gap-1"><MapPin size={11} /> {ev.location}</small>}
                      </span>
                      <AvatarStack members={evMembers} size="sm" />
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card className="today-load-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Family load</p>
                <h2 className="ui-section-title">Family workload</h2>
              </div>
              <Users size={18} color="var(--color-accent)" />
            </div>
            <div className="space-y-3">
              {memberStats.length === 0 ? (
                <EmptyState title="No members yet" subtitle="Invite your family from Settings." />
              ) : memberStats.map(({ member, tasksOpen, events }) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar member={member} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{member.name}</p>
                    <p className="text-[11.5px] text-[var(--color-ink-soft)]">{events} events · {tasksOpen} open tasks</p>
                  </div>
                  <div className="w-20 h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((tasksOpen + events) * 18, 100)}%`, backgroundColor: colorVar(member.color) }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="m3-grid lg:grid-cols-2">
          <Card className="today-meals-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Meals</p>
                <h2 className="ui-section-title">Meal plan</h2>
              </div>
              <button onClick={() => goTo("meals")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                Meal planner <ChevronRight size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {weekDays.slice(0, 5).map((date) => {
                const meal = meals.find((m) => m.date === date && m.slot === "dinner" && m.title);
                return (
                  <div key={date} className="flex items-center gap-3 rounded-2xl bg-white border border-[var(--color-border)] px-3 py-2.5">
                    <span className="w-12 shrink-0 text-[11.5px] font-bold uppercase text-[var(--color-accent-strong)]">{date === today ? "Today" : formatDayLabel(date, { withWeekday: true }).split(",")[0]}</span>
                    <span className="flex-1 text-[13px] text-[var(--color-ink)] truncate">{meal?.title || "Open dinner slot"}</span>
                    {meal?.cookIds?.length ? <AvatarStack members={meal.cookIds.map((id) => memberById[id]).filter(Boolean)} size="sm" /> : <Tag tone="neutral">Plan</Tag>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="today-groceries-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Groceries</p>
                <h2 className="ui-section-title">Grocery radar</h2>
              </div>
              <button onClick={() => goTo("groceries")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                Shop list <ChevronRight size={14} />
              </button>
            </div>
            {activeGroceries.length === 0 ? (
              <EmptyState title="Grocery list is clear" subtitle="Nothing to pick up right now. Suspicious, but lovely." />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {groceryCategories.slice(0, 4).map(([category, count]) => (
                    <span key={category} className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--color-good)]">{category} · {count}</span>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {activeGroceries.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{item.name}</p>
                      <p className="text-[11.5px] text-[var(--color-ink-soft)]">{item.category || "Other"}{item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>

        <section>
          <Card className="today-tasks-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Tasks</p>
                <h2 className="ui-section-title">Tiny missions</h2>
              </div>
              <button onClick={() => goTo("tasks")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                Task board <ChevronRight size={14} />
              </button>
            </div>
            {todaysTasks.length === 0 ? (
              <EmptyState title="Nothing due today" subtitle="You’re all caught up. Frame it." />
            ) : (
              <ul className="grid md:grid-cols-2 gap-2">
                {todaysTasks.map((t) => {
                  const assignee = memberById[t.assigneeId];
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white border border-[var(--color-border)]">
                      <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} color={assignee?.color} />
                      <span className={`flex-1 text-[14px] ${t.done ? "line-through text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"}`}>
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
      </div>
    </div>
  );
}
