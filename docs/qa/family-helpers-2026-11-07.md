# Family helpers: local implementation and rollout

## Scope

Local React/Supabase implementation. No production schema changes, invitations, bookings or deployments were performed.

- Settings → Family → Family helpers: explicit resource selection and permissions, expiry, review, one-time invitation link, revoke/remove and per-resource revocation.
- `/helpers`: isolated authentication and data loading; never mounts the family data providers. Verified matching email required for invitation preview/acceptance. Accepting never inserts a household membership. Multiple shared spaces are isolated.
- Helper actions: view minimal projections; check/uncheck authorized list items. No arbitrary row updates, parent deletion, files, provider tokens, member directory, chat, AI or billing.
- FamOS default calendar, custom calendars, individual events, task/shopping/custom lists supported. Imported provider events and private/guardian/selected records excluded. Calendar recurrence is expanded through access expiry.
- Eligible owner-created events offer Plan help. Date/time is carried over; area/requirements/budget start blank. The family records an external arrangement as confirmed, then separately chooses to invite a helper to that event. The helper sees the job's scheduled hours. Completing/cancelling the plan revokes only that job's bundles. Deleting the event cascades through its job grants.
- Invitation acceptance expires at seven days or access expiry, whichever is sooner. Access is mandatory-expiry, maximum one year; job access ends within six hours of the job.
- Completion audit records actor, item and time without copying content. Family records remain after helper removal.
- Guest content stays in memory; read failures, backgrounding, offline state, family switching and periodic revalidation clear it. Foreground polling every 25 seconds rechecks access. Server authorization rejects every read/write after revocation; already delivered information cannot be recalled.

## Local checks

Commands and results are recorded in the final task response. Test artifacts/logs were written to `/tmp/famos-helpers-*.log`.

Database integration tests execute the new SQL against PGlite with actual authenticated/anonymous role privileges and the relevant baseline migrations. They cover owner authority, cross-household grants/reads, minimal projections, invitation preview/acceptance, replay, wrong email, unverified email, expiry, item mutation restrictions, private child/container filtering, resource removal, leave/revoke/remove, default calendar exclusions, multiple families and job cancellation isolation. This does not establish the effective policies of the live database.

UI regression tests cover explicit sharing selection/review, owner-only controls, private-address exclusion from help plans, completion/revalidation, client-switch response races, access revocation clearing and explicit invitation acceptance.

The helper sign-in route rendered in Chrome on the existing local Vite server at `127.0.0.1:5178/helpers`. No real invitation or sign-in email was sent. Native packaging builds do not establish real-device behavior.

## Deployment sequence

1. Review `supabase/migrations/202611070008_family_helpers.sql` and `202611070009_family_membership_guards.sql` against the target database schema and effective privileges. This workspace contains other pending unrelated work; do not blindly apply all pending migrations.
2. Apply these transactionally wrapped migrations through the normal reviewed database release process. It creates four RLS-enabled tables and narrow RPCs. It adds no direct helper permissions to existing family tables.
3. Add the canonical `https://home.fam-os.app/helpers` callback to Supabase Auth's allowed redirect URLs if it is not already covered. Preserve existing redirect URLs. Check existing Auth email sign-in configuration and mail delivery. No new provider credentials are required for Family helpers itself.
4. Deploy the frontend and updated routing/cache configuration. `/helpers` must serve the app entry via the existing SPA rewrite, carry noindex/no-store/no-referrer headers, and remain outside navigation response caching. Update any non-Vercel hosting configuration equivalently.
5. Use two controlled accounts to prove the live flow: owner selects one list, creates invitation, intended verified helper previews/accepts, checks an item, owner sees it, owner revokes, old-session read/write fails and helper view clears. Do not use real child/private data for this test. Repeat with two family relationships, an event job cancellation, an expired invitation and a private event.
6. Verify mobile Safari/Chrome and the native app opening the canonical helper invitation URL. Email sign-in callbacks must return to the isolated helper route. A helper who opens an email link in a new tab may need to reopen the original family invitation link; the pending invitation is held only in its original tab's session storage.

## Deferred

Marketplace/provider search, automated invitations, provider communications, service booking/cancellation, payments/refunds, credential vetting, calendar editing, item contribution, files/addresses/location, offline queues, notifications, automated audit retention cleanup and permission expansion without reinvitation. No marketplace or employment-service claims should be added to marketing from this implementation.


## Production backend checks, November 7

The helper and membership-guard migrations have been applied transactionally to the linked production project. An older deployed schema lacked calendar containers; migration 008 now includes a forward-compatible repair before creating helper grants. Existing data and ownership were preserved.

Ten checks passed using two controlled authenticated QA accounts and synthetic records: wrong-account invitation denial, selected-resource read, replay denial, no helper membership, ordinary-table read denial, attributable completion visible to owner, no sharing before job confirmation, job cancellation isolation, and stale-session read/write denial after revocation. No customer records were modified. Frontend rollout is tracked separately in the release evidence.
