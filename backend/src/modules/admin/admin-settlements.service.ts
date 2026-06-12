import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThan, Repository } from "typeorm";

import { Business } from "../businesses/business.entity";
import { BusinessCommissionSettlement } from "../payments/business-commission-settlement.entity";
import { CashSettlement } from "../payments/cash-settlement.entity";
import { User } from "../users/user.entity";

type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

type AdminBusinessSummary = {
  id: string;
  name: string;
  address?: string;
  owner?: AdminUserSummary;
};

type AdminCourierCashSettlement = {
  id: string;
  courierId: string;
  courier?: AdminUserSummary;
  settlementDate: string;
  periodStartAt: Date;
  periodEndAt: Date;
  status: string;
  orderGroupCount: number;
  orderGroupIds?: string[] | null;
  cashCollectedCents: number;
  cashChangeCents: number;
  businessPayoutCents: number;
  rapivCommissionCents: number;
  courierPayoutCents: number;
  platformDeliveryMarginCents: number;
  netDueToRapivCents: number;
  courierNotifiedAt?: Date | null;
  courierOverdueNotifiedAt?: Date | null;
  confirmedAt?: Date | null;
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AdminBusinessCommissionSettlement = {
  id: string;
  businessId: string;
  business?: AdminBusinessSummary;
  ownerUserId: string;
  owner?: AdminUserSummary;
  settlementWeek: string;
  periodStartAt: Date;
  periodEndAt: Date;
  status: string;
  orderCount: number;
  orderIds?: string[] | null;
  grossSalesCents: number;
  businessPayoutCents: number;
  rapivCommissionCents: number;
  businessNotifiedAt?: Date | null;
  confirmedAt?: Date | null;
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminSettlementsOverview = {
  generatedAt: Date;
  totals: {
    pendingCourierSettlements: number;
    pendingBusinessSettlements: number;
    overdueCourierSettlements: number;
    overdueBusinessSettlements: number;
    blockedCouriers: number;
    courierNetDueToRapivCents: number;
    businessCommissionDueCents: number;
    totalDueToRapivCents: number;
  };
  courierCashSettlements: AdminCourierCashSettlement[];
  businessCommissionSettlements: AdminBusinessCommissionSettlement[];
};

@Injectable()
export class AdminSettlementsService {
  constructor(
    @InjectRepository(CashSettlement)
    private readonly cashSettlementRepository: Repository<CashSettlement>,
    @InjectRepository(BusinessCommissionSettlement)
    private readonly businessCommissionSettlementRepository: Repository<BusinessCommissionSettlement>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>
  ) {}

  async getOverview(): Promise<AdminSettlementsOverview> {
    const now = new Date();
    const [cashSettlements, businessCommissionSettlements] = await Promise.all([
      this.cashSettlementRepository.find({
        where: { status: "PENDING", netDueToRapivCents: MoreThan(0) },
        order: { periodEndAt: "DESC", updatedAt: "DESC" }
      }),
      this.businessCommissionSettlementRepository.find({
        where: { status: "PENDING", rapivCommissionCents: MoreThan(0) },
        order: { periodEndAt: "DESC", updatedAt: "DESC" }
      })
    ]);

    const courierIds = cashSettlements.map((settlement) => settlement.courierId);
    const ownerIds = businessCommissionSettlements.map((settlement) => settlement.ownerUserId);
    const businessIds = businessCommissionSettlements.map((settlement) => settlement.businessId);
    const usersById = await this.findUsersById([...courierIds, ...ownerIds]);
    const businessesById = await this.findBusinessesById(businessIds);

    const courierCashSettlements = cashSettlements.map((settlement) => ({
      id: settlement.id,
      courierId: settlement.courierId,
      courier: usersById.get(settlement.courierId),
      settlementDate: settlement.settlementDate,
      periodStartAt: settlement.periodStartAt,
      periodEndAt: settlement.periodEndAt,
      status: settlement.status,
      orderGroupCount: settlement.orderGroupCount,
      orderGroupIds: settlement.orderGroupIds,
      cashCollectedCents: settlement.cashCollectedCents,
      cashChangeCents: settlement.cashChangeCents,
      businessPayoutCents: settlement.businessPayoutCents,
      rapivCommissionCents: settlement.rapivCommissionCents,
      courierPayoutCents: settlement.courierPayoutCents,
      platformDeliveryMarginCents: settlement.platformDeliveryMarginCents,
      netDueToRapivCents: settlement.netDueToRapivCents,
      courierNotifiedAt: settlement.courierNotifiedAt,
      courierOverdueNotifiedAt: settlement.courierOverdueNotifiedAt,
      confirmedAt: settlement.confirmedAt,
      isOverdue: settlement.periodEndAt.getTime() < now.getTime(),
      createdAt: settlement.createdAt,
      updatedAt: settlement.updatedAt
    }));

    const businessCommissionRows = businessCommissionSettlements.map((settlement) => {
      const owner = usersById.get(settlement.ownerUserId);
      const business = businessesById.get(settlement.businessId);

      return {
        id: settlement.id,
        businessId: settlement.businessId,
        business: business
          ? {
              id: business.id,
              name: business.name,
              address: business.address,
              owner
            }
          : undefined,
        ownerUserId: settlement.ownerUserId,
        owner,
        settlementWeek: settlement.settlementWeek,
        periodStartAt: settlement.periodStartAt,
        periodEndAt: settlement.periodEndAt,
        status: settlement.status,
        orderCount: settlement.orderCount,
        orderIds: settlement.orderIds,
        grossSalesCents: settlement.grossSalesCents,
        businessPayoutCents: settlement.businessPayoutCents,
        rapivCommissionCents: settlement.rapivCommissionCents,
        businessNotifiedAt: settlement.businessNotifiedAt,
        confirmedAt: settlement.confirmedAt,
        isOverdue: settlement.periodEndAt.getTime() < now.getTime(),
        createdAt: settlement.createdAt,
        updatedAt: settlement.updatedAt
      };
    });

    const courierNetDueToRapivCents = this.sum(courierCashSettlements, "netDueToRapivCents");
    const businessCommissionDueCents = this.sum(businessCommissionRows, "rapivCommissionCents");

    return {
      generatedAt: now,
      totals: {
        pendingCourierSettlements: courierCashSettlements.length,
        pendingBusinessSettlements: businessCommissionRows.length,
        overdueCourierSettlements: courierCashSettlements.filter((settlement) => settlement.isOverdue).length,
        overdueBusinessSettlements: businessCommissionRows.filter((settlement) => settlement.isOverdue).length,
        blockedCouriers: new Set(courierCashSettlements.map((settlement) => settlement.courierId)).size,
        courierNetDueToRapivCents,
        businessCommissionDueCents,
        totalDueToRapivCents: courierNetDueToRapivCents + businessCommissionDueCents
      },
      courierCashSettlements,
      businessCommissionSettlements: businessCommissionRows
    };
  }

  private async findUsersById(userIds: string[]): Promise<Map<string, AdminUserSummary>> {
    const uniqueUserIds = [...new Set(userIds)].filter(Boolean);

    if (uniqueUserIds.length === 0) {
      return new Map();
    }

    const users = await this.userRepository.find({
      where: { id: In(uniqueUserIds) }
    });

    return new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          name: user.fullName,
          email: user.email,
          phone: user.phone
        }
      ])
    );
  }

  private async findBusinessesById(businessIds: string[]): Promise<Map<string, Business>> {
    const uniqueBusinessIds = [...new Set(businessIds)].filter(Boolean);

    if (uniqueBusinessIds.length === 0) {
      return new Map();
    }

    const businesses = await this.businessRepository.find({
      where: { id: In(uniqueBusinessIds) }
    });

    return new Map(businesses.map((business) => [business.id, business]));
  }

  private sum<T extends Record<K, number>, K extends keyof T>(rows: T[], key: K): number {
    return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  }
}
