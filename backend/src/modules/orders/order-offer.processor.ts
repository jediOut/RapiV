import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Job, Worker } from "bullmq";

import { redisConnection } from "../../common/queue/redis-connection";
import {
  DeliveryOfferGenerationJob,
  ORDER_DELIVERY_OFFER_QUEUE,
  OrderProcessingQueue
} from "./order-processing.queue";
import { OrdersService } from "./orders.service";
import { MonitoringService } from "../monitoring/monitoring.service";

@Injectable()
export class OrderOfferProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderOfferProcessor.name);
  private worker?: Worker<DeliveryOfferGenerationJob>;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderProcessingQueue: OrderProcessingQueue,
    private readonly monitoring: MonitoringService
  ) {}

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<DeliveryOfferGenerationJob>(
      ORDER_DELIVERY_OFFER_QUEUE,
      (job) => this.process(job),
      {
        connection: redisConnection(),
        concurrency: Number(process.env.ORDER_OFFER_QUEUE_CONCURRENCY || 6)
      }
    );

    this.worker.on("completed", (job) => {
      this.monitoring.recordWorkerJob({
        queue: ORDER_DELIVERY_OFFER_QUEUE,
        jobName: job.name,
        status: "completed",
        durationMs: this.jobDurationMs(job)
      });
      this.logger.debug(`Delivery offer job ${job.id ?? "unknown"} completed`);
    });

    this.worker.on("failed", (job, error) => {
      if (job) {
        this.monitoring.recordWorkerJob({
          queue: ORDER_DELIVERY_OFFER_QUEUE,
          jobName: job.name,
          status: "failed",
          durationMs: this.jobDurationMs(job)
        });
      }
      this.logger.error(
        `Delivery offer job ${job?.id ?? "unknown"} failed: ${error.message}`,
        error.stack
      );
    });

    this.worker.on("error", (error) => {
      this.logger.error(`Delivery offer worker error: ${error.message}`, error.stack);
    });

    const recoverableOrderGroupIds =
      await this.ordersService.findReadyOrderGroupIdsNeedingDeliveryOffers();
    await this.orderProcessingQueue.addDeliveryOfferGenerations(recoverableOrderGroupIds);

    if (recoverableOrderGroupIds.length > 0) {
      this.logger.log(
        `Requeued ${recoverableOrderGroupIds.length} ready order groups needing delivery offers`
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<DeliveryOfferGenerationJob>): Promise<void> {
    this.monitoring.recordOrderEvent("offer_job_started", {
      orderGroupId: job.data.orderGroupId,
      jobId: job.id
    });
    await this.ordersService.generateDeliveryOffersForGroup(job.data.orderGroupId);
  }

  private jobDurationMs(job: Job): number {
    return job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  }
}
