# Product feedback implementation — September 14, 2026

## Implemented locally

- Manual and saved-recipe meal additions wait for persistence, retain the editor on failure, show errors, and disable concurrent editor actions. Failed edits restore the previous meal in the family store. This addresses silent failure UX; the reported production database failure has not yet been reproduced with an authenticated household.
- Calendar source selection supports multiple simultaneous overlays. The picker is collapsible, month view omits the redundant week strip, and phone month cells are compact.
- Starter staples: five opt-in packs, quantities/units, and case-insensitive duplicate prevention. Uses the existing local staple storage; household sync is still pending.
- Quantity inputs support fractions and unit dropdowns preserve legacy custom values. Applied to Shopping, favourites and Kitchen Watch. Kitchen edits now persist quantity, units and name as well as expiry/location.
- Optional preferred-store label in Shopping editor, list rows and Focus Shop. Deploy migration `202609140001_grocery_preferred_store.sql` before enabling this release in production. Saving a nonempty store deliberately fails rather than silently discarding the label when the column is unavailable.
- App theme is propagated to the document root so portal dialogs inherit it. Dark dialog backgrounds and close controls override old hard-coded white rules; celebration surfaces use theme variables. This is a focused dark-mode fix, not a completed audit of every page.

## Verification

Production build, shared component tests, real Meals rendering with delayed/rejected persistence mocks, staple deduplication and unit controls. Local setup preview includes light/dark portal dialogs. Production database migration and authenticated cross-device persistence have not been run.

## Remaining backlog

1. Reproduce reported meal failure against the affected household and confirm saved meals survive reload/device switching.
2. Shared staple persistence, replenishment intervals, routine templates and recurring-task rollover (distinguish twice monthly from every two weeks).
3. Batch purchased-items-to-Kitchen confirmation, low-stock suggestions, duplicate handling and undo.
4. Store grouping/filtering and optional maps directions.
5. Audit actual AI access versus plan/platform; do not change pricing or native entitlements implicitly.
6. Voice capture with review before saving and explicit microphone permission.
7. Full dark-mode page audit.
8. Verified current-price data before any cheapest-store/route/fuel claims.

The release includes the icon-library changes. Migration `202609140001_grocery_preferred_store.sql` was applied to the linked production project on September 14, 2026. Production build and 35 focused tests passed before release. Authenticated cross-device verification remains outstanding.
