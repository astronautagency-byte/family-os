# Mia live conversation preview — November 24, 2026

## Scope and rollout

The new live path is opt-in and build-gated by `VITE_MIA_REALTIME=true`. The public frontend and submitted Mac 9/iOS 15 builds have not enabled it. The backend `mia-live` and migration `202611240002` are deployed for controlled testing. Do not describe those submitted native builds as realtime.

The existing turn-based path remains the default. A shared validation bug rejecting “my shopping list” and “our grocery list” as unknown named lists is corrected in source and covered by regressions.

## Verified

- WebSocket first-frame authentication; missing base AI consent and missing separate streaming consent both denied before a provider connection.
- Live xAI connection reached `mia.ready` using the stored server credential. Long-lived and ephemeral provider keys remain server-side.
- Two supplied synthetic speech turns received replies: “Add lemons to my shopping list” and “Actually, make that two lemons.” Transcripts and proposals preserved the correction from one to two lemons. First response audio arrived 454 ms and 686 ms after each supplied input ended. This is a synthetic network test, not measured iPhone latency.
- Withdrawing live-audio consent while connected terminated the active server session on its periodic access check. The UI stops immediately when it withdraws consent.
- All QA sessions had ended-at settlement timestamps. Removed only the isolated synthetic QA household and login after verification.
- Deployed-service tests also passed: a competing household session is denied, an exhausted duration allowance is denied before provider connection, and removing household membership terminates an active connection. The second isolated QA household/login was removed afterward.
- Component tests cover correction, explicit confirmation, saving the corrected quantity exactly once, cancellation and panel-close cleanup. Controller tests cover token-free URLs, delayed microphone cleanup, initialization timeout and duplicate provider events.
- Database tests cover consent acceptance/withdrawal, base-permission denial, household session serialization, elapsed-time allowance, per-household text allowance and denied client ledger access.

## Controls and costs

- Adult/base AI permission plus separate live-streaming choice; active-session checks every 15 seconds.
- Up to 180 live seconds per household per calendar month, 30 connection starts and 12 app-result/tool-result text inputs. One active session per household. This is a free preview; paid checkout is not enabled.
- Audio streams during replies to support interruption. No conversation audio is persisted by this implementation. Duration, user/household identifiers and consent timestamps are stored for metering and access control.
- The server pins the model, voice, instructions and tool schema. Client session reconfiguration is not forwarded. Only actual provider call IDs can receive function results.
- Proposed additions use existing app validation and writes. Nothing saves merely because the model proposes it.

## Still required before public activation

- Actual Safari/iPhone and native Mac microphone, audio routing, interruption, screen-lock/background, correction and save tests. Synthetic audio and mocked controller tests do not establish device behavior.
- Complete paid usage/entitlement and store purchase work separately. No compliance certification or legal sign-off is implied.

## Web rollout

- Production deployment `fam-os-6puu79d0e-astronautagency-bytes-projects.vercel.app` serves both canonical domains with bundle `index-eYScd64L.js`. HTTP and updated privacy disclosure verified. Realtime is explicitly built **false**; the grocery/named-list validation fixes are live on web.
- Controlled realtime preview: `https://fam-os-g5q64q2xu-astronautagency-bytes-projects.vercel.app` (HTTP 200). Includes source `480eeaf`, realtime true and the existing production backend. The later named-list preservation change is in production source `26df483`; it is not in that preview. Ordinary shopping-list quantity corrections are covered by the preview tests.
- Full validation after privacy generation: 329 Node tests and 344 component tests passed. One additional initialization-timeout test passed in the focused six-test live suite afterward. Focused parser regressions passed after named-list preservation. Build and public metadata verification passed. Focused lint has existing hook warnings, no errors.

Official protocol references: [speech-to-speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech), [ephemeral credentials](https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens).
