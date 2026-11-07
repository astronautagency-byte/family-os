# Privacy and delivery review — 6 November 2026

This is a working gap assessment, not a legal opinion or certification. Applicability and message classification require review against the actual business and jurisdictions served.

## Changes made

- Product-update email delivery is paused until a lawful sending basis, sender identification, unsubscribe handling and evidence of consent are in place. In-app updates remain available.
- SMS invitations require the inviter to attest that the recipient agreed to the invitation; the attestation and actor are recorded. This is not independent verification of recipient consent.
- Delivery tests require an authenticated user, use their account email and verified phone, and have a per-user server-side cooldown. Provider acceptance is not proof of delivery.
- The privacy notice clarifies Google Calendar access, imported images and AI processing, and gives a privacy contact.

## Open work before claiming compliance or reliable delivery

1. **Messaging:** Inventory all onboarding, invitation, trial and reminder messages; have counsel classify each under CASL and applicable laws. Implement and test consent collection, evidence, suppression, unsubscribe and sender identification wherever required. Verify the invitation SMS STOP process with each provider, and add aggregate abuse limits and delivery monitoring.
2. **Delivery:** Confirm provider accounts, sender-domain verification, authentication and carrier registration; run a controlled email and SMS test and verify receipt, failures and opt-outs. The reminder worker currently delivers web push; email and SMS reminders are not established by this review.
3. **Data mapping:** Document categories, purposes, lawful bases, retention and deletion across the database, backups, storage, analytics, calendar integration, AI and all subprocessors. Confirm processing locations, contracts and international transfer safeguards where applicable.
4. **Rights and children:** Verify end-to-end access, export, correction and deletion workflows, including files and backups; define identity checks, response procedures and applicable rules for children's data and parental authorization.
5. **Operations:** Assign a privacy lead, maintain breach response and incident records, review access and retention, and validate security fixes and monitoring. Have qualified Canadian and EU privacy counsel review the product, notices and operations before making a compliance claim.

## Regulatory references

- [CRTC: CASL consent, identification and unsubscribe requirements](https://crtc.gc.ca/eng/com500/faq500.htm)
- [Office of the Privacy Commissioner: meaningful consent](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/)
- [European Commission: GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
- [European Commission: GDPR applicability](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en)
