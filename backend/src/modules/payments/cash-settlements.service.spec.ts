import "reflect-metadata";

import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Order } from "../orders/order.entity";
import { CashSettlement } from "./cash-settlement.entity";
import { CashSettlementsService } from "./cash-settlements.service";

function createService(options: {
  settlements?: CashSettlement[];
  orders?: Order[];
} = {}) {
  const settlements = options.settlements ?? [];
  const orders = options.orders ?? [];
  const notifications: Array<{
    userId: string;
    message: { title: string; body: string; data?: Record<string, unknown> };
  }> = [];

  const settlementRepository = {
    create(value: Partial<CashSettlement>) {
      return {
        id: `settlement-${settlements.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value
      } as CashSettlement;
    },
    async findOne(options: { where: Partial<CashSettlement> }) {
      return settlements.find((settlement) =>
        Object.entries(options.where).every(
          ([key, value]) => (settlement as unknown as Record<string, unknown>)[key] === value
        )
      ) ?? null;
    },
    async find() {
      return settlements;
    },
    async save(settlement: CashSettlement) {
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
  const notificationsService = {
    async sendToUser(userId: string, message: { title: string; body: string; data?: Record<string, unknown> }) {
      notifications.push({ userId, message });
    }
  };

  return {
    service: new CashSettlementsService(
      settlementRepository as never,
      orderRepository as never,
      notificationsService as never
    ),
    settlements,
    notifications
  };
}

describe("CashSettlementsService", () => {
  it("summarizes grouped cash orders once for customer cash and sums business payouts", () => {
    const { service } = createService();
    const periodStartAt = new Date("2026-06-05T04:00:00.000Z");
    const periodEndAt = new Date("2026-06-06T04:00:00.000Z");

    const orders = [
      {
        id: "order-1",
        orderGroupId: "group-1",
        courierId: "courier-1",
        status: "DELIVERED",
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        cashReceivedCents: 5500,
        cashChangeCents: 0,
        businessPayoutCents: 1800,
        businessCommissionCents: 200,
        courierPayoutCents: 2000,
        platformDeliveryMarginCents: 1000
      },
      {
        id: "order-2",
        orderGroupId: "group-1",
        courierId: "courier-1",
        status: "DELIVERED",
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        cashReceivedCents: 5500,
        cashChangeCents: 0,
        businessPayoutCents: 450,
        businessCommissionCents: 50,
        courierPayoutCents: 0,
        platformDeliveryMarginCents: 0
      },
      {
        id: "pickup-order",
        orderGroupId: "pickup-group",
        courierId: "courier-1",
        status: "DELIVERED",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        cashReceivedCents: 3000,
        cashChangeCents: 0,
        businessPayoutCents: 2700,
        businessCommissionCents: 300,
        courierPayoutCents: 0,
        platformDeliveryMarginCents: 0
      }
    ] as Order[];

    const [summary] = service.summarizeOrders(
      orders,
      "2026-06-05",
      periodStartAt,
      periodEndAt
    );

    assert.equal(summary.courierId, "courier-1");
    assert.equal(summary.orderGroupCount, 1);
    assert.deepEqual(summary.orderGroupIds, ["group-1"]);
    assert.equal(summary.cashCollectedCents, 5500);
    assert.equal(summary.cashChangeCents, 0);
    assert.equal(summary.businessPayoutCents, 2250);
    assert.equal(summary.rapivCommissionCents, 250);
    assert.equal(summary.courierPayoutCents, 2000);
    assert.equal(summary.platformDeliveryMarginCents, 1000);
    assert.equal(summary.netDueToRapivCents, 1250);
  });

  it("notifies the courier once when a daily settlement is created", async () => {
    const { service, notifications } = createService({
      orders: [
        {
          id: "order-1",
          orderGroupId: "group-1",
          courierId: "courier-1",
          status: "DELIVERED",
          fulfillmentMethod: "DELIVERY",
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          cashCollectedAt: new Date("2026-06-06T03:00:00.000Z"),
          cashReceivedCents: 5500,
          cashChangeCents: 0,
          businessPayoutCents: 2250,
          businessCommissionCents: 250,
          courierPayoutCents: 2000,
          platformDeliveryMarginCents: 1000
        }
      ] as Order[]
    });

    await service.runDailySettlement("2026-06-05");
    await service.runDailySettlement("2026-06-05");

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, "courier-1");
    assert.equal(notifications[0].message.data?.type, "CASH_SETTLEMENT_DUE");
  });
});
