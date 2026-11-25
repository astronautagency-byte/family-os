# Competitor pricing and product decisions — November 24, 2026

This supplements the earlier ten-screen review in the parent workspace's product-research folder. Recommendations below do not change approved prices, current customer entitlements, billing or store submissions.

## Current official price references

| Product/plan | Published price | What the comparison tells us |
| --- | --- | --- |
| Cozi Gold | US$39/year; one subscription covers the account | Basic calendar/list improvements compete against a modest annual household price. |
| Cozi Max | $79.99/year on its US-facing page | AI email-to-event import, recipe creation and meal planning already exist in the category; those features alone do not establish unique differentiation. |
| FamilyWall Premium | US$7.99/month or US$44.99/year; whole family, up to five circles | Annual pricing and household coverage matter; advanced planning and calendar sync are already bundled. |
| Cubbily | Free with optional Pro; no period-specific price adopted in this review | The screenshots and developer listing support clear create/join flows, shared lists, recurring plans, milestones and selected-member visibility. |

Sources checked today:

- https://www.cozi.com/faq/ — Gold cost and household coverage.
- https://www.cozi.com/cozi-max/ — Max annual price and its three AI use cases.
- https://www.familywall.com/en/pricing.html — current USD monthly/yearly price, trial and family coverage. An older premium page advertises a conflicting monthly price; use the current pricing page and confirm storefront checkout before campaign claims.
- https://apps.apple.com/us/app/cubbily-shared-family-calendar/id6443812921 — developer-maintained feature description.

The supplied Cozi and FamilyWall screenshots show different amounts/offers. Their currency is not identified in the screenshots. Do not combine screenshot amounts, US web pricing and Canadian FamOS prices in a like-for-like price claim without aligning country, currency, channel and renewal terms.

## FamOS packaging recommendation

Keep the approved AI prices: AI Chat US$4.99/month; Mia Voice US$7.99/month; both US$9.99/month, per household. Do not reprice these merely to follow generic pricing heuristics. Lead with the combined option when both capabilities are ready, while preserving the separate choices the user requested.

The current source/legal catalog also lists Plus at CAD $14.99/month or CAD $149/year and Pro at CAD $19.99/month or CAD $199/year. Those tiers already include AI query allowances. Publishing those offers alongside separate AI add-ons without a clear entitlement relationship creates overlapping value and potential customer confusion. AI add-on checkout is presently disabled; this review does not establish active customers or subscription revenues.

Before paid activation:

1. Publish one understandable household pricing structure and one currency for each storefront. State whether the AI option includes, requires or sits on top of a base subscription, with the complete total visible. Preserve purchased entitlements; never silently bill existing AI access twice.
2. Keep useful Core shared organization free. Concentrate paid differentiation on verified time-saving work: reliable assistant actions, useful capture and planning, and trusted-helper coordination. Avoid charging simply for access controls that protect family data.
3. Use monthly and annual choices with actual annual total, monthly equivalent, trial/renewal terms, included household size and restore purchases. Core currently advertises five included members; resolve the limit before making an unlimited-family promise.
4. Cost voice minutes, model calls, recipe imports, SMS and platform fees before promising usage allowances. No unlimited AI/SMS promise, invented discount, invented review count or charging for roadmap features.
5. Existing store candidates remain positioned as free Core until their native billing/entitlement path is tested. No checkout or legal copy was changed by this decision note.

## Feature decisions and actual status

| Reference | FamOS decision | Actual status |
| --- | --- | --- |
| Cubbily create/join + share code | Clear initial choice; expiring, revocable share code; account identity and owner approval before household access | Implementation specification saved; family code not implemented. Existing family invitations use email/phone. |
| Cubbily/FamilyWall family organization | Distinguish shared calendar information from tasks requiring completion; make existing routines easy to understand | Core tools, helper sharing and routine code exist; current-device polish and end-to-end release checks remain necessary. |
| FamilyWall list cards + Uber hierarchy | Calm list overview, useful category colours and illustrations, compact items, one primary action, management in context | Header, layering and touch corrections uploaded as Mac 8/iOS 1.0.0.14. Broader list/navigation redesign is a proposal, not a completed change. |
| Cozi Max AI capture/planning | Review imported dates/quantities; convert meals into a grocery plan; show confirmed saves and truthful failures | Source contains capture/planning paths; complete flows and provider access need validation. Email-forwarding import is not claimed implemented. |
| Natural voice-agent examples | Persistent live speech, streaming replies, interruption and context through multiple turns | Specification only. Current Mia restarts recognition between replies. Stored xAI credential rejected in the prior benchmark; a valid key alone will not implement the transport. |
| Recipe categories/diet preferences | Editable dietary tags, card badges, combined search/filter, tags preserved in meal snapshots | Implemented and pushed as 01be5c4; 658 tests passed. Local app save/reload and independent backend read verified using a disposable recipe. Not deployed or in builds 8/14. |
| FamilyWall calendar settings | One connection screen showing direction, actual state and recovery action | Requires a current connection-by-connection audit. Previously reported Google verification rejection is unresolved in this review. |
| Cubbily Big Days | Optional birthdays/anniversaries and reminder templates inside Calendar | Proposed; no separate milestone module added. |
| Larger premium feature lists | Defer a new document vault, expanded budget tools and extra navigation until demand and operational safeguards justify them | No new modules or privacy-sensitive data collection introduced. |
| Assistant-by-SMS/proactive help | Later opt-in briefs and actionable reminders with quiet hours, verified phone binding and existing permissions | Future work; no SMS-assistant or unsolicited proactive delivery claimed. |

## Order of execution

1. Complete native compatibility checks and store release work.
2. Finish reliable realtime Mia and family joining, preserving the approved design system.
3. Make existing routines, recipes, meal-to-grocery planning and calendar connection recovery coherent and dependable.
4. Reconcile household packaging, usage limits and billing before activating paid checkout.
5. Trial optional proactive summaries/SMS only after in-app actions and account binding are dependable.

The differentiating proposition to test is a dependable assistant that completes household work together with useful, scoped helper coordination. The current evidence does not establish that competitors lack these capabilities; sell verified FamOS outcomes rather than an unsupported uniqueness claim.

## Implementation update — November 24

The owner prioritised lower operating costs. New-customer packaging now uses Free Core with planned household AI prices of US$4.99 Chat, US$7.99 Voice and US$9.99 both. This reduces the number of plan combinations to support. Voice minutes, model usage and SMS still need measured allowances before paid activation.

Source changes replace new Plus/Pro sales on the pricing page, billing screen and onboarding with Core and planned AI offers. Existing subscription details, trial dates, cancellation state, entitlements and billing management remain available. A server gate blocks new legacy-plan checkout by default, with an explicit ALLOW_LEGACY_PLAN_CHECKOUT rollback switch. Pricing UI, terms and checkout-gate changes await coordinated deployment.

A new xAI credential was saved in Supabase and tested successfully. The deployed mia-speech endpoint now prefers Eve and returned audio through an authenticated disposable household in 1.30 seconds. This endpoint measurement excludes microphone turn detection and playback startup. Persistent realtime voice and family share codes still require implementation.

Validation passed 326 Node tests and 334 component tests. The Mac frontend bundle built successfully with existing size warnings. Updated pricing screens still require rendered review before deployment.

## Release progress — late November 24

Production web deployment dpl_DtFAyqDjRW3aY84ymhRK7cMMmkAe serves the shared controls, recipe tags, distinct calendar week/day views, tighter chat composer and Core-plus-AI packaging. Browser checks confirmed seven week sections, a single day agenda and an 8px composer/navigation gap on the canonical home domain. New legacy-plan checkout is disabled server-side. Mac build 9 and iOS build 1.0.0.15 uploaded successfully. Mac symbol upload still warns about a missing dSYM. These builds precede the family-code UI.

Family codes now use 40 random bits, a 48-hour expiry, hash-only storage, ten authenticated attempts per fifteen minutes and owner approval. Codes support at most twenty distinct requests. Approval produces an email-bound invitation accepted through the existing membership flow. Revocation or replacement expires associated unaccepted invitations. Helpers retain their scoped passcodes. The code interface is under Settings → Family and in onboarding before creating a new household.

The database migration and three previously pending private-storage migrations are applied. Both protected storage buckets are private. An older idempotent location-announcement migration was reconciled during the migration push, preserving its existing November 7 publication and content. Family-code tests passed against PostgreSQL-compatible PGlite and the live API using two verified disposable accounts. The synthetic household and both accounts were removed. Mobile owner controls were inspected at 393px without horizontal overflow. Full suite passed 328 Node tests and 339 component tests. Family-code web deployment and store review verification are continuing.
