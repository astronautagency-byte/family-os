# Shared control refinement — November 24, 2026

Status: implemented in the local preview and source branch. No production deployment or new TestFlight package was made for this refinement. The uploaded Mac 8/iOS 1.0.0.14 candidates are unchanged.

## Delivered

- Shared SelectField now pairs visible labels with the native select, decorative leading icons and a single consistent chevron. It supports hints, invalid/error announcements, disabled state and keyboard focus. The platform picker remains native.
- Shared ChoiceChip uses real keyboard-accessible checkboxes with a 44px minimum target, an explicit checked mark and distinct selected/unselected states.
- Badges use quieter type, wrapping and semantic soft colours. Informational tags and selectable chips have different roles and appearances.
- Tasks and Shopping use the same labelled list selector and OptionsMenu. The panel is anchored, bounded, scrollable, dismisses on outside input/Escape and restores focus for keyboard dismissal. It does not intercept a modal's Escape handling. Active filters include a text description for assistive technology.
- Collapsible progress, saved staples and dietary sections use consistent chevrons. Recipe editing uses shared fields, pairs short numeric inputs, removes redundant category labels and reduces empty thumbnail framing when no photograph exists.
- Existing family colours, fonts, avatar, header safe-area fix, access rules, confirmations and data operations are retained. DESIGN.md records the control contract.

## Evidence

- 324 Node tests and 340 component/unit tests passed (664 total), including native select label/error associations, keyboard checkbox interaction, options dismissal/focus, modal Escape ownership, active-filter descriptions, and existing Tasks/Shopping/RecipeBook behaviour.
- Mac and iOS web bundles built and passed the native-entry verifier. These are frontend bundles, not newly signed store apps. Existing bundle-size and lint warnings remain; focused lint has no errors.
- The requested design detector returned no findings. A bounded rendered inspection covered mobile and wide desktop, light and dark themes, plus one corrective/confirmation pass. Detector output alone is not a visual quality guarantee.
- Browser widths checked: 320px, 393px and 1440px. The 320px and 393px page width matched the viewport; native selects were 50px high and selection chips were 44px high. Long selected list names truncate within the control while remaining available in the native picker.
- Actual interactions verified: task-list selection, search inside Options, Escape dismissal, New shopping list opening its labelled dialog, and toggling recipe dietary choices before cancelling the edit. No real family data was changed.
- Sample light-theme text checks: field label contrast 6.57:1, selected chip text 4.60:1. This is not a complete accessibility certification.
- Two synthetic records were created only in the disposable Mac Review Deletion Test household for preview evidence, then removed with an independently verified API readback. Browser theme was restored to light. Physical-device keyboard, touch and native pop-up checks remain required before store submission.

## Local browser captures

- [Tasks on mobile](premium-controls-2026-11-24/tasks-mobile.jpg)
- [Recipe fields and chips](premium-controls-2026-11-24/recipe-fields-mobile.jpg)
- [Shopping on desktop in dark mode](premium-controls-2026-11-24/shopping-desktop-dark.jpg)

All captures use synthetic review-household content. They are not customer outcomes or native-device screenshots.
