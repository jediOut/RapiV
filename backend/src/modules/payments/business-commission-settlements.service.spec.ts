import "reflect-metadata";

import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Business } from "../businesses/business.entity";
import { Order } from "../orders/order.entity";
import { BusinessCommissionSettlement } from "./business-commission-settlement.entity";
import { BusinessCommissionSettlementsService } from "./business-commission-settlements.service";

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  return left === right;
}

function createService(options: {
  settlements?: BusinessCommissionSettlement[];
  orders?: Order[];
  businesses?: Business[];
} = {}) {
  const settlements = options.settlements ?? [];
  const orders = options.orders ?? [];
  const businesses = options.businesses ?? [];
  const notifications: Array<{
    userId: string;
    message: { title: string; body: string; data?: Record<string, unknown> };
  }> = [];

  const settlementRepository = {
    create(value: Partial<BusinessCommissionSettlement>) {
      return {
        id: `business-settlement-${settlements.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value
      } as BusinessCommissionSettlement;
    },
    async findOne(options: { where: Partial<BusinessCommissionSettlement> }) {
      return settlements.find((settlement) =>
        Object.entries(options.where).every(
          ([key, value]) => sameValue((settlement as unknown as Record<string, unknown>)[key], value)
        )
      ) ?? null;
    },
    async find() {
      return settlements;
    },
    async save(settlement: BusinessCommissionSettlement) {
      const existingIndex = settlements.findIndex((existing) => existing.id === settlement.id);

      if (existingIndex >= 0) {
        settlements[existingIndex] = settlement;
      } else {
        settlements.push(settlement);
      }

      return settlement;
    }
  };
  const orderRepository = {
    async find() {
      return orders;
    }
  };
  const businessRepository = {
    async find() {
      return businesses;
    },
    async findOne(options: { where: Partial<Business> }) {
      return businesses.find((business) =>
        Object.entries(options.where).every(
          ([key, value]) => (business as unknown as Record<string, unknown>)[key] === value
        )
      ) ?? null;
    }
  };
  const notificationsService = {
    async sendToUser(userId: string, message: { title: string; body: string; data?: Record<string, unknown> }) {
      notifications.push({ userId, message });
    }
  };

  return {
    service: new BusinessCommissionSettlementsService(
      settlementRepository as never,
      orderRepository as never,
      businessRepository as never,
      notificationsService as never
    ),
    settlements,
    notifications
  };
}

describe("BusinessCommissionSettlementsService", () => {
  it("summarizes only paid delivered pickup cash orders", () => {
    const { service } = createService();
    const periodStartAt = new Date("2026-06-01T16:00:00.000Z");
    const periodEndAt = new Date("2026-06-08T16:00:00.000Z");
    const businesses = [
      { id: "business-1", ownerUserId: "owner-1" },
      { id: "business-2", ownerUserId: "owner-2" }
    ] as Business[];
    const orders = [
      {
        id: "order-1",
        businessId: "business-1",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        status: "DELIVERED",
        subtotalCents: 5000,
        businessPayoutCents: 4500,
        businessCommissionCents: 500
      },
      {
        id: "order-2",
        businessId: "business-1",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        status: "DELIVERED",
        subtotalCents: 2500,
        businessPayoutCents: 2250,
        businessCommissionCents: 250
      },
      {
        id: "delivery-cash",
        businessId: "business-1",
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        status: "DELIVERED",
        subtotalCents: 3000,
        businessPayoutCents: 2700,
        businessCommissionCents: 300
      },
      {
        id: "pickup-card",
        businessId: "business-2",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CARD",
        paymentStatus: "PAID",
        status: "DELIVERED",
        subtotalCents: 4000,
        businessPayoutCents: 3600,
        businessCommissionCents: 400
      }
    ] as Order[];

    const [summary] = service.summarizeOrders(
      orders,
      businesses,
      "2026-06-08",
      periodStartAt,
      periodEndAt
    );

    assert.equal(summary.businessId, "business-1");
    assert.equal(summary.ownerUserId, "owner-1");
    assert.equal(summary.orderCount, 2);
    assert.deepEqual(summary.orderIds, ["order-1", "order-2"]);
    assert.equal(summary.grossSalesCents, 7500);
    assert.equal(summary.businessPayoutCents, 6750);
    assert.equal(summary.rapivCommissionCents, 750);
  });

  it("creates a weekly settlement and notifies the business once", async () => {
    const { service, settlements, notifications } = createService({
      businesses: [
        { id: "business-1", ownerUserId: "owner-1" }
      ] as Business[],
      orders: [
        {
          id: "order-1",
          businessId: "business-1",
          fulfillmentMethod: "PICKUP",
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          status: "DELIVERED",
          paidAt: new Date("2026-06-05T18:00:00.000Z"),
          subtotalCents: 5000,
          businessPayoutCents: 4500,
          businessCommissionCents: 500
        }
      ] as Order[]
    });

    await service.runWeeklySettlement("2026-06-08");
    await service.runWeeklySettlement("2026-06-08");

    assert.equal(settlements.length, 1);
    assert.equal(settlements[0].businessId, "business-1");
    assert.equal(settlements[0].rapivCommissionCents, 500);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, "owner-1");
    assert.equal(notifications[0].message.data?.type, "BUSINESS_COMMISSION_SETTLEMENT_DUE");
  });
});
