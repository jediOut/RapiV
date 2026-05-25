# Payments Architecture

Payments are intentionally split into three paths:

1. The authenticated API creates a Stripe Checkout Session with an `Idempotency-Key` and a Connect `transfer_group`.
2. The public webhook stores Stripe events after `Stripe-Signature` verification and deduplicates them by provider event id.
3. The worker queue processes stored events and updates local payment/order state outside the webhook request.

The backend never accepts or stores card numbers, CVV, expiration dates, or bank account credentials. Clients must send card data directly to the payment provider SDK and only send the provider payment reference or intent result to this API.

Local state is not the source of truth for card authorization. The Stripe Checkout Session lookup triggered by the webhook is the source of truth for final payment status.

For marketplace orders, each business order becomes one Stripe Connect transfer. The customer still pays once in Checkout; after the Checkout Session is paid, the worker creates one transfer per business using the same `transfer_group`. The amount left on the platform is the configured RapiV fee plus Stripe fees.

Required environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_APP_URL`, used to build Checkout success and cancel redirect URLs
- `BUSINESS_APP_URL`, used to build Stripe Connect onboarding return and refresh URLs
- `RAPIV_PLATFORM_FEE_BPS`, optional platform fee in basis points, for example `1000` for 10%
