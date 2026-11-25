# Billing tab restoration — November 25, 2026

Cause: native distribution guards hid both the Plan & billing tab and its entire section, removing subscription status and usage alongside checkout offers.

Restored the Settings tab and billing section for every distribution. Native builds show Core availability, an existing subscription record when present, renewal/status and usage information. Existing subscription owners can contact billing/cancellation support; native checkout, promo codes, legacy paid comparisons and unreleased AI offers remain excluded. No native purchase, restore, or cancellation API is represented as implemented. Web owners retain the existing billing portal; removed its duplicate button. Core-only accounts no longer display a paid-subscription management button.

Validation: nine focused component tests and 24 billing/Stripe Node tests passed. Native Settings test selects the actual tab and checks for account status with no purchase/promo controls. Existing trial and owner-only web management tests pass. Focused lint has existing Settings warnings and no errors. Native distribution bundles and release archives are being prepared separately; source changes do not alter installed TestFlight apps until updated.
