# App UI consistency pass — November 6, 2026

Scope: product UI refinement following the marketing-site review. Preserve user palettes and existing feature behaviour. No location/check-in feature was added in this pass.

## Findings and changes
- Header layout drift: legacy page rules constrained action slots and clipped long mobile add labels. Shared responsive sizing now allows the full labelled action; decorative art yields to actions on narrow screens.
- Header art: use the same family-v4 registry, with accurate 60/88px image sizes instead of requesting card-size derivatives for compact headers.
- Settings: replace emoji section headings with the existing SVG icon system. Remove the dark header surface mismatch without changing palette selection.
- Interaction consistency: shared tab radii, visible keyboard focus, larger mobile task/meal action targets, and wrapped long titles.
- Forms: TextField now associates labels, hints and validation errors with unique IDs and preserves supplied aria-describedby values. Custom input classes augment rather than replace form-control.
- Motion: short dialog/scrim entrances, checkbox acknowledgement and button press feedback. No looping decorative motion. Reduced-motion disables app and dialog animations/transitions.

## Evidence and limits
- Local real-page fixture, no backend credentials, synthetic household data. Inspected mobile Today, Calendar, Tasks, Shopping, Kitchen, Recipes, Chat, Settings and RewardBank; desktop Tasks; dark mobile Settings, RewardBank and meal editor.
- Mobile routes reported no document-level horizontal overflow. A clipped Shopping action found by screenshot was corrected through shared header sizing.
- Recipe and RewardBank authenticated data paths remain unverified; sample fixture correctly shows sign-in requirements. FamAI is a controlled sheet, not a standalone page, and was not acceptance-tested in this pass.
- Build passes. 14 focused tests pass: header action, modal focus, text-field accessibility, Tasks UX, and meal saving/import regressions.
- Native iPhone keyboard/safe-area behaviour, every custom palette and authenticated delivery/billing were not certified by this visual review.
