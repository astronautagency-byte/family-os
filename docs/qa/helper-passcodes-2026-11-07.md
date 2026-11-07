# Helper passcodes and mobile UX — 7 November 2026

New helper invitations use a family-assigned passcode (8–64 characters) and private 256-bit invitation link. No helper Auth user or household membership is created. Earlier account-bound invitations remain supported. Anyone with both the link and passcode can use that scoped access; owners should revoke and replace an invitation if either is exposed.

## Implemented

- Task management/actions and progress collapsed; single list selector; row actions moved into the task editor.
- Family feature settings collapsed by default. Fixed destructive settings-tab initialization under React StrictMode.
- Mobile helper form width constrained, date input bounded, lists first and individual events collapsed; scrollable resource area and sticky dialog header.
- Helper-specific social preview at `/helpers`, noindex, no-referrer/no-store response headers.
- Owner-controlled passcode invitations, optional SMS with recipient-permission confirmation. Failures remain visible and manual sharing is available.
- Salted passcode hashes; five failed attempts lock the invitation for 15 minutes. Scoped browser sessions expire within 12 hours or earlier access expiry. Revocation checked on every server read/write.
- Guest RPCs and SMS-claim RPC are service-role-only. Owner-authorized creation calls the existing resource catalog. Delivery has owner/credential checks, recipient permission, a one-minute retry floor and ten attempts per owner/hour.
- SMS contains the private link and code. Phone/network privacy and shared-device risks remain; this is scoped bearer access, not verified helper identity.

## Evidence

- Nine database integration/security tests passed, including existing helper permissions, guest lockout, revoked/expired sessions and SMS claim authorization.
- Fifteen focused React tests passed; six policy/AI privacy checks passed. Production build passed with existing warnings.
- Isolated mobile Chrome at 390 × 844: Tasks, collapsed family settings, invitation form (12 events), guest entry and shared checklist. No horizontal overflow in measured task page/modal.
- Canonical live app and backend against a synthetic household: accountless login, private-task exclusion, allowed completion observed by owner, existing-session revocation, and unauthorized SMS denied. Temporary QA household and owner removed.
- Screenshots in the working project at `docs/qa/helper-passcode-2026-11-07/`. Chrome mobile emulation is not a physical iPhone/Safari test.
- Live app bundle matches the tested build. `/helpers` returns the custom helper image/title, noindex, no-store and no-referrer headers.
- One consented SMS to the operator’s supplied number was accepted by the delivery service. The operator confirmed receiving the SMS, opening its link, using the passcode and completing the sample task on their phone. The sample task completion was independently observed in the database. The temporary SMS household, owner and helper access were then removed.

Live grant inspection confirms the guest/session and SMS-claim RPCs cannot be executed directly by anonymous or signed-in client roles.

This scoped verification does not close the broader compliance/fundraising readiness gate or establish an independent security audit.
