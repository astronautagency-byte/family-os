# FamAI product-page rebuild — 2026-11-07

The old live route rendered with a cream background and pale copy because generic landing-page CSS loaded after the page stylesheet. Its inherited body overflow also prevented sticky scroll scenes from pinning. Verified with isolated headless inspection of the canonical live page.

Rebuilt the page with isolated near-black surfaces, dimensional voice/chat phone mockups, a luminous geometric voice sculpture, a pinned voice-to-event-review scene, scroll-linked phone transforms, interactive household examples, distinct chat/voice/both planned add-ons, pause control and reduced-motion layout. Removed the generic landing-page class and stylesheet imports. The document overflow override is scoped to this page, has enough specificity to beat the product's scroll-unfreeze rule, and excludes scroll-locked body states.

Validation: production build and public-route SEO checks passed; 304 Node tests and 280 component tests passed. Focused page tests cover preview switching, separate safe add-on selection and pause/resume. Headless production-build checks at 1440x1000 and 390x844 confirmed near-black rgb(5,5,6), pinned scene at y=0 after scrolling, no runtime errors and no horizontal overflow. Desktop, phone and reduced-motion layouts reviewed. Screens use illustrative data, never microphone access or writes. Approved planned prices unchanged; checkout is not enabled.

Actual customer-browser rendering must be checked on canonical production after publication.
