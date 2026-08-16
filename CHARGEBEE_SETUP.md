# FamOS Chargebee setup

FamOS uses Chargebee Product Catalog 2.0 and Hosted Pages. API keys stay in Supabase Edge Function secrets and are never shipped to the browser.

## Product catalog

Create one product family named `FamOS`, then create these flat-fee recurring items and monthly CAD price points:

| Item | Suggested item price ID | Price |
| --- | --- | ---: |
| FamOS Free | `famos-free-cad-monthly` | $0.00 |
| Meal planning | `famos-meals-cad-monthly` | $4.99 |
| FamAI | `famos-famai-cad-monthly` | $4.99 |
| Family tools | `famos-family-cad-monthly` | $4.99 |

The free item is the base plan. Calendar, Tasks, Shopping, Chat, and Kitchen Watch are included. The three paid items are recurring add-ons. Configure the Chargebee portal to permit add-on changes and cancellation.

## Supabase secrets

Set these only in Supabase project secrets:

```text
CHARGEBEE_SITE=<your Chargebee site prefix>
CHARGEBEE_API_KEY=<test or live secret API key>
CHARGEBEE_WEBHOOK_AUTH=<random username:password value>
CHARGEBEE_ITEM_FREE_BASE=famos-free-cad-monthly
CHARGEBEE_ITEM_MEALS=famos-meals-cad-monthly
CHARGEBEE_ITEM_FAMAI=famos-famai-cad-monthly
CHARGEBEE_ITEM_FAMILY=famos-family-cad-monthly
FRONTEND_URL=https://fam-os.app
```

Deploy `chargebee-checkout`, `chargebee-portal`, and `chargebee-webhook` after applying migration `202608150006_chargebee_feature_billing.sql`.

## Webhook

Create a Chargebee v2 webhook pointing to:

```text
https://<supabase-project-ref>.supabase.co/functions/v1/chargebee-webhook
```

Enable Basic Authentication. Use the same `username:password` stored in `CHARGEBEE_WEBHOOK_AUTH`. Subscribe to subscription created, changed, renewed, cancelled, reactivated, paused, resumed, and payment-failed events. The handler retrieves every event from Chargebee before changing entitlements, so forged or modified request bodies are rejected.

## Test before live mode

Use the Chargebee test site and Time Machine to verify purchase, renewal, failed payment, cancellation, and reactivation. Test and live API keys and catalogs are separate; replace all secrets with live values only after the test lifecycle passes.
