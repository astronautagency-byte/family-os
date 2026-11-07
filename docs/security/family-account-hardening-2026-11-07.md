# Family account protection: local hardening review

Date: 2026-11-07. Scope: account transitions, calendar persistence, ordinary family table authorization and the new helper boundary. Source and synthetic local tests only; no customer records were accessed or changed. This is not a complete security certification or verification of live enforcement.

## Changes

### Shared-device calendar isolation — medium, fixed locally

Evidence: FamilyContext previously loaded/persisted imported feed URLs/events and Google calendar metadata under device-wide keys. A second account on the same browser could hydrate the first account's feed state. The state was not attributable to a verified user/household.

Fix: calendar storage now uses both user and household IDs. Configured apps with no established identity do not read/write these caches. Authenticated views do not load the unscoped legacy family snapshot. FamilyProvider remounts on an account/household change so prior asynchronous loaders cannot populate the next provider instance. Configured initial views use empty collections until authorized data arrives.

Legacy storage is preserved, not assigned to whichever account next signs in. Old local-only calendar imports may need to be reimported/reconnected after rollout. Do not automatically claim the old records for a user without an explicit, verified recovery decision. The new scoped persistence is logical isolation, not encryption at rest or protection from someone with access to browser developer tools/local device storage. Imported-file records are local-only, so silently deleting all of them at sign-out would cause data loss and was not done.

Verification: synthetic storage tests write an appointment for account A and show that account B, household B, and pending authentication cannot read it. A legacy record is not adopted and remains preserved. Shared-device real-browser acceptance testing is still required.

### Family membership enforcement — defense in depth, added locally

Migration: `supabase/migrations/202611070009_family_membership_guards.sql`.

Adds a restrictive membership policy for all ordinary authenticated operations on tasks, groceries, events, messages, meals, expenses, calendars and list containers. Because this is restrictive, another permissive policy cannot reopen table access for a non-member. Existing narrower privacy/entitlement policies still apply; this does not grant access or replace child/adult privacy rules. The guard covers tables present at migration time; adding new tables later requires their own reviewed policies.

Helper accounts remain outside household_members. The narrow helper RPCs remain security-definer operations with explicit owner/helper authorization, current relationship/expiry checks and minimal data projections. The membership guard does not authorize a privileged function by itself. Recipient invitation acceptance is deliberately not subjected to a household-member requirement.

Verification: actual SQL migrations run under authenticated roles in PGlite. Tests add deliberately broad policies and then verify that a helper and a removed member cannot select/update/delete family rows or insert a family grocery item. Owner access remains available. Helper invite/read/complete/revoke flows continue to pass with this migration applied.

### In-flight helper responses — medium defense in depth, fixed locally

The helper API now captures the requesting account and verifies the current account again after receiving the response. Account changes and sign-out discard the old account's response rather than returning it to UI code. Requests remain authenticated POSTs with no-store caching. Existing guest UI generation checks independently reject stale responses after switching shared spaces.

Verification: client tests switch account A to account B, or sign out between request and response, and assert rejection. A normal same-account request succeeds. This is client-side protection against stale display; server authorization is still the security boundary.

## Existing protections checked in this scope

- Helper invitation tokens are high-entropy, stored as hashes, email-bound, single-use and expiring. Acceptance requires the matching verified Auth user, not only possession of the link.
- Owner checks and per-resource permissions run server-side. Helper grant tables have RLS enabled and no direct authenticated/anonymous table access.
- Private/guardian-only items and imported external calendar data are omitted from helper projections. No OAuth credentials, photos, child/member directory, precise location, billing or family chat are returned.
- Revocation and expiry are checked for each helper operation; cancellation revokes only the job-specific bundles. No ordinary family membership is created by helper acceptance.
- Earlier source fixes exist for message author/channel immutability (`202611070001_message_update_security.sql`) and the retired arbitrary-URL calendar importer. The older pentest report is historical evidence, not the current production verdict.

## Remaining release checks

1. Review/apply migrations 008 (helpers) and 009 (membership guards) in the intended environment, then inspect the *effective* live policies, function execution grants and private storage configuration. Do not apply unrelated pending workspace migrations blindly.
2. Test two real controlled households plus parent/child/helper accounts: wrong-family direct requests, private messages/events, files, invite replay/email mismatch, member removal, helper cancellation/expiry, account switching and logout. Use synthetic content and do not change customer records.
3. Verify live email-confirmation, secure email/password recovery, password policy/leaked-password protection, MFA enrollment/challenge behavior, redirect allowlist and auth rate limits. No live Auth settings were changed or verified in this task. MFA needs a complete tested enrollment/recovery/challenge flow; silently enforcing it in a policy before that exists could lock families out.
4. Verify logout/recovery/device-session behavior. Supabase warns that revoked sessions' access JWTs can remain valid until expiry; current membership/relationship checks are therefore required independently. Do not promise immediate erasure of already delivered information.
5. Recheck production dependencies and edge/native dependencies. A fresh `npm audit --omit=dev` attempt was blocked by registry DNS/network access (`ENOTFOUND registry.npmjs.org`), so no current zero-advisory claim is made.
6. Test web/native builds, responsive screens, calendar reconnect/migration behavior and controlled post-deploy flows before calling the change live.

## References

- Supabase sign-out/token lifetime: https://supabase.com/docs/guides/auth/signout
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase password security: https://supabase.com/docs/guides/auth/password-security
- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
