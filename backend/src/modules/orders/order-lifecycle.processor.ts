import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Job, Worker } from "bullmq";

import { redisConnection } from "../../common/queue/redis-connection";
import { MonitoringService } from "../monitoring/monitoring.service";
import {
  ORDER_LIFECYCLE_QUEUE,
  OrderLifecycleJob
} from "./order-processing.queue";
import { OrdersService } from "./orders.service";

@Injectable()
export class OrderLifecycleProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderLifecycleProcessor.name);
  private worker?: Worker<OrderLifecycleJob>;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly monitoring: MonitoringService
  ) {}

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<OrderLifecycleJob>(
      ORDER_LIFECYCLE_QUEUE,
      (job) => this.process(job),
      {
        connection: redisConnection(),
        concurrency: Number(process.env.ORDER_LIFECYCLE_QUEUE_CONCURRENCY || 4)
      }
    );

    this.worker.on("completed", (job) => {
      this.monitoring.recordWorkerJob({
        queue: ORDER_LIFECYCLE_QUEUE,
        jobName: job.name,
        status: "completed",
        durationMs: this.jobDurationMs(job)
      });
      this.logger.debug(`Order lifecycle job ${job.id ?? "unknown"} completed`);
    });

    this.worker.on("failed", (job, error) => {
      if (job) {
        this.monitoring.recordWorkerJob({
          queue: ORDER_LIFECYCLE_QUEUE,
          jobName: job.name,
          status: "failed",
          durationMs: this.jobDurationMs(job)
        });
      }

      this.logger.error(
        `Order lifecycle job ${job?.id ?? "unknown"} failed: ${error.message}`,
        error.stack
      );
    });

    this.worker.on("error", (error) => {
      this.logger.error(`Order lifecycle worker error: ${error.message}`, error.stack);
    });

    await this.ordersService.scheduleRecoverableLifecycleTimeouts();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<OrderLifecycleJob>): Promise<void> {
    this.monitoring.recordOrderEvent("lifecycle_job_started", {
      type: job.data.type,
      orderGroupId: job.data.orderGroupId,
      jobId: job.id
    });
    await this.ordersService.handleLifecycleJob(job.data);
  }

  private jobDurationMs(job: Job): number {
    return job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  }
}
