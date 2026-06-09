import { Injectable } from "@nestjs/common";

export type PaymentSplit = {
  businessId: string;
  connectedAccountId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  transferAmountCents: number;
};

type CreateProviderPaymentInput = {
  localPaymentId: string;
  idempotencyKey: string;
  orderGroupId: string;
  amountCents: number;
  currency: string;
  splits: PaymentSplit[];
};

export type ProviderPayment = {
  provider: string;
  providerPaymentId: string;
  checkoutUrl: string;
  clientSecret: string;
  status: "REQUIRES_ACTION" | "PROCESSING";
  metadata: Record<string, unknown>;
};

export type ProviderPaymentDetails = {
  providerPaymentId: string;
  externalReference: string;
  status: "paid" | "unpaid" | "expired" | "open" | "complete" | string;
  amountCents?: number;
  currency?: string;
  latestChargeId?: string;
  raw: Record<string, unknown>;
};

export type ProviderRefund = {
  providerRefundId: string;
  status: string;
  raw: Record<string, unknown>;
};

export type ProviderTransfer = {
  businessId: string;
  connectedAccountId: string;
  providerTransferId: string;
  amountCents: number;
};

export type ProviderCourierTransfer = {
  courierId: string;
  connectedAccountId: string;
  providerTransferId: string;
  amountCents: number;
};

export type ProviderTransferReversal = {
  businessId: string;
  providerTransferId: string;
  providerTransferReversalId: string;
  amountCents: number;
  status: string;
};

@Injectable()
export class PaymentProviderService {
  readonly providerName = "stripe";

  async createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment> {
    const apiKey = this.requireStripeSecretKey();
    const transferGroup = this.transferGroupForOrder(input.orderGroupId);
    const returnBaseUrl = this.requirePaymentReturnBaseUrl();
    const successUrl = `${returnBaseUrl}/payments/stripe-return?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${returnBaseUrl}/payments/stripe-cancelled?orderGroupId=${input.orderGroupId}`;

    const session = await this.stripeRequest<Record<string, unknown>>(
      "/v1/checkout/sessions",
      {
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: input.localPaymentId,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": input.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(input.amountCents),
        "line_items[0][price_data][product_data][name]": `Pedido RapiV ${input.orderGroupId.slice(0, 8)}`,
        "payment_intent_data[transfer_group]": transferGroup,
        "payment_intent_data[metadata][payment_id]": input.localPaymentId,
        "payment_intent_data[metadata][order_group_id]": input.orderGroupId,
        "metadata[payment_id]": input.localPaymentId,
        "metadata[order_group_id]": input.orderGroupId
      },
      apiKey,
      input.idempotencyKey
    );

    const sessionId = this.stringField(session, "id");
    const checkoutUrl = this.stringField(session, "url");

    if (!sessionId || !checkoutUrl) {
      throw new Error("Stripe Checkout Session did not return an id and URL");
    }

    return {
      provider: this.providerName,
      providerPaymentId: sessionId,
      checkoutUrl,
      clientSecret: checkoutUrl,
      status: "REQUIRES_ACTION",
      metadata: {
        checkoutSessionId: sessionId,
        checkoutUrl,
        orderGroupId: input.orderGroupId,
        amountCents: input.amountCents,
        currency: input.currency,
        transferGroup,
        transferSplits: input.splits
      }
    };
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentDetails> {
    const apiKey = this.requireStripeSecretKey();
    const session = await this.stripeGet<Record<string, unknown>>(
      `/v1/checkout/sessions/${encodeURIComponent(providerPaymentId)}`,
      apiKey,
      {
        "expand[]": ["payment_intent.latest_charge"]
      }
    );

    return this.paymentDetailsFromSession(session);
  }

  async getPlatformAccountId(): Promise<string> {
    const apiKey = this.requireStripeSecretKey();
    const account = await this.stripeGet<Record<string, unknown>>("/v1/account", apiKey);
    const accountId = this.stringField(account, "id");

    if (!accountId) {
      throw new Error("Stripe did not return a platform account id");
    }

    return accountId;
  }

  async findPaymentForLocalPayment(
    localPaymentId: string,
    providerReference: string
  ): Promise<ProviderPaymentDetails> {
    if (providerReference.startsWith("cs_")) {
      return this.getPayment(providerReference);
    }

    const apiKey = this.requireStripeSecretKey();
    const sessions = await this.stripeGet<{ data?: Array<Record<string, unknown>> }>(
      "/v1/checkout/sessions",
      apiKey,
      {
        client_reference_id: localPaymentId,
        limit: "1",
        "expand[]": ["data.payment_intent.latest_charge"]
      }
    );
    const [session] = sessions.data ?? [];

    if (session) {
      return this.paymentDetailsFromSession(session);
    }

    return {
      providerPaymentId: providerReference,
      externalReference: localPaymentId,
      status: "open",
      raw: {}
    };
  }

  async createTransfersForPayment(input: {
    localPaymentId: string;
    orderGroupId: string;
    providerPaymentId: string;
    latestChargeId?: string;
    currency: string;
    splits: PaymentSplit[];
  }): Promise<ProviderTransfer[]> {
    const apiKey = this.requireStripeSecretKey();
    const transferGroup = this.transferGroupForOrder(input.orderGroupId);
    const transfers: ProviderTransfer[] = [];

    for (const split of input.splits) {
      if (split.transferAmountCents <= 0) {
        continue;
      }

      const transfer = await this.stripeRequest<Record<string, unknown>>(
        "/v1/transfers",
        {
          amount: String(split.transferAmountCents),
          currency: input.currency.toLowerCase(),
          destination: split.connectedAccountId,
          transfer_group: transferGroup,
          ...(input.latestChargeId ? { source_transaction: input.latestChargeId } : {}),
          "metadata[payment_id]": input.localPaymentId,
          "metadata[order_group_id]": input.orderGroupId,
          "metadata[business_id]": split.businessId
        },
        apiKey,
        `transfer-${input.localPaymentId}-${split.businessId}`
      );

      transfers.push({
        businessId: split.businessId,
        connectedAccountId: split.connectedAccountId,
        providerTransferId: this.stringField(transfer, "id") ?? "",
        amountCents: split.transferAmountCents
      });
    }

    return transfers;
  }

  async createCourierTransferForPayment(input: {
    localPaymentId: string;
    orderGroupId: string;
    courierId: string;
    connectedAccountId: string;
    providerPaymentId: string;
    latestChargeId?: string;
    currency: string;
    amountCents: number;
  }): Promise<ProviderCourierTransfer> {
    const apiKey = this.requireStripeSecretKey();
    const transferGroup = this.transferGroupForOrder(input.orderGroupId);
    const transfer = await this.stripeRequest<Record<string, unknown>>(
      "/v1/transfers",
      {
        amount: String(input.amountCents),
        currency: input.currency.toLowerCase(),
        destination: input.connectedAccountId,
        transfer_group: transferGroup,
        ...(input.latestChargeId ? { source_transaction: input.latestChargeId } : {}),
        "metadata[payment_id]": input.localPaymentId,
        "metadata[order_group_id]": input.orderGroupId,
        "metadata[courier_id]": input.courierId,
        "metadata[payout_type]": "courier_delivery"
      },
      apiKey,
      `courier-transfer-${input.orderGroupId}-${input.courierId}`
    );

    return {
      courierId: input.courierId,
      connectedAccountId: input.connectedAccountId,
      providerTransferId: this.stringField(transfer, "id") ?? "",
      amountCents: input.amountCents
    };
  }

  async refundPayment(
    providerPaymentId: string,
    idempotencyKey: string,
    transfers: ProviderTransfer[] = []
  ): Promise<ProviderRefund> {
    const apiKey = this.requireStripeSecretKey();
    const details = await this.getPayment(providerPaymentId);
    const paymentIntent = this.objectField(details.raw, "payment_intent");
    const paymentIntentId = typeof details.raw.payment_intent === "string"
      ? details.raw.payment_intent
      : this.stringField(paymentIntent, "id");

    if (!paymentIntentId) {
      return {
        providerRefundId: `pending-${providerPaymentId}`,
        status: "PENDING_PROVIDER_PAYMENT_ID",
        raw: {
          reason: "Stripe payment intent is not available yet",
          providerPaymentId
        }
      };
    }

    const refund = await this.stripeRequest<Record<string, unknown>>(
      "/v1/refunds",
      { payment_intent: paymentIntentId },
      apiKey,
      idempotencyKey
    );
    const reversals: ProviderTransferReversal[] = [];

    for (const transfer of transfers) {
      if (!transfer.providerTransferId || transfer.amountCents <= 0) {
        continue;
      }

      const reversal = await this.stripeRequest<Record<string, unknown>>(
        `/v1/transfers/${encodeURIComponent(transfer.providerTransferId)}/reversals`,
        { amount: String(transfer.amountCents) },
        apiKey,
        `${idempotencyKey}:transfer:${transfer.businessId}`
      );

      reversals.push({
        businessId: transfer.businessId,
        providerTransferId: transfer.providerTransferId,
        providerTransferReversalId: this.stringField(reversal, "id") ?? "",
        amountCents: transfer.amountCents,
        status: this.stringField(reversal, "status") ?? "unknown"
      });
    }

    return {
      providerRefundId: this.stringField(refund, "id") ?? "",
      status: this.stringField(refund, "status") ?? "unknown",
      raw: {
        refund,
        transferReversals: reversals
      }
    };
  }

  private paymentDetailsFromSession(session: Record<string, unknown>): ProviderPaymentDetails {
    const amountTotal = Number(session.amount_total);
    const paymentStatus = this.stringField(session, "payment_status");
    const status = paymentStatus === "paid" ? "paid" : this.stringField(session, "status") ?? "open";
    const paymentIntent = this.objectField(session, "payment_intent");
    const latestCharge = this.objectField(paymentIntent, "latest_charge");

    return {
      providerPaymentId: this.stringField(session, "id") ?? "",
      externalReference: this.stringField(session, "client_reference_id") ?? "",
      status,
      amountCents: Number.isFinite(amountTotal) ? Math.round(amountTotal) : undefined,
      currency: this.stringField(session, "currency")?.toUpperCase(),
      latestChargeId: this.stringField(latestCharge, "id"),
      raw: session
    };
  }

  private async stripeRequest<T>(
    path: string,
    params: Record<string, string>,
    apiKey: string,
    idempotencyKey: string
  ): Promise<T> {
    const response = await fetch(`https://api.stripe.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey
      },
      body: new URLSearchParams(params)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Stripe request failed with status ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  private async stripeGet<T>(
    path: string,
    apiKey: string,
    params: Record<string, string | string[]> = {}
  ): Promise<T> {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          query.append(key, item);
        }
      } else {
        query.append(key, value);
      }
    }

    const response = await fetch(`https://api.stripe.com${path}${query.size ? `?${query}` : ""}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Stripe lookup failed with status ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  private transferGroupForOrder(orderGroupId: string): string {
    return `ORDER_${orderGroupId}`;
  }

  private requireStripeSecretKey(): string {
    const apiKey = process.env.STRIPE_SECRET_KEY;

    if (!apiKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    return apiKey;
  }

  private requirePaymentReturnBaseUrl(): string {
    const configured = process.env.PUBLIC_API_URL ?? process.env.PUBLIC_APP_URL ?? process.env.CLIENT_APP_URL;

    if (!configured) {
      throw new Error("Missing PUBLIC_API_URL for Stripe Checkout return URLs");
    }

    const normalized = configured.replace(/\/$/, "");

    if (!normalized.startsWith("https://")) {
      throw new Error("PUBLIC_API_URL must be an HTTPS URL for Stripe Checkout return URLs");
    }

    return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
  }

  private stringField(source: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = source?.[key];
    return typeof value === "string" ? value : undefined;
  }

  private objectField(source: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
    const value = source?.[key];
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
  }
}
