# RewardBank — first release

Open Tasks → RewardBank. The household owner enables the mode and enrolls child members. Other members cannot change scores or balances. This release deliberately uses the existing trusted owner role, not an editable profile label, as parental authority.

1. Assign a normal task to a child.
2. In RewardBank select that child/task and set points (default 10; suggested 5/10/20 for increasing effort).
3. The child completes the task in Tasks. The parent approves its points in RewardBank.
4. Create experiences, purchases, or cash-allowance rewards with parent-set point thresholds and descriptions. Put cash amount/currency in the description; FamOS never transfers money.
5. Children sign in with their own household account to see balances and request affordable rewards. Requests reserve points immediately; a parent marks the reward given or declines and returns the points.

Every scored task earns once, even when reopened and completed again. Create a new task for each week's chore. There is no automatic recurring-instance reward system yet. Disabling the mode pauses activity without deleting balances. Pending requests are retained while paused.

Database writes use `rewardbank_command`; RLS alone does not provide balance mutation access. Per-task row locks prevent duplicate approval. Account locks serialize redemptions; request locks make refunds idempotent. Child members can read only their own accounts, chores, redemptions, and ledger within their household. Reward catalogue and enabled state are household-visible.

No leaderboards, negative balances, automatic payments, AI scoring, reward push notifications, or role switching on a shared device are included. Sign in as the correct member. Reward catalogue editing/removal and additional delegated parent roles are follow-ups.

## Validation

`npx vitest run src/components/__tests__/RewardBank.test.jsx src/pages/Tasks.ux.test.jsx`

The migration is also tested against an isolated PGlite database with `tests/rewardbank.db.mjs`. Install `@electric-sql/pglite` in a temporary directory, then set `PGLITE_MODULE` to its absolute `dist/index.js` path when running the test. It checks owner authority, completion requirements, repeat approval, child privacy, overspending, refunds, outsider access, and pausing.

Applied `202609140004_rewardbank.sql` for the September 14 release. Points are stored in the household database, never treated as a trusted local balance.
