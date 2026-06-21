import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { DataSource, LessThan, Repository } from "typeorm";
import { In } from "typeorm";

import { Business } from "../businesses/business.entity";
import { Order } from "../orders/order.entity";
import { OrdersService } from "../orders/orders.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { PaymentEvent } from "./payment-event.entity";
import { PaymentProviderService, PaymentSplit } from "./payment-provider.service";
import { PaymentProcessingQueue } from "./payment-processing.queue";
import { Payment, PaymentStatus } from "./payment.entity";
import { MonitoringService } from "../monitoring/monitoring.service";
import { CourierProfile } from "../users/courier-profile.entity";
import { CourierWalletTopUp } from "./courier-wallet-top-up.entity";
import { CourierWalletTransaction } from "./courier-wallet-transaction.entity";
import { CourierWalletService, CourierWalletSummary } from "./courier-wallet.service";
import { CreateCourierWalletTopUpDto } from "./dto/create-courier-wallet-top-up.dto";
import { CreateCourierWalletWithdrawalDto } from "./dto/create-courier-wallet-withdrawal.dto";

type PaymentResponse = {
  id: string;
  orderGroupId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerPaymentId: string;
  checkoutUrl?: string;
  clientSecret?: string;
};

type CourierWalletTopUpResponse = {
  id: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerPaymentId: string;
  checkoutUrl?: string;
  clientSecret?: string;
  paidAt?: Date | null;
};

type CourierWalletWithdrawalResponse = {
  transactionId: string;
  amountCents: number;
  currency: string;
  status: "SUCCEEDED";
  provider: string;
  providerTransferId: string;
  balanceAfterCents: number;
};

type PaymentConfigurationStatus = {
  ok: boolean;
  cardPaymentsEnabled: boolean;
  returnUrl?: string;
  checks: {
    stripeSecretConfigured: boolean;
    webhookSecretConfigured: boolean;
    returnUrlConfigured: boolean;
    returnUrlHttps: boolean;
  };
  issues: string[];
};

type PaymentHealthStatus = PaymentConfigurationStatus & {
  recoverablePayments: number;
  stalePaidPendingOrderGroups: number;
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentEvent)
    private readonly paymentEventRepository: Repository<PaymentEvent>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(CourierProfile)
    private readonly courierProfileRepository: Repository<CourierProfile>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(CourierWalletTopUp)
    private readonly courierWalletTopUpRepository: Repository<CourierWalletTopUp>,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly providerService: PaymentProviderService,
    private readonly courierWalletService: CourierWalletService,
    private readonly processingQueue: PaymentProcessingQueue,
    @Optional()
    private readonly monitoring?: MonitoringService
  ) {}

  async createPayment(
    userId: string,
    idempotencyKey: string | undefined,
    dto: CreatePaymentDto
  ): Promise<PaymentResponse> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();

    if (!normalizedIdempotencyKey) {
      throw new BadRequestException("Idempotency-Key header is required");
    }

    const existing = await this.paymentRepository.findOne({
      where: { userId, idempotencyKey: normalizedIdempotencyKey }
    });

    if (existing) {
      return this.toResponse(existing);
    }

    this.assertCardCheckoutAvailable();

    const orderGroup = await this.ordersService.findByIdForUser(dto.orderGroupId, {
      sub: userId,
      roles: ["CUSTOMER"]
    });

    if (orderGroup.customerId !== userId) {
      throw new ForbiddenException("Only the customer can pay this order");
    }

    if (orderGroup.paymentMethod === "CASH") {
      throw new ConflictException("This order will be paid in cash");
    }

    const amountCents = Number(orderGroup.totalCents);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new ConflictException("Order has no payable amount");
    }

    const localPaymentId = randomUUID();
    const splits = await this.buildStripeConnectSplits(orderGroup.businessOrders);
    const providerPayment = await this.providerService.createPayment({
      localPaymentId,
      idempotencyKey: normalizedIdempotencyKey,
      orderGroupId: dto.orderGroupId,
      amountCents,
      currency: "MXN",
      splits
    });

    try {
      const payment = this.paymentRepository.create({
        id: localPaymentId,
        userId,
        orderGroupId: dto.orderGroupId,
        amountCents,
        currency: "MXN",
        status: providerPayment.status,
        provider: providerPayment.provider,
        providerPaymentId: providerPayment.providerPaymentId,
        idempotencyKey: normalizedIdempotencyKey,
        providerMetadata: providerPayment.metadata
      });

      const saved = await this.paymentRepository.save(payment);
      this.monitoring?.recordPaymentEvent("created", {
        paymentId: saved.id,
        orderGroupId: saved.orderGroupId,
        amountCents: saved.amountCents,
        status: saved.status
      });
      return this.toResponse(saved, providerPayment.clientSecret, providerPayment.checkoutUrl);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const racedPayment = await this.paymentRepository.findOne({
          where: { userId, idempotencyKey: normalizedIdempotencyKey }
        });

        if (racedPayment) {
          return this.toResponse(racedPayment);
        }
      }

      throw error;
    }
  }

  async findMine(userId: string, orderGroupId: string): Promise<PaymentResponse[]> {
    const payments = await this.paymentRepository.find({
      where: { userId, orderGroupId },
      order: { createdAt: "DESC" }
    });

    return payments.map((payment) => this.toResponse(payment));
  }

  async getPaymentHealth(): Promise<PaymentHealthStatus> {
    const configuration = this.getPaymentConfigurationStatus();
    const recoverablePayments = await this.paymentRepository.find({
      select: { id: true },
      where: { status: In(["REQUIRES_ACTION", "PROCESSING"]) },
      take: 500
    });
    const stalePaidPendingOrders = await this.findStalePaidPendingOrders();

    return {
      ...configuration,
      recoverablePayments: recoverablePayments.length,
      stalePaidPendingOrderGroups: new Set(
        stalePaidPendingOrders.map((order) => order.orderGroupId)
      ).size
    };
  }

  getCourierWallet(userId: string): Promise<CourierWalletSummary> {
    return this.courierWalletService.getSummary(userId);
  }

  async createCourierWalletTopUp(
    courierId: string,
    idempotencyKey: string | undefined,
    dto: CreateCourierWalletTopUpDto
  ): Promise<CourierWalletTopUpResponse> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();

    if (!normalizedIdempotencyKey) {
      throw new BadRequestException("Idempotency-Key header is required");
    }

    const amountCents = Number(dto.amountCents);
    const minimumAmountCents = this.courierWalletTopUpMinimumCents();

    if (!Number.isInteger(amountCents) || amountCents < minimumAmountCents) {
      throw new ConflictException(
        `La recarga minima es ${(minimumAmountCents / 100).toFixed(2)} MXN`
      );
    }

    const existing = await this.courierWalletTopUpRepository.findOne({
      where: { courierId, idempotencyKey: normalizedIdempotencyKey }
    });

    if (existing) {
      return this.toCourierWalletTopUpResponse(existing);
    }

    const localTopUpId = randomUUID();
    const providerPayment = await this.providerService.createCourierWalletTopUp({
      localTopUpId,
      idempotencyKey: normalizedIdempotencyKey,
      courierId,
      amountCents,
      currency: "MXN"
    });

    try {
      const topUp = this.courierWalletTopUpRepository.create({
        id: localTopUpId,
        courierId,
        amountCents,
        currency: "MXN",
        status: providerPayment.status,
        provider: providerPayment.provider,
        providerPaymentId: providerPayment.providerPaymentId,
        idempotencyKey: normalizedIdempotencyKey,
        providerMetadata: providerPayment.metadata
      });

      const saved = await this.courierWalletTopUpRepository.save(topUp);
      this.monitoring?.recordPaymentEvent("courier_wallet_topup_created", {
        topUpId: saved.id,
        courierId,
        amountCents
      });
      return this.toCourierWalletTopUpResponse(
        saved,
        providerPayment.clientSecret,
        providerPayment.checkoutUrl
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const racedTopUp = await this.courierWalletTopUpRepository.findOne({
          where: { courierId, idempotencyKey: normalizedIdempotencyKey }
        });

        if (racedTopUp) {
          return this.toCourierWalletTopUpResponse(racedTopUp);
        }
      }

      throw error;
    }
  }

  async syncCourierWalletTopUp(userId: string, topUpId: string): Promise<CourierWalletTopUpResponse> {
    const topUp = await this.courierWalletTopUpRepository.findOne({
      where: { id: topUpId, courierId: userId }
    });

    if (!topUp) {
      throw new BadRequestException("Wallet top-up not found");
    }

    const providerDetails = await this.providerService.findPaymentForLocalPayment(
      topUp.id,
      topUp.providerPaymentId
    );

    await this.applyProviderCourierWalletTopUpDetails(topUp.id, providerDetails);

    const syncedTopUp = await this.courierWalletTopUpRepository.findOne({
      where: { id: topUpId, courierId: userId }
    });

    return this.toCourierWalletTopUpResponse(syncedTopUp ?? topUp);
  }

  async syncCourierWalletTopUpByCheckoutSession(providerPaymentId: string): Promise<CourierWalletTopUpResponse> {
    const topUp = await this.courierWalletTopUpRepository.findOne({
      where: {
        provider: this.providerService.providerName,
        providerPaymentId
      }
    });

    if (!topUp) {
      throw new BadRequestException("Wallet top-up not found for Stripe Checkout session");
    }

    const providerDetails = await this.providerService.getPayment(providerPaymentId);
    await this.applyProviderCourierWalletTopUpDetails(topUp.id, providerDetails);

    const syncedTopUp = await this.courierWalletTopUpRepository.findOne({
      where: { id: topUp.id }
    });

    return this.toCourierWalletTopUpResponse(syncedTopUp ?? topUp);
  }

  async createCourierWalletWithdrawal(
    courierId: string,
    idempotencyKey: string | undefined,
    dto: CreateCourierWalletWithdrawalDto
  ): Promise<CourierWalletWithdrawalResponse> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();

    if (!normalizedIdempotencyKey) {
      throw new BadRequestException("Idempotency-Key header is required");
    }

    const amountCents = Number(dto.amountCents);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BadRequestException("Withdrawal amount must be greater than zero");
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(CourierProfile, {
        where: { userId: courierId },
        lock: { mode: "pessimistic_write" }
      });

      if (!existing?.stripeConnectedAccountId || !existing.stripePayoutsEnabled) {
        throw new ConflictException("Configura Stripe Connect antes de retirar tu depósito.");
      }

      const referenceId = normalizedIdempotencyKey;
      const existingTransaction = await manager.findOne(CourierWalletTransaction, {
        where: { type: "WITHDRAWAL", referenceId }
      });

      if (existingTransaction) {
        return {
          transactionId: existingTransaction.id,
          amountCents: Math.abs(existingTransaction.amountCents),
          currency: "MXN",
          status: "SUCCEEDED",
          provider: this.providerService.providerName,
          providerTransferId: this.stringMetadataValue(existingTransaction.metadata, "providerTransferId") ?? "",
          balanceAfterCents: existingTransaction.balanceAfterCents
        };
      }

      const transaction = await this.courierWalletService.debitWithdrawal(
        courierId,
        amountCents,
        referenceId,
        manager,
        {
          provider: this.providerService.providerName,
          status: "PROCESSING"
        }
      );
      const transfer = await this.providerService.createCourierWalletWithdrawalTransfer({
        courierId,
        connectedAccountId: existing.stripeConnectedAccountId,
        amountCents,
        currency: "MXN",
        idempotencyKey: `courier-wallet-withdrawal-${courierId}-${normalizedIdempotencyKey}`
      });

      transaction.metadata = {
        ...(transaction.metadata ?? {}),
        status: "SUCCEEDED",
        provider: this.providerService.providerName,
        providerTransferId: transfer.providerTransferId,
        connectedAccountId: transfer.connectedAccountId
      };
      await manager.save(CourierWalletTransaction, transaction);

      this.monitoring?.recordPaymentEvent("courier_wallet_withdrawal_created", {
        courierId,
        amountCents,
        providerTransferId: transfer.providerTransferId
      });

      return {
        transactionId: transaction.id,
        amountCents,
        currency: "MXN",
        status: "SUCCEEDED",
        provider: this.providerService.providerName,
        providerTransferId: transfer.providerTransferId,
        balanceAfterCents: transaction.balanceAfterCents
      };
    });
  }

  async syncPayment(userId: string, paymentId: string): Promise<PaymentResponse> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId }
    });

    if (!payment) {
      throw new BadRequestException("Payment not found");
    }

    const providerDetails = await this.providerService.findPaymentForLocalPayment(
      payment.id,
      payment.providerPaymentId
    );

    await this.applyProviderPaymentDetails(payment.id, providerDetails);

    const syncedPayment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId }
    });

    return this.toResponse(syncedPayment ?? payment);
  }

  async syncPaymentByCheckoutSession(providerPaymentId: string): Promise<PaymentResponse> {
    const payment = await this.paymentRepository.findOne({
      where: {
        provider: this.providerService.providerName,
        providerPaymentId
      }
    });

    if (!payment) {
      throw new BadRequestException("Payment not found for Stripe Checkout session");
    }

    const providerDetails = await this.providerService.getPayment(providerPaymentId);
    await this.applyProviderPaymentDetails(payment.id, providerDetails);

    const syncedPayment = await this.paymentRepository.findOne({
      where: { id: payment.id }
    });

    return this.toResponse(syncedPayment ?? payment);
  }

  async receiveWebhook(
    signature: string | undefined,
    rawBody: Buffer | undefined,
    body: PaymentWebhookDto
  ): Promise<{ received: true; duplicate: boolean }> {
    this.assertValidWebhookSignature(signature, rawBody, body);
    const providerPaymentId = this.providerPaymentIdFromWebhook(body);

    const event = this.paymentEventRepository.create({
      provider: this.providerService.providerName,
      providerEventId: body.id ?? `${body.type}:${providerPaymentId}`,
      type: body.action ?? body.type,
      payload: body as unknown as Record<string, unknown>,
      status: "PENDING"
    });

    try {
      const savedEvent = await this.paymentEventRepository.save(event);
      await this.processingQueue.addWebhookEvent(savedEvent.id);
      this.monitoring?.recordPaymentEvent("webhook_received", {
        eventId: savedEvent.id,
        providerEventId: savedEvent.providerEventId,
        type: savedEvent.type
      });
      return { received: true, duplicate: false };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.monitoring?.recordPaymentEvent("webhook_duplicate", {
          providerEventId: event.providerEventId,
          type: event.type
        });
        return { received: true, duplicate: true };
      }

      throw error;
    }
  }

  async processWebhookEvent(eventId: string): Promise<void> {
    const event = await this.paymentEventRepository.findOne({
      where: { id: eventId }
    });

    if (!event || event.status === "PROCESSED") {
      return;
    }

    try {
      const payload = event.payload as unknown as PaymentWebhookDto;
      const providerPaymentId = this.providerPaymentIdFromWebhook(payload);

      if (!providerPaymentId) {
        throw new BadRequestException("Missing provider payment id");
      }

      const providerDetails = await this.providerService.getPayment(providerPaymentId);

      if (!providerDetails.externalReference) {
        throw new BadRequestException("Missing local payment reference");
      }

      const localPayment = await this.paymentRepository.findOne({
        where: { id: providerDetails.externalReference }
      });

      if (localPayment) {
        await this.applyProviderPaymentDetails(providerDetails.externalReference, providerDetails);
      } else {
        const localTopUp = await this.courierWalletTopUpRepository.findOne({
          where: { id: providerDetails.externalReference }
        });

        if (!localTopUp) {
          throw new BadRequestException("Payment event does not match a local payment or wallet top-up");
        }

        await this.applyProviderCourierWalletTopUpDetails(localTopUp.id, providerDetails);
      }
      await this.dataSource.transaction(async (manager) => {
        event.status = "PROCESSED";
        event.processedAt = new Date();
        event.errorMessage = null;
        await manager.save(PaymentEvent, event);
      });
      this.monitoring?.recordPaymentEvent("webhook_processed", {
        eventId,
        providerPaymentId,
        localPaymentId: providerDetails.externalReference
      });
    } catch (error) {
      event.status = "FAILED";
      event.errorMessage = error instanceof Error ? error.message : "Unknown payment event error";
      await this.paymentEventRepository.save(event);
      this.monitoring?.recordPaymentEvent("webhook_failed", {
        eventId,
        error: event.errorMessage
      });
      throw error;
    }
  }

  async findRecoverablePaymentEventIds(): Promise<string[]> {
    const events = await this.paymentEventRepository.find({
      select: { id: true },
      where: { status: In(["PENDING", "FAILED"]) },
      order: { createdAt: "ASC" },
      take: 500
    });

    return events.map((event) => event.id);
  }

  async findRecoverableCourierPayoutOrderGroupIds(): Promise<string[]> {
    const orders = await this.orderRepository.find({
      select: {
        orderGroupId: true,
        courierPayoutCents: true
      },
      where: {
        status: "DELIVERED",
        paymentMethod: "CARD",
        paymentStatus: "PAID",
        courierPayoutStatus: In(["PENDING", "FAILED"])
      },
      order: { updatedAt: "ASC" },
      take: 500
    });

    return [...new Set(
      orders
        .filter((order) => Number(order.courierPayoutCents ?? 0) > 0)
        .map((order) => order.orderGroupId)
    )];
  }

  async reconcileRecoverablePayments(): Promise<number> {
    const recoverablePayments = await this.paymentRepository.find({
      where: { status: In(["REQUIRES_ACTION", "PROCESSING"]) },
      order: { updatedAt: "ASC" },
      take: this.paymentReconciliationBatchSize()
    });

    let reconciled = 0;

    for (const payment of recoverablePayments) {
      try {
        const providerDetails = await this.providerService.findPaymentForLocalPayment(
          payment.id,
          payment.providerPaymentId
        );
        await this.applyProviderPaymentDetails(payment.id, providerDetails);
        reconciled += 1;
      } catch (error) {
        this.monitoring?.recordPaymentEvent("reconciliation_failed", {
          paymentId: payment.id,
          orderGroupId: payment.orderGroupId,
          error: error instanceof Error ? error.message : "Unknown payment reconciliation error"
        });
      }
    }

    if (reconciled) {
      this.monitoring?.recordPaymentEvent("reconciliation_completed", { count: reconciled });
    }

    return reconciled;
  }

  async alertAndReschedulePaidPendingOrders(): Promise<number> {
    const stalePaidPendingOrders = await this.findStalePaidPendingOrders();
    const orderGroupIds = [...new Set(stalePaidPendingOrders.map((order) => order.orderGroupId))];

    for (const orderGroupId of orderGroupIds) {
      const groupOrders = stalePaidPendingOrders.filter((order) => order.orderGroupId === orderGroupId);
      this.monitoring?.recordPaymentEvent("paid_pending_order_alert", {
        orderGroupId,
        businessOrderCount: groupOrders.length,
        oldestUpdatedAt: groupOrders
          .map((order) => order.updatedAt)
          .filter(Boolean)
          .sort((left, right) => left.getTime() - right.getTime())[0]?.toISOString()
      });

      try {
        await this.ordersService.scheduleBusinessAcceptanceTimeouts(orderGroupId);
      } catch (error) {
        this.monitoring?.recordPaymentEvent("paid_pending_reschedule_failed", {
          orderGroupId,
          error: error instanceof Error ? error.message : "Unknown paid pending reschedule error"
        });
      }
    }

    return orderGroupIds.length;
  }

  private async applyProviderPaymentDetails(
    paymentId: string,
    providerDetails: {
      providerPaymentId: string;
      status: string;
      amountCents?: number;
      currency?: string;
      latestChargeId?: string;
    }
  ): Promise<void> {
    let paidOrderGroupId: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: "pessimistic_write" }
      });

      if (!payment) {
        throw new BadRequestException("Payment not found for provider details");
      }

      const nextStatus = this.statusFromProviderStatus(providerDetails.status);

      if (
        nextStatus === "SUCCEEDED" &&
        !payment.providerMetadata?.stripeTransfersCreatedAt &&
        !payment.providerMetadata?.stripeTransfersFailedAt
      ) {
        const splits = this.paymentSplitsFromMetadata(payment.providerMetadata);
        try {
          const transfers = await this.providerService.createTransfersForPayment({
            localPaymentId: payment.id,
            orderGroupId: payment.orderGroupId,
            providerPaymentId: providerDetails.providerPaymentId,
            latestChargeId: providerDetails.latestChargeId,
            currency: providerDetails.currency ?? payment.currency,
            splits
          });

          payment.providerMetadata = {
            ...(payment.providerMetadata ?? {}),
            stripeTransfers: transfers,
            stripeTransfersCreatedAt: new Date().toISOString()
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown Stripe transfer error";
          payment.providerMetadata = {
            ...(payment.providerMetadata ?? {}),
            stripeTransfersFailedAt: new Date().toISOString(),
            stripeTransfersError: message
          };
          this.monitoring?.recordPaymentEvent("transfers_failed", {
            paymentId,
            orderGroupId: payment.orderGroupId,
            error: message
          });
        }
      }

      payment.status = nextStatus;
      payment.providerPaymentId = providerDetails.providerPaymentId;
      payment.providerMetadata = {
        ...(payment.providerMetadata ?? {}),
        stripeCheckoutSessionId: providerDetails.providerPaymentId,
        stripeStatus: providerDetails.status,
        stripeAmountCents: providerDetails.amountCents,
        stripeCurrency: providerDetails.currency,
        stripeLatestChargeId: providerDetails.latestChargeId
      };

      if (nextStatus === "SUCCEEDED" && !payment.paidAt) {
        payment.paidAt = new Date();
      }

      await manager.save(Payment, payment);

      if (nextStatus === "SUCCEEDED") {
        paidOrderGroupId = payment.orderGroupId;
        const orders = await manager.find(Order, {
          where: { orderGroupId: payment.orderGroupId },
          lock: { mode: "pessimistic_write" }
        });

        for (const order of orders) {
          order.paymentStatus = "PAID";
          order.paidAt = payment.paidAt;
        }

        await manager.save(Order, orders);
      }
      this.monitoring?.recordPaymentEvent("status_applied", {
        paymentId,
        orderGroupId: payment.orderGroupId,
        status: nextStatus
      });
    });

    if (paidOrderGroupId) {
      await this.runPostPaymentSideEffects(paidOrderGroupId);
    }
  }

  private async runPostPaymentSideEffects(orderGroupId: string): Promise<void> {
    try {
      await this.ordersService.scheduleBusinessAcceptanceTimeouts(orderGroupId);
    } catch (error) {
      this.monitoring?.recordPaymentEvent("business_acceptance_schedule_failed", {
        orderGroupId,
        error: error instanceof Error ? error.message : "Unknown business acceptance scheduling error"
      });
    }

    try {
      await this.processingQueue.addCourierPayout(orderGroupId);
    } catch (error) {
      this.monitoring?.recordPaymentEvent("courier_payout_schedule_failed", {
        orderGroupId,
        error: error instanceof Error ? error.message : "Unknown courier payout scheduling error"
      });
    }
  }

  private getPaymentConfigurationStatus(): PaymentConfigurationStatus {
    const returnUrl = this.paymentReturnBaseUrl();
    const checks = {
      stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET ?? process.env.PAYMENT_WEBHOOK_SECRET),
      returnUrlConfigured: Boolean(returnUrl),
      returnUrlHttps: Boolean(returnUrl?.startsWith("https://"))
    };
    const issues: string[] = [];

    if (!checks.stripeSecretConfigured) {
      issues.push("Missing STRIPE_SECRET_KEY");
    }

    if (!checks.webhookSecretConfigured) {
      issues.push("Missing STRIPE_WEBHOOK_SECRET");
    }

    if (!checks.returnUrlConfigured) {
      issues.push("Missing PUBLIC_API_URL for Stripe Checkout return URLs");
    } else if (!checks.returnUrlHttps) {
      issues.push("PUBLIC_API_URL must be an HTTPS URL for card payments");
    }

    return {
      ok: issues.length === 0,
      cardPaymentsEnabled: issues.length === 0,
      returnUrl,
      checks,
      issues
    };
  }

  private assertCardCheckoutAvailable(): void {
    const status = this.getPaymentConfigurationStatus();

    if (status.ok) {
      return;
    }

    this.monitoring?.recordPaymentEvent("card_checkout_unavailable", {
      issues: status.issues
    });

    throw new ServiceUnavailableException(
      "El pago con tarjeta no esta disponible temporalmente. Intenta con efectivo o mas tarde."
    );
  }

  private paymentReturnBaseUrl(): string | undefined {
    const configured = process.env.PUBLIC_API_URL ?? process.env.PUBLIC_APP_URL ?? process.env.CLIENT_APP_URL;
    return configured?.replace(/\/$/, "");
  }

  private async findStalePaidPendingOrders(): Promise<Order[]> {
    const cutoff = new Date(Date.now() - this.paidPendingAlertAgeMs());

    return this.orderRepository.find({
      where: {
        paymentMethod: "CARD",
        paymentStatus: "PAID",
        status: "PENDING",
        updatedAt: LessThan(cutoff)
      },
      order: { updatedAt: "ASC" },
      take: 500
    });
  }

  private paidPendingAlertAgeMs(): number {
    return this.minutesToMs(process.env.PAID_PENDING_ORDER_ALERT_MINUTES, 5);
  }

  private paymentReconciliationBatchSize(): number {
    const configured = Number(process.env.PAYMENT_RECONCILIATION_BATCH_SIZE ?? 100);
    return Number.isInteger(configured) && configured > 0 ? configured : 100;
  }

  private minutesToMs(value: string | undefined, fallback: number): number {
    const minutes = Number(value ?? fallback);
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
    return safeMinutes * 60_000;
  }

  private async applyProviderCourierWalletTopUpDetails(
    topUpId: string,
    providerDetails: {
      providerPaymentId: string;
      status: string;
      amountCents?: number;
      currency?: string;
      latestChargeId?: string;
    }
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const topUp = await manager.findOne(CourierWalletTopUp, {
        where: { id: topUpId },
        lock: { mode: "pessimistic_write" }
      });

      if (!topUp) {
        throw new BadRequestException("Wallet top-up not found for provider details");
      }

      const nextStatus = this.statusFromProviderStatus(providerDetails.status);
      topUp.status = nextStatus;
      topUp.providerPaymentId = providerDetails.providerPaymentId;
      topUp.providerMetadata = {
        ...(topUp.providerMetadata ?? {}),
        stripeCheckoutSessionId: providerDetails.providerPaymentId,
        stripeStatus: providerDetails.status,
        stripeAmountCents: providerDetails.amountCents,
        stripeCurrency: providerDetails.currency,
        stripeLatestChargeId: providerDetails.latestChargeId
      };

      if (nextStatus === "SUCCEEDED" && !topUp.paidAt) {
        topUp.paidAt = new Date();
        await this.courierWalletService.creditTopUp(
          topUp.courierId,
          topUp.amountCents,
          topUp.id,
          manager,
          {
            providerPaymentId: providerDetails.providerPaymentId,
            stripeLatestChargeId: providerDetails.latestChargeId
          }
        );
      }

      await manager.save(CourierWalletTopUp, topUp);
      this.monitoring?.recordPaymentEvent("courier_wallet_topup_status_applied", {
        topUpId,
        courierId: topUp.courierId,
        status: nextStatus
      });
    });
  }

  async processCourierPayout(orderGroupId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const orders = await manager.find(Order, {
        where: { orderGroupId },
        lock: { mode: "pessimistic_write" }
      });

      if (!orders.length) {
        throw new BadRequestException("Order group not found for courier payout");
      }

      const payoutOrder = orders.find((order) => Number(order.courierPayoutCents ?? 0) > 0);

      if (!payoutOrder || payoutOrder.courierPayoutStatus === "NOT_APPLICABLE") {
        return;
      }

      if (payoutOrder.courierPayoutStatus === "PAID" || payoutOrder.courierPayoutStatus === "CANCELLED") {
        return;
      }

      if (payoutOrder.paymentMethod !== "CARD") {
        return;
      }

      if (
        payoutOrder.status !== "DELIVERED" ||
        payoutOrder.paymentStatus !== "PAID" ||
        !payoutOrder.courierId
      ) {
        return;
      }

      const payment = await manager.findOne(Payment, {
        where: {
          orderGroupId,
          status: "SUCCEEDED"
        }
      });

      if (!payment) {
        return;
      }

      const courierProfile = await manager.findOne(CourierProfile, {
        where: { userId: payoutOrder.courierId }
      });

      if (
        !courierProfile?.stripeConnectedAccountId ||
        !courierProfile.stripePayoutsEnabled
      ) {
        payoutOrder.courierPayoutStatus = "FAILED";
        payoutOrder.courierPayoutFailedAt = new Date();
        payoutOrder.courierPayoutError = "Courier Stripe Connect payouts are not enabled";
        await manager.save(Order, payoutOrder);
        return;
      }

      const amountCents = Number(payoutOrder.courierPayoutCents);

      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        payoutOrder.courierPayoutStatus = "NOT_APPLICABLE";
        await manager.save(Order, payoutOrder);
        return;
      }

      try {
        const transfer = await this.providerService.createCourierTransferForPayment({
          localPaymentId: payment.id,
          orderGroupId,
          courierId: payoutOrder.courierId,
          connectedAccountId: courierProfile.stripeConnectedAccountId,
          providerPaymentId: payment.providerPaymentId,
          latestChargeId: this.stringMetadataValue(payment.providerMetadata, "stripeLatestChargeId"),
          currency: payment.currency,
          amountCents
        });

        payoutOrder.courierPayoutStatus = "PAID";
        payoutOrder.courierPayoutPaidAt = new Date();
        payoutOrder.courierPayoutProviderTransferId = transfer.providerTransferId;
        payoutOrder.courierPayoutFailedAt = null;
        payoutOrder.courierPayoutError = null;
        await manager.save(Order, payoutOrder);
        this.monitoring?.recordPaymentEvent("courier_payout_paid", {
          orderGroupId,
          courierId: payoutOrder.courierId,
          amountCents,
          providerTransferId: transfer.providerTransferId
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown courier payout error";
        payoutOrder.courierPayoutStatus = "FAILED";
        payoutOrder.courierPayoutFailedAt = new Date();
        payoutOrder.courierPayoutError = message;
        await manager.save(Order, payoutOrder);
        this.monitoring?.recordPaymentEvent("courier_payout_failed", {
          orderGroupId,
          courierId: payoutOrder.courierId,
          amountCents,
          error: message
        });
        throw error;
      }
    });
  }

  private assertValidWebhookSignature(
    signature: string | undefined,
    rawBody: Buffer | undefined,
    body: PaymentWebhookDto
  ): void {
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const fallbackSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const secret = stripeSecret ?? fallbackSecret;

    if (!secret) {
      throw new UnauthorizedException("Payment webhook secret is not configured");
    }

    if (!signature) {
      throw new UnauthorizedException("Missing payment webhook signature");
    }

    const received = this.signaturePart(signature, "v1") ?? signature.replace(/^sha256=/, "");
    const signatureTimestamp = this.signaturePart(signature, "t");
    const payload = stripeSecret && this.signaturePart(signature, "t")
      ? Buffer.from(`${signatureTimestamp}.${rawBody?.toString("utf8") ?? JSON.stringify(body)}`)
      : rawBody ?? Buffer.from(JSON.stringify(body));
    const expected = createHmac("sha256", secret).update(payload).digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(received, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException("Invalid payment webhook signature");
    }
  }

  private statusFromProviderStatus(status: string): PaymentStatus {
    const statuses: Record<string, PaymentStatus> = {
      paid: "SUCCEEDED",
      complete: "SUCCEEDED",
      unpaid: "PROCESSING",
      open: "REQUIRES_ACTION",
      expired: "CANCELLED",
      approved: "SUCCEEDED",
      pending: "PROCESSING",
      in_process: "PROCESSING",
      rejected: "FAILED",
      cancelled: "CANCELLED",
      refunded: "CANCELLED"
    };

    return statuses[status] ?? "PROCESSING";
  }

  private toResponse(
    payment: Payment,
    clientSecret?: string,
    checkoutUrl?: string
  ): PaymentResponse {
    return {
      id: payment.id,
      orderGroupId: payment.orderGroupId,
      amountCents: payment.amountCents,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      checkoutUrl: checkoutUrl ?? this.stringMetadata(payment, "checkoutUrl"),
      clientSecret
    };
  }

  private toCourierWalletTopUpResponse(
    topUp: CourierWalletTopUp,
    clientSecret?: string,
    checkoutUrl?: string
  ): CourierWalletTopUpResponse {
    return {
      id: topUp.id,
      amountCents: topUp.amountCents,
      currency: topUp.currency,
      status: topUp.status,
      provider: topUp.provider,
      providerPaymentId: topUp.providerPaymentId,
      checkoutUrl: checkoutUrl ?? this.stringMetadataFromRecord(topUp.providerMetadata, "checkoutUrl"),
      clientSecret,
      paidAt: topUp.paidAt
    };
  }

  private providerPaymentIdFromWebhook(body: PaymentWebhookDto): string {
    return body.data?.object?.id ?? body.data?.providerPaymentId ?? body.data?.id ?? "";
  }

  private signaturePart(signature: string, key: string): string | undefined {
    return signature
      .split(",")
      .map((part) => part.trim().split("="))
      .find(([currentKey]) => currentKey === key)?.[1];
  }

  private stringMetadata(payment: Payment, key: string): string | undefined {
    const value = payment.providerMetadata?.[key];
    return typeof value === "string" ? value : undefined;
  }

  private stringMetadataFromRecord(metadata: Record<string, unknown> | null | undefined, key: string): string | undefined {
    const value = metadata?.[key];
    return typeof value === "string" ? value : undefined;
  }

  private stringMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string): string | undefined {
    const value = metadata?.[key];
    return typeof value === "string" ? value : undefined;
  }

  private async buildStripeConnectSplits(
    businessOrders: Array<{ businessId: string; subtotalCents: number }>
  ): Promise<PaymentSplit[]> {
    const businessIds = businessOrders.map((businessOrder) => businessOrder.businessId);
    const businesses = await this.businessRepository.find({
      where: { id: In(businessIds) }
    });
    const businessesById = new Map(businesses.map((business) => [business.id, business]));
    const platformFeeBps = this.platformFeeBasisPoints();
    const platformAccountId = await this.providerService.getPlatformAccountId();

    return businessOrders.map((businessOrder) => {
      const business = businessesById.get(businessOrder.businessId);

      if (!business?.stripeConnectedAccountId || !business.stripeChargesEnabled) {
        throw new ConflictException(`Business ${businessOrder.businessId} is not ready for Stripe Connect card payments`);
      }

      if (!business.stripePlatformAccountId || business.stripePlatformAccountId !== platformAccountId) {
        throw new ConflictException(`Business ${businessOrder.businessId} must reconnect Stripe Connect before card payments`);
      }

      const grossAmountCents = Number(businessOrder.subtotalCents);
      const platformFeeCents = Math.floor((grossAmountCents * platformFeeBps) / 10_000);
      const transferAmountCents = grossAmountCents - platformFeeCents;

      if (!Number.isInteger(grossAmountCents) || grossAmountCents <= 0 || transferAmountCents <= 0) {
        throw new ConflictException(`Business ${businessOrder.businessId} has no transferable amount`);
      }

      return {
        businessId: businessOrder.businessId,
        connectedAccountId: business.stripeConnectedAccountId,
        grossAmountCents,
        platformFeeCents,
        transferAmountCents
      };
    });
  }

  private paymentSplitsFromMetadata(metadata: Record<string, unknown> | null | undefined): PaymentSplit[] {
    const splits = metadata?.transferSplits;

    if (!Array.isArray(splits)) {
      throw new ConflictException("Payment is missing Stripe transfer splits");
    }

    return splits.map((split) => {
      const value = split as Record<string, unknown>;
      return {
        businessId: String(value.businessId),
        connectedAccountId: String(value.connectedAccountId),
        grossAmountCents: Number(value.grossAmountCents),
        platformFeeCents: Number(value.platformFeeCents),
        transferAmountCents: Number(value.transferAmountCents)
      };
    });
  }

  private platformFeeBasisPoints(): number {
    const configured = Number(process.env.RAPIV_PLATFORM_FEE_BPS ?? 0);

    if (!Number.isInteger(configured) || configured < 0 || configured >= 10_000) {
      throw new Error("RAPIV_PLATFORM_FEE_BPS must be an integer between 0 and 9999");
    }

    return configured;
  }

  private courierWalletTopUpMinimumCents(): number {
    const configured = Number(process.env.COURIER_WALLET_TOPUP_MINIMUM_CENTS ?? 20000);

    if (!Number.isInteger(configured) || configured <= 0) {
      throw new Error("COURIER_WALLET_TOPUP_MINIMUM_CENTS must be a positive integer");
    }

    return configured;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    );
  }
}
