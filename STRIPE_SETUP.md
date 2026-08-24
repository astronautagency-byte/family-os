# FamOS Stripe billing setup

FamOS uses Stripe Checkout for new Plus and Pro subscriptions, Stripe Customer Portal for self-service billing, and a signed Stripe webhook to synchronize household entitlements. Stripe secrets stay in Supabase Edge Functions and are never shipped to the browser.

## Catalog

Create four recurring CAD prices in Stripe:

| Environment variable | Product | Billing |
| --- | --- | --- |
| `STRIPE_PRICE_PLUS_MONTHLY` | FamOS Plus | $14.99 / month |
| `STRIPE_PRICE_PLUS_YEARLY` | FamOS Plus | $149 / year |
| `STRIPE_PRICE_PRO_MONTHLY` | FamOS Pro | $19.99 / month |
| `STRIPE_PRICE_PRO_YEARLY` | FamOS Pro | $199 / year |

Core is free and does not need a Stripe price. The onboarding checkout uses Stripe subscription mode, collects a card, and starts a 30-day trial. The first paid invoice is created after the trial unless the customer cancels. Promo codes entered in onboarding use FamOS admin promo codes and bypass checkout entirely when redeemed.

## Supabase secrets

Set these in the live Supabase project:

```text
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS_MONTHLY=price_...
STRIPE_PRICE_PLUS_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
FRONTEND_URL=https://home.fam-os.app
```

Do not place these values in `.env.local`, Vite variables, or committed source. The public `.env.example` only contains placeholders.

## Webhook

Create a Stripe webhook endpoint pointing to:

```text
https://<supabase-project-ref>.supabase.co/functions/v1/stripe-webhook
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

The endpoint verifies `Stripe-Signature`, reads the household metadata written by checkout, and calls the service-role-only `upsert_from_stripe` database function. Stripe never writes directly to the browser or to an unvalidated household id.

## Deploy

Apply migrations first, then deploy the active billing functions:

```bash
supabase db push
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy billing-portal --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy admin-stripe-analytics --no-verify-jwt
supabase functions deploy admin-stripe-portal --no-verify-jwt
supabase functions deploy admin-stripe-refund --no-verify-jwt
```

The old Chargebee functions and columns remain in the repository/database only for historical reconciliation. They are no longer called by onboarding, pricing, Settings, or the active Admin revenue controls.

## Test checklist

Use Stripe test mode and test cards to verify:

1. Owner checkout with monthly Plus and yearly Pro.
2. 30-day card-backed trial and the first invoice after trial expiry.
3. Cancellation and reactivation from Customer Portal.
4. Failed payment and `past_due` entitlement handling.
5. Promo-code redemption without a card.
6. Admin revenue, customer portal, and refund actions.
7. Feature access returning to Core after a trial or promo expiry.
