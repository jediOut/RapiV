# Payments Architecture

Payments are intentionally split into three paths:

1. The authenticated API creates a Mercado Pago Checkout Pro preference with an `Idempotency-Key`.
2. The public webhook stores Mercado Pago events after `x-signature` verification and deduplicates them by provider event id.
3. The worker queue processes stored events and updates local payment/order state outside the webhook request.

The backend never accepts or stores card numbers, CVV, expiration dates, or bank account credentials. Clients must send card data directly to the payment provider SDK and only send the provider payment reference or intent result to this API.

Local state is not the source of truth for card authorization. The Mercado Pago payment lookup triggered by the webhook is the source of truth for final payment status.

Required environment variables:

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `PUBLIC_API_URL`, used to build the Checkout Pro `notification_url`
