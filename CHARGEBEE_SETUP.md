# Chargebee billing migration

Chargebee is no longer the active FamOS billing provider. New signup, onboarding trials, subscription changes, customer billing management, promotions, refunds, and entitlement synchronization use Stripe.

Use [STRIPE_SETUP.md](./STRIPE_SETUP.md) for the current catalog, secrets, webhook, deployment, and test instructions.

The legacy Chargebee Edge Functions, columns, and historical migrations remain in the repository so existing records can be reconciled safely. Do not add new Chargebee secrets, connect new Chargebee webhooks, or use the legacy checkout and portal functions for new customers.
