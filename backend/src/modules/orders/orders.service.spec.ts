import "reflect-metadata";

import * as assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException
} from "@nestjs/common";

import { Business } from "../businesses/business.entity";
import { CourierProfile } from "../users/courier-profile.entity";
import { Product } from "../products/product.entity";
import { DeliveryOffer } from "./delivery-offer.entity";
import { OrderItem } from "./order-item.entity";
import { Order } from "./order.entity";
import { CashSettlement } from "../payments/cash-settlement.entity";
import type { BusinessOrderStatus } from "./order.entity";
import { OrdersService } from "./orders.service";
import { User } from "../users/user.entity";
import { Payment } from "../payments/payment.entity";

type RepositoryMock<T> = {
  findOne: (options: { where: Partial<T> }) => Promise<T | null>;
  find: (options: { where?: Partial<T> }) => Promise<T[]>;
  save: (entity: T | T[]) => Promise<T | T[]>;
};

type TestOrder = Partial<Order> & Pick<Order, "id" | "orderGroupId" | "userId" | "businessId" | "status">;

const customerId = "customer-1";
const courierId = "courier-1";
const otherCourierId = "courier-2";
const ownerUserId = "owner-1";
const businessId = "business-1";
const orderGroupId = "group-1";

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    userId: customerId,
    businessId,
    orderGroupId,
    courierId: null,
    status: "PENDING",
    paymentStatus: "PAID",
    paidAt: new Date("2026-01-01T00:00:00.000Z"),
    subtotalCents: 1200,
    totalPrice: 12,
    deliveryAddress: "Calle Principal 123",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    items: [
      {
        id: "item-1",
        orderId: "order-1",
        productId: "product-1",
        productName: "Taco",
        price: 1200,
        quantity: 1
      } as OrderItem
    ],
    ...overrides
  } as Order;
}

function createService(options: {
  orders?: Order[];
  cashSettlements?: CashSettlement[];
  products?: Product[];
  businesses?: Business[];
  offers?: DeliveryOffer[];
  payments?: Payment[];
  courierProfiles?: CourierProfile[];
  users?: User[];
  businessOwnerId?: string;
} = {}) {
  const orders = options.orders ?? [];
  const products = options.products ?? [];
  const businesses = options.businesses ?? [];
  const offers = options.offers ?? [];
  const payments = options.payments ?? [];
  const courierProfiles = options.courierProfiles ?? [];
  const cashSettlements = options.cashSettlements ?? [];
  const users = options.users ?? [];
  const enqueuedOfferGenerations: string[] = [];
  let orderSequence = 1;
  let transactionCount = 0;

  const matchesWhere = <T>(entity: T, where: Partial<T>) =>
    Object.entries(where).every(([key, value]) => {
      const actual = (entity as unknown as Record<string, unknown>)[key];

      if (value && typeof value === "object" && "_type" in value) {
        const operator = value as unknown as { _type: string; _value: unknown };

        if (operator._type === "moreThan") {
          return Number(actual) > Number(operator._value);
        }

        if (operator._type === "lessThanOrEqual") {
          return new Date(actual as Date).getTime() <= new Date(operator._value as Date).getTime();
        }
      }

      return actual === value;
    });

  const findOrder = (where: Partial<Order>) =>
    orders.find((order) => matchesWhere(order, where)) ?? null;

  const orderRepository: RepositoryMock<Order> = {
    async findOne(options: { where: Partial<Order> }) {
      return findOrder(options.where);
    },
    async find(options: { where?: Partial<Order> }) {
      if (!options.where) {
        return orders;
      }

      return orders.filter((order) =>
        matchesWhere(order, options.where ?? {})
      );
    },
    async save(entity: Order | Order[]) {
      return entity;
    }
  };

  const deliveryOfferRepository: RepositoryMock<DeliveryOffer> & {
    create: (value: Partial<DeliveryOffer>) => DeliveryOffer;
  } = {
    async findOne(options: { where: Partial<DeliveryOffer> }) {
      return offers.find((offer) =>
        Object.entries(options.where).every(
          ([key, value]) => (offer as unknown as Record<string, unknown>)[key] === value
        )
      ) ?? null;
    },
    async find(options: { where?: Partial<DeliveryOffer> }) {
      if (!options.where) {
        return offers;
      }

      return offers.filter((offer) =>
        Object.entries(options.where ?? {}).every(
          ([key, value]) => (offer as unknown as Record<string, unknown>)[key] === value
        )
      );
    },
    async save(entity: DeliveryOffer | DeliveryOffer[]) {
      const values = Array.isArray(entity) ? entity : [entity];

      for (const offer of values) {
        if (!offers.some((existing) => existing.id === offer.id)) {
          offers.push(offer);
        }
      }

      return entity;
    },
    create(value: Partial<DeliveryOffer>) {
      return {
        id: `offer-${offers.length + 1}`,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        ...value
      } as DeliveryOffer;
    }
  };

  const manager = {
    async findOne(entity: unknown, options: { where: Record<string, unknown> }) {
      if (entity === Order) {
        return findOrder(options.where as Partial<Order>);
      }

      if (entity === DeliveryOffer) {
        return offers.find((offer) =>
          Object.entries(options.where).every(
            ([key, value]) => (offer as unknown as Record<string, unknown>)[key] === value
          )
        ) ?? null;
      }

      if (entity === CourierProfile) {
        return courierProfiles.find((profile) =>
          Object.entries(options.where).every(
            ([key, value]) => (profile as unknown as Record<string, unknown>)[key] === value
          )
        ) ?? null;
      }

      if (entity === Product) {
        return products.find((product) => product.id === options.where.id) ?? null;
      }

      if (entity === Business) {
        return businesses.find((business) => business.id === options.where.id) ?? null;
      }

      if (entity === Payment) {
        return payments.find((payment) =>
          Object.entries(options.where).every(
            ([key, value]) => (payment as unknown as Record<string, unknown>)[key] === value
          )
        ) ?? null;
      }

      return null;
    },
    async find(entity: unknown, options: { where?: Partial<Order> | Partial<OrderItem> }) {
      if (entity === Order) {
        return orderRepository.find(options as { where?: Partial<Order> });
      }

      if (entity === OrderItem) {
        const where = options.where as Partial<OrderItem> | undefined;
        return orders.find((order) => order.id === where?.orderId)?.items ?? [];
      }

      if (entity === DeliveryOffer) {
        return offers.filter((offer) =>
          Object.entries(options.where ?? {}).every(
            ([key, value]) => (offer as unknown as Record<string, unknown>)[key] === value
          )
        );
      }

      if (entity === Payment) {
        return payments.filter((payment) =>
          Object.entries(options.where ?? {}).every(
            ([key, value]) => (payment as unknown as Record<string, unknown>)[key] === value
          )
        );
      }

      return [];
    },
    create(entity: unknown, value: Record<string, unknown>) {
      if (entity === Order) {
        return {
          id: `order-${orderSequence++}`,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          ...value
        } as Order;
      }

      return value;
    },
    async save(entity: unknown, value: Order | Order[]) {
      const values = Array.isArray(value) ? value : [value];

      if (entity === Order) {
        for (const order of values) {
          if (!orders.some((existing) => existing.id === order.id)) {
            orders.push(order);
          }
        }
      }

      if (entity === DeliveryOffer) {
        for (const offer of values as unknown as DeliveryOffer[]) {
          if (!offers.some((existing) => existing.id === offer.id)) {
            offers.push(offer);
          }
        }
      }

      if (entity === Payment) {
        for (const payment of values as unknown as Payment[]) {
          if (!payments.some((existing) => existing.id === payment.id)) {
            payments.push(payment);
          }
        }
      }

      return value;
    },
    getRepository(entity: unknown) {
      assert.equal(entity, Order);
      return orderRepository;
    }
  };

  const dataSource = {
    async transaction<T>(callback: (transactionManager: typeof manager) => Promise<T>) {
      transactionCount += 1;
      return callback(manager);
    }
  };

  const businessesService = {
    async findById(id: string) {
      const business = businesses.find((current) => current.id === id);
      return {
        id,
        name: business?.name ?? "Taqueria",
        ownerUserId: options.businessOwnerId ?? business?.ownerUserId ?? ownerUserId
      };
    }
  };

  const userRepository = {
    async findOne(options: { where: { id: string } }) {
      return {
        id: options.where.id,
        fullName: "Cliente Test",
        phone: "5551234567"
      };
    },
    async find() {
      return users;
    }
  };

  const courierProfileRepository = {
    create(value: Partial<CourierProfile>) {
      return {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        ...value
      } as CourierProfile;
    },
    async findOne(options: { where: Partial<CourierProfile> }) {
      return courierProfiles.find((profile) =>
        Object.entries(options.where).every(
          ([key, value]) => (profile as unknown as Record<string, unknown>)[key] === value
        )
      ) ?? null;
    },
    async find() {
      return courierProfiles;
    },
    async save(profile: CourierProfile) {
      const existingIndex = courierProfiles.findIndex((existing) => existing.userId === profile.userId);

      if (existingIndex >= 0) {
        courierProfiles[existingIndex] = {
          ...courierProfiles[existingIndex],
          ...profile
        };
        return courierProfiles[existingIndex];
      }

      courierProfiles.push(profile);
      return profile;
    }
  };

  const orderProcessingQueue = {
    async addDeliveryOfferGeneration(orderGroupId: string) {
      enqueuedOfferGenerations.push(orderGroupId);
      return undefined;
    },
    async addDeliveryOfferGenerations(orderGroupIds: string[]) {
      enqueuedOfferGenerations.push(...orderGroupIds);
      return undefined;
    },
    async addBusinessAcceptanceTimeout() {
      return undefined;
    },
    async addBusinessReadyTimeout() {
      return undefined;
    },
    async addDeliveryOfferTimeout() {
      return undefined;
    }
  };

  const sentNotifications: Array<{
    userId: string;
    message: { title: string; body: string; data?: Record<string, unknown> };
  }> = [];

  const notificationsService = {
    async sendToUser(userId: string, message: { title: string; body: string; data?: Record<string, unknown> }) {
      sentNotifications.push({ userId, message });
      return undefined;
    },
    async sendToUsers(userIds: string[], message: { title: string; body: string; data?: Record<string, unknown> }) {
      for (const userId of userIds) {
        sentNotifications.push({ userId, message });
      }
      return undefined;
    }
  };
  const paymentRepository = {
    async findOne(options: { where: Partial<Payment> }) {
      return payments.find((payment) =>
        Object.entries(options.where).every(
          ([key, value]) => (payment as unknown as Record<string, unknown>)[key] === value
        )
      ) ?? null;
    }
  };
  const cashSettlementRepository = {
    async findOne(options: { where: Partial<CashSettlement> }) {
      return cashSettlements.find((settlement) =>
        matchesWhere(settlement, options.where)
      ) ?? null;
    },
    async find(options: { where: Partial<CashSettlement> }) {
      return cashSettlements.filter((settlement) => matchesWhere(settlement, options.where));
    }
  };
  const refundCalls: Array<{
    providerPaymentId: string;
    idempotencyKey: string;
    transfers: unknown[];
  }> = [];
  const stripeAccountCalls: unknown[] = [];
  const paymentProviderService = {
    async refundPayment(providerPaymentId: string, idempotencyKey: string, transfers: unknown[] = []) {
      refundCalls.push({ providerPaymentId, idempotencyKey, transfers });
      return {
        providerRefundId: "refund-1",
        status: "succeeded",
        raw: { refund: { id: "refund-1" }, transferReversals: [] }
      };
    }
  };
  const stripeConnectService = {
    async createExpressAccount(input: unknown) {
      stripeAccountCalls.push(input);
      return {
        accountId: "acct_courier_1",
        platformAccountId: "acct_platform_1"
      };
    },
    async createOnboardingLink() {
      return "https://connect.stripe.test/onboarding";
    },
    async retrieveAccountStatus() {
      return {
        platformAccountId: "acct_platform_1",
        chargesEnabled: false,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requirementsCurrentlyDue: null
      };
    },
    async currentPlatformAccountId() {
      return "acct_platform_1";
    },
    requireReturnBaseUrl() {
      return "https://api.example.com/api";
    },
    isMissingResourceError() {
      return false;
    }
  };
  const paymentProcessingQueue = {
    courierPayoutOrderGroupIds: [] as string[],
    async addCourierPayout(orderGroupId: string) {
      this.courierPayoutOrderGroupIds.push(orderGroupId);
    }
  };

  const service = new OrdersService(
    orderRepository as never,
    deliveryOfferRepository as never,
    {} as never,
    userRepository as never,
    courierProfileRepository as never,
    paymentRepository as never,
    cashSettlementRepository as never,
    dataSource as never,
    businessesService as never,
    orderProcessingQueue as never,
    notificationsService as never,
    paymentProviderService as never,
    paymentProcessingQueue as never,
    stripeConnectService as never
  );

  return {
    service,
    orders,
    offers,
    payments,
    courierProfiles,
    enqueuedOfferGenerations,
    sentNotifications,
    refundCalls,
    queuedCourierPayoutOrderGroupIds: paymentProcessingQueue.courierPayoutOrderGroupIds,
    stripeAccountCalls,
    getTransactionCount: () => transactionCount
  };
}

describe("OrdersService", () => {
  let openBusiness: Business;
  let product: Product;

  beforeEach(() => {
    openBusiness = {
      id: businessId,
      ownerUserId,
      name: "Taqueria",
      address: "Centro",
      latitude: 20.0289,
      longitude: -96.6472,
      isOpen: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Business;

    product = {
      id: "product-1",
      businessId,
      business: openBusiness,
      name: "Taco",
      priceCents: 1200,
      available: true,
      stock: 10,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Product;
  });

  it("requires an idempotency key when creating an order", async () => {
    const { service } = createService();

    await assert.rejects(
      service.create(customerId, "   ", {
        deliveryAddress: "Calle Principal 123",
        items: [{ productId: product.id, quantity: 1 }]
      }),
      BadRequestException
    );
  });

  it("rejects orders below the product minimum quantity", async () => {
    product.minimumQuantityPerOrder = 5;
    const { service } = createService({
      products: [product],
      businesses: [openBusiness]
    });

    await assert.rejects(
      service.create(customerId, "product-minimum-key", {
        deliveryAddress: "Calle Principal 123",
        items: [{ productId: product.id, quantity: 2 }],
        latitude: 20.0289,
        longitude: -96.6472
      }),
      ConflictException
    );
  });

  it("coalesces concurrent creates with the same idempotency key", async () => {
    const { service, getTransactionCount } = createService({
      products: [product],
      businesses: [openBusiness]
    });

    const dto = {
      deliveryAddress: " Calle Principal 123 ",
      paymentMethod: "CASH" as const,
      items: [{ productId: product.id, quantity: 2 }],
      latitude: 20.0289,
      longitude: -96.6472
    };

    const [first, second] = await Promise.all([
      service.create(customerId, "order-key-1", dto),
      service.create(customerId, "order-key-1", dto)
    ]);

    assert.equal(getTransactionCount(), 1);
    assert.equal(first.id, second.id);
    assert.equal(first.customerId, customerId);
    assert.equal(first.businessOrders[0].subtotalCents, 2400);
    assert.equal(first.businessOrders[0].items[0].lineTotalCents, 2400);
  });

  it("adds delivery fee and records pending courier payout when creating an order", async () => {
    const originalDeliveryFee = process.env.DELIVERY_FEE_CENTS;
    const originalCourierPayout = process.env.COURIER_PAYOUT_CENTS;
    const originalPlatformFee = process.env.RAPIV_PLATFORM_FEE_BPS;
    const originalCardPaymentMinimum = process.env.CARD_PAYMENT_MINIMUM_CENTS;
    process.env.DELIVERY_FEE_CENTS = "3000";
    process.env.COURIER_PAYOUT_CENTS = "2000";
    process.env.RAPIV_PLATFORM_FEE_BPS = "1000";
    process.env.CARD_PAYMENT_MINIMUM_CENTS = "0";

    try {
      const { service } = createService({
        products: [product],
        businesses: [openBusiness]
      });

      const order = await service.create(customerId, "financial-key-1", {
        deliveryAddress: "Calle Principal 123",
        items: [{ productId: product.id, quantity: 2 }],
        latitude: 20.0289,
        longitude: -96.6472
      });

      assert.equal(order.subtotalCents, 2400);
      assert.equal(order.deliveryFeeCents, 3000);
      assert.equal(order.courierPayoutCents, 2000);
      assert.equal(order.courierPayoutStatus, "PENDING");
      assert.equal(order.platformDeliveryMarginCents, 1000);
      assert.equal(order.totalCents, 5400);
      assert.equal(order.businessOrders[0].businessCommissionCents, 240);
      assert.equal(order.businessOrders[0].businessPayoutCents, 2160);
    } finally {
      if (originalDeliveryFee === undefined) {
        delete process.env.DELIVERY_FEE_CENTS;
      } else {
        process.env.DELIVERY_FEE_CENTS = originalDeliveryFee;
      }

      if (originalCourierPayout === undefined) {
        delete process.env.COURIER_PAYOUT_CENTS;
      } else {
        process.env.COURIER_PAYOUT_CENTS = originalCourierPayout;
      }

      if (originalPlatformFee === undefined) {
        delete process.env.RAPIV_PLATFORM_FEE_BPS;
      } else {
        process.env.RAPIV_PLATFORM_FEE_BPS = originalPlatformFee;
      }

      if (originalCardPaymentMinimum === undefined) {
        delete process.env.CARD_PAYMENT_MINIMUM_CENTS;
      } else {
        process.env.CARD_PAYMENT_MINIMUM_CENTS = originalCardPaymentMinimum;
      }
    }
  });

  it("keeps delivery financials single and business commissions per business in multipedido", async () => {
    const originalDeliveryFee = process.env.DELIVERY_FEE_CENTS;
    const originalCourierPayout = process.env.COURIER_PAYOUT_CENTS;
    const originalPlatformFee = process.env.RAPIV_PLATFORM_FEE_BPS;
    const originalCardPaymentMinimum = process.env.CARD_PAYMENT_MINIMUM_CENTS;
    process.env.DELIVERY_FEE_CENTS = "3000";
    process.env.COURIER_PAYOUT_CENTS = "2000";
    process.env.RAPIV_PLATFORM_FEE_BPS = "1000";
    process.env.CARD_PAYMENT_MINIMUM_CENTS = "0";

    try {
      const secondBusiness = {
        ...openBusiness,
        id: "business-2",
        ownerUserId: "owner-2",
        name: "Pizzeria"
      } as Business;
      const secondProduct = {
        ...product,
        id: "product-2",
        businessId: secondBusiness.id,
        business: secondBusiness,
        name: "Pizza",
        priceCents: 3000
      } as Product;
      const { service } = createService({
        products: [product, secondProduct],
        businesses: [openBusiness, secondBusiness]
      });

      const order = await service.create(customerId, "multipedido-financial-key-1", {
        deliveryAddress: "Calle Principal 123",
        items: [
          { productId: product.id, quantity: 2 },
          { productId: secondProduct.id, quantity: 1 }
        ],
        latitude: 20.0289,
        longitude: -96.6472
      });

      const [firstBusinessOrder, secondBusinessOrder] = order.businessOrders;

      assert.equal(order.subtotalCents, 5400);
      assert.equal(order.deliveryFeeCents, 3000);
      assert.equal(order.courierPayoutCents, 2000);
      assert.equal(order.platformDeliveryMarginCents, 1000);
      assert.equal(order.totalCents, 8400);
      assert.equal(firstBusinessOrder.businessCommissionCents, 240);
      assert.equal(firstBusinessOrder.businessPayoutCents, 2160);
      assert.equal(secondBusinessOrder.businessCommissionCents, 300);
      assert.equal(secondBusinessOrder.businessPayoutCents, 2700);
      assert.equal(
        order.businessOrders.reduce((sum, businessOrder) => sum + (businessOrder.businessCommissionCents ?? 0), 0),
        540
      );
    } finally {
      if (originalDeliveryFee === undefined) {
        delete process.env.DELIVERY_FEE_CENTS;
      } else {
        process.env.DELIVERY_FEE_CENTS = originalDeliveryFee;
      }

      if (originalCourierPayout === undefined) {
        delete process.env.COURIER_PAYOUT_CENTS;
      } else {
        process.env.COURIER_PAYOUT_CENTS = originalCourierPayout;
      }

      if (originalPlatformFee === undefined) {
        delete process.env.RAPIV_PLATFORM_FEE_BPS;
      } else {
        process.env.RAPIV_PLATFORM_FEE_BPS = originalPlatformFee;
      }

      if (originalCardPaymentMinimum === undefined) {
        delete process.env.CARD_PAYMENT_MINIMUM_CENTS;
      } else {
        process.env.CARD_PAYMENT_MINIMUM_CENTS = originalCardPaymentMinimum;
      }
    }
  });

  it("creates pickup orders without delivery financials or courier payout", async () => {
    const originalDeliveryFee = process.env.DELIVERY_FEE_CENTS;
    const originalCourierPayout = process.env.COURIER_PAYOUT_CENTS;
    const originalCardPaymentMinimum = process.env.CARD_PAYMENT_MINIMUM_CENTS;
    process.env.DELIVERY_FEE_CENTS = "3000";
    process.env.COURIER_PAYOUT_CENTS = "2000";
    process.env.CARD_PAYMENT_MINIMUM_CENTS = "0";

    try {
      const { service } = createService({
        products: [product],
        businesses: [openBusiness]
      });

      const order = await service.create(customerId, "pickup-key-1", {
        deliveryAddress: "Recoger en negocio",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CARD",
        items: [{ productId: product.id, quantity: 2 }]
      });

      assert.equal(order.fulfillmentMethod, "PICKUP");
      assert.equal(order.subtotalCents, 2400);
      assert.equal(order.deliveryFeeCents, 0);
      assert.equal(order.courierPayoutCents, 0);
      assert.equal(order.platformDeliveryMarginCents, 0);
      assert.equal(order.totalCents, 2400);
    } finally {
      if (originalDeliveryFee === undefined) {
        delete process.env.DELIVERY_FEE_CENTS;
      } else {
        process.env.DELIVERY_FEE_CENTS = originalDeliveryFee;
      }

      if (originalCourierPayout === undefined) {
        delete process.env.COURIER_PAYOUT_CENTS;
      } else {
        process.env.COURIER_PAYOUT_CENTS = originalCourierPayout;
      }

      if (originalCardPaymentMinimum === undefined) {
        delete process.env.CARD_PAYMENT_MINIMUM_CENTS;
      } else {
        process.env.CARD_PAYMENT_MINIMUM_CENTS = originalCardPaymentMinimum;
      }
    }
  });

  it("requires cash for orders below the card payment minimum", async () => {
    const originalCardPaymentMinimum = process.env.CARD_PAYMENT_MINIMUM_CENTS;
    process.env.CARD_PAYMENT_MINIMUM_CENTS = "18000";

    try {
      const { service } = createService({
        products: [product],
        businesses: [openBusiness]
      });

      await assert.rejects(
        service.create(customerId, "card-minimum-key-1", {
          deliveryAddress: "Calle Principal 123",
          paymentMethod: "CARD",
          items: [{ productId: product.id, quantity: 2 }],
          latitude: 20.0289,
          longitude: -96.6472
        }),
        ConflictException
      );
    } finally {
      if (originalCardPaymentMinimum === undefined) {
        delete process.env.CARD_PAYMENT_MINIMUM_CENTS;
      } else {
        process.env.CARD_PAYMENT_MINIMUM_CENTS = originalCardPaymentMinimum;
      }
    }
  });

  it("uses the lower cash platform fee when creating cash orders", async () => {
    const originalPlatformFee = process.env.RAPIV_PLATFORM_FEE_BPS;
    const originalCashPlatformFee = process.env.RAPIV_CASH_PLATFORM_FEE_BPS;
    process.env.RAPIV_PLATFORM_FEE_BPS = "1000";
    process.env.RAPIV_CASH_PLATFORM_FEE_BPS = "500";

    try {
      const { service } = createService({
        products: [product],
        businesses: [openBusiness]
      });

      const order = await service.create(customerId, "cash-fee-key-1", {
        deliveryAddress: "Calle Principal 123",
        paymentMethod: "CASH",
        items: [{ productId: product.id, quantity: 2 }],
        latitude: 20.0289,
        longitude: -96.6472
      });

      assert.equal(order.paymentMethod, "CASH");
      assert.equal(order.businessOrders[0].subtotalCents, 2400);
      assert.equal(order.businessOrders[0].businessCommissionCents, 120);
      assert.equal(order.businessOrders[0].businessPayoutCents, 2280);
    } finally {
      if (originalPlatformFee === undefined) {
        delete process.env.RAPIV_PLATFORM_FEE_BPS;
      } else {
        process.env.RAPIV_PLATFORM_FEE_BPS = originalPlatformFee;
      }

      if (originalCashPlatformFee === undefined) {
        delete process.env.RAPIV_CASH_PLATFORM_FEE_BPS;
      } else {
        process.env.RAPIV_CASH_PLATFORM_FEE_BPS = originalCashPlatformFee;
      }
    }
  });

  it("enforces business order status transitions", async () => {
    const pendingOrder = createOrder({ status: "PENDING" });
    const { service } = createService({
      orders: [pendingOrder],
      businesses: [openBusiness]
    });

    const accepted = await service.updateBusinessOrderStatus(
      ownerUserId,
      businessId,
      pendingOrder.id,
      "ACCEPTED"
    );

    assert.equal(accepted.status, "PREPARING");
    assert.equal(pendingOrder.status, "PREPARING");

    await assert.rejects(
      service.updateBusinessOrderStatus(ownerUserId, businessId, pendingOrder.id, "ACCEPTED"),
      ConflictException
    );
  });

  it("requires the matching business owner to update a business order", async () => {
    const { service } = createService({
      orders: [createOrder()],
      businesses: [openBusiness],
      businessOwnerId: "another-owner"
    });

    await assert.rejects(
      service.updateBusinessOrderStatus(ownerUserId, businessId, "order-1", "ACCEPTED"),
      ForbiddenException
    );
  });

  it("blocks business processing until the order is paid", async () => {
    const unpaidOrder = createOrder({ status: "PENDING", paymentStatus: "UNPAID", paidAt: null });
    const { service } = createService({
      orders: [unpaidOrder],
      businesses: [openBusiness]
    });

    await assert.rejects(
      service.updateBusinessOrderStatus(ownerUserId, businessId, unpaidOrder.id, "ACCEPTED"),
      ConflictException
    );
    await assert.doesNotReject(
      service.updateBusinessOrderStatus(ownerUserId, businessId, unpaidOrder.id, "REJECTED")
    );
  });

  it("cancels and refunds a multipedido when one business rejects it", async () => {
    const rejectingOrder = createOrder({
      id: "order-1",
      businessId,
      status: "PENDING",
      paymentStatus: "PAID"
    });
    const otherOrder = createOrder({
      id: "order-2",
      businessId: "business-2",
      status: "PREPARING",
      paymentStatus: "PAID"
    });
    const payment = {
      id: "payment-1",
      userId: customerId,
      orderGroupId,
      amountCents: 2400,
      currency: "MXN",
      status: "SUCCEEDED",
      provider: "stripe",
      providerPaymentId: "cs_test_1",
      idempotencyKey: "pay-key",
      paidAt: new Date("2026-01-01T00:00:00.000Z"),
      providerMetadata: {
        stripeTransfers: [
          {
            businessId,
            connectedAccountId: "acct_1",
            providerTransferId: "tr_1",
            amountCents: 1200
          },
          {
            businessId: "business-2",
            connectedAccountId: "acct_2",
            providerTransferId: "tr_2",
            amountCents: 1200
          }
        ]
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    } as Payment;
    const { service, sentNotifications, refundCalls } = createService({
      orders: [rejectingOrder, otherOrder],
      payments: [payment],
      businesses: [
        openBusiness,
        {
          ...openBusiness,
          id: "business-2",
          ownerUserId: "owner-2",
          name: "Pizzeria"
        }
      ]
    });

    const rejected = await service.updateBusinessOrderStatus(
      ownerUserId,
      businessId,
      rejectingOrder.id,
      "REJECTED"
    );

    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejectingOrder.status, "REJECTED");
    assert.equal(rejectingOrder.paymentStatus, "REFUNDED");
    assert.equal(otherOrder.status, "CANCELLED");
    assert.equal(otherOrder.paymentStatus, "REFUNDED");
    assert.equal(payment.status, "CANCELLED");
    assert.equal(refundCalls.length, 1);
    assert.equal(refundCalls[0].providerPaymentId, "cs_test_1");
    assert.equal(refundCalls[0].transfers.length, 2);
    assert.ok(sentNotifications.some((notification) =>
      notification.userId === customerId &&
      notification.message.data?.type === "ORDER_REFUNDED" &&
      notification.message.body.includes("Taqueria")
    ));
    assert.ok(sentNotifications.some((notification) =>
      notification.userId === "owner-2" &&
      notification.message.data?.type === "ORDER_GROUP_CANCELLED" &&
      notification.message.body.includes("Taqueria")
    ));
  });

  it("derives cancelled order groups from cancelled business orders", async () => {
    const firstOrder = createOrder({ id: "order-1", status: "CANCELLED" });
    const secondOrder = createOrder({
      id: "order-2",
      businessId: "business-2",
      status: "CANCELLED"
    });
    const { service } = createService({ orders: [firstOrder, secondOrder] });

    const orderGroup = await service.findById(orderGroupId);

    assert.equal(orderGroup.status, "CANCELLED");
  });

  it("assigns ready order groups to a courier", async () => {
    const firstOrder = createOrder({ id: "order-1", status: "READY" });
    const secondOrder = createOrder({
      id: "order-2",
      businessId: "business-2",
      status: "READY",
      items: [
        {
          id: "item-2",
          orderId: "order-2",
          productId: "product-2",
          productName: "Agua",
          price: 1800,
          quantity: 1
        } as OrderItem
      ]
    });
    const { service } = createService({ orders: [firstOrder, secondOrder] });

    const assigned = await service.assignToCourier(courierId, orderGroupId);

    assert.equal(assigned.status, "ASSIGNED");
    assert.equal(assigned.courierId, courierId);
    assert.equal(firstOrder.courierId, courierId);
    assert.equal(secondOrder.courierId, courierId);
    assert.equal(firstOrder.status, "ASSIGNED");
    assert.equal(secondOrder.status, "ASSIGNED");
  });

  it("accepts a delivery offer and cancels competing offers", async () => {
    const order = createOrder({ status: "READY" });
    const acceptedOffer = {
      id: "offer-1",
      orderGroupId,
      courierId,
      status: "PENDING",
      score: 9000,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date()
    } as DeliveryOffer;
    const competingOffer = {
      id: "offer-2",
      orderGroupId,
      courierId: otherCourierId,
      status: "PENDING",
      score: 8500,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date()
    } as DeliveryOffer;
    const profile = {
      userId: courierId,
      availabilityStatus: "AVAILABLE",
      createdAt: new Date(),
      updatedAt: new Date()
    } as CourierProfile;
    const { service, sentNotifications } = createService({
      orders: [order],
      offers: [acceptedOffer, competingOffer],
      courierProfiles: [profile]
    });

    const assigned = await service.acceptDeliveryOffer(courierId, acceptedOffer.id);

    assert.equal(assigned.status, "ASSIGNED");
    assert.equal(order.courierId, courierId);
    assert.equal(order.status, "ASSIGNED");
    assert.equal(acceptedOffer.status, "ACCEPTED");
    assert.equal(competingOffer.status, "CANCELLED");
    assert.equal(profile.availabilityStatus, "BUSY");
    assert.deepEqual(sentNotifications[0]?.message.data, {
      type: "ORDER_ASSIGNED",
      orderGroupId
    });
  });

  it("assigns a multipedido as soon as one business order is ready", async () => {
    const readyOrder = createOrder({ id: "order-1", status: "READY" });
    const preparingOrder = createOrder({
      id: "order-2",
      businessId: "business-2",
      status: "PREPARING"
    });
    const { service } = createService({ orders: [readyOrder, preparingOrder] });

    const assigned = await service.assignToCourier(courierId, orderGroupId);

    assert.equal(assigned.status, "ASSIGNED");
    assert.equal(readyOrder.status, "ASSIGNED");
    assert.equal(preparingOrder.status, "PREPARING");
    assert.equal(readyOrder.courierId, courierId);
    assert.equal(preparingOrder.courierId, courierId);
  });

  it("lets couriers pick up ready business orders one at a time", async () => {
    const firstOrder = createOrder({ id: "order-1", status: "ASSIGNED", courierId });
    const secondOrder = createOrder({
      id: "order-2",
      businessId: "business-2",
      status: "PREPARING",
      courierId
    });
    const { service } = createService({ orders: [firstOrder, secondOrder] });

    const partiallyPickedUp = await service.markBusinessOrderPickedUp(
      courierId,
      orderGroupId,
      firstOrder.id
    );

    assert.equal(partiallyPickedUp.status, "PARTIALLY_PICKED_UP");
    assert.equal(firstOrder.status, "PICKED_UP");
    assert.equal(secondOrder.status, "PREPARING");

    secondOrder.status = "READY";
    const fullyPickedUp = await service.markBusinessOrderPickedUp(
      courierId,
      orderGroupId,
      secondOrder.id
    );

    assert.equal(fullyPickedUp.status, "PICKED_UP");
    assert.equal(secondOrder.status, "PICKED_UP");
  });

  it("blocks delivery start until every business order has been picked up", async () => {
    const firstOrder = createOrder({ id: "order-1", status: "PICKED_UP", courierId });
    const secondOrder = createOrder({
      id: "order-2",
      businessId: "business-2",
      status: "PREPARING",
      courierId
    });
    const { service } = createService({ orders: [firstOrder, secondOrder] });

    await assert.rejects(
      service.updateCourierDeliveryStatus(courierId, orderGroupId, "ON_THE_WAY"),
      ConflictException
    );
  });

  it("requeues ready orders when a courier becomes available", async () => {
    const firstOrder = createOrder({ id: "order-1", status: "READY" });
    const secondOrder = createOrder({
      id: "order-2",
      businessId: "business-2",
      status: "READY"
    });
    const { service, enqueuedOfferGenerations } = createService({
      orders: [firstOrder, secondOrder]
    });

    await service.updateCourierAvailability(courierId, {
      status: "AVAILABLE",
      latitude: 20.0289,
      longitude: -96.6472
    });

    assert.deepEqual(enqueuedOfferGenerations, [orderGroupId]);
  });

  it("blocks new orders when the courier has an overdue cash settlement", async () => {
    const settlement = {
      id: "settlement-1",
      courierId,
      settlementDate: "2026-06-05",
      status: "PENDING",
      periodEndAt: new Date(Date.now() - 31 * 60_000),
      netDueToRapivCents: 1250
    } as CashSettlement;
    const { service } = createService({ cashSettlements: [settlement] });

    await assert.rejects(
      service.updateCourierAvailability(courierId, {
        status: "AVAILABLE",
        latitude: 20.0289,
        longitude: -96.6472
      }),
      ConflictException
    );
  });

  it("blocks new orders when a business cash payout is overdue", async () => {
    const order = createOrder({
      status: "DELIVERED",
      courierId,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashCollectedAt: new Date(Date.now() - 121 * 60_000),
      businessPayoutCents: 2250,
      businessCashPayoutStatus: "PENDING"
    });
    const { service } = createService({ orders: [order] });

    await assert.rejects(
      service.updateCourierAvailability(courierId, {
        status: "AVAILABLE",
        latitude: 20.0289,
        longitude: -96.6472
      }),
      ConflictException
    );
  });

  it("lets the business confirm a delivered cash payout", async () => {
    const order = createOrder({
      status: "DELIVERED",
      courierId,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      businessPayoutCents: 2250,
      businessCashPayoutStatus: "PENDING"
    });
    const { service } = createService({ orders: [order] });

    const businessOrder = await service.confirmBusinessCashPayout(
      ownerUserId,
      businessId,
      order.id
    );

    assert.equal(businessOrder.businessCashPayoutStatus, "CONFIRMED");
    assert.ok(order.businessCashPayoutConfirmedAt);
    assert.equal(order.businessCashPayoutConfirmedByUserId, ownerUserId);
  });

  it("lets the business confirm cash payment for a ready pickup order", async () => {
    const order = createOrder({
      status: "READY",
      fulfillmentMethod: "PICKUP",
      paymentMethod: "CASH",
      paymentStatus: "UNPAID",
      businessPayoutCents: 2250,
      businessCashPayoutStatus: "PENDING"
    });
    const { service } = createService({ orders: [order] });

    const businessOrder = await service.confirmBusinessCashPayout(
      ownerUserId,
      businessId,
      order.id
    );

    assert.equal(businessOrder.status, "DELIVERED");
    assert.equal(businessOrder.paymentStatus, "PAID");
    assert.equal(businessOrder.businessCashPayoutStatus, "CONFIRMED");
    assert.equal(order.cashReceivedCents, 1200);
    assert.equal(order.cashChangeCents, 0);
  });

  it("adds a missing delivery offer for a newly available courier", async () => {
    const order = createOrder({
      status: "READY",
      businessLatitude: 20.0289,
      businessLongitude: -96.6472
    });
    const existingOffer = {
      id: "offer-1",
      orderGroupId,
      courierId,
      status: "PENDING",
      score: 9000,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date()
    } as DeliveryOffer;
    const { service, offers } = createService({
      orders: [order],
      offers: [existingOffer],
      users: [
        { id: courierId, roles: ["COURIER"] } as User,
        { id: otherCourierId, roles: ["COURIER"] } as User
      ],
      courierProfiles: [
        {
          userId: otherCourierId,
          availabilityStatus: "AVAILABLE",
          preferredLatitude: 20.0289,
          preferredLongitude: -96.6472,
          preferredRadiusKm: 35,
          maxDeliveryDistanceKm: 35,
          createdAt: new Date(),
          updatedAt: new Date()
        } as CourierProfile
      ]
    });

    await service.generateDeliveryOffersForGroup(orderGroupId);

    assert.equal(offers.length, 2);
    assert.equal(offers[1].courierId, otherCourierId);
    assert.equal(offers[1].status, "PENDING");
  });

  it("creates missing offers before returning courier offers", async () => {
    const order = createOrder({
      status: "READY",
      businessLatitude: 20.0289,
      businessLongitude: -96.6472
    });
    const existingOffer = {
      id: "offer-1",
      orderGroupId,
      courierId,
      status: "PENDING",
      score: 9000,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date()
    } as DeliveryOffer;
    const { service } = createService({
      orders: [order],
      offers: [existingOffer],
      users: [
        { id: courierId, roles: ["COURIER"] } as User,
        { id: otherCourierId, roles: ["COURIER"] } as User
      ],
      courierProfiles: [
        {
          userId: otherCourierId,
          availabilityStatus: "AVAILABLE",
          preferredLatitude: 20.0289,
          preferredLongitude: -96.6472,
          preferredRadiusKm: 35,
          maxDeliveryDistanceKm: 35,
          createdAt: new Date(),
          updatedAt: new Date()
        } as CourierProfile
      ]
    });

    const summaries = await service.findOffersForCourier(otherCourierId);

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].order.id, orderGroupId);
  });

  it("rejects courier assignment unless the group is ready and unassigned to others", async () => {
    const { service: pendingService } = createService({
      orders: [createOrder({ status: "PREPARING" })]
    });

    await assert.rejects(
      pendingService.assignToCourier(courierId, orderGroupId),
      ConflictException
    );

    const { service: assignedService } = createService({
      orders: [createOrder({ status: "READY", courierId: otherCourierId })]
    });

    await assert.rejects(
      assignedService.assignToCourier(courierId, orderGroupId),
      ConflictException
    );
  });

  it("enforces courier delivery transitions and assignment", async () => {
    const order = createOrder({ status: "ASSIGNED", courierId });
    const { service, sentNotifications } = createService({ orders: [order] });

    const pickedUp = await service.updateCourierDeliveryStatus(courierId, orderGroupId, "PICKED_UP");
    assert.equal(pickedUp.status, "PICKED_UP");
    assert.equal(order.status, "PICKED_UP");

    await assert.rejects(
      service.updateCourierDeliveryStatus(courierId, orderGroupId, "DELIVERED"),
      ConflictException
    );

    await assert.rejects(
      service.updateCourierDeliveryStatus(otherCourierId, orderGroupId, "ON_THE_WAY"),
      ForbiddenException
    );
  });

  it("queues courier payout when a paid card order is delivered", async () => {
    const order = createOrder({
      status: "ON_THE_WAY",
      courierId,
      paymentMethod: "CARD",
      paymentStatus: "PAID",
      courierPayoutCents: 2000,
      courierPayoutStatus: "PENDING"
    });
    const { service, queuedCourierPayoutOrderGroupIds } = createService({ orders: [order] });

    const delivered = await service.updateCourierDeliveryStatus(courierId, orderGroupId, "DELIVERED");

    assert.equal(delivered.status, "DELIVERED");
    assert.deepEqual(queuedCourierPayoutOrderGroupIds, [orderGroupId]);
  });

  it("limits order access by user role and ownership", async () => {
    const order = createOrder({ courierId });
    const { service } = createService({
      orders: [order],
      businesses: [openBusiness]
    });

    await assert.doesNotReject(
      service.findByIdForUser(orderGroupId, { sub: "admin-1", roles: ["ADMIN"] })
    );
    await assert.doesNotReject(
      service.findByIdForUser(orderGroupId, { sub: customerId, roles: ["CUSTOMER"] })
    );
    await assert.doesNotReject(
      service.findByIdForUser(orderGroupId, { sub: courierId, roles: ["COURIER"] })
    );
    await assert.doesNotReject(
      service.findByIdForUser(orderGroupId, { sub: ownerUserId, roles: ["BUSINESS_OWNER"] })
    );
    await assert.rejects(
      service.findByIdForUser(orderGroupId, { sub: "stranger-1", roles: ["CUSTOMER"] }),
      ForbiddenException
    );
  });

  it("allows location reads and writes only during an active delivery", async () => {
    const order = createOrder({ status: "ASSIGNED", courierId });
    const { service, sentNotifications } = createService({ orders: [order] });

    await assert.deepEqual(
      await service.updateCustomerLocation(customerId, orderGroupId, {
        latitude: 20.0289,
        longitude: -96.6472
      }),
      { ok: true }
    );
    await assert.deepEqual(
      await service.updateCourierLocation(courierId, orderGroupId, {
        latitude: 20.03,
        longitude: -96.65
      }),
      { ok: true }
    );

    const location = await service.getDeliveryLocation(customerId, orderGroupId);
    assert.deepEqual(location.customer, { latitude: 20.0289, longitude: -96.6472 });
    assert.deepEqual(location.courier, { latitude: 20.03, longitude: -96.65 });
    assert.equal(sentNotifications.length, 0);

    await assert.deepEqual(
      await service.updateCourierLocation(courierId, orderGroupId, {
        latitude: 20.0289,
        longitude: -96.6472
      }),
      { ok: true }
    );
    assert.equal(sentNotifications.at(-1)?.message.data?.type, "COURIER_ARRIVED");
    assert.ok(order.arrivalNotifiedAt);

    order.status = "DELIVERED" as BusinessOrderStatus;

    await assert.rejects(
      service.updateCustomerLocation(customerId, orderGroupId, {
        latitude: 20.0289,
        longitude: -96.6472
      }),
      ConflictException
    );
    await assert.rejects(
      service.getDeliveryLocation(customerId, orderGroupId),
      ConflictException
    );
  });

  it("keeps delivery location private to the customer and assigned courier", async () => {
    const { service } = createService({
      orders: [createOrder({ status: "ON_THE_WAY", courierId })]
    });

    await assert.rejects(
      service.updateCustomerLocation("other-customer", orderGroupId, {
        latitude: 20.0289,
        longitude: -96.6472
      }),
      ForbiddenException
    );
    await assert.rejects(
      service.updateCourierLocation(otherCourierId, orderGroupId, {
        latitude: 20.0289,
        longitude: -96.6472
      }),
      ForbiddenException
    );
    await assert.rejects(
      service.getDeliveryLocation("stranger-1", orderGroupId),
      ForbiddenException
    );
  });

  it("lets the assigned courier notify arrival once while on the way", async () => {
    const order = createOrder({ status: "ON_THE_WAY", courierId });
    const { service, sentNotifications } = createService({ orders: [order] });

    const firstNotice = await service.notifyCustomerCourierArrived(courierId, orderGroupId);
    const duplicateNotice = await service.notifyCustomerCourierArrived(courierId, orderGroupId);

    assert.deepEqual(firstNotice, { ok: true, alreadyNotified: false });
    assert.deepEqual(duplicateNotice, { ok: true, alreadyNotified: true });
    assert.equal(order.arrivalNotifiedAt instanceof Date, true);
    assert.equal(sentNotifications.length, 1);
    assert.equal(sentNotifications[0].message.data?.type, "COURIER_ARRIVED");
  });

  it("rejects manual arrival notice before the courier is on the way", async () => {
    const order = createOrder({ status: "PICKED_UP", courierId });
    const { service } = createService({ orders: [order] });

    await assert.rejects(
      service.notifyCustomerCourierArrived(courierId, orderGroupId),
      ConflictException
    );
  });

  it("creates and refreshes courier Stripe Connect profile", async () => {
    const { service, courierProfiles, stripeAccountCalls } = createService();

    const onboarding = await service.createCourierStripeOnboardingLink(courierId);

    assert.equal(onboarding.url, "https://connect.stripe.test/onboarding");
    assert.equal(onboarding.profile.stripeConnectedAccountId, "acct_courier_1");
    assert.equal(onboarding.profile.stripePlatformAccountId, "acct_platform_1");
    assert.equal(stripeAccountCalls.length, 1);
    assert.deepEqual(
      (stripeAccountCalls[0] as { metadata: Record<string, string> }).metadata,
      { courier_user_id: courierId }
    );

    const refreshed = await service.refreshCourierStripeConnectStatus(courierId);

    assert.equal(refreshed.stripePayoutsEnabled, true);
    assert.equal(refreshed.stripeDetailsSubmitted, true);
    assert.equal(courierProfiles.length, 1);
  });
});
