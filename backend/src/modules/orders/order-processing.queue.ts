import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { JobsOptions, Queue } from "bullmq";
import { redisConnection } from "../../common/queue/redis-connection";

export const ORDER_DELIVERY_OFFER_QUEUE = "order-delivery-offers";

export type DeliveryOfferGenerationJob = {
  orderGroupId: string;
};

type QueueItem<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

@Injectable()
export class OrderProcessingQueue implements OnModuleDestroy {
  private readonly concurrency = 4;
  private readonly pending: QueueItem<unknown>[] = [];
  private activeWorkers = 0;
  private readonly deliveryOfferQueue = new Queue<DeliveryOfferGenerationJob>(
    ORDER_DELIVERY_OFFER_QUEUE,
    {
      connection: redisConnection()
    }
  );

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        task,
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.drain();
    });
  }

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

  async addDeliveryOfferGenerations(orderGroupIds: string[]): Promise<void> {
    for (const orderGroupId of orderGroupIds) {
      await this.addDeliveryOfferGeneration(orderGroupId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.deliveryOfferQueue.close();
  }

  private drain(): void {
    while (this.activeWorkers < this.concurrency && this.pending.length > 0) {
      const item = this.pending.shift();

      if (!item) {
        return;
      }

      this.activeWorkers += 1;
      void this.run(item);
    }
  }

  private async run<T>(item: QueueItem<T>): Promise<void> {
    try {
      item.resolve(await item.task());
    } catch (error) {
      item.reject(error);
    } finally {
      this.activeWorkers -= 1;
      this.drain();
    }
  }
}
