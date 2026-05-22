import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { DataSource, Repository } from "typeorm";
import { In } from "typeorm";

import { Order } from "../orders/order.entity";
import { OrdersService } from "../orders/orders.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { PaymentEvent } from "./payment-event.entity";
import { PaymentProviderService } from "./payment-provider.service";
import { PaymentProcessingQueue } from "./payment-processing.queue";
import { Payment, PaymentStatus } from "./payment.entity";
import { MonitoringService } from "../monitoring/monitoring.service";

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

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentEvent)
    private readonly paymentEventRepository: Repository<PaymentEvent>,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly providerService: PaymentProviderService,
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

    const orderGroup = await this.ordersService.findByIdForUser(dto.orderGroupId, {
      sub: userId,
      roles: ["CUSTOMER"]
    });

    if (orderGroup.customerId !== userId) {
      throw new ForbiddenException("Only the customer can pay this order");
    }

    const amountCents = Number(orderGroup.totalCents);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new ConflictException("Order has no payable amount");
    }

    const localPaymentId = randomUUID();
    const providerPayment = await this.providerService.createPayment({
      localPaymentId,
      idempotencyKey: normalizedIdempotencyKey,
      orderGroupId: dto.orderGroupId,
      amountCents,
      currency: "MXN"
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

  async receiveWebhook(
    signature: string | undefined,
    rawBody: Buffer | undefined,
    body: PaymentWebhookDto,
    requestId?: string
  ): Promise<{ received: true; duplicate: boolean }> {
    this.assertValidWebhookSignature(signature, rawBody, body, requestId);
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

      await this.applyProviderPaymentDetails(providerDetails.externalReference, providerDetails);
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

  private async applyProviderPaymentDetails(
    paymentId: string,
    providerDetails: {
      providerPaymentId: string;
      status: string;
      amountCents?: number;
      currency?: string;
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
      payment.status = nextStatus;
      payment.providerPaymentId = providerDetails.providerPaymentId;
      payment.providerMetadata = {
        ...(payment.providerMetadata ?? {}),
        mercadoPagoPaymentId: providerDetails.providerPaymentId,
        mercadoPagoStatus: providerDetails.status,
        mercadoPagoAmountCents: providerDetails.amountCents,
        mercadoPagoCurrency: providerDetails.currency
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
      await this.ordersService.scheduleBusinessAcceptanceTimeouts(paidOrderGroupId);
    }
  }

  private assertValidWebhookSignature(
    signature: string | undefined,
    rawBody: Buffer | undefined,
    body: PaymentWebhookDto,
    requestId?: string
  ): void {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? process.env.PAYMENT_WEBHOOK_SECRET;

    if (!secret) {
      throw new UnauthorizedException("Payment webhook secret is not configured");
    }

    if (!signature) {
      throw new UnauthorizedException("Missing payment webhook signature");
    }

    const received = this.signaturePart(signature, "v1") ?? signature.replace(/^sha256=/, "");
    const signatureTimestamp = this.signaturePart(signature, "ts");
    const payload = signatureTimestamp && requestId
      ? Buffer.from(
        `id:${this.providerPaymentIdFromWebhook(body)};request-id:${requestId};ts:${signatureTimestamp};`
      )
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

  private providerPaymentIdFromWebhook(body: PaymentWebhookDto): string {
    return body.data?.providerPaymentId ?? body.data?.id ?? "";
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

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    );
  }
}
