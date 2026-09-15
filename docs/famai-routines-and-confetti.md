# FamAI routines and shared confetti

Local implementation; production deployment not performed.

## Routines

- Contextual routine prompt chips lead to the `fam-ai` proposal generator. Updated edge schema supports `add_routine` and sees current routine cadence/steps alongside tasks and events.
- Review is mandatory: editable title, daily/weekdays/weekly/monthly cadence, first due date, explicit member or unassigned, 1–12 steps.
- Approval creates one normal task with steps in notes and a `routine:` recurrence. It is visible in Tasks/Today, not an isolated routine data store. Task editor shows repeat frequency and supports stopping recurrence.
- The database trigger creates the next occurrence on completion (not on a clock). Missed tasks remain overdue; completion advances from the previous due date. Monthly dates clamp to the next month's end. Reopening a completed occurrence does not remove its already-created follow-up; completing it again does not duplicate the follow-up.
- A stable task ID makes retrying an uncertain routine save idempotent. Successful items are removed from a partially failed review batch. Existing photos, themes and billing are unaffected.
- No new notification channel or delivery-time guarantee; reminders still depend on existing task reminder settings and infrastructure.

## Required release steps

1. Apply `supabase/migrations/202609150001_routine_task_occurrences.sql`.
2. Deploy the updated `fam-ai` Edge Function.
3. Deploy the client. Routine insert includes the new schema field so missing migration fails visibly instead of silently saving a non-repeating routine.
4. Verify an authenticated live request, approved save, completed occurrence and reminder delivery. Live AI/provider calls and notification delivery were not tested locally.

## Confetti

All rendered confetti paths use `canvas-confetti` via `brandConfetti.js`. Sources: https://www.kirilv.com/canvas-confetti/ and https://github.com/catdad/canvas-confetti .
Palette: green #16865D, peach #F6AE96, yellow #F4D15B, sky #9DD7EB. Bounded side cannons; worker rendering; no pointer capture; resets on unmount; suppressed for reduced motion and disabled celebrations. Completion art uses the new v3 object-only illustrations; human family scenes remain v4.

Tests: unit checks for proposal validation/routing and confetti; isolated PGlite trigger tests for next dates/duplicates/stop; browser test for real canvas rendering, close cleanup and reduced motion. Preview buttons are in `/tests/visual-regression/family-cards.html`.
