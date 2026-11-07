# Family helpers: nanny and housekeeping access

Status: first implementation completed, 2026-11-07; production backend migrated and controlled access checks passed. Frontend rollout is recorded separately. See `docs/qa/family-helpers-2026-11-07.md` for verification and rollout.

Implemented: owner management, nanny/housekeeping/custom presets, email-bound single-use invitation links, read-only FamOS calendars/events, selected shopping/task/custom lists with view or completion, expiring access, leave/revoke/remove, per-resource removal, and private event help plans with confirmation separate from access. Event-specific invitations are separate bundles so cancelling a job leaves general access intact. The default FamOS calendar grant covers household-visible local events with no custom calendar; custom calendars are separate selections. Recurring calendar events expand in the helper view.

First-release limits: invitations are copied and sent by the family, not automatically emailed. No provider search, booking, payment, notifications, attachments, helper item creation/editing, offline mode or native device verification. Expiry is mandatory and limited to one year; job invitations expire no later than six hours after the job. Renewing or expanding access requires a fresh reviewed invitation; there is no silent permission escalation. Audit events are retained with the household; automated retention cleanup is not yet implemented. The sections below remain the broader product specification; their unimplemented options are not claims about the first release.

## Product decision

Add **Family helpers** under Settings → Family. Nanny and Housekeeping are editable invitation presets within one feature. Each helper signs in with their own verified account and sees only resources deliberately shared with them. Being a helper never creates household membership or a guardian role.

Keep the existing React/Vite, Supabase Auth/Postgres and Tauri applications. No new hosted service is required for this architecture. Use existing authenticated delivery infrastructure for invitations, with separate helper invitation copy and acceptance logic.

The family owner manages helpers in v1. A later explicitly delegated adult permission can support other adults. Children cannot invite helpers, increase access or revoke another adult's access. Ownership of a household does not authorize sharing another member's private resources: the resource's sharing authority must also be checked.

## Family experience

1. Open Family helpers → Invite helper. Choose Nanny, Housekeeping, or Custom; enter a name and email.
2. Select specific calendars and lists. Start with nothing selected. Offer creation of dedicated “Childcare” or “Housekeeping” resources; do not silently copy family content into them.
3. Choose access per resource: View; Complete items (lists only); or Contribute (lists only). Calendar access is read-only in v1.
4. Set access expiry. Recommend 30 days, show the exact date/time and household timezone, and allow the family to change it or explicitly choose ongoing access. Invitation acceptance expires after 7 days, independently of access expiry.
5. Review exactly what will be visible, including future items added to selected resources. Preview the helper's view and show excluded areas. Send only after this review.
6. Manage each person from one card: Pending / Active / Expired / Revoked; shared resources, expiry, last access when reliably recorded, Edit access, Revoke access, Remove helper.

Resource screens show “Shared with 1 helper” with names and access levels. New calendars and lists are never shared automatically. A badge warns before adding sensitive details to a shared resource. Ordinary family navigation stays unchanged.

Revoking one resource keeps other grants. Revoking a helper blocks every grant for that household, immediately in server authorization. Keep the revoked record visible for confirmation. Removing a helper also revokes pending invitations and hides their card, retaining a minimal security record. Confirmation states the affected person/resources and that family records will be retained. Never delete the helper's global account or access granted by another family.

## Helper experience

An invitation explains who invited them, the selected resource names, allowed actions, expiry, and how to leave. Require a verified email matching the invitation; a forwarded URL alone cannot grant access. Existing users keep their own family membership. Helpers with several clients get an explicit family switcher; each request and view uses one access relationship and must not combine client data.

Provide a small helper shell: Today, Shared lists, Shared calendar. Display only authorized items and the minimum identity information needed for them. Include “Shared with you by [family]”, expiry, Leave this family, and notification preferences. Empty, expired, revoked and deleted-resource states must be understandable. An invalid resource link returns a generic unavailable state without revealing whether another family's record exists.

Use accessible controls, text labels alongside colors, keyboard focus, clear timezone/date formatting and phone-friendly touch targets. Helper views require a connection in v1: no offline copies or queued writes.

## Permission presets and boundaries

| Capability | Nanny preset | Housekeeping preset |
| --- | --- | --- |
| Calendars | Family selects exact childcare calendar(s); view only | Family selects exact visit calendar(s); view only |
| Lists | Family selects exact lists; default Complete items | Family selects exact lists; default Complete items |
| Add items | Optional Contribute permission per list | Optional Contribute permission per list |
| Private/guardian-only records | Excluded | Excluded |
| Family chat, member directory, photos, location, finances, rewards, billing, AI | Excluded | Excluded |
| Invite others, reshare, export, connect calendar providers, change permissions | Excluded | Excluded |
| Delete calendar/list/event or family-owned item | Excluded | Excluded |

“View” reads authorized items. “Complete items” adds only a checked/status toggle. “Contribute” additionally creates and edits helper-authored list items; completion remains reversible. Family-owned titles, notes, schedules, assignees and resource ownership remain protected. V1 deletion is family-only; helpers can correct or mark their own additions rather than destroying family records. The family can archive an item to recoverable Trash and restore it using the same permission rules. Destructive container deletion remains a separate family action with an exact count and explicit confirmation.

Share curated resources rather than all household data. Do not offer child profiles, medical records, door/access codes, documents, attachments or live location in v1. Families can write necessary instructions in a selected list but must see that those notes are shared. Do not market the feature as emergency care, a credential/background check, worker monitoring, payroll or custody authorization.

## Existing source findings

These are repository findings, not a claim about policies currently deployed to production.

- `src/context/FamilyContext.jsx` → `loadRemoteData` fetches members, tasks, groceries, events, meals and messages as household data. Helpers must not mount this provider or hydrate its family cache.
- `src/context/AuthContext.jsx` chooses a household membership during authentication. Helper acceptance must bypass family-creation/member-onboarding side effects and route into the helper shell.
- `202607180010_repair_split_household_and_enforce_single_home.sql` enforces one household membership per user. Keep this invariant; represent helper access in a separate many-to-many relation.
- `202608160001_task_notes_and_shopping_lists.sql` grants household members broad shopping-list access. Adding a helper enum to ordinary membership would expose unrelated data.
- `202608020001_coordination_mvp.sql` evaluates item visibility separately from container grants. `202608020002_calendars_and_task_lists.sql` introduces calendars/task lists. Do not assume sharing a calendar/list already enforces visibility of its children.
- `202608160012_multi_assignments_and_task_list_deletion.sql` validates assignees as household members. Helper completion attribution must use a separate actor identity; do not insert guests into member arrays to satisfy this validator.
- `src/context/CoordinationContext.jsx` also manages `shared_lists/shared_list_items`; list sharing must cover task lists, grocery lists and these custom lists explicitly.
- Audit the final policy set, views, RPCs, storage, notifications and service-role functions before implementation. An old migration alone cannot establish effective authorization.

## Data and authorization architecture

Proposed entities:

- `household_helper_access`: household, authenticated helper user, display label/preset, active/revoked/removed state, starts/expires timestamps, invited/accepted/revoked metadata, monotonically increasing access version. Unique relationship per household/user. A helper can leave their own relationship but cannot edit permissions.
- `helper_invitations`: household, verified target email, hashed cryptographically random single-use token, inviter, expiry, accepted/revoked timestamps and an explicit grant snapshot. Store no raw token in logs, analytics or referer-bearing destinations. Editing access while pending invalidates/reissues the old invitation.
- Typed resource grant tables for calendars, task lists, grocery lists and custom shared lists, each with a real resource foreign key and household-consistency validation. Avoid an unchecked polymorphic ID. Reference the access relationship and allowed permission; revocation/expiry is checked through that relationship on every request.
- Append-only helper access audit: actor, household, relationship, action, resource identifiers and timestamp. Log invites, acceptance, permission changes, leave/revoke/remove and content mutations; do not copy sensitive content or invitation tokens into logs. Proposed retention: 90 days for access audit, subject to the app's final retention policy.

Use server-only, transactionally checked RPCs for invitation creation/acceptance, access changes and narrow helper mutations. Pin search paths, restrict execution privileges and check identity/authority inside every privileged function. Do not trust a caller-supplied household, email, role or grant snapshot. Race-safe acceptance consumes the invitation exactly once; a revoked/expired invitation cannot be accepted or revive an old grant. Reinvitation creates a fresh invitation and explicit review of permissions.

Helper reads use an explicit minimal projection from an authorized server endpoint/RPC; never `select('*')` against household data. Keep authenticated helper identities outside `household_members`; baseline member RLS must therefore continue to deny direct table reads. Helper projection and mutation functions check current access and resource relationships each time. No helper INSERT/UPDATE of grant tables. Audit service-role endpoints to prevent them bypassing those boundaries.

Effective read requires active relationship + server time within access window + explicit resource grant + matching household + resource not deleted + item in that resource + item permitted for helper sharing. Private/guardian-only and selected-member records are excluded in v1; item authorship never preserves access after revocation. Unassigned items and deleted/moved resources never fall back to household-wide access. A dedicated resource must show an accurate preview if item exclusions leave it partly empty.

Calendar projection includes only deliberately shareable event title, occurrence time, approved instructions/location and minimal participant labels. Do not include OAuth tokens, external calendar identifiers, attendee emails, meeting links, raw provider payloads, attachments or unrelated profiles. V1 calendars use FamOS-managed resources only; imported Google/CalDAV/ICS content requires a later provider-aware review and explicit selection. No helper-side provider sync or ICS export.

Authorize list completion with a narrow server mutation; reject changes to list ID, household, author, visibility, grants and protected fields. Helper additions inherit the authorized destination and family access policy server-side. Store completion actor/time so the family can undo errors. Do not reuse broad member update APIs.

## Revocation and deletion contract

- The revocation transaction updates the relationship/access version and cancels pending invitations, reminder jobs and device subscriptions for this family relationship. Every later read/write is denied regardless of existing login/JWT age; never embed durable access solely in token claims.
- Helper accounts remain signed in for their own household/other clients. Family-specific access disappears.
- V1 sends no sensitive content over persistent Broadcast/Presence channels. Use foreground polling/refetch for authorized data; any future realtime delivery must reauthorize payload delivery, not just channel join.
- Online clients revalidate on focus and before every operation. Proposed foreground heartbeat: 30 seconds, with content hidden if the authorization lease cannot be refreshed. Show a generic “Access ended” state and clear current in-memory data. This bounds cooperative UI clearing; it cannot recall already delivered information.
- No persistent helper content, service-worker response caching, downloadable exports, attachments or calendar subscriptions in v1. API responses use private/no-store caching. Audit existing PWA caching and route prefetch behavior.
- Notification jobs recheck active access and resource grants at delivery time. Start with generic notifications (“A shared list was updated”), not child names, addresses or event details. Cancel queued jobs; already displayed OS notifications and screenshots cannot be erased remotely.
- Deleting a container disables its grants. Restoring content must not revive revoked access. Moving an item changes its access atomically and shows a sharing warning when moving into a helper-shared destination.
- Revoke means stopping future access. Remove means revoking and removing the relationship from active management. Neither means remotely wiping screenshots or deleting the helper's account. Family content stays with its family, even if helper-authored; deletion of a helper's own account must not cascade-delete that content.

## Risks and release gates

| Risk | Required mitigation/test |
| --- | --- |
| Broad membership accidentally exposes family chat, children, money or location | Guest never becomes member; direct table/REST/RPC denial tests, including AI/search/admin-like routes |
| Forwarded or replayed invite | Verified matching email; single use; hashed token; rate limits; expiry; revoke/accept race tests |
| One account serves multiple clients | Relationship-scoped switcher, queries, caches and notifications; attempt cross-family resource substitution |
| Calendar/list parent and child permissions disagree | Check both; test private/selected/guardian-only records, null parents, moved items and future additions |
| Completion permission escalates to arbitrary edits | Narrow RPC; malicious payload tests changing household, author, grant, visibility and destination |
| Family shares another adult's private information | Enforce sharing authority and exclusions; preview exact helper projection |
| Helper keeps content after revocation | No persistent copies/export; server deny immediately; test stale tokens, tabs, reconnects and pending jobs; explain screenshot limit |
| Realtime/storage link outlives grant | No content-bearing Broadcast or file links in v1; independently test future channels and file authorization |
| Ending work deletes useful family records or other clients' access | Separate relationship removal from content/account deletion; test both family and helper account deletion |
| Helper misses a changed visit or list | Clear refresh/error states, timezone and recurrence tests; generic opt-in reminders; no emergency-delivery promises |
| Hidden scope expansion via future items | Shared-resource badge, sharing warning on moves, all future items policy in review; new resources unshared |

## Delivery sequence and acceptance

1. **Authorization foundation:** inventory current effective policies and privileged functions; add relationship/grant/invite/audit schema and narrow RPCs. Local database integration tests with owner, adult member, child, helper, former helper and unrelated user. Include unauthorized access by direct HTTP/RPC, not just UI tests. Nothing customer-visible yet.
2. **One complete slice:** owner invites a helper to one shopping list with Complete items, helper accepts using an existing account, sees only that list, checks an item, owner sees attributable completion, owner revokes, stale-token read/write fails and helper UI clears. Test verified email mismatch, expiry, leave and invitation replay. Prove transactional email delivery with a controlled recipient before claiming working invitations.
3. **Remaining lists and calendar:** extend typed grants to task/custom lists and a FamOS calendar. Add curated event projection, item exclusions, expiry, family switcher, notifications, Trash/restore and permission preview.
4. **App integration and release:** helper-specific auth routing/providers, mobile phone review, native/web checks, automated authorization suite, existing-family regression suite, service-role/AI/notification/storage audit and controlled two-account production test. Feature stays gated until these pass.

Success means an invited person can perform only the selected actions, across web and mobile, and a revoked person cannot obtain fresh data or mutate it using a previously valid session. A working invite screen alone is insufficient.

Recommended first release: owner-managed sharing, verified email invitations, read-only FamOS calendars, explicit selected lists, view/complete/contribute, access expiry, leave/revoke/remove and family-visible audit. Defer calendar editing, location, files, chat, offline use and external calendar exports until separately scoped.

## Technical references

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Broadcast/Presence authorization and permission caching: https://supabase.com/docs/guides/realtime/authorization
- Supabase private storage access after removal/logout: https://supabase.com/kb/troubleshooting/storage-private-bucket-files-still-accessible-after-remove-access-or-logout

The realtime and storage documentation are reasons to verify each delivery path independently; database grant revocation must not be described as remote erasure of delivered data.
