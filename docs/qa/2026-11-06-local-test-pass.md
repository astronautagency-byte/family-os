# FamOS local test pass — November 6, 2026

Scope: current local working tree, including partner event/recipe drafts, Home and Tasks changes, chat layout, and existing regression coverage. No production deployment or customer-data writes were performed in this pass.

| Check | Result | Evidence and limits |
| --- | --- | --- |
| Node regression suite | PASS | `npm run test`: 262/262 after replacing a video radius literal with the shared token. |
| Component suite | PASS | `npm run test:vitest`: 53 files, 215/215 tests. Includes widget, URL validation, meal draft, chat isolation, task controls and admin access mocks. |
| Web build | PASS | `npm run build`, including marketing prerender checks. |
| Android and iOS web assets | PASS | `npm run build:android` and `npm run build:ios-app-store`; each verified its native entry and seven referenced assets. These are not signed native builds or device tests. |
| Lint | PASS with warnings | `npm run lint` exits 0 after correcting a JSX parse error in `UniversalAdd.jsx`; 216 existing warnings remain. |
| Production npm dependencies | PASS | `npm audit --omit=dev --audit-level=high`: zero advisories reported at test time. |
| Event and recipe signed-in handoff | PARTIAL | In a local signed-in Chrome session, event title/date/times appeared in the editable event form and recipe URL/title appeared in the editable meal form; no save or import was submitted. Signed-out sign-in/onboarding continuation and real recipe extraction remain unverified. |
| Chat layout | PARTIAL | Local Chrome desktop and 390×844 viewport: composer directly followed the messages; private thread scroll area remained scrollable. No messages were sent. Physical iPhone keyboard/safe-area behavior not tested. |
| Security | PARTIAL | Existing regression suite includes message-update and Google-token checks; production dependency audit ran. No new penetration test or comprehensive security assessment was performed. |
| Admin | PARTIAL | Mocked access, navigation, and failed-metrics tests pass; no authenticated live admin operations were performed. |
| Affiliate referrals | NOT RUN | Attribution, dashboard, commission ledger and reviewed payout workflow are not implemented. |
| Google Home / Android App Actions | NOT RUN | Google Home requires a physical device and connected test calendar; Android App Actions have not been implemented. |
| Stripe checkout, real notification delivery, native device UI | NOT RUN | No isolated Stripe test environment, recipient delivery check, or physical-device session used in this pass. |

Local fixes: `src/landing.css` uses the shared card-radius token for the video player; `src/components/UniversalAdd.jsx` has the missing JSX expression terminator. No commit, push, or deployment was performed.
