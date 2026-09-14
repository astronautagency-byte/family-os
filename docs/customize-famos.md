# Customize FamOS

Settings → Family → Customize FamOS controls one shared household layout. Simple enables Calendar, Tasks, and Chat. Everyday adds Shopping, Meal Planning, Recipe Book, and Celebrations. Custom supports each switch independently. Changes are previewed before Save; nothing is deleted.

The current household role system has owner/member roles. Only the trusted owner can save through set_household_features; a self-selected parent profile does not grant administrative authority. Members have read-only access. Defaults preserve all current pages for households without a saved selection.

Navigation, direct page links, Today cards/shortcuts, notification-feed links, Recipe Book entry points, shopping-to-kitchen prompts, FamAI suggestions/context/action execution, and celebrations use the shared selection. Children are restricted further to enabled Calendar, Tasks, Rewards, and Chat. If all four are off, they receive a quiet screen with sign out. Adult Settings stays reachable.

Recipe Book is independently reachable at /recipes; reading/importing recipes does not require Meal Planning. Its Plan meal action follows the Meal Planning toggle. Insights currently controls FamAI contextual summaries; Routine suggestions controls its routine-planning prompt. These are not a new analytics dashboard or recurring-task scheduler.

Optional reminder pause is separate from personal notification preferences. The push sender checks the destination page before sending; the queued worker marks paused jobs skipped rather than retrying them. Browser kitchen-expiry notifications also respect this choice. Existing untyped/test notices are not suppressed. Feature visibility is not a new data-access permission system.

## Release prerequisites

Apply migration 202609140006_household_features.sql, then deploy send-household-push and deliver-reminders, then the web app. No production migration or deployment was performed during implementation. Missing-schema errors are surfaced in Settings and saves are blocked.

## Verification

Run component/lib Vitest tests, npm run build, and tests/household-features.db.mjs against an isolated PGlite instance via PGLITE_MODULE. Confirm on two signed-in accounts that an owner save updates the member view, including after reload, and test real push delivery separately after deployment.
