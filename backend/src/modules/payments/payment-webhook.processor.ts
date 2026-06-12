import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Job, Worker } from "bullmq";

import {
  PAYMENT_WEBHOOK_QUEUE,
  PaymentJob,
  PaymentProcessingQueue,
} from "./payment-processing.queue";
import { redisConnection } from "../../common/queue/redis-connection";
import { MonitoringService } from "../monitoring/monitoring.service";
import { PaymentsService } from "./payments.service";

@Injectable()
export class PaymentWebhookProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentWebhookProcessor.name);
  private worker?: Worker<PaymentJob>;

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentQueue: PaymentProcessingQueue,
    private readonly monitoring: MonitoringService
  ) {}

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<PaymentJob>(
      PAYMENT_WEBHOOK_QUEUE,
      (job) => this.process(job),
      {
        connection: redisConnection(),
        concurrency: Number(process.env.PAYMENT_QUEUE_CONCURRENCY || 8)
      }
    );

    this.worker.on("failed", (job, error) => {
      if (job) {
        this.monitoring.recordWorkerJob({
          queue: PAYMENT_WEBHOOK_QUEUE,
          jobName: job.name,
          status: "failed",
          durationMs: this.jobDurationMs(job)
        });
      }
      this.logger.error(
        `Payment webhook job ${job?.id ?? "unknown"} failed: ${error.message}`,
        error.stack
      );
    });

    this.worker.on("error", (error) => {
      this.logger.error(`Payment webhook worker error: ${error.message}`, error.stack);
    });

    this.worker.on("completed", (job) => {
      this.monitoring.recordWorkerJob({
        queue: PAYMENT_WEBHOOK_QUEUE,
        jobName: job.name,
        status: "completed",
        durationMs: this.jobDurationMs(job)
      });
    });

    const recoverableEventIds = await this.paymentsService.findRecoverablePaymentEventIds();
    await this.paymentQueue.addWebhookEvents(recoverableEventIds);
    const recoverableCourierPayoutOrderGroupIds =
      await this.paymentsService.findRecoverableCourierPayoutOrderGroupIds();
    await this.paymentQueue.addCourierPayouts(recoverableCourierPayoutOrderGroupIds);

    if (recoverableEventIds.length > 0) {
      this.logger.log(`Requeued ${recoverableEventIds.length} recoverable payment webhook events`);
    }

    if (recoverableCourierPayoutOrderGroupIds.length > 0) {
      this.logger.log(`Requeued ${recoverableCourierPayoutOrderGroupIds.length} recoverable courier payouts`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<PaymentJob>): Promise<void> {
    if (job.data.type === "WEBHOOK_EVENT") {
      this.monitoring.recordPaymentEvent("webhook_job_started", {
        eventId: job.data.eventId,
        jobId: job.id
      });
      await this.paymentsService.processWebhookEvent(job.data.eventId);
      return;
    }

    this.monitoring.recordPaymentEvent("courier_payout_job_started", {
      orderGroupId: job.data.orderGroupId,
      jobId: job.id
    });
    await this.paymentsService.processCourierPayout(job.data.orderGroupId);
  }

  private jobDurationMs(job: Job): number {
    return job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  }
}
