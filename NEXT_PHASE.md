# FamOS prioritized next phase

The cohesive coordination MVP is runnable. The following work remains, in priority order.

1. Apply and validate `202608020001_coordination_mvp.sql` against a staging Supabase project, including adversarial tests for teen, adult, owner, selected-member, private, and guardian-only access.
2. Move list-item editing, transportation changes, readiness updates, notification records/preferences, and all activity-log writes into database RPCs so each mutation and its audit entry commit atomically.
3. Add server-side Smart Capture processing for screenshots, images, PDFs, and voice. Keep files private in object storage, use short-lived signed URLs, validate structured output, highlight uncertainty, and preserve the current explicit review step.
4. Complete invitation role/age-group onboarding and self-service privacy controls for teen and adult accounts, including availability-only calendar sharing.
5. Complete the guided Weekly Game Plan, recurring routine instantiation, travel-time calculation, driver overlap detection, caregiver confirmation, and publish/share output.
6. Add selective Google and Outlook calendar connections with read-only/read-write choice per calendar and availability-only sharing.
7. Add dedicated integration and browser tests for Add, review/approval, keyboard navigation, small screens, search visibility, and notification quiet hours.

Explicitly out of scope remains: inbox access, private-message ingestion, continuous location, health records, budgeting/banking, social feed, marketplace/ads, autonomous purchases/messages/schedule changes, and photo-library storage.
