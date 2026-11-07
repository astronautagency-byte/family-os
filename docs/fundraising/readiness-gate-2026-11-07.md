# Fundraising readiness gate — Astronaut Digital Inc. / FamOS

Reviewed 7 November 2026. **NOT CLEARED for an unconditional “100% compliant”, “GDPR compliant”, “fully secure” or independently audited assurance.** This is an engineering/evidence assessment, not a legal opinion or a determination that fundraising itself is prohibited. Investor conversations and securities transactions need their own accurate disclosures and appropriate advice.

The operator confirmed no legal review is in place yet; no accountable privacy owner was identified. EU/UK households are not actively targeted, but territorial scope still needs assessment. No signed provider contracts were supplied; a narrow connected-mailbox search for relevant DPAs/reviews returned no matches, which is not proof those agreements do not exist.

## Refreshed evidence and limits

| Area | Evidence | Gate |
|---|---|---|
| Four current decks | Rechecked current PPTX hashes, all 113 PDF page counts and ZIP integrity against the validated package; prior image validation confirms ten required embedded product captures per deck; matching PDFs; synthetic data and future-feature labels. Market count independently rechecked against BLS 2025 release. | Product/demo evidence; not an audited commercial or financial statement. |
| Pricing/economics | Base catalog CAD; planned AI add-ons USD. 32.9M × US$120 = US$3.948B rounded US$3.95B; illustrative ARR and referral/fulfillment arithmetic are consistent with stated assumptions. | No verified traction, willingness to pay, partner fees or forecast reliability inferred. |
| Live app and policies | Canonical app bundle matches tested release; privacy/terms controller, address, date, exact listed prices and mobile layout checked again. | Publication is not proof of all operational compliance. |
| Focused privacy/isolation checks | 13 selected Node tests passed this review, including consent/context, legal generation, helper membership guards and scoped local storage. Earlier controlled live household tests are recorded separately. | Not an independent penetration test or full regression certification. |
| Table RLS | Live metadata query found zero ordinary public-schema tables with row security disabled. | Does not establish every policy, RPC or storage bucket is correctly authorized. |
| Security advisor | Before: 170 findings, including one error. After reviewed hardening: 137 warnings, zero errors. | **Open:** warnings need risk-by-risk review; the count is not 137 confirmed exploits. Leaked-password protection remains disabled. |
| Privileged grants | Live anonymous execute permission existed on admin and billing-sync functions. Migration 012 removes PUBLIC/anon execution from admin RPCs, preserves authenticated admin call paths, and restricts Stripe/Chargebee sync to service role. Statistics view uses security_invoker. | Live grant inspection confirms both billing functions reject client execution privileges. Internal admin authorization and real webhook integration still need independent regression assessment. No billing/customer records were changed by the migration. |
| AI diagnostic logs | Removed raw provider error-body reads/logging; deployed fam-ai. Only provider label and HTTP status are logged on this path. | Historical/provider/other-function log retention is not established. No known customer-data incident is asserted. |
| Account deletion | Prior live test confirmed read-state FK blocker repaired and synthetic account/household deletion succeeds. | Storage files, all processors, shared records and backup re-erasure are not comprehensively verified. |
| Native/store declarations | Repository privacy manifest has empty collected-data/API lists. | Must reconcile actual native build/SDK behavior and App Store privacy disclosures; not proof of native approval or a conclusive manifest violation by itself. |

## Blocking evidence / decisions

| Workstream | Completion evidence needed | Accountable party |
|---|---|---|
| Privacy accountability | Named lead, monitored rights mailbox, approved processing register and documented purpose/basis per flow | Operator; not assigned |
| Children | Jurisdiction/applicability assessment, proportionate age assurance, verifiable parental authorization where required, child-friendly notice, sensitive-data handling | Privacy lead + qualified counsel; not appointed |
| Providers | Applicable accepted/signed DPAs, model terms, processor/subprocessor inventory, locations, actual retention/training settings and any transfer mechanisms | Operator + provider account owners + counsel |
| Retention and erasure | Approved category schedules; file/object deletion; full synthetic request across DB, storage, history, deliveries, backups and processors; observed outcomes | Engineering + privacy lead |
| Rights operations | Access/export, correction, restriction, objection and deletion procedures; identity checks; request log and jurisdiction-specific deadlines | Privacy lead + engineering |
| Incident readiness | Named incident contacts, containment and evidence procedures, notification assessment, tabletop exercise and retained records | Operator + engineering + counsel |
| Security | Triage 137 remaining advisor warnings; enable/assess leaked-password control; effective RPC/storage/auth tests; independent assessment and retest of material issues | Engineering + independent security reviewer |
| Legal/commercial disclosures | Reviewed terms/privacy, consumer renewal/refund/trial terms, actual feature availability and material risks | Qualified counsel + operator |
| Raising capital | Confirm issuer/cap table/authority, IP and material-contract evidence; applicable investor/offer jurisdiction and exemption/filing/disclosure requirements | Corporate/securities counsel + operator |

A qualified reviewer should assess which obligations actually apply. Do not convert this list into a generic claim that every law requires identical controls, a DPO, representation or certification.

## Safe investor wording today

“FamOS has implemented and tested selected household access and AI privacy controls. Its privacy, security and legal readiness review remains in progress. Paid AI add-on checkout and provider marketplace bookings/payments are not live. Financial scenarios are illustrative assumptions.”

Do not claim SOC 2, verified zero retention, EU-only processing, verified parental consent, audited revenue, live service partnerships, or completed GDPR/PIPEDA/COPPA compliance without the corresponding evidence.

## Primary references

- BLS 2025 families release, confirmed 32.9 million U.S. families with children under 18: https://www.bls.gov/news.release/archives/famee_04232026.htm
- GDPR accountability, rights, processors and security: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- Canadian privacy principles: https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/
- FTC children’s privacy guidance and link to amended rule: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Ontario securities overview: https://oscinnovation.ca/education/securities

See docs/compliance/gdpr-ai-readiness-2026-11-07.md for the earlier feature-specific evidence and unresolved scope questions. Findings apply to the reviewed configuration/time only.
