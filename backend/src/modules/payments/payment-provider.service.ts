import { Injectable } from "@nestjs/common";

type CreateProviderPaymentInput = {
  localPaymentId: string;
  idempotencyKey: string;
  orderGroupId: string;
  amountCents: number;
  currency: string;
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
  status: "approved" | "pending" | "in_process" | "rejected" | "cancelled" | "refunded" | string;
  amountCents?: number;
  currency?: string;
  raw: Record<string, unknown>;
};

@Injectable()
export class PaymentProviderService {
  readonly providerName = "mercadopago";

  async createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error("Missing MERCADOPAGO_ACCESS_TOKEN");
    }

    const notificationBaseUrl = process.env.PUBLIC_API_URL;
    const notificationUrl = notificationBaseUrl
      ? `${notificationBaseUrl.replace(/\/$/, "")}/api/payments/webhooks/provider`
      : undefined;

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.idempotencyKey
      },
      body: JSON.stringify({
        items: [
          {
            id: input.orderGroupId,
            title: `Pedido RapiV ${input.orderGroupId.slice(0, 8)}`,
            quantity: 1,
            unit_price: input.amountCents / 100,
            currency_id: input.currency
          }
        ],
        external_reference: input.localPaymentId,
        notification_url: notificationUrl,
        metadata: {
          payment_id: input.localPaymentId,
          order_group_id: input.orderGroupId
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago preference failed with status ${response.status}`);
    }

    const preference = (await response.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
    };
    const isTestToken = accessToken.startsWith("TEST-");
    const checkoutUrl = isTestToken
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point ?? preference.sandbox_init_point;

    if (!checkoutUrl) {
      throw new Error("Mercado Pago preference did not return a checkout URL");
    }

    return {
      provider: this.providerName,
      providerPaymentId: preference.id,
      checkoutUrl,
      clientSecret: checkoutUrl,
      status: "REQUIRES_ACTION",
      metadata: {
        preferenceId: preference.id,
        checkoutUrl,
        orderGroupId: input.orderGroupId,
        amountCents: input.amountCents,
        currency: input.currency
      }
    };
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentDetails> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error("Missing MERCADOPAGO_ACCESS_TOKEN");
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${providerPaymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago payment lookup failed with status ${response.status}`);
    }

    const payment = (await response.json()) as Record<string, unknown>;
    const transactionAmount = Number(payment.transaction_amount);

    return {
      providerPaymentId: String(payment.id),
      externalReference: String(payment.external_reference ?? ""),
      status: String(payment.status),
      amountCents: Number.isFinite(transactionAmount) ? Math.round(transactionAmount * 100) : undefined,
      currency: typeof payment.currency_id === "string" ? payment.currency_id : undefined,
      raw: payment
    };
  }

  async findPaymentForLocalPayment(
    localPaymentId: string,
    providerReference: string
  ): Promise<ProviderPaymentDetails> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error("Missing MERCADOPAGO_ACCESS_TOKEN");
    }

    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(localPaymentId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Mercado Pago payment search failed with status ${response.status}`);
    }

    const search = (await response.json()) as { results?: Array<Record<string, unknown>> };
    const [payment] = search.results ?? [];

    if (payment?.id) {
      return this.getPayment(String(payment.id));
    }

    if (this.looksLikeMercadoPagoPaymentId(providerReference)) {
      return this.getPayment(providerReference);
    }

    return {
      providerPaymentId: providerReference,
      externalReference: localPaymentId,
      status: "pending",
      raw: {}
    };
  }

  private looksLikeMercadoPagoPaymentId(providerReference: string): boolean {
    return /^\d+$/.test(providerReference);
  }
}
