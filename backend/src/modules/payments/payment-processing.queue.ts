import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { JobsOptions, Queue } from "bullmq";

export const PAYMENT_WEBHOOK_QUEUE = "payment-webhook-events";

export type PaymentWebhookJob = {
  eventId: string;
};

@Injectable()
export class PaymentProcessingQueue implements OnModuleDestroy {
  private readonly queue = new Queue<PaymentWebhookJob>(PAYMENT_WEBHOOK_QUEUE, {
    connection: redisConnection()
  });

  async addWebhookEvent(eventId: string): Promise<void> {
    const options: JobsOptions = {
      jobId: eventId,
      attempts: 8,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: {
        age: 86400,
        count: 1000
      },
      removeOnFail: {
        age: 604800,
        count: 5000
      }
    };

    await this.queue.add("process-payment-webhook", { eventId }, options);
  }

  async addWebhookEvents(eventIds: string[]): Promise<void> {
    for (const eventId of eventIds) {
      await this.addWebhookEvent(eventId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

export function redisConnection() {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null
  };
}
