# FamOS consumer UX/UI audit

## Executive assessment

FamOS has a useful family coordination loop: plan the week → assign work → shop → put food away → cook → keep everyone informed. The opportunity is to make that loop obvious and reliable, not to add more disconnected features. The approved colour-outline icons give the product personality; predictable navigation, honest feedback and readable lists must do the functional work.

This is a code-backed heuristic review of the application shell, onboarding, Today, Calendar, Tasks, Shopping, Kitchen Watch, Meals, Chat, Fam AI, Settings and feature paywalls. It is not user research or a complete authenticated production walkthrough. Payment, calendar-provider connections, notifications, offline sync and multi-person households need account/device testing before claiming end-to-end reliability. Recommendations below are design judgments, not measured conversion findings.

## Findings and priorities

| Area | Evidence / friction | Recommendation | This pass |
| --- | --- | --- | --- |
| Navigation | Mobile plus always opened a second choice sheet, even inside Tasks/Shopping. | Add directly to the current feature; retain a global chooser on Home and non-creation pages. Keep the reference Home/Calendar/+/Chat/More structure stable. | Implemented, feature flags retained. |
| Task entry | `submitInline` had no catch, pending lock or visible submit button; page autofocus invoked a phone keyboard immediately. | Explicit Add; retain draft and show errors; disable duplicate entry while saving; don't focus on page arrival. | Implemented. |
| Task retrieval | Board only included unfinished tasks, so completed tasks could not be reviewed or reopened there. | To do / Completed plus search, retaining custom lists. | Implemented. |
| Task urgency | Due dates displayed only a weekday, without overdue wording or chronological prioritisation. | Earliest dates first; month/day and explicit Overdue; no colour-only meaning. | Implemented. |
| Task deletion | Row trash immediately called `removeTask`. | Confirm family-wide deletion. Longer term: soft delete and Undo. | Confirmation implemented; no backend retention change. |
| Celebrations | Full-screen completion interrupted every finished task. | Reserve the existing celebration screen for clearing the final open task. | Implemented; shopping celebration retained. |
| Progress truthfulness | All-time task totals were labelled “This week’s wins.” | Describe what is actually counted; only claim weekly stats with timestamp filtering. | Renamed to family progress. |
| Empty states | Several states joked about emptiness or told people to find a different control. | Explain the state and offer a specific next action. | Shopping, Today, Calendar and Tasks updated. |
| Kitchen filtering | A storage/category combination with zero results and no search text could render no explanation. | Explain the filtered state and offer Clear filters. | Implemented. |
| Dialogs | Shared Modal scrolled correctly but lacked keyboard containment/restoration. | Focus entry, Tab/Shift+Tab wrap, topmost Escape and restoration. Preserve deliberate form autofocus. | Implemented and regression tested. |
| Calendar | Month date buttons lacked full date names and selected-state semantics. Repeated month controls and sources compete for space. | Label dates and event counts; retain compact month and agenda. Later, consolidate redundant desktop toolbar controls. | Date semantics and 44px mobile date targets implemented. |
| Chat | Heading was marketing copy, not the destination label. | Match navigation language: Family Chat. | Implemented. |
| Lists / mobile layout | Some row actions were 32–36px; long titles and competing header actions risk crowding. | 44px row actions, wrapping titles and headers; larger mobile search input. | Targeted shared CSS implemented. |
| Today | Overview, shortcuts and a customizable multi-card dashboard create competing summaries. | Make “next up / needs attention” the primary view; collapse secondary weather, broadcasts and analytics progressively. Preserve customization. | Recommend validating with populated household sessions before restructuring. |
| Onboarding | Household, family, interests, schedule, address and payment branches create substantial setup work. | Get to a useful first shared task/event quickly; allow optional profile/integration steps later; persist progress. | Existing draft preservation retained; funnel redesign deferred. |
| Meals | Planning, library, discovery, cook mode, sharing and reset compete for attention. | Make the selected week and next empty meal slot primary; place discovery/library behind explicit secondary choices. Verify save/read-back across devices. | Existing save feedback retained. No claim of production persistence verification. |
| Kitchen ↔ Shopping | Purchase queue exists, but expiry/category details still require per-item work. | Batch “Put away” with editable suggested dates and clear completion feedback; prevent duplicates by source grocery ID. Staples should sync across household members. | Deferred: data-model and sync work. |
| AI | Rich assistance exists, with approvals for changes, but access can surprise people after navigation. | Show included/upgrade status before asking for input; preserve prompt through upgrade; keep approve-before-write previews. | Billing/entitlements intentionally unchanged. |
| Settings | Long sections and mixed emoji/shared-icon headings make scanning uneven. | Group Family, Connections, Notifications, Appearance, Billing, Account, Support; searchable destinations and status summaries. | Recommend separate information-architecture pass. |
| Billing | Distribution-specific paywall copy and checkout branches must stay aligned. | One consistent plan/renewal/access explanation for each supported distribution; test purchase, cancellation and household entitlements. | No pricing, checkout or App Store compliance changes. |
| Visual system | Approved shared icon palette coexists with grocery raster art, emoji headings and layered legacy CSS. | Keep approved palette; audit exceptions deliberately. Consolidate duplicate tokens/rules feature-by-feature rather than adding broad overrides. | Scoped refinement stylesheet; no global rebrand. |

## Design direction

Keep white/navy surfaces, green primary actions and the approved cyan/mint/yellow/coral/purple feature icons. Typography remains the app’s existing display/body system; this pass does not introduce another font. Use 8/12/16/24px spacing, explicit destination titles, one primary creation action per feature and secondary actions that don't compete with it. Functional targets remain at least 44px in the controls touched here. The signature is the family-friendly colour-outline icon language, not additional decoration.

## Next implementation sequence

1. Instrument and validate first-use: time to first shared item, household invitation acceptance, setup abandonment. Do not log private task/message contents.
2. Test cross-device save/read-back and offline recovery for tasks, meals, shopping and kitchen. Add visible pending/retry status consistently where missing.
3. Simplify Today around next event, due tasks, expiring food and tonight's meal; test with both empty and busy households before replacing existing layouts.
4. Ship household-synced staples and batch put-away using confirmed, editable expiry suggestions.
5. Rationalize Settings and show AI/plan availability before users invest effort.
6. Conduct real iPhone keyboard/safe-area, Mac keyboard, VoiceOver, reduced-motion and dark-mode checks across authenticated journeys.

## Validation boundaries

Automated tests cover contextual mobile add, task draft retention/pending state/completed retrieval/delete confirmation, modal keyboard focus and the existing shared component regressions. Production build and local visual checks are required before handoff. No deployment, external data edits or billing changes are part of this pass.
