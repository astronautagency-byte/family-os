# FamOS GDPR and AI age/privacy review

7 November 2026. This is an implementation and gap record, not certification or a legal opinion.

## Business and scope confirmed by operator

Astronaut Digital Inc., 164 McCaffrey Road, Newmarket, Ontario L3X 1K2, Canada. Privacy contact: support@fam-os.app. Operator states FamOS is not actively targeting EU or UK households. Mere availability does not by itself decide territorial scope: assess offering services or monitoring people in those territories under GDPR Article 3 and the UK rules before any expansion. Do not advertise GDPR compliance as established by this change.

## Provider distinctions

- Google Gemini API/AI Studio terms restrict under-18 use and API clients directed at or likely to be accessed by under-18s. Consumer Google-account age rules do not override API restrictions. Gemini is not in the reviewed active AI call paths.
- OpenAI's under-18 API guidance requires safeguards for minors and Zero Data Retention before processing personal data of children under 13 or the applicable digital-consent age. This applies to children's data submitted by an adult too; an adult login alone is insufficient. The reviewed OpenAI call path is voice-note transcription, not Groq-hosted open-weight models.
- Anthropic's consumer Claude terms are 18+, but third-party API products serving minors have separate additional safeguards. No Anthropic API use was found in the reviewed call paths.
- Consumer and Education Copilot ages are product-specific. No Copilot integration was found in the reviewed call paths.
- Reviewed production code calls Groq and xAI for chat, text-to-speech, images and selected meal generation. Their commercial terms, DPAs, model terms, data settings and processing locations must be reviewed independently of the consumer services above.

## Implemented controls

- Versioned per-user adult attestation and optional AI-processing choice, separate unchecked checkboxes, status lookup and withdrawal. Known child/teen roles and known ages/DOB below 18 are ineligible. No extra DOB or identity documents are collected for this declaration. Self-attestation is not verified age assurance or verified parental consent.
- Row-level security on choice records; no client table writes; authenticated RPC validates eligibility and requires both booleans explicitly true. Choice is checked server-side before provider calls on all reviewed interactive external AI endpoints. A changed role/age, withdrawal, missing record or lookup failure blocks AI. Ordinary non-AI features remain separate.
- Voice pauses when AI privacy choices are opened or withdrawn. AI Chat and Mia show choices before their controls; Settings → Account exposes management for the other optional AI features.
- AI Chat stops automatically sending household members, tasks, meals, calendar locations and notes. Server whitelist strips the legacy snapshot from older clients too. User-entered prompts and images may still contain personal information; notices warn against children's personal data and sensitive material.
- OpenAI voice-note transcription is paused by default unless OPENAI_TRANSCRIPTION_PRIVACY_APPROVED is explicitly true. Do not enable until the relevant account controls, applicable ZDR eligibility, children's-data restrictions and notices are verified. Saved voice-note playback remains separate.
- Automatic inbound-email AI extraction is paused by default unless INBOUND_AI_PRIVACY_APPROVED is explicitly true. Do not enable until sender/webhook verification, recipient authorization, notice and third-party/children's-data safeguards are reviewed. An owner's AI choice alone does not authorize processing everyone mentioned in an email.
- Privacy policy and terms now identify the controller/address and describe lawful-basis categories, recipients, international processing, helper access, voice categories, retention criteria, GDPR rights and complaint routes. Corrected obsolete pricing and preserved mandatory consumer rights.

## Required operational work before a GDPR-compliance claim / EU-UK launch

1. **Accountability and lawful basis:** assign a privacy owner and maintain an Article 30 processing register. Record the basis and necessity for each purpose, including child profiles and inferred health/allergy information. Complete legitimate-interest assessments where used; obtain separate explicit consent or another valid Article 9 condition for special-category data where applicable. A generic AI opt-in does not meet every lawful-basis requirement.
2. **Children and age assurance:** assess proportionate age assurance and parent/guardian verification for child core accounts, country-specific consent ages and child-friendly notices. Document under-18 access controls and abuse/bypass handling. Adults must not submit children's data to AI merely because they can consent for themselves.
3. **Processors/transfers:** verify signed/incorporated Article 28 DPAs, current subprocessors, real processing/backup/support locations and AI data-control settings. Document adequacy or SCCs/UK addendum/IDTA and transfer risk assessments/supplementary measures as applicable. Do not claim ZDR, EU-only storage or no provider training without account-specific evidence.
4. **Retention/deletion:** set category-specific schedules, execute and monitor deletion jobs, verify file/object storage cleanup, family shared-content handling, account deletion, delivery logs, analytics and processor erasure. Record backup windows and restoration re-deletion procedures. Current generic criteria do not establish all operational deadlines.
5. **Rights:** operate the support mailbox as a DSAR channel with a request log, identity-check procedure, access/portable-export assembly, correction/restriction/objection/erasure process and one-month response tracking. Test a full request across database, files, AI history, provider logs and backups without disclosing another member's data. No complete automatic export was established in this review.
6. **DPIA and security:** assess/document whether a DPIA is required for children's data, optional location and household AI; complete it before any high-risk processing. Maintain incident response, processor escalation, breach assessment and notification procedures (including applicable 72-hour authority notification). Review access, auditability, vulnerability management and browser/device storage.
7. **EU/UK representation and notices:** assess Article 27 representatives separately in EU and UK and Article 37 DPO criteria before targeting those territories. Confirm actual controller details remain current. Add separate marketing/analytics consent and suppression if non-essential tracking or marketing is introduced; do not treat these legal updates as marketing opt-in.
8. **Governance:** legal review of notices, consumer subscription rules and provider contracts; verify material-change notification and fresh consent where required. Publishing policies and passing technical tests do not demonstrate all the operational requirements above.

## Primary references checked

- GDPR, especially Articles 3, 5–9, 12–22, 25, 27–30, 32–37, 44–49: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- EDPB age assurance: https://www.edpb.europa.eu/our-work-tools/our-documents/statements/statement-12025-age-assurance_en
- Google API terms: https://ai.google.dev/gemini-api/terms
- OpenAI under-18 API guidance: https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance
- Anthropic API minors guidance: https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors
- Copilot consumer terms: https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/termsofuse
- Groq agreement/data controls: https://console.groq.com/docs/legal/services-agreement and https://console.groq.com/docs/your-data
- xAI enterprise FAQ/DPA: https://x.ai/legal/faq-enterprise and https://x.ai/legal/data-processing-addendum

## Verification evidence

- 40 component tests (privacy choice UI, withdrawal, failure recovery, voice controls and marketing regression) and 19 Node tests (context minimisation, guards and voice parsing) passed.
- Production build and public-page metadata checks completed. Focused lint has no errors; existing hook/unused-variable warnings remain.
- Controlled synthetic household: AI was off initially; incomplete and null declarations were rejected; direct consent-table inserts were denied; adult acceptance passed the API gate; a known teen profile was denied despite an earlier acceptance; the teen could not consent; withdrawal blocked the next API request.
- In isolated headless Chrome, UI opt-in and withdrawal persisted and were enforced by the server. Grocery, meal, task and event additions each remained pending until confirmed and produced exactly one database record. Layout fit 320, 390 and 1440px. Deleted the synthetic account/household after testing.
