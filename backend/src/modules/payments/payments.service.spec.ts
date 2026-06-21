import "reflect-metadata";

import * as assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { Order } from "../orders/order.entity";
import { CourierProfile } from "../users/courier-profile.entity";
import { PaymentEvent } from "./payment-event.entity";
import { Payment } from "./payment.entity";
import { PaymentsService } from "./payments.service";

const customerId = "11111111-1111-4111-8111-111111111111";
const orderGroupId = "22222222-2222-4222-8222-222222222222";

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    userId: customerId,
    orderGroupId,
    amountCents: 2400,
    currency: "MXN",
    status: "REQUIRES_ACTION",
    provider: "sandbox",
    providerPaymentId: "pay_1",
    idempotencyKey: "payment-key-1",
    providerMetadata: {
      transferSplits: [
        {
          businessId: "business-1",
          connectedAccountId: "acct_123",
          grossAmountCents: 2400,
          platformFeeCents: 0,
          transferAmountCents: 2400
        }
      ]
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Payment;
}

function createEvent(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    id: "event-1",
    provider: "sandbox",
    providerEventId: "evt_1",
    type: "payment.succeeded",
    status: "PENDING",
    payload: {
      id: "evt_1",
      type: "payment.succeeded",
      data: { providerPaymentId: "pay_1" }
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as PaymentEvent;
}

function createService(options: {
  payments?: Payment[];
  events?: PaymentEvent[];
  orders?: Order[];
  courierProfiles?: CourierProfile[];
  businesses?: Array<{
    id: string;
    stripeConnectedAccountId?: string;
    stripePlatformAccountId?: string;
    stripeChargesEnabled?: boolean;
  }>;
  orderGroup?: {
    totalCents: number;
    businessOrders: Array<{
      id: string;
      orderGroupId: string;
      businessId: string;
      status: string;
      items: unknown[];
      subtotalCents: number;
    }>;
  };
  scheduleBusinessAcceptanceTimeoutsError?: Error;
  courierPayoutError?: Error;
} = {}) {
  const payments = options.payments ?? [];
  const events = options.events ?? [];
  const courierProfiles = options.courierProfiles ?? [];
  const orders =
    options.orders ??
    ([
      {
        id: "order-1",
        orderGroupId,
        paymentStatus: "UNPAID",
        paidAt: null
      }
    ] as Order[]);
  const queuedEventIds: string[] = [];
  const queuedCourierPayoutOrderGroupIds: string[] = [];
  const scheduledBusinessAcceptanceOrderGroupIds: string[] = [];
  const courierTransferCalls: unknown[] = [];
  const paymentCreateCalls: unknown[] = [];
  const businesses = options.businesses ?? [
    {
      id: "business-1",
      stripeConnectedAccountId: "acct_123",
      stripePlatformAccountId: "acct_platform_1",
      stripeChargesEnabled: true
    }
  ];

  const matches = <T>(entity: T, where: Partial<T>) =>
    Object.entries(where).every(([key, value]) => {
      const currentValue = (entity as unknown as Record<string, unknown>)[key];
      const operator = value as unknown as Record<string, unknown> | null;

      if (operator && typeof operator === "object" && "_type" in operator) {
        if (operator._type === "in" && Array.isArray(operator._value)) {
          return operator._value.includes(currentValue);
        }

        if (operator._type === "lessThan" && operator._value instanceof Date) {
          return currentValue instanceof Date && currentValue.getTime() < operator._value.getTime();
        }
      }

      return currentValue === value;
    });

  const applyFindOptions = <T extends { updatedAt?: Date }>(
    values: T[],
    options?: { where?: Partial<T>; take?: number; order?: { updatedAt?: "ASC" | "DESC" } }
  ) => {
    let result = options?.where ? values.filter((value) => matches(value, options.where ?? {})) : values;

    if (options?.order?.updatedAt) {
      result = [...result].sort((left, right) => {
        const leftTime = left.updatedAt?.getTime() ?? 0;
        const rightTime = right.updatedAt?.getTime() ?? 0;
        return options.order?.updatedAt === "DESC" ? rightTime - leftTime : leftTime - rightTime;
      });
    }

    return typeof options?.take === "number" ? result.slice(0, options.take) : result;
  };

  const paymentRepository = {
    create(value: Partial<Payment>) {
      return {
        id: `payment-${payments.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value
      } as Payment;
    },
    async findOne(options: { where: Partial<Payment> }) {
      return payments.find((payment) => matches(payment, options.where)) ?? null;
    },
    async find(options?: { where?: Partial<Payment>; take?: number; order?: { updatedAt?: "ASC" | "DESC" } }) {
      return applyFindOptions(payments, options);
    },
    async save(payment: Payment) {
      if (
        payments.some(
          (existing) =>
            existing.id !== payment.id &&
            existing.userId === payment.userId &&
            existing.idempotencyKey === payment.idempotencyKey
        )
      ) {
        throw { code: "23505" };
      }

      const existingIndex = payments.findIndex((existing) => existing.id === payment.id);

      if (existingIndex >= 0) {
        payments[existingIndex] = payment;
      } else {
        payments.push(payment);
      }

      return payment;
    }
  };

  const paymentEventRepository = {
    create(value: Partial<PaymentEvent>) {
      return {
        id: `event-${events.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value
      } as PaymentEvent;
    },
    async findOne(options: { where: Partial<PaymentEvent> }) {
      return events.find((event) => matches(event, options.where)) ?? null;
    },
    async save(event: PaymentEvent) {
      if (
        events.some(
          (existing) =>
            existing.id !== event.id &&
            existing.provider === event.provider &&
            existing.providerEventId === event.providerEventId
        )
      ) {
        throw { code: "23505" };
      }

      const existingIndex = events.findIndex((existing) => existing.id === event.id);

      if (existingIndex >= 0) {
        events[existingIndex] = event;
      } else {
        events.push(event);
      }

      return event;
    }
  };

  const businessRepository = {
    async find() {
      return businesses;
    }
  };

  const courierProfileRepository = {
    async findOne(options: { where: Partial<CourierProfile> }) {
      return courierProfiles.find((profile) => matches(profile, options.where)) ?? null;
    }
  };

  const courierWalletTopUpRepository = {
    async findOne() {
      return null;
    },
    create(value: unknown) {
      return value;
    },
    async save(value: unknown) {
      return value;
    }
  };

  const orderRepository = {
    async find(options?: { where?: Partial<Order>; take?: number; order?: { updatedAt?: "ASC" | "DESC" } }) {
      return applyFindOptions(orders, options);
    }
  };

  const manager = {
    async findOne(entity: unknown, options: { where: Record<string, unknown> }) {
      if (entity === Payment) {
        return payments.find((payment) => matches(payment, options.where as Partial<Payment>)) ?? null;
      }

      if (entity === CourierProfile) {
        return courierProfiles.find((profile) => matches(profile, options.where as Partial<CourierProfile>)) ?? null;
      }

      return null;
    },
    async find(entity: unknown, options: { where: Record<string, unknown> }) {
      if (entity === Order) {
        return orders.filter((order) => matches(order, options.where as Partial<Order>));
      }

      return [];
    },
    async save(entity: unknown, value: Payment | PaymentEvent | Order | Order[]) {
      if (entity === Payment) {
        return paymentRepository.save(value as Payment);
      }

      if (entity === PaymentEvent) {
        return paymentEventRepository.save(value as PaymentEvent);
      }

      if (entity === Order) {
        const values = Array.isArray(value) ? value : [value];

        for (const order of values as Order[]) {
          const index = orders.findIndex((existing) => existing.id === order.id);
          if (index >= 0) {
            orders[index] = order;
          }
        }
      }

      return value;
    }
  };

  const dataSource = {
    async transaction<T>(callback: (transactionManager: typeof manager) => Promise<T>) {
      return callback(manager);
    }
  };

  const ordersService = {
    async findByIdForUser() {
      return {
        id: orderGroupId,
        customerId,
        totalCents: options.orderGroup?.totalCents ?? 2400,
        status: "PENDING",
        businessOrders: options.orderGroup?.businessOrders ?? [
          {
            id: "order-1",
            orderGroupId,
            businessId: "business-1",
            status: "PENDING",
            items: [],
            subtotalCents: 2400
          }
        ],
        deliveryAddress: "Calle 1",
        createdAt: new Date()
      };
    },
    async scheduleBusinessAcceptanceTimeouts(nextOrderGroupId: string) {
      if (options.scheduleBusinessAcceptanceTimeoutsError) {
        throw options.scheduleBusinessAcceptanceTimeoutsError;
      }

      scheduledBusinessAcceptanceOrderGroupIds.push(nextOrderGroupId);
      return undefined;
    }
  };

  const providerService = {
    providerName: "sandbox",
    async createPayment(input: unknown) {
      paymentCreateCalls.push(input);
      return {
        provider: "sandbox",
        providerPaymentId: "pay_1",
        checkoutUrl: "https://stripe.test/checkout",
        clientSecret: "secret_1",
        status: "REQUIRES_ACTION",
        metadata: { safe: true }
      };
    },
    async getPayment(providerPaymentId: string) {
      return {
        providerPaymentId,
        externalReference: "payment-1",
        status: "paid",
        amountCents: 2400,
        currency: "MXN",
        latestChargeId: "ch_1",
        raw: { id: providerPaymentId, status: "complete", payment_status: "paid" }
      };
    },
    async findPaymentForLocalPayment(_localPaymentId: string, providerPaymentId: string) {
      return this.getPayment(providerPaymentId);
    },
    async getPlatformAccountId() {
      return "acct_platform_1";
    },
    async createTransfersForPayment() {
      return [
        {
          businessId: "business-1",
          connectedAccountId: "acct_123",
          providerTransferId: "tr_1",
          amountCents: 2400
        }
      ];
    },
    async createCourierTransferForPayment(input: unknown) {
      courierTransferCalls.push(input);
      return {
        courierId: "courier-1",
        connectedAccountId: "acct_courier_1",
        providerTransferId: "tr_courier_1",
        amountCents: 2000
      };
    }
  };

  const courierWalletService = {
    async getSummary() {
      return {
        courierId: "courier-1",
        balanceCents: 0,
        activeCashCommitmentCents: 0,
        availableCents: 0,
        recentTransactions: []
      };
    },
    async creditTopUp() {
      return undefined;
    }
  };

  const processingQueue = {
    async addWebhookEvent(eventId: string) {
      queuedEventIds.push(eventId);
    },
    async addCourierPayout(nextOrderGroupId: string) {
      if (options.courierPayoutError) {
        throw options.courierPayoutError;
      }

      queuedCourierPayoutOrderGroupIds.push(nextOrderGroupId);
    }
  };

  const service = new PaymentsService(
    paymentRepository as never,
    paymentEventRepository as never,
    businessRepository as never,
    courierProfileRepository as never,
    orderRepository as never,
    courierWalletTopUpRepository as never,
    dataSource as never,
    ordersService as never,
    providerService as never,
    courierWalletService as never,
    processingQueue as never
  );

  return {
    service,
    payments,
    events,
    orders,
    queuedEventIds,
    queuedCourierPayoutOrderGroupIds,
    scheduledBusinessAcceptanceOrderGroupIds,
    paymentCreateCalls,
    courierTransferCalls
  };
}

function signedBody(body: object) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = createHmac("sha256", process.env.PAYMENT_WEBHOOK_SECRET ?? "")
    .update(rawBody)
    .digest("hex");

  return { rawBody, signature: `sha256=${signature}` };
}

function signedStripeBody(body: object) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const timestamp = "1700000000";
  const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET ?? "")
    .update(Buffer.from(`${timestamp}.${rawBody.toString("utf8")}`))
    .digest("hex");

  return { rawBody, signature: `t=${timestamp},v1=${signature}` };
}

describe("PaymentsService", () => {
  const originalWebhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const originalPublicApiUrl = process.env.PUBLIC_API_URL;
  const originalPublicAppUrl = process.env.PUBLIC_APP_URL;
  const originalClientAppUrl = process.env.CLIENT_APP_URL;

  beforeEach(() => {
    process.env.PAYMENT_WEBHOOK_SECRET = "test-secret";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.PUBLIC_API_URL = "https://staging.test/api";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.CLIENT_APP_URL;
  });

  afterEach(() => {
    process.env.PAYMENT_WEBHOOK_SECRET = originalWebhookSecret;
    process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
    process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
    process.env.PUBLIC_API_URL = originalPublicApiUrl;
    process.env.PUBLIC_APP_URL = originalPublicAppUrl;
    process.env.CLIENT_APP_URL = originalClientAppUrl;
  });

  it("requires an idempotency key when creating a payment", async () => {
    const { service } = createService();

    await assert.rejects(
      service.createPayment(customerId, undefined, { orderGroupId }),
      BadRequestException
    );
  });

  it("returns the existing payment for the same idempotency key", async () => {
    const existingPayment = createPayment();
    const { service, payments } = createService({ payments: [existingPayment] });

    const response = await service.createPayment(customerId, "payment-key-1", { orderGroupId });

    assert.equal(payments.length, 1);
    assert.equal(response.id, existingPayment.id);
    assert.equal(response.clientSecret, undefined);
  });

  it("creates a payment intent without storing card data", async () => {
    const { service, payments } = createService();

    const response = await service.createPayment(customerId, "payment-key-1", { orderGroupId });

    assert.equal(response.clientSecret, "secret_1");
    assert.equal(payments.length, 1);
    assert.equal(payments[0].amountCents, 2400);
    assert.deepEqual(payments[0].providerMetadata, { safe: true });
    assert.equal(JSON.stringify(payments[0]).includes("card"), false);
  });

  it("blocks card checkout when payment configuration is not ready", async () => {
    process.env.PUBLIC_API_URL = "http://staging.test/api";
    const { service, paymentCreateCalls } = createService();

    await assert.rejects(
      service.createPayment(customerId, "payment-key-1", { orderGroupId }),
      ServiceUnavailableException
    );

    assert.equal(paymentCreateCalls.length, 0);
  });

  it("reports payment health with configuration and recovery counts", async () => {
    const oldDate = new Date(Date.now() - 10 * 60_000);
    const { service } = createService({
      payments: [createPayment({ status: "PROCESSING" })],
      orders: [
        {
          id: "order-1",
          orderGroupId,
          status: "PENDING",
          paymentMethod: "CARD",
          paymentStatus: "PAID",
          updatedAt: oldDate
        } as Order
      ]
    });

    const health = await service.getPaymentHealth();

    assert.equal(health.ok, true);
    assert.equal(health.cardPaymentsEnabled, true);
    assert.equal(health.recoverablePayments, 1);
    assert.equal(health.stalePaidPendingOrderGroups, 1);
  });

  it("calculates card business transfers from business subtotal and leaves delivery fee on platform", async () => {
    const originalPlatformFee = process.env.RAPIV_PLATFORM_FEE_BPS;
    process.env.RAPIV_PLATFORM_FEE_BPS = "1000";

    try {
      const { service, paymentCreateCalls } = createService({
        orderGroup: {
          totalCents: 5400,
          businessOrders: [
            {
              id: "order-1",
              orderGroupId,
              businessId: "business-1",
              status: "PENDING",
              items: [],
              subtotalCents: 2400
            }
          ]
        }
      });

      await service.createPayment(customerId, "payment-key-2", { orderGroupId });

      assert.equal(paymentCreateCalls.length, 1);
      const call = paymentCreateCalls[0] as {
        amountCents: number;
        splits: Array<{
          grossAmountCents: number;
          platformFeeCents: number;
          transferAmountCents: number;
        }>;
      };

      assert.equal(call.amountCents, 5400);
      assert.equal(call.splits[0].grossAmountCents, 2400);
      assert.equal(call.splits[0].platformFeeCents, 240);
      assert.equal(call.splits[0].transferAmountCents, 2160);
    } finally {
      if (originalPlatformFee === undefined) {
        delete process.env.RAPIV_PLATFORM_FEE_BPS;
      } else {
        process.env.RAPIV_PLATFORM_FEE_BPS = originalPlatformFee;
      }
    }
  });

  it("rejects webhooks with invalid signatures", async () => {
    const { service } = createService();

    await assert.rejects(
      service.receiveWebhook("sha256=bad", Buffer.from("{}"), {
        id: "evt_1",
        type: "payment.succeeded",
        data: { providerPaymentId: "pay_1" }
      }),
      UnauthorizedException
    );
  });

  it("deduplicates webhook events before enqueueing work", async () => {
    const existingEvent = createEvent();
    const { service, queuedEventIds } = createService({ events: [existingEvent] });
    const body = {
      id: existingEvent.providerEventId,
      type: "payment.succeeded" as const,
      data: { providerPaymentId: "pay_1" }
    };
    const { rawBody, signature } = signedBody(body);

    const response = await service.receiveWebhook(signature, rawBody, body);

    assert.deepEqual(response, { received: true, duplicate: true });
    assert.equal(queuedEventIds.length, 0);
  });

  it("rejects legacy non-Stripe webhook signature manifests", async () => {
    const { service } = createService();
    const body = {
      id: "evt_1",
      action: "payment.updated",
      type: "payment" as const,
      data: { id: "pay_1" }
    };
    const manifest = "id:pay_1;request-id:req_1;ts:1700000000;";
    const signature = createHmac("sha256", process.env.PAYMENT_WEBHOOK_SECRET ?? "")
      .update(Buffer.from(manifest))
      .digest("hex");

    await assert.rejects(
      service.receiveWebhook(
        `ts=1700000000,v1=${signature}`,
        Buffer.from(JSON.stringify(body)),
        body
      ),
      UnauthorizedException
    );
  });

  it("accepts Stripe signed checkout session webhooks", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "stripe-secret";
    const { service, queuedEventIds } = createService();
    const body = {
      id: "evt_1",
      object: "event",
      type: "checkout.session.completed" as const,
      data: {
        object: {
          id: "cs_test_1",
          client_reference_id: "payment-1",
          payment_status: "paid",
          status: "complete"
        }
      }
    };
    const { rawBody, signature } = signedStripeBody(body);

    const response = await service.receiveWebhook(signature, rawBody, body);

    assert.deepEqual(response, { received: true, duplicate: false });
    assert.deepEqual(queuedEventIds, ["event-1"]);
  });

  it("processes succeeded webhooks in the worker and marks orders paid", async () => {
    const payment = createPayment();
    const event = createEvent();
    const { service, orders, events, queuedCourierPayoutOrderGroupIds } = createService({
      payments: [payment],
      events: [event]
    });

    await service.processWebhookEvent(event.id);

    assert.equal(payment.status, "SUCCEEDED");
    assert.ok(payment.paidAt);
    assert.equal(payment.providerMetadata?.stripeCheckoutSessionId, "pay_1");
    assert.equal(payment.providerMetadata?.stripeStatus, "paid");
    assert.equal(payment.providerMetadata?.stripeLatestChargeId, "ch_1");
    assert.equal(Array.isArray(payment.providerMetadata?.stripeTransfers), true);
    assert.equal(orders[0].paymentStatus, "PAID");
    assert.equal(orders[0].paidAt, payment.paidAt);
    assert.equal(events[0].status, "PROCESSED");
    assert.deepEqual(queuedCourierPayoutOrderGroupIds, [orderGroupId]);
  });

  it("keeps checkout return successful when post-payment scheduling fails", async () => {
    const payment = createPayment();
    const { service, orders, queuedCourierPayoutOrderGroupIds } = createService({
      payments: [payment],
      scheduleBusinessAcceptanceTimeoutsError: new Error("queue unavailable")
    });

    const response = await service.syncPaymentByCheckoutSession(payment.providerPaymentId);

    assert.equal(response.status, "SUCCEEDED");
    assert.equal(payment.status, "SUCCEEDED");
    assert.equal(orders[0].paymentStatus, "PAID");
    assert.equal(orders[0].paidAt, payment.paidAt);
    assert.deepEqual(queuedCourierPayoutOrderGroupIds, [orderGroupId]);
  });

  it("reconciles recoverable Stripe payments without waiting for a webhook", async () => {
    const payment = createPayment({ status: "PROCESSING" });
    const { service, orders } = createService({ payments: [payment] });

    const reconciled = await service.reconcileRecoverablePayments();

    assert.equal(reconciled, 1);
    assert.equal(payment.status, "SUCCEEDED");
    assert.equal(orders[0].paymentStatus, "PAID");
    assert.equal(orders[0].paidAt, payment.paidAt);
  });

  it("alerts and reschedules paid pending card orders", async () => {
    const stalePaidPendingOrder = {
      id: "order-1",
      orderGroupId,
      status: "PENDING",
      paymentMethod: "CARD",
      paymentStatus: "PAID",
      updatedAt: new Date(Date.now() - 10 * 60_000)
    } as Order;
    const { service, scheduledBusinessAcceptanceOrderGroupIds } = createService({
      orders: [stalePaidPendingOrder]
    });

    const alerted = await service.alertAndReschedulePaidPendingOrders();

    assert.equal(alerted, 1);
    assert.deepEqual(scheduledBusinessAcceptanceOrderGroupIds, [orderGroupId]);
  });

  it("creates an idempotent courier payout transfer for delivered paid card orders", async () => {
    const payment = createPayment({
      status: "SUCCEEDED",
      providerMetadata: {
        stripeLatestChargeId: "ch_1"
      }
    });
    const deliveredOrder = {
      id: "order-1",
      orderGroupId,
      courierId: "courier-1",
      status: "DELIVERED",
      paymentMethod: "CARD",
      paymentStatus: "PAID",
      courierPayoutCents: 2000,
      courierPayoutStatus: "PENDING"
    } as Order;
    const courierProfile = {
      userId: "courier-1",
      stripeConnectedAccountId: "acct_courier_1",
      stripePayoutsEnabled: true
    } as CourierProfile;
    const { service, orders, courierTransferCalls } = createService({
      payments: [payment],
      orders: [deliveredOrder],
      courierProfiles: [courierProfile]
    });

    await service.processCourierPayout(orderGroupId);

    assert.equal(courierTransferCalls.length, 1);
    assert.equal(
      (courierTransferCalls[0] as { connectedAccountId: string }).connectedAccountId,
      "acct_courier_1"
    );
    assert.equal(orders[0].courierPayoutStatus, "PAID");
    assert.equal(orders[0].courierPayoutProviderTransferId, "tr_courier_1");
    assert.ok(orders[0].courierPayoutPaidAt);
  });
});
