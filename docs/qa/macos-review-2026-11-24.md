# macOS App Review correction — November 24, 2026

## Confirmed Apple findings

App 6804827805, macOS 1.0, build 1.0.0 (6), submission 96d8ddf3-e78c-404c-827d-3b351e743b20.

September 14: guideline 5.1.1(v), reviewers could not locate account deletion. Apple requests a physical-device recording of sign-in, navigation to deletion, and completed account deletion. September 6 also requested a physical-device demonstration of core flows and purpose, audience, service and regional information.

The separate November 16 iOS submission still displayed Waiting for Review on November 24. It has not been changed by this Mac correction.

## Changes

- Shared account deletion control in Settings → Account, placed first, with a permanent-deletion confirmation that clearly distinguishes household owners from members.
- The same deletion control is available during onboarding, including before household creation.
- Sign-in displays a completion message after the server confirms account deletion.
- Store onboarding ends with free Core access, including restored drafts. Web trial checkout and promotional entitlement redemption are excluded from this flow.
- Mac build verifies its frontend entry, excludes marketing ad/social asset directories, and fails on an invalid code signature.

## Verification completed

- Focused deletion/onboarding tests: 22 passed.
- Full Node suite: 324 passed.
- Full component suite: 319 passed.
- Focused lint ran with warnings in existing Auth/Settings code. No errors.
- git diff --check passed.
- Production deletion-service test passed using a disposable synthetic account: login, household, grocery row and uploaded image removed; subsequent sign-in rejected; separate recording account remained intact.
- Native arm64 release compilation completed. Distribution signing is pending macOS key access authorization.

## Still required before resubmission

- Finish distribution signing and verify the package.
- Launch the exact new signed build on this physical Mac.
- Record launch/sign-in, core flows and account deletion using only the dedicated disposable synthetic household, never the preserved reviewer or real family account.
- Verify the synthetic account cannot sign in and its records/uploads are gone after deletion.
- Attach the recording, update review notes, select the new processed build and resubmit.

No approval or publication is claimed by this report.
