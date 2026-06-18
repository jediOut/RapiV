import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { Order } from "../orders/order.entity";
import { CourierProfile } from "../users/courier-profile.entity";
import { CourierWalletTransaction } from "./courier-wallet-transaction.entity";

export type CourierWalletSummary = {
  courierId: string;
  balanceCents: number;
  activeCashCommitmentCents: number;
  availableCents: number;
  recentTransactions: CourierWalletTransaction[];
};

@Injectable()
export class CourierWalletService {
  constructor(
    @InjectRepository(CourierProfile)
    private readonly courierProfileRepository: Repository<CourierProfile>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(CourierWalletTransaction)
    private readonly transactionRepository: Repository<CourierWalletTransaction>
  ) {}

  async getSummary(courierId: string): Promise<CourierWalletSummary> {
    const profile = await this.ensureCourierProfile(courierId);
    const activeCashCommitmentCents = await this.activeCashCommitmentCents(courierId);
    const recentTransactions = await this.transactionRepository.find({
      where: { courierId },
      order: { createdAt: "DESC" },
      take: 20
    });

    return {
      courierId,
      balanceCents: Number(profile.walletBalanceCents ?? 0),
      activeCashCommitmentCents,
      availableCents: Number(profile.walletBalanceCents ?? 0) - activeCashCommitmentCents,
      recentTransactions
    };
  }

  async assertCanCoverCashOrders(
    courierId: string,
    orders: Order[],
    manager?: EntityManager
  ): Promise<void> {
    const requiredCents = this.cashSettlementRequiredCents(orders);

    if (requiredCents <= 0) {
      return;
    }

    const orderGroupId = orders[0]?.orderGroupId;
    const activeCommitmentCents = await this.activeCashCommitmentCents(
      courierId,
      orderGroupId,
      manager
    );
    const profile = await this.getCourierProfile(courierId, manager, Boolean(manager));
    const availableCents = Number(profile.walletBalanceCents ?? 0) - activeCommitmentCents;

    if (availableCents < requiredCents) {
      throw new ConflictException(
        `Saldo RapiV insuficiente para aceptar esta orden en efectivo. Necesitas ${(requiredCents / 100).toFixed(2)} MXN disponibles.`
      );
    }
  }

  async creditTopUp(
    courierId: string,
    amountCents: number,
    topUpId: string,
    manager: EntityManager,
    metadata: Record<string, unknown> = {}
  ): Promise<CourierWalletTransaction> {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BadRequestException("Top-up amount must be greater than zero");
    }

    const existing = await manager.findOne(CourierWalletTransaction, {
      where: { type: "TOP_UP", referenceId: topUpId }
    });

    if (existing) {
      return existing;
    }

    const profile = await this.getCourierProfile(courierId, manager, true);
    profile.walletBalanceCents = Number(profile.walletBalanceCents ?? 0) + amountCents;
    await manager.save(CourierProfile, profile);

    const transaction = manager.create(CourierWalletTransaction, {
      courierId,
      type: "TOP_UP",
      amountCents,
      balanceAfterCents: profile.walletBalanceCents,
      referenceId: topUpId,
      metadata
    });

    return manager.save(CourierWalletTransaction, transaction);
  }

  async debitCashOrderSettlement(
    courierId: string,
    orders: Order[],
    manager: EntityManager,
    metadata: Record<string, unknown> = {}
  ): Promise<CourierWalletTransaction | null> {
    const amountCents = this.cashSettlementRequiredCents(orders);

    if (amountCents <= 0) {
      return null;
    }

    const orderGroupId = orders[0]?.orderGroupId;
    const existing = await manager.findOne(CourierWalletTransaction, {
      where: { type: "CASH_ORDER_SETTLEMENT", referenceId: orderGroupId }
    });

    if (existing) {
      return existing;
    }

    const profile = await this.getCourierProfile(courierId, manager, true);

    if (Number(profile.walletBalanceCents ?? 0) < amountCents) {
      throw new ConflictException(
        `Saldo RapiV insuficiente para pagar esta orden. Recarga ${(amountCents / 100).toFixed(2)} MXN antes de cerrar la entrega.`
      );
    }

    profile.walletBalanceCents = Number(profile.walletBalanceCents ?? 0) - amountCents;
    await manager.save(CourierProfile, profile);

    const transaction = manager.create(CourierWalletTransaction, {
      courierId,
      type: "CASH_ORDER_SETTLEMENT",
      amountCents: -amountCents,
      balanceAfterCents: profile.walletBalanceCents,
      orderGroupId,
      referenceId: orderGroupId,
      metadata: {
        ...metadata,
        orderGroupId,
        cashCollectedCents: this.totalCentsForOrders(orders),
        courierPayoutCents: this.courierPayoutCentsForOrders(orders)
      }
    });

    return manager.save(CourierWalletTransaction, transaction);
  }

  async debitWithdrawal(
    courierId: string,
    amountCents: number,
    referenceId: string,
    manager: EntityManager,
    metadata: Record<string, unknown> = {}
  ): Promise<CourierWalletTransaction> {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BadRequestException("Withdrawal amount must be greater than zero");
    }

    const existing = await manager.findOne(CourierWalletTransaction, {
      where: { type: "WITHDRAWAL", referenceId }
    });

    if (existing) {
      return existing;
    }

    const profile = await this.getCourierProfile(courierId, manager, true);
    const activeCommitmentCents = await this.activeCashCommitmentCents(courierId, undefined, manager);
    const availableCents = Number(profile.walletBalanceCents ?? 0) - activeCommitmentCents;

    if (availableCents < amountCents) {
      throw new ConflictException(
        `Saldo disponible insuficiente para retirar ${(amountCents / 100).toFixed(2)} MXN.`
      );
    }

    profile.walletBalanceCents = Number(profile.walletBalanceCents ?? 0) - amountCents;
    await manager.save(CourierProfile, profile);

    const transaction = manager.create(CourierWalletTransaction, {
      courierId,
      type: "WITHDRAWAL",
      amountCents: -amountCents,
      balanceAfterCents: profile.walletBalanceCents,
      referenceId,
      metadata
    });

    return manager.save(CourierWalletTransaction, transaction);
  }

  cashSettlementRequiredCents(orders: Order[]): number {
    if (orders[0]?.paymentMethod !== "CASH" || orders[0]?.fulfillmentMethod === "PICKUP") {
      return 0;
    }

    return Math.max(0, this.totalCentsForOrders(orders) - this.courierPayoutCentsForOrders(orders));
  }

  private async activeCashCommitmentCents(
    courierId: string,
    excludingOrderGroupId?: string,
    manager?: EntityManager
  ): Promise<number> {
    const repository = manager?.getRepository(Order) ?? this.orderRepository;
    const orders = await repository.find({
      where: {
        courierId,
        paymentMethod: "CASH",
        paymentStatus: "UNPAID"
      }
    });

    const activeOrders = orders.filter((order) =>
      order.orderGroupId !== excludingOrderGroupId &&
      ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"].includes(order.status as string)
    );
    const orderGroups = new Map<string, Order[]>();

    for (const order of activeOrders) {
      const group = orderGroups.get(order.orderGroupId) ?? [];
      group.push(order);
      orderGroups.set(order.orderGroupId, group);
    }

    return [...orderGroups.values()].reduce(
      (sum, groupOrders) => sum + this.cashSettlementRequiredCents(groupOrders),
      0
    );
  }

  private async ensureCourierProfile(courierId: string): Promise<CourierProfile> {
    let profile = await this.courierProfileRepository.findOne({
      where: { userId: courierId }
    });

    if (!profile) {
      profile = this.courierProfileRepository.create({
        userId: courierId,
        availabilityStatus: "OFFLINE",
        walletBalanceCents: 0
      });
      return this.courierProfileRepository.save(profile);
    }

    return profile;
  }

  private async getCourierProfile(
    courierId: string,
    manager?: EntityManager,
    lock = false
  ): Promise<CourierProfile> {
    const repository = manager?.getRepository(CourierProfile) ?? this.courierProfileRepository;
    const profile = await repository.findOne({
      where: { userId: courierId },
      ...(lock && manager ? { lock: { mode: "pessimistic_write" as const } } : {})
    });

    if (profile) {
      return profile;
    }

    const created = repository.create({
      userId: courierId,
      availabilityStatus: "OFFLINE",
      walletBalanceCents: 0
    });

    return repository.save(created);
  }

  private totalCentsForOrders(orders: Order[]): number {
    return orders.reduce(
      (sum, order) => sum + Number(order.subtotalCents ?? 0) + Number(order.deliveryFeeCents ?? 0),
      0
    );
  }

  private courierPayoutCentsForOrders(orders: Order[]): number {
    return orders.reduce((sum, order) => sum + Number(order.courierPayoutCents ?? 0), 0);
  }
}
