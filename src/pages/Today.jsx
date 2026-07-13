import { ChefHat, ChevronRight, MapPin, Moon, ShoppingCart, Sun } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { Avatar, AvatarStack, Card, Checkbox, EmptyState, SectionTitle, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { formatTime, fullDateLabel, greetingInfo, todayISO } from "../lib/dates";

export default function Today({ goTo }) {
  const { members, memberById, events, googleEvents, meals, tasks, groceries, toggleTask } = useFamily();
  const today = todayISO();
  const greeting = greetingInfo();
  const GreetingIcon = greeting.icon === "sun" ? Sun : Moon;

  const todaysEvents = [...events, ...googleEvents]
    .filter((e) => e.start.slice(0, 10) === today)
    .sort((a, b) => a.start.localeCompare(b.start));

  const dinner = meals.find((m) => m.date === today && m.slot === "dinner");
  const dinnerCooks = (dinner?.cookIds ?? []).map((id) => memberById[id]).filter(Boolean);

  const todaysTasks = tasks
    .filter((t) => t.due === today)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const openTaskCount = todaysTasks.filter((t) => !t.done).length;

  const groceryCount = groceries.filter((g) => !g.checked).length;

  const nextEvent = todaysEvents.find((e) => new Date(e.end) > new Date());

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow={fullDateLabel(today)}
        title={`${greeting.text}${members[0] ? `, ${members[0].name.split(" ")[0]}` : ""}`}
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
          <Card className="p-4 fade-up pastel-lilac">
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
          <Card className="p-4 fade-up pastel-blue">
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
          <Card className="p-1 pastel-blue">
            {todaysEvents.length === 0 ? (
              <EmptyState title="No events today" subtitle="Add something from the Calendar tab." />
            ) : (
              <ol className="relative">
                {todaysEvents.map((ev, i) => {
                  const evMembers = (ev.memberIds || []).map((id) => memberById[id]).filter(Boolean);
                  const isPast = new Date(ev.end) < new Date();
                  const isGoogle = ev.source === "google";
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
                          style={{ backgroundColor: isGoogle ? "#4C91F2" : evMembers[0] ? colorVar(evMembers[0].color) : "var(--color-ink-faint)" }}
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
          <Card className="p-4 pastel-peach">
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
          <Card className="p-1 pastel-pink">
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
            <Card className="p-4 flex items-center gap-3 active:scale-[0.99] transition-transform pastel-mint">
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
      </div>
    </div>
  );
}
