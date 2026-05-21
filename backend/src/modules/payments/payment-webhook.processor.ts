import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Job, Worker } from "bullmq";

import {
  PAYMENT_WEBHOOK_QUEUE,
  PaymentProcessingQueue,
  PaymentWebhookJob,
  redisConnection
} from "./payment-processing.queue";
import { PaymentsService } from "./payments.service";

@Injectable()
export class PaymentWebhookProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentWebhookProcessor.name);
  private worker?: Worker<PaymentWebhookJob>;

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentQueue: PaymentProcessingQueue
  ) {}

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<PaymentWebhookJob>(
      PAYMENT_WEBHOOK_QUEUE,
      (job) => this.process(job),
      {
        connection: redisConnection(),
        concurrency: Number(process.env.PAYMENT_QUEUE_CONCURRENCY || 8)
      }
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Payment webhook job ${job?.id ?? "unknown"} failed: ${error.message}`,
        error.stack
      );
    });

    this.worker.on("error", (error) => {
      this.logger.error(`Payment webhook worker error: ${error.message}`, error.stack);
    });

    const recoverableEventIds = await this.paymentsService.findRecoverablePaymentEventIds();
    await this.paymentQueue.addWebhookEvents(recoverableEventIds);

    if (recoverableEventIds.length > 0) {
      this.logger.log(`Requeued ${recoverableEventIds.length} recoverable payment webhook events`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<PaymentWebhookJob>): Promise<void> {
    await this.paymentsService.processWebhookEvent(job.data.eventId);
  }
}
