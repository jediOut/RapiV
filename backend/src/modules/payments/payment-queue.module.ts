import { Module } from "@nestjs/common";

import { PaymentProcessingQueue } from "./payment-processing.queue";

@Module({
  providers: [PaymentProcessingQueue],
  exports: [PaymentProcessingQueue]
})
export class PaymentQueueModule {}
