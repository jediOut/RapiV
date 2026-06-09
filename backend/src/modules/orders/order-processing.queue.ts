import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { JobsOptions, Queue } from "bullmq";
import { redisConnection } from "../../common/queue/redis-connection";

export const ORDER_DELIVERY_OFFER_QUEUE = "order-delivery-offers";
export const ORDER_LIFECYCLE_QUEUE = "order-lifecycle";

export type DeliveryOfferGenerationJob = {
  orderGroupId: string;
};

export type OrderLifecycleJob =
  | {
      type: "BUSINESS_ACCEPTANCE_TIMEOUT";
      orderGroupId: string;
      businessOrderId: string;
    }
  | {
      type: "BUSINESS_READY_TIMEOUT";
      orderGroupId: string;
      businessOrderId: string;
    }
  | {
      type: "DELIVERY_OFFER_TIMEOUT";
      orderGroupId: string;
    };

@Injectable()
export class OrderProcessingQueue implements OnModuleDestroy {
  private readonly deliveryOfferQueue = new Queue<DeliveryOfferGenerationJob>(
    ORDER_DELIVERY_OFFER_QUEUE,
    {
      connection: redisConnection()
    }
  );
  private readonly lifecycleQueue = new Queue<OrderLifecycleJob>(ORDER_LIFECYCLE_QUEUE, {
    connection: redisConnection()
  });

  async addDeliveryOfferGeneration(orderGroupId: string): Promise<void> {
    const options: JobsOptions = {
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

    await this.deliveryOfferQueue.add(
      "generate-delivery-offers",
      { orderGroupId },
      options
    );
  }

  async addBusinessAcceptanceTimeout(
    orderGroupId: string,
    businessOrderId: string,
    delayMs = this.businessAcceptanceTimeoutMs()
  ): Promise<void> {
    await this.addLifecycleJob(
      "business-acceptance-timeout",
      { type: "BUSINESS_ACCEPTANCE_TIMEOUT", orderGroupId, businessOrderId },
      this.lifecycleJobId(orderGroupId, businessOrderId, "business-acceptance-timeout"),
      delayMs
    );
  }

  async addBusinessReadyTimeout(
    orderGroupId: string,
    businessOrderId: string,
    delayMs = this.businessReadyTimeoutMs()
  ): Promise<void> {
    await this.addLifecycleJob(
      "business-ready-timeout",
      { type: "BUSINESS_READY_TIMEOUT", orderGroupId, businessOrderId },
      this.lifecycleJobId(orderGroupId, businessOrderId, "business-ready-timeout"),
      delayMs
    );
  }

  async addDeliveryOfferTimeout(
    orderGroupId: string,
    delayMs = this.deliveryOfferTimeoutMs()
  ): Promise<void> {
    await this.addLifecycleJob(
      "delivery-offer-timeout",
      { type: "DELIVERY_OFFER_TIMEOUT", orderGroupId },
      this.lifecycleJobId(orderGroupId, "delivery-offer-timeout"),
      delayMs
    );
  }

  async addDeliveryOfferGenerations(orderGroupIds: string[]): Promise<void> {
    for (const orderGroupId of orderGroupIds) {
      await this.addDeliveryOfferGeneration(orderGroupId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.deliveryOfferQueue.close();
    await this.lifecycleQueue.close();
  }

  private async addLifecycleJob(
    name: string,
    data: OrderLifecycleJob,
    jobId: string,
    delayMs: number
  ): Promise<void> {
    await this.lifecycleQueue.add(name, data, {
      jobId,
      delay: delayMs,
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
    });
  }

  private lifecycleJobId(...parts: string[]): string {
    return parts.join("__");
  }

  private businessAcceptanceTimeoutMs(): number {
    return this.minutesToMs(process.env.BUSINESS_ACCEPTANCE_TIMEOUT_MINUTES, 10);
  }

  private businessReadyTimeoutMs(): number {
    return this.minutesToMs(process.env.BUSINESS_READY_TIMEOUT_MINUTES, 30);
  }

  private deliveryOfferTimeoutMs(): number {
    return this.minutesToMs(process.env.DELIVERY_OFFER_TTL_MINUTES, 15);
  }

  private minutesToMs(value: string | undefined, fallback: number): number {
    const minutes = Number(value ?? fallback);
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
    return safeMinutes * 60 * 1000;
  }
}
