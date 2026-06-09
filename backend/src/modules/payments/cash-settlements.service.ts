import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { And, LessThanOrEqual, MoreThan, Repository } from "typeorm";

import { Order } from "../orders/order.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { CashSettlement } from "./cash-settlement.entity";

export type CashSettlementSummary = {
  courierId: string;
  settlementDate: string;
  periodStartAt: Date;
  periodEndAt: Date;
  orderGroupCount: number;
  orderGroupIds: string[];
  cashCollectedCents: number;
  cashChangeCents: number;
  businessPayoutCents: number;
  rapivCommissionCents: number;
  courierPayoutCents: number;
  platformDeliveryMarginCents: number;
  netDueToRapivCents: number;
};

@Injectable()
export class CashSettlementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CashSettlementsService.name);
  private autoSettlementTimer?: NodeJS.Timeout;
  private lastAutoSettlementDate?: string;

  constructor(
    @InjectRepository(CashSettlement)
    private readonly settlementRepository: Repository<CashSettlement>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly notificationsService: NotificationsService
  ) {}

  onModuleInit(): void {
    if (!this.autoSettlementEnabled()) {
      return;
    }

    void this.runDueDailySettlement(new Date());
    this.autoSettlementTimer = setInterval(() => {
      const now = new Date();
      void this.runDueDailySettlement(now);
      void this.notifyOverdueSettlements(now);
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.autoSettlementTimer) {
      clearInterval(this.autoSettlementTimer);
    }
  }

  async findCourierSettlement(courierId: string, settlementDate?: string): Promise<CashSettlement | CashSettlementSummary> {
    const normalizedDate = this.normalizeSettlementDate(settlementDate);
    const existing = await this.settlementRepository.findOne({
      where: { courierId, settlementDate: normalizedDate }
    });

    if (existing) {
      return existing;
    }

    return this.buildCourierSummary(courierId, normalizedDate);
  }

  async findDailySettlements(settlementDate?: string): Promise<CashSettlement[]> {
    const normalizedDate = this.normalizeSettlementDate(settlementDate);
    return this.settlementRepository.find({
      where: { settlementDate: normalizedDate },
      order: { courierId: "ASC" }
    });
  }

  async runDailySettlement(settlementDate?: string): Promise<CashSettlement[]> {
    const normalizedDate = this.normalizeSettlementDate(settlementDate);
    const summaries = await this.buildDailySummaries(normalizedDate);
    const settlements: CashSettlement[] = [];

    for (const summary of summaries) {
      const existing = await this.settlementRepository.findOne({
        where: {
          courierId: summary.courierId,
          settlementDate: summary.settlementDate
        }
      });

      if (existing?.status === "CONFIRMED") {
        settlements.push(existing);
        continue;
      }

      const settlement = existing ?? this.settlementRepository.create({
        courierId: summary.courierId,
        settlementDate: summary.settlementDate
      });

      Object.assign(settlement, {
        periodStartAt: summary.periodStartAt,
        periodEndAt: summary.periodEndAt,
        status: existing?.status ?? "PENDING",
        orderGroupCount: summary.orderGroupCount,
        orderGroupIds: summary.orderGroupIds,
        cashCollectedCents: summary.cashCollectedCents,
        cashChangeCents: summary.cashChangeCents,
        businessPayoutCents: summary.businessPayoutCents,
        rapivCommissionCents: summary.rapivCommissionCents,
        courierPayoutCents: summary.courierPayoutCents,
        platformDeliveryMarginCents: summary.platformDeliveryMarginCents,
        netDueToRapivCents: summary.netDueToRapivCents,
        courierNotifiedAt: existing?.courierNotifiedAt ?? null,
        courierOverdueNotifiedAt: existing?.courierOverdueNotifiedAt ?? null
      });

      const savedSettlement = await this.settlementRepository.save(settlement);
      await this.notifyCourierSettlementCreated(savedSettlement);
      settlements.push(savedSettlement);
    }

    return settlements;
  }

  async confirmSettlement(settlementId: string, adminUserId: string): Promise<CashSettlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId }
    });

    if (!settlement) {
      throw new NotFoundException("Cash settlement not found");
    }

    settlement.status = "CONFIRMED";
    settlement.confirmedAt = new Date();
    settlement.confirmedByUserId = adminUserId;

    return this.settlementRepository.save(settlement);
  }

  private async runDueDailySettlement(now: Date): Promise<void> {
    const local = this.toLocalParts(now);
    const cutoffHour = this.cutoffHour();
    const cutoffMinute = this.cutoffMinute();

    if (
      local.hour < cutoffHour ||
      (local.hour === cutoffHour && local.minute < cutoffMinute) ||
      this.lastAutoSettlementDate === local.date
    ) {
      return;
    }

    this.lastAutoSettlementDate = local.date;

    try {
      const settlements = await this.runDailySettlement(local.date);
      this.logger.log(`Cash settlement generated for ${local.date}: ${settlements.length} couriers`);
    } catch (error) {
      this.lastAutoSettlementDate = undefined;
      const message = error instanceof Error ? error.message : "Unknown cash settlement error";
      this.logger.error(`Cash settlement generation failed: ${message}`);
    }
  }

  async notifyOverdueSettlements(now = new Date()): Promise<void> {
    const overdueCutoff = new Date(now.getTime() - this.graceMinutes() * 60_000);
    const settlements = await this.settlementRepository.find({
      where: {
        status: "PENDING",
        periodEndAt: LessThanOrEqual(overdueCutoff),
        netDueToRapivCents: MoreThan(0)
      }
    });

    for (const settlement of settlements) {
      if (settlement.courierOverdueNotifiedAt) {
        continue;
      }

      await this.notificationsService.sendToUser(settlement.courierId, {
        title: "Comision vencida",
        body: `Entrega tu liquidacion pendiente de ${this.formatMoney(settlement.netDueToRapivCents)} para recibir nuevos pedidos.`,
        data: {
          type: "CASH_SETTLEMENT_OVERDUE",
          settlementId: settlement.id,
          settlementDate: settlement.settlementDate,
          netDueToRapivCents: settlement.netDueToRapivCents
        }
      });

      settlement.courierOverdueNotifiedAt = now;
      await this.settlementRepository.save(settlement);
    }
  }

  private async notifyCourierSettlementCreated(settlement: CashSettlement): Promise<void> {
    if (
      settlement.status !== "PENDING" ||
      settlement.courierNotifiedAt ||
      Number(settlement.netDueToRapivCents ?? 0) <= 0
    ) {
      return;
    }

    await this.notificationsService.sendToUser(settlement.courierId, {
      title: "Comision pendiente",
      body: `Tu corte de efectivo es ${this.formatMoney(settlement.netDueToRapivCents)}. Entregalo antes de las ${this.blockTimeLabel()}.`,
      data: {
        type: "CASH_SETTLEMENT_DUE",
        settlementId: settlement.id,
        settlementDate: settlement.settlementDate,
        netDueToRapivCents: settlement.netDueToRapivCents
      }
    });

    settlement.courierNotifiedAt = new Date();
    await this.settlementRepository.save(settlement);
  }

  private async buildCourierSummary(courierId: string, settlementDate: string): Promise<CashSettlementSummary> {
    const summaries = await this.buildDailySummaries(settlementDate);
    const existing = summaries.find((summary) => summary.courierId === courierId);

    if (existing) {
      return existing;
    }

    const period = this.settlementPeriod(settlementDate);
    return {
      courierId,
      settlementDate,
      periodStartAt: period.start,
      periodEndAt: period.end,
      orderGroupCount: 0,
      orderGroupIds: [],
      cashCollectedCents: 0,
      cashChangeCents: 0,
      businessPayoutCents: 0,
      rapivCommissionCents: 0,
      courierPayoutCents: 0,
      platformDeliveryMarginCents: 0,
      netDueToRapivCents: 0
    };
  }

  private async buildDailySummaries(settlementDate: string): Promise<CashSettlementSummary[]> {
    const period = this.settlementPeriod(settlementDate);
    const orders = await this.orderRepository.find({
      where: {
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        cashCollectedAt: And(MoreThan(period.start), LessThanOrEqual(period.end))
      },
      order: { cashCollectedAt: "ASC" }
    });

    return this.summarizeOrders(orders, settlementDate, period.start, period.end);
  }

  summarizeOrders(
    orders: Order[],
    settlementDate: string,
    periodStartAt: Date,
    periodEndAt: Date
  ): CashSettlementSummary[] {
    const groupsByCourier = new Map<string, Map<string, Order[]>>();

    for (const order of orders) {
      if (
        order.fulfillmentMethod !== "DELIVERY" ||
        order.paymentMethod !== "CASH" ||
        order.paymentStatus !== "PAID" ||
        !order.courierId ||
        !order.orderGroupId ||
        order.status !== "DELIVERED"
      ) {
        continue;
      }

      const groups = groupsByCourier.get(order.courierId) ?? new Map<string, Order[]>();
      const groupOrders = groups.get(order.orderGroupId) ?? [];
      groupOrders.push(order);
      groups.set(order.orderGroupId, groupOrders);
      groupsByCourier.set(order.courierId, groups);
    }

    return [...groupsByCourier.entries()].map(([courierId, groups]) => {
      const summary: CashSettlementSummary = {
        courierId,
        settlementDate,
        periodStartAt,
        periodEndAt,
        orderGroupCount: groups.size,
        orderGroupIds: [...groups.keys()],
        cashCollectedCents: 0,
        cashChangeCents: 0,
        businessPayoutCents: 0,
        rapivCommissionCents: 0,
        courierPayoutCents: 0,
        platformDeliveryMarginCents: 0,
        netDueToRapivCents: 0
      };

      for (const groupOrders of groups.values()) {
        const cashOrder = groupOrders.find((order) => Number(order.cashReceivedCents ?? 0) > 0) ?? groupOrders[0];
        summary.cashCollectedCents += Number(cashOrder.cashReceivedCents ?? 0);
        summary.cashChangeCents += Number(cashOrder.cashChangeCents ?? 0);
        summary.businessPayoutCents += groupOrders.reduce((sum, order) => sum + Number(order.businessPayoutCents ?? 0), 0);
        summary.rapivCommissionCents += groupOrders.reduce((sum, order) => sum + Number(order.businessCommissionCents ?? 0), 0);
        summary.courierPayoutCents += groupOrders.reduce((sum, order) => sum + Number(order.courierPayoutCents ?? 0), 0);
        summary.platformDeliveryMarginCents += groupOrders.reduce((sum, order) => sum + Number(order.platformDeliveryMarginCents ?? 0), 0);
      }

      summary.netDueToRapivCents =
        summary.cashCollectedCents -
        summary.cashChangeCents -
        summary.businessPayoutCents -
        summary.courierPayoutCents;

      return summary;
    });
  }

  private settlementPeriod(settlementDate: string): { start: Date; end: Date } {
    const end = this.localDateAtCutoffToUtc(settlementDate);
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private localDateAtCutoffToUtc(settlementDate: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(settlementDate);

    if (!match) {
      throw new BadRequestException("Settlement date must use YYYY-MM-DD");
    }

    const [, year, month, day] = match;
    const utcMs = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      this.cutoffHour(),
      this.cutoffMinute()
    );

    return new Date(utcMs - this.timezoneOffsetMinutes() * 60_000);
  }

  private normalizeSettlementDate(settlementDate: string | undefined): string {
    if (settlementDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(settlementDate)) {
        throw new BadRequestException("Settlement date must use YYYY-MM-DD");
      }

      return settlementDate;
    }

    return this.toLocalParts(new Date()).date;
  }

  private toLocalParts(date: Date): { date: string; hour: number; minute: number } {
    const local = new Date(date.getTime() + this.timezoneOffsetMinutes() * 60_000);

    return {
      date: local.toISOString().slice(0, 10),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes()
    };
  }

  private cutoffHour(): number {
    return this.integerEnv("CASH_SETTLEMENT_CUTOFF_HOUR", 22, 0, 23);
  }

  private cutoffMinute(): number {
    return this.integerEnv("CASH_SETTLEMENT_CUTOFF_MINUTE", 0, 0, 59);
  }

  private timezoneOffsetMinutes(): number {
    return this.integerEnv("CASH_SETTLEMENT_TIMEZONE_OFFSET_MINUTES", -360, -720, 840);
  }

  private autoSettlementEnabled(): boolean {
    return process.env.CASH_SETTLEMENT_AUTO_RUN !== "false";
  }

  private graceMinutes(): number {
    return this.integerEnv("CASH_SETTLEMENT_GRACE_MINUTES", 30, 0, 240);
  }

  private blockTimeLabel(): string {
    const totalMinutes = this.cutoffHour() * 60 + this.cutoffMinute() + this.graceMinutes();
    const hour = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  private formatMoney(cents: number): string {
    return `$${(Number(cents ?? 0) / 100).toFixed(2)}`;
  }

  private integerEnv(key: string, fallback: number, minimum: number, maximum: number): number {
    const raw = process.env[key];

    if (raw === undefined || raw === "") {
      return fallback;
    }

    const parsed = Number(raw);

    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
    }

    return parsed;
  }
}
