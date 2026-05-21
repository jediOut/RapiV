import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { JobsOptions, Queue } from "bullmq";
import { redisConnection } from "../../common/queue/redis-connection";

export const ORDER_DELIVERY_OFFER_QUEUE = "order-delivery-offers";

export type DeliveryOfferGenerationJob = {
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
}
