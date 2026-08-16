const DAY_MS = 24 * 60 * 60 * 1000;

const asDate = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const advance = (date, recurrence) => {
  const next = new Date(date);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  else if (recurrence === "yearly") next.setFullYear(next.getFullYear() + 1);
  return next;
};

export function expandRecurringEvents(events, rangeStart, rangeEnd) {
  const startBoundary = asDate(rangeStart);
  const endBoundary = asDate(rangeEnd);
  if (!startBoundary || !endBoundary) return events;

  return events.flatMap((event) => {
    if (!event.recurrence || event.recurrence === "none") return [event];
    const seriesStart = asDate(event.start);
    const seriesEnd = asDate(event.end);
    if (!seriesStart || !seriesEnd) return [event];

    const duration = Math.max(1, seriesEnd.getTime() - seriesStart.getTime());
    const until = event.recurrenceUntil ? asDate(`${event.recurrenceUntil}T23:59:59`) : null;
    const occurrences = [];
    let cursor = new Date(seriesStart);
    let guard = 0;

    // Skip old occurrences quickly for daily/weekly series while retaining
    // calendar-aware month/year advancement below.
    if (cursor < startBoundary && event.recurrence === "daily") {
      cursor.setDate(cursor.getDate() + Math.max(0, Math.floor((startBoundary - cursor) / DAY_MS) - 1));
    } else if (cursor < startBoundary && event.recurrence === "weekly") {
      cursor.setDate(cursor.getDate() + Math.max(0, Math.floor((startBoundary - cursor) / (7 * DAY_MS)) - 1) * 7);
    }

    while (cursor <= endBoundary && guard < 800) {
      if ((!until || cursor <= until) && cursor >= startBoundary) {
        const occurrenceStart = new Date(cursor);
        occurrences.push({
          ...event,
          id: `${event.id}::${occurrenceStart.toISOString()}`,
          seriesId: event.id,
          start: occurrenceStart.toISOString(),
          end: new Date(occurrenceStart.getTime() + duration).toISOString(),
          isRecurringOccurrence: occurrenceStart.getTime() !== seriesStart.getTime(),
        });
      }
      if (until && cursor > until) break;
      const next = advance(cursor, event.recurrence);
      if (next.getTime() === cursor.getTime()) break;
      cursor = next;
      guard += 1;
    }
    return occurrences;
  });
}
