# Billing tab restoration — November 25, 2026

Cause: native distribution guards hid both the Plan & billing tab and its entire section, removing subscription status and usage alongside checkout offers.

Restored the Settings tab and billing section for every distribution. Native builds show Core availability, an existing subscription record when present, renewal/status and usage information. Existing subscription owners can contact billing/cancellation support; native checkout, promo codes, legacy paid comparisons and unreleased AI offers remain excluded. No native purchase, restore, or cancellation API is represented as implemented. Web owners retain the existing billing portal; removed its duplicate button. Core-only accounts no longer display a paid-subscription management button.

Validation: nine focused component tests and 24 billing/Stripe Node tests passed. Native Settings test selects the actual tab and checks for account status with no purchase/promo controls. Existing trial and owner-only web management tests pass. Focused lint has existing Settings warnings and no errors. Native distribution bundles and release archives are being prepared separately; source changes do not alter installed TestFlight apps until updated.

Web deployment: fam-os-dmwjh1h0b, verified both canonical hosts serve the updated Settings bundle. Both native release bundles contain the restored plan summary and navigation. Mac 1.0.0 build 11 uploaded successfully; upload reported the existing missing-dSYM warning. iPhone 1.0.0.17 uploaded successfully. Apple processing/new-build device readback pending.

TestFlight refresh now identifies the installed build 10 correctly. Automatic Updates restored to on (its original setting); build 11 had not yet appeared at the time of readback. The billing restoration is not claimed verified in an installed native app yet.
