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
- `BUSINESS_APP_URL`, used to build business Stripe Connect onboarding return and refresh URLs
- `COURIER_APP_URL`, used to build courier Stripe Connect onboarding return and refresh URLs
- `RAPIV_PLATFORM_FEE_BPS`, card platform fee in basis points, for example `1000` for 10%
- `RAPIV_CASH_PLATFORM_FEE_BPS`, cash platform fee in basis points, for example `500` for 5%; when omitted, cash uses `RAPIV_PLATFORM_FEE_BPS`
- `CASH_SETTLEMENT_CUTOFF_HOUR`, local hour for daily cash settlement cutoffs, default `22`
- `CASH_SETTLEMENT_CUTOFF_MINUTE`, local minute for daily cash settlement cutoffs, default `0`
- `CASH_SETTLEMENT_GRACE_MINUTES`, minutes after cutoff before blocking new delivery offers, default `30`
- `CASH_SETTLEMENT_TIMEZONE_OFFSET_MINUTES`, local timezone offset from UTC, default `-360` for Mexico City standard time
- `CASH_SETTLEMENT_AUTO_RUN`, set to `false` to disable automatic daily cash settlement generation
- `BUSINESS_CASH_PAYOUT_TIMEOUT_MINUTES`, minutes after cash collection before blocking new orders when a business payout is not confirmed, default `120`
- `BUSINESS_COMMISSION_SETTLEMENT_DAY_OF_WEEK`, weekly business commission cutoff day, where `0` is Sunday and `1` is Monday, default `1`
- `BUSINESS_COMMISSION_SETTLEMENT_CUTOFF_HOUR`, local hour for weekly business commission cutoffs, default `10`
- `BUSINESS_COMMISSION_SETTLEMENT_CUTOFF_MINUTE`, local minute for weekly business commission cutoffs, default `0`
- `BUSINESS_COMMISSION_SETTLEMENT_TIMEZONE_OFFSET_MINUTES`, local timezone offset from UTC, default `-360` for Mexico City standard time
- `BUSINESS_COMMISSION_SETTLEMENT_AUTO_RUN`, set to `false` to disable automatic weekly business commission generation
- `DELIVERY_FEE_CENTS`, fixed customer delivery fee for the order group, for example `3000` for MXN 30
- `COURIER_PAYOUT_CENTS`, fixed courier payout recorded as pending, for example `2000` for MXN 20

For cash orders, the customer pays the courier at delivery. RapiV commission is discounted from the business payout (`businessPayoutCents = subtotalCents - businessCommissionCents`) so the business receives its net amount without Stripe being involved.

Daily cash settlement runs after the configured cutoff, for example 10:00 pm. Each courier settlement groups delivered cash order groups for the previous 24-hour cutoff window and records:

- cash collected from customers
- change returned to customers
- net payout delivered to businesses
- RapiV business commission
- courier delivery payout
- platform delivery margin
- net cash due to RapiV

Couriers receive a push notification when a pending cash settlement is generated. If it remains pending after the grace window, for example 10:30 pm, the courier can still use the app but stops receiving and accepting new orders until an admin confirms the settlement.

For cash orders, each business owner must confirm receipt of its business payout. If the courier collects cash and the business payout remains pending beyond `BUSINESS_CASH_PAYOUT_TIMEOUT_MINUTES`, the courier stops receiving and accepting new orders until the business confirms the payout.

For pickup cash orders, the customer pays the business directly when collecting the order. The business keeps the full cash amount at that moment, and RapiV commission is accumulated in a weekly business commission settlement. By default, the backend generates that weekly settlement every Monday at 10:00 local time for pickup cash orders that are paid and delivered during the previous weekly window. Admins can confirm the settlement after the business pays RapiV.
