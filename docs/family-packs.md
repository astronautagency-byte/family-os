# Family Packs — first release

## Scope

- Open **More → Family Packs** (desktop: sidebar link). Recipe Book and Meal Plan also link to their pack type.
- Household owners select up to 30 tasks, routines, recipes, or meals, edit a sanitized preview, and explicitly approve publication.
- Anonymous recipients open `/packs#<random token>` to preview; owners import into their own household.
- Imports create independent task lists/tasks, recipes, or meal slots. Original records are never linked for editing.
- Routines require a start date and retain their repeat cadence; assignments are deliberately empty. Private routine notes are excluded; owners may add shareable steps during review.
- Meal plans use relative days and require a start date. Conflicts abort the entire import, preserving existing meals. Repeated imports of the same pack into the same household are idempotent.
- Links expire after 90 days; owners can revoke them sooner. Existing recipient copies survive revocation or deletion of the sender's household.
- Family Settings → Customize FamOS can hide Family Packs. Existing links remain active until revoked or expired. Source/destination page toggles are respected.

## Privacy

Server and client both whitelist fields. No household/member IDs, assignments, absolute source dates, completion state, rewards, private notes, thumbnails, or uploaded photos are published. Recipe source attribution is retained where a public HTTPS URL without query parameters is available. Free-text names/instructions can still contain personal information: the publisher must review them. Only distribute text you have permission to share.

Links are unlisted, **not recipient-authenticated**: anyone with a link can view or forward it. Tokens use two random UUIDs and stay in the URL fragment, out of normal access logs/referrers. Public pages have a noindex robots tag. There is no directory, feed, public household profile, or cross-family chat.

## Billing / onboarding

Preview is anonymous. Sharing and importing have no subscription check or extra charge. The existing card-first, seven-day Pro-trial onboarding flow is unchanged for new households. This release does not add a card-free signup path. Pending links are restored after onboarding on the same browser origin; the original link always remains usable.

## Deployment requirement

Apply `supabase/migrations/202609160001_family_packs.sql` and `202609160002_family_pack_function_permissions.sql` **before** releasing the web bundle. They depend on existing task lists, recipe book, household feature preferences, and the owner-check helper from RewardBank. The second migration removes Supabase's default direct anonymous execution grants from write functions; only preview is anonymously callable.

## Verification

- `node --test tests/family-packs.test.js tests/family-packs-database.test.js`
- `FAMOS_PACK_SNAPSHOT=/tmp/famos-pack-snapshots.json npx vitest run src/pages/FamilyPacks.test.jsx`
- With Vite on port 5173: `node tests/family-packs.browser.mjs`
- `npm run test:all` and `npm run build`

Database tests execute the actual migration against in-process PostgreSQL (PGlite), with isolated prerequisite table fixtures and anonymous/authenticated roles. They cover metadata stripping, owner access, RLS visibility, all four import types, expiry, revocation, feature toggles, duplicate prevention and meal-conflict rollback. They do not replace a staging Supabase smoke test with two real households.

Before production, verify that one real household can publish, a signed-out browser can preview, a second household can import and edit its copy, and revocation blocks a fresh preview. Verify signup/email-confirmation return on the deployed domain as well. No production household data was changed by the tests.
