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
import type { BusinessOrderStatus } from "./order.entity";
import { OrdersService } from "./orders.service";
import { User } from "../users/user.entity";

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
  products?: Product[];
  businesses?: Business[];
  offers?: DeliveryOffer[];
  courierProfiles?: CourierProfile[];
  users?: User[];
  businessOwnerId?: string;
} = {}) {
  const orders = options.orders ?? [];
  const products = options.products ?? [];
  const businesses = options.businesses ?? [];
  const offers = options.offers ?? [];
  const courierProfiles = options.courierProfiles ?? [];
  const users = options.users ?? [];
  const enqueuedOfferGenerations: string[] = [];
  let orderSequence = 1;
  let transactionCount = 0;

  const findOrder = (where: Partial<Order>) =>
    orders.find((order) =>
      Object.entries(where).every(([key, value]) => (order as unknown as Record<string, unknown>)[key] === value)
    ) ?? null;

  const orderRepository: RepositoryMock<Order> = {
    async findOne(options: { where: Partial<Order> }) {
      return findOrder(options.where);
    },
    async find(options: { where?: Partial<Order> }) {
      if (!options.where) {
        return orders;
      }

      return orders.filter((order) =>
        Object.entries(options.where ?? {}).every(
          ([key, value]) => (order as unknown as Record<string, unknown>)[key] === value
        )
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
    async sendToUsers() {
      return undefined;
    }
  };

  const service = new OrdersService(
    orderRepository as never,
    deliveryOfferRepository as never,
    {} as never,
    userRepository as never,
    courierProfileRepository as never,
    {} as never,
    dataSource as never,
    businessesService as never,
    orderProcessingQueue as never,
    notificationsService as never,
    {} as never
  );

  return {
    service,
    orders,
    offers,
    enqueuedOfferGenerations,
    sentNotifications,
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

  it("coalesces concurrent creates with the same idempotency key", async () => {
    const { service, getTransactionCount } = createService({
      products: [product],
      businesses: [openBusiness]
    });

    const dto = {
      deliveryAddress: " Calle Principal 123 ",
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
});
