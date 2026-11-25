# Calendar month view — November 25, 2026

Month previously rendered date cells with dots and only the selected day's agenda below. It now renders two event-title previews per date across the entire 42-day grid, source colors and an additional-event count. Selecting a date retains the detailed agenda. The header reports month/week totals instead of always describing one day.

Month navigation also moves the selected date into the displayed month, clamping a 31st to the last valid date. This prevents a December grid from retaining November's selected-day details.

Validation:
- Four focused Month/Week/Day component tests passed. Month events on separate dates render simultaneously; crowded days have bounded visible previews and full accessible labels.
- Production build and verification of 27 public routes passed. Focused lint has pre-existing Calendar warnings; no errors.
- Browser fixture with a real 393px iframe viewport: 42 month cells, event previews on multiple dates, width and scrollWidth both 393px. Week has seven day sections; Day has no month grid or week sections.
- Browser navigation selected December 25 correctly, then December 31 → January 31 → February 28 correctly. Today was verified using the native accessibility control after the browser locator could not target it inside the iframe. It restored November and the current date.
- Desktop fixture shows the month event grid. Tests use synthetic sample data and an empty backend configuration; no household data was modified.

The web deployment contains this fix. Mac build 9 and iOS build 15 already submitted to Apple bundle earlier source and do not contain it; a new native build is required.
