# Helper pause and launch hardening — November 25, 2026

Helper UI removed from Settings, Tasks and Calendar; `/helpers` now explains the pause and discards private invite/session material. Regular household joining, list sharing and routines remain. Retained helper records were not deleted.

Live database migrations 202611250001 and 202611250002 applied: helper RPC execution revoked for client/service roles; public ad creative projection excludes campaign budgets and targeting. Both helper delivery endpoints return HELPERS_PAUSED before processing data or sending messages. Synthetic authenticated QA verified denial and no SMS dispatch.

Native builds disable all ad delivery and impression tracking so web purchases do not unlock native ad removal. Crash route capture excludes query/hash tokens. Native privacy manifests now declare actual collection categories; camera/location permission strings included in uploaded archives. Required-reason API inventory and independent privacy review remain open.

Validation: 335 Node tests and 350 component tests passed (685 total); focused tests repeated after AI timeout adjustment. Production web build and native bundle checks passed. npm audit reported zero vulnerabilities within its package scope. Existing focused lint warnings remain; no lint errors.

Live synthetic AI check returned a grocery proposal in 1.32 seconds, without an automatic grocery write. Earlier runs failed, so this single successful sample does not establish reliability or device voice latency. Requests now prefer bounded low-reasoning Groq calls, with bounded xAI backup. Temporary privileged readiness probe was removed after use.

Mac 1.0.0 build 10 and iPhone 1.0.0 build 16 uploaded successfully. Both include helper removal, Month view fixes and consent-gated three-minute realtime Mia preview. Actual TestFlight installation/device checks remain pending. Mac upload warned about missing dSYM; symbolication remains unresolved. Existing build 9/15 review submissions were not replaced during this step.

Alex Vorobiev assigned privacy/security operations owner. Legal reviewer and provider agreement/retention evidence remain unconfirmed. AI Chat/Voice/Both prices are not configured in Stripe, sandbox payment verification is unavailable, and paid checkout remains disabled. No compliance certification or store approval is asserted.
