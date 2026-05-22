import "reflect-metadata";

import * as assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { BadRequestException, UnauthorizedException } from "@nestjs/common";

import { Order } from "../orders/order.entity";
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
    providerMetadata: {},
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
} = {}) {
  const payments = options.payments ?? [];
  const events = options.events ?? [];
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

  const matches = <T>(entity: T, where: Partial<T>) =>
    Object.entries(where).every(
      ([key, value]) => (entity as unknown as Record<string, unknown>)[key] === value
    );

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
    async find(options: { where: Partial<Payment> }) {
      return payments.filter((payment) => matches(payment, options.where));
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

  const manager = {
    async findOne(entity: unknown, options: { where: Record<string, unknown> }) {
      if (entity === Payment) {
        return payments.find((payment) => matches(payment, options.where as Partial<Payment>)) ?? null;
      }

      return null;
    },
    async find(entity: unknown, options: { where: Record<string, unknown> }) {
      if (entity === Order) {
        return orders.filter((order) => matches(order, options.where as Partial<Order>));
      }

      return [];
    },
    async save(entity: unknown, value: Payment | PaymentEvent | Order[]) {
      if (entity === Payment) {
        return paymentRepository.save(value as Payment);
      }

      if (entity === PaymentEvent) {
        return paymentEventRepository.save(value as PaymentEvent);
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
        totalCents: 2400,
        status: "PENDING",
        businessOrders: [],
        deliveryAddress: "Calle 1",
        createdAt: new Date()
      };
    },
    async scheduleBusinessAcceptanceTimeouts() {
      return undefined;
    }
  };

  const providerService = {
    providerName: "sandbox",
    async createPayment() {
      return {
        provider: "sandbox",
        providerPaymentId: "pay_1",
        checkoutUrl: "https://mercadopago.test/checkout",
        clientSecret: "secret_1",
        status: "REQUIRES_ACTION",
        metadata: { safe: true }
      };
    },
    async getPayment(providerPaymentId: string) {
      return {
        providerPaymentId,
        externalReference: "payment-1",
        status: "approved",
        amountCents: 2400,
        currency: "MXN",
        raw: { id: providerPaymentId, status: "approved" }
      };
    }
  };

  const processingQueue = {
    async addWebhookEvent(eventId: string) {
      queuedEventIds.push(eventId);
    }
  };

  const service = new PaymentsService(
    paymentRepository as never,
    paymentEventRepository as never,
    dataSource as never,
    ordersService as never,
    providerService as never,
    processingQueue as never
  );

  return { service, payments, events, orders, queuedEventIds };
}

function signedBody(body: object) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = createHmac("sha256", process.env.PAYMENT_WEBHOOK_SECRET ?? "")
    .update(rawBody)
    .digest("hex");

  return { rawBody, signature: `sha256=${signature}` };
}

describe("PaymentsService", () => {
  const originalWebhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.PAYMENT_WEBHOOK_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.PAYMENT_WEBHOOK_SECRET = originalWebhookSecret;
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

  it("accepts Mercado Pago signed webhook format", async () => {
    const { service, queuedEventIds } = createService();
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

    const response = await service.receiveWebhook(
      `ts=1700000000,v1=${signature}`,
      Buffer.from(JSON.stringify(body)),
      body,
      "req_1"
    );

    assert.deepEqual(response, { received: true, duplicate: false });
    assert.deepEqual(queuedEventIds, ["event-1"]);
  });

  it("processes succeeded webhooks in the worker and marks orders paid", async () => {
    const payment = createPayment();
    const event = createEvent();
    const { service, orders, events } = createService({
      payments: [payment],
      events: [event]
    });

    await service.processWebhookEvent(event.id);

    assert.equal(payment.status, "SUCCEEDED");
    assert.ok(payment.paidAt);
    assert.equal(payment.providerMetadata?.mercadoPagoPaymentId, "pay_1");
    assert.equal(payment.providerMetadata?.mercadoPagoStatus, "approved");
    assert.equal(payment.providerMetadata?.mercadoPagoPayment, undefined);
    assert.equal(orders[0].paymentStatus, "PAID");
    assert.equal(orders[0].paidAt, payment.paidAt);
    assert.equal(events[0].status, "PROCESSED");
  });
});
