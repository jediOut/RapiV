import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Order } from "../orders/order.entity";
import { OrdersModule } from "../orders/orders.module";
import { PaymentEvent } from "./payment-event.entity";
import { PaymentProcessingQueue } from "./payment-processing.queue";
import { PaymentProviderService } from "./payment-provider.service";
import { PaymentWebhookProcessor } from "./payment-webhook.processor";
import { Payment } from "./payment.entity";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentEvent, Order]), OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProviderService, PaymentProcessingQueue, PaymentWebhookProcessor],
  exports: [PaymentsService]
})
export class PaymentsModule {}
