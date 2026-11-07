# Calendar OAuth and privacy review — 2026-11-06

This is a targeted engineering review, not a certification of legal compliance or App Store approval.

## Authenticated Google observations
Project `familyos-502301` (FamilyOS): External, In production; branding verified; data access NOT verified. Calendar list read-only is listed as non-sensitive. `calendar.events` is sensitive and not approved. No restricted scopes listed. The scope justification is populated, but the required YouTube demo URL is empty. The unverified user cap currently shows 6/100. No configuration or verification submission was changed during this review.

Required verification evidence: demonstrate sign-in, full OAuth consent, selected calendars, read/create/update/delete operations, private/shared visibility, and disconnect using a dedicated account with synthetic events. Include every OAuth client assigned to the project. Submit accurate policy and scope-use evidence; Google approval remains external. Do not ask customers to bypass warnings as a remedy.

Production status means Testing-mode seven-day refresh-token expiry is not established as the current disconnect cause. Existing revoked/expired grants may still require one explicit reconnect.

## Changes in this patch
- Remove separate unscoped refresh/access-token localStorage copies; pending refresh-token upload retries stay in memory and are cancelled on sign-out, account change, or effect cleanup.
- Bind token uploads to the originating user before constructing the authenticated request.
- Never use stale Supabase Google provider tokens as a configured sync fallback. Supabase does not refresh provider tokens.
- Report temporary status/storage failures honestly instead of claiming a healthy connection or renewed-permission requirement.
- Wait for durable disconnect storage confirmation before clearing connection UI.
- Mark credential responses no-store, reject unknown endpoint actions, bound input length, redact internal/provider error details, and scope invalid-grant deletion to the exact credential read to avoid deleting a concurrently replaced token.

## Remaining release/compliance gates
- Complete and obtain Google sensitive-scope verification; confirm the production OAuth client IDs match this reviewed project.
- Audit the legacy `calendar-sync` function and `google_calendar_tokens` table against canonical `google_oauth_tokens`. Both functions are deployed; current src has no calendar-sync invocation. Do not delete credentials or disable clients without checking usage and migrating safely.
- Validate explicit Google grant revocation and deletion behavior, including refresh-token-only sessions and legacy token storage.
- Review identity unlink/relink reconnect flow separately; it currently unlinks an existing identity before requesting fresh consent.
- Audit live RLS, storage policies, household/private-calendar separation, and account deletion using dedicated test accounts. Local policies are not proof of production configuration.
- Native PrivacyInfo.xcprivacy currently declares no collected data. Reconcile the actual account/contact, household content, calendar, photos/audio, diagnostics and purchase data with both the manifest and App Store Connect privacy labels; inventory SDK required-reason APIs rather than inventing declarations.
- Review AI disclosures and explicit consent before third-party processing of calendar/photos/audio/household data. Confirm Google Limited Use and AI-provider data-use settings before publishing compliance promises.
- Reconcile public/privacy/index.html and src/pages/Privacy.jsx with the actual processor inventory, retention/deletion, child accounts, privacy contact and Google data use. Obtain accountable owner/legal review for applicable privacy obligations.
- No current App Store review-status verification or submission was performed in this patch.

## Validation
Behavior tests cover no-store, storage outages, unknown actions, concurrent token replacement and cross-account deferred upload rejection. Existing session-recovery tests pass. Production build passes. Full Node suite: 251/253 pass; existing assertions for mobile chat composer and removed kitchen-ideas control fail outside the changed security paths. Do not report the whole suite green. Live user reconnection, Google consent approval, and end-to-end customer sync remain separate checks.
