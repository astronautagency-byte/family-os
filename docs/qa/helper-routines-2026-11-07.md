# Shared schedules, recurring lists and narrow-screen layouts

7 November 2026. Engineering QA evidence; no independent security or compliance certification.

## Behavior

- Helper mode separates read-only **Schedules** from **Lists & routines**. School/soccer events show dates and times without checkboxes. View-only lists show instructions without completion controls.
- Named task lists can be one-time, daily or weekdays. New tasks inherit the list repeat setting. Use Tasks → select a named list → Task options → Repeat / routine to change it.
- Enabling a routine starts shared open tasks on the current scheduled date and creates a fresh occurrence for completed leaf items. Existing completion history remains. Reapplying the same routine setting does not reset tomorrow’s occurrence.
- Completion creates one next occurrence. Today’s helper projection excludes tomorrow and older completed routine history. Weekday routines skip weekends. An overdue unfinished occurrence advances past today when completed instead of requiring repeated completion of missed days. This is not an attendance ledger recording every missed day.
- List timezone controls daily boundaries; new lists use the creator’s browser timezone. Private tasks remain excluded from helper reads and shared-list conversion.
- Helpers cannot complete future routine occurrences through either account-based or passcode access. Existing expiry/revocation and selected-list permission checks remain.
- Routine task instructions/due dates are included in the deliberately shared task projection; invitation review now states this.
- Long task/list names and instructions wrap. Task cards, list selector, settings and helper cards shrink within available width. Location announcement is now limited to Home instead of crowding task/settings screens.

## Verification

- 11 database integration/security tests passed, including routine advancement, duplicate check-off protection, missed-day advancement, weekday inheritance, stopping recurrence, creator authorization, private tasks and future-completion denial.
- 21 focused React tests passed, including schedule-only views, switching between schedules/routines, read-only instructions and list repeat setup.
- Existing routine trigger regression passed (weekday, monthly boundary, stop repeating, duplicate completion).
- Production build passed with existing warnings; focused lint has existing context/hooks warnings.
- Isolated mobile Chrome preview tested Tasks, Family settings and helper spaces at 320/360/390/768 px; helper invitation modal at 320/390/768 px. Long list names and 174-character unbroken instructions were used. Measured document/modal horizontal bounds passed. Screenshots are in working-project `docs/qa/helper-routines-2026-11-07/`.
- Live database with temporary sample household: list routine configuration, read-only family calendar plus shared routine, passcode login, task instructions, hidden private task, allowed completion observed by owner, exactly one next occurrence, tomorrow excluded, and revocation blocking an existing session all passed. Temporary household/owner removed; no SMS sent this review.
- Physical Safari layout verification has not been repeated for this change. These responsive checks use Chrome emulation.
