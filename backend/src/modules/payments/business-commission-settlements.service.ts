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

import { Business } from "../businesses/business.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { Order } from "../orders/order.entity";
import { BusinessCommissionSettlement } from "./business-commission-settlement.entity";

export type BusinessCommissionSettlementSummary = {
  businessId: string;
  ownerUserId: string;
  settlementWeek: string;
  periodStartAt: Date;
  periodEndAt: Date;
  orderCount: number;
  orderIds: string[];
  grossSalesCents: number;
  businessPayoutCents: number;
  rapivCommissionCents: number;
};

@Injectable()
export class BusinessCommissionSettlementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BusinessCommissionSettlementsService.name);
  private autoSettlementTimer?: NodeJS.Timeout;
  private lastAutoSettlementWeek?: string;

  constructor(
    @InjectRepository(BusinessCommissionSettlement)
    private readonly settlementRepository: Repository<BusinessCommissionSettlement>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly notificationsService: NotificationsService
  ) {}

  onModuleInit(): void {
    if (!this.autoSettlementEnabled()) {
      return;
    }

    void this.runDueWeeklySettlement(new Date());
    this.autoSettlementTimer = setInterval(() => {
      void this.runDueWeeklySettlement(new Date());
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.autoSettlementTimer) {
      clearInterval(this.autoSettlementTimer);
    }
  }

  async findBusinessSettlements(ownerUserId: string, businessId: string): Promise<BusinessCommissionSettlement[]> {
    await this.assertBusinessOwner(ownerUserId, businessId);
    return this.settlementRepository.find({
      where: { businessId },
      order: { periodEndAt: "DESC" }
    });
  }

  async findWeeklySettlements(settlementWeek?: string): Promise<BusinessCommissionSettlement[]> {
    const normalizedWeek = this.normalizeSettlementWeek(settlementWeek);
    return this.settlementRepository.find({
      where: { settlementWeek: normalizedWeek },
      order: { businessId: "ASC" }
    });
  }

  async runWeeklySettlement(settlementWeek?: string): Promise<BusinessCommissionSettlement[]> {
    const normalizedWeek = this.normalizeSettlementWeek(settlementWeek);
    const summaries = await this.buildWeeklySummaries(normalizedWeek);
    const settlements: BusinessCommissionSettlement[] = [];

    for (const summary of summaries) {
      const existing = await this.settlementRepository.findOne({
        where: {
          businessId: summary.businessId,
          periodStartAt: summary.periodStartAt,
          periodEndAt: summary.periodEndAt
        }
      });

      if (existing?.status === "CONFIRMED") {
        settlements.push(existing);
        continue;
      }

      const settlement = existing ?? this.settlementRepository.create({
        businessId: summary.businessId,
        ownerUserId: summary.ownerUserId,
        settlementWeek: summary.settlementWeek
      });

      Object.assign(settlement, {
        ownerUserId: summary.ownerUserId,
        periodStartAt: summary.periodStartAt,
        periodEndAt: summary.periodEndAt,
        status: existing?.status ?? "PENDING",
        orderCount: summary.orderCount,
        orderIds: summary.orderIds,
        grossSalesCents: summary.grossSalesCents,
        businessPayoutCents: summary.businessPayoutCents,
        rapivCommissionCents: summary.rapivCommissionCents,
        businessNotifiedAt: existing?.businessNotifiedAt ?? null
      });

      const savedSettlement = await this.settlementRepository.save(settlement);
      await this.notifyBusinessSettlementCreated(savedSettlement);
      settlements.push(savedSettlement);
    }

    return settlements;
  }

  async confirmSettlement(settlementId: string, adminUserId: string): Promise<BusinessCommissionSettlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId }
    });

    if (!settlement) {
      throw new NotFoundException("Business commission settlement not found");
    }

    settlement.status = "CONFIRMED";
    settlement.confirmedAt = new Date();
    settlement.confirmedByUserId = adminUserId;

    return this.settlementRepository.save(settlement);
  }

  summarizeOrders(
    orders: Order[],
    businesses: Business[],
    settlementWeek: string,
    periodStartAt: Date,
    periodEndAt: Date
  ): BusinessCommissionSettlementSummary[] {
    const businessesById = new Map(businesses.map((business) => [business.id, business]));
    const summariesByBusiness = new Map<string, BusinessCommissionSettlementSummary>();

    for (const order of orders) {
      if (
        order.fulfillmentMethod !== "PICKUP" ||
        order.paymentMethod !== "CASH" ||
        order.paymentStatus !== "PAID" ||
        order.status !== "DELIVERED" ||
        Number(order.businessCommissionCents ?? 0) <= 0
      ) {
        continue;
      }

      const business = businessesById.get(order.businessId);

      if (!business?.ownerUserId) {
        continue;
      }

      const summary = summariesByBusiness.get(order.businessId) ?? {
        businessId: order.businessId,
        ownerUserId: business.ownerUserId,
        settlementWeek,
        periodStartAt,
        periodEndAt,
        orderCount: 0,
        orderIds: [],
        grossSalesCents: 0,
        businessPayoutCents: 0,
        rapivCommissionCents: 0
      };

      summary.orderCount += 1;
      summary.orderIds.push(order.id);
      summary.grossSalesCents += Number(order.subtotalCents ?? 0);
      summary.businessPayoutCents += Number(order.businessPayoutCents ?? 0);
      summary.rapivCommissionCents += Number(order.businessCommissionCents ?? 0);
      summariesByBusiness.set(order.businessId, summary);
    }

    return [...summariesByBusiness.values()];
  }

  private async runDueWeeklySettlement(now: Date): Promise<void> {
    const local = this.toLocalParts(now);

    if (
      local.dayOfWeek !== this.cutoffDayOfWeek() ||
      local.hour < this.cutoffHour() ||
      (local.hour === this.cutoffHour() && local.minute < this.cutoffMinute()) ||
      this.lastAutoSettlementWeek === local.week
    ) {
      return;
    }

    this.lastAutoSettlementWeek = local.week;

    try {
      const settlements = await this.runWeeklySettlement(local.week);
      this.logger.log(`Business commission settlement generated for ${local.week}: ${settlements.length} businesses`);
    } catch (error) {
      this.lastAutoSettlementWeek = undefined;
      const message = error instanceof Error ? error.message : "Unknown business commission settlement error";
      this.logger.error(`Business commission settlement generation failed: ${message}`);
    }
  }

  private async buildWeeklySummaries(settlementWeek: string): Promise<BusinessCommissionSettlementSummary[]> {
    const period = this.settlementPeriod(settlementWeek);
    const orders = await this.orderRepository.find({
      where: {
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        status: "DELIVERED",
        businessCommissionCents: MoreThan(0),
        paidAt: And(MoreThan(period.start), LessThanOrEqual(period.end))
      }
    });
    const businesses = orders.length
      ? await this.businessRepository.find()
      : [];

    return this.summarizeOrders(orders, businesses, settlementWeek, period.start, period.end);
  }

  private async notifyBusinessSettlementCreated(settlement: BusinessCommissionSettlement): Promise<void> {
    if (
      settlement.status !== "PENDING" ||
      settlement.businessNotifiedAt ||
      Number(settlement.rapivCommissionCents ?? 0) <= 0
    ) {
      return;
    }

    await this.notificationsService.sendToUser(settlement.ownerUserId, {
      title: "Comision semanal pendiente",
      body: `Tu corte semanal de comisiones RapiV es ${this.formatMoney(settlement.rapivCommissionCents)}.`,
      data: {
        type: "BUSINESS_COMMISSION_SETTLEMENT_DUE",
        settlementId: settlement.id,
        settlementWeek: settlement.settlementWeek,
        businessId: settlement.businessId,
        rapivCommissionCents: settlement.rapivCommissionCents
      }
    });

    settlement.businessNotifiedAt = new Date();
    await this.settlementRepository.save(settlement);
  }

  private async assertBusinessOwner(ownerUserId: string, businessId: string): Promise<void> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId }
    });

    if (!business || business.ownerUserId !== ownerUserId) {
      throw new NotFoundException("Business commission settlements not found");
    }
  }

  private settlementPeriod(settlementWeek: string): { start: Date; end: Date } {
    const end = this.localDateAtCutoffToUtc(settlementWeek);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private localDateAtCutoffToUtc(settlementWeek: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(settlementWeek);

    if (!match) {
      throw new BadRequestException("Settlement week must use YYYY-MM-DD");
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

  private normalizeSettlementWeek(settlementWeek: string | undefined): string {
    if (settlementWeek) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(settlementWeek)) {
        throw new BadRequestException("Settlement week must use YYYY-MM-DD");
      }

      return settlementWeek;
    }

    return this.toLocalParts(new Date()).week;
  }

  private toLocalParts(date: Date): { date: string; week: string; dayOfWeek: number; hour: number; minute: number } {
    const local = new Date(date.getTime() + this.timezoneOffsetMinutes() * 60_000);
    const dateText = local.toISOString().slice(0, 10);
    const dayOfWeek = local.getUTCDay();
    const cutoffDay = this.cutoffDayOfWeek();
    const daysSinceCutoff = (dayOfWeek - cutoffDay + 7) % 7;
    const cutoffDate = new Date(local);
    cutoffDate.setUTCDate(local.getUTCDate() - daysSinceCutoff);

    return {
      date: dateText,
      week: cutoffDate.toISOString().slice(0, 10),
      dayOfWeek,
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes()
    };
  }

  private cutoffDayOfWeek(): number {
    return this.integerEnv("BUSINESS_COMMISSION_SETTLEMENT_DAY_OF_WEEK", 1, 0, 6);
  }

  private cutoffHour(): number {
    return this.integerEnv("BUSINESS_COMMISSION_SETTLEMENT_CUTOFF_HOUR", 10, 0, 23);
  }

  private cutoffMinute(): number {
    return this.integerEnv("BUSINESS_COMMISSION_SETTLEMENT_CUTOFF_MINUTE", 0, 0, 59);
  }

  private timezoneOffsetMinutes(): number {
    return this.integerEnv("BUSINESS_COMMISSION_SETTLEMENT_TIMEZONE_OFFSET_MINUTES", -360, -720, 840);
  }

  private autoSettlementEnabled(): boolean {
    return process.env.BUSINESS_COMMISSION_SETTLEMENT_AUTO_RUN !== "false";
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
