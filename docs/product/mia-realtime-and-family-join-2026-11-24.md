# Mia live conversation and family join codes

Product direction recorded November 24, 2026. This is an implementation specification, not a claim that these features are live. Preserve the design assets in the current native compatibility candidates (Mac 8 and iOS 1.0.0.14).

## Reference screens and their application

- Cubbily Create/Join and share-code screens: a clear family joining choice, a prominent readable code, Copy and Share actions, and visible expiry. Keep these decisions; use FamOS's established palette, typography, spacing and avatar.
- FamilyWall list cards and calendar settings: a small number of recognisable destinations, useful category colours, calendar connections grouped in one place, and advanced settings disclosed when needed. Do not add more competing actions to the main task screen.
- Uber examples: a clear primary action, consistent navigation, useful illustrations and deliberate spacing. Respect native status bars, keyboards and safe areas. Do not substitute marketing graphics for working product controls.
- Competitor paywalls: communicate household value and precise billing terms. They do not justify copying promotions, changing approved prices or charging for unavailable capabilities.

## Verified starting point

VoiceQuickAdd currently stops speech recognition before generating/playing an audio reply, then starts a new recognition session. Its `continuous` UI mode automates successive turns; it is not a persistent bidirectional audio session. Reducing a timeout or changing the voice will not implement full live conversation.

The family invitation path currently accepts email/name and optional mobile number, persists pending household invitations, and sends invitation links. No family join-code redemption flow was found in the inspected current source. Helper passcodes already serve a different access purpose and must remain separate.

The previous voice benchmark rejected the stored xAI credential. A working voice-enabled credential is needed to verify a new live session. The transport, audio lifecycle and action integration still need implementation even after that credential is corrected.

## Mia: intended flow

1. Open Mia from the existing avatar and tap Start talking once.
2. Establish one authenticated live audio session and stream microphone input while the conversation is active. Clearly show that the microphone remains active, including during Mia's reply; revise the existing voice disclosure accordingly before enabling this behaviour.
3. Stream Mia's generated speech as it arrives. Detect the end of a user's turn automatically. Keep conversation context within the active session.
4. If the user starts speaking over Mia, cancel queued playback and the interrupted generation, then listen to the new turn. Do not play stale audio when the user has moved on.
5. Present short action confirmations within the conversation. Groceries, meals, tasks and events use validated app operations. Bind every operation to the current authenticated household and existing permissions; validate arguments and prevent duplicate execution. Say an item was saved only after the server confirms it. Explain unsupported actions plainly.
6. End conversation, panel close, backgrounding, logout, account change or revoked AI permission must stop microphone tracks, playback, network activity and pending actions. Connection failure must show a recovery state instead of a false Listening indicator. Never automatically fall back to a different privacy/recording mode.

Keep the panel simple: Mia avatar, live state, latest conversational exchange, mute/end controls and optional typing. Keep advanced explanations accessible without occupying the conversation view.

### Live voice boundaries

Use short-lived client credentials issued after server-side authentication, household/age/AI-consent checks, usage checks and rate limiting. Never embed the long-lived provider key in a native app or browser bundle. Treat provider-generated action requests as untrusted input. Client session configuration alone cannot enforce authorisation or billing limits: action execution must recheck access, and session duration/issuance need enforceable limits.

The provider's speech-to-speech API documents bidirectional streaming, server voice activity detection and ephemeral client tokens. That establishes an available transport, not verified FamOS performance or interruption behaviour. Pin the evaluated model version when implementing the release.

Reference: https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech

## Family share code: intended flow

1. A family owner opens Settings → Family → Invite family and creates an invite code.
2. Show a readable, cryptographically random code with Copy, Share and an explicit expiry. Use an eight-character human-friendly alphabet, grouped for readability. Default expiry: 48 hours; allow the owner to revoke or replace it immediately. Display usage limits.
3. Share through the device's share sheet, allowing Messages or email. Copy must remain usable when sharing is unavailable or cancelled. This is user-initiated sharing, not an automatic bulk text.
4. A recipient chooses Join a family, enters the code or opens its invitation link, then signs in or creates an eligible account. Hold the code safely through authentication; do not include it in analytics, logs or AI requests. Invitation links should avoid leaking the code in referrers, and should remove their sensitive fragment after it is read.
5. A valid code creates a pending request. The family owner sees who is requesting access and confirms the appropriate membership role before any household content becomes readable. Code possession must not grant owner/admin privileges, location access or AI consent.
6. Clearly show approval, decline, expiry, revocation, already-member and membership-conflict outcomes. Never silently replace an existing household membership or move data. Children's profiles remain parent-managed under the existing age/access policies.

The owner approval step protects the household if a text or code is forwarded. Store only code digests; use server-enforced expiry, redemption throttling, bounded usage and atomic handling of concurrent attempts. Return generic invalid/expired errors to unauthorised callers, without exposing family names or member information. Recheck revocation and membership authorisation on every protected request.

Helpers continue to use family-assigned passcodes for selected lists/calendars and expiry-controlled access. A family share code must never convert a helper into a family member automatically.

## Screen/state inventory

| Screen | User goal | Default | Loading | Error/retry | Success | Offline/permission | Small/large screens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mia | Hold a natural conversation | Avatar and Start talking | Connecting, then accurate live state | Explicit disconnected state and reconnect | Continued conversation; confirmed app writes | Stop capture on lost permission; typing remains available | Stable header, safe-area padding, accessible controls, keyboard-safe transcript |
| Invite family | Share access deliberately | Create code, existing pending requests | Disable duplicate creation | Visible failure with retry | Code, expiry, Copy, Share, Revoke | Owner-only; no fake success offline | Single readable card; actions wrap without overflow |
| Join family | Request membership | Code input and sign-in path | Validate/request once | Generic invalid/expired, retry throttling | Pending request, then approved membership | Explain need to reconnect; do not reveal household content | One-field paste-friendly input; support full code paste and keyboard navigation |
| Approve member | Confirm intended recipient | Pending identity and role | Prevent duplicate decisions | Preserve request on failed save | Approved/declined, with membership refreshed | Owner-only; server rechecks permissions | Calm list rows with a clear decision view |

## Acceptance gates

- Physical iPhone and Mac: four conversational turns, correction of a prior detail, interruption mid-reply, network interruption/reconnect, permission denial, background/resume and logout. No repeated turn-start feedback added by the app; investigate platform-generated sounds separately. Do not promise that OS privacy indicators or sounds can be disabled.
- Measure end-of-user-speech to first audible reply, with cold/warm and Wi-Fi/cellular results. Report median and tail latency rather than endpoint timing alone. No speed claim until measured.
- Test that proposed and confirmed actions are distinct, every supported action persists, rejected/offline writes produce truthful replies, and replayed/duplicated responses cannot write twice.
- Family-code tests: expiry, revocation, wrong code, guessing throttles, concurrent redemptions, existing membership conflicts, owner approval, declined requests and no pre-approval data access. Verify on two accounts and two devices, including a full sign-out/sign-in cycle.
- Keep the existing native compatibility candidates unchanged. These features require separately verified builds; neither the join-code flow nor true realtime voice is included in builds 8/14.
