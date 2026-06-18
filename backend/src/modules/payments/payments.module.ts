import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Business } from "../businesses/business.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { Order } from "../orders/order.entity";
import { OrdersModule } from "../orders/orders.module";
import { CourierProfile } from "../users/courier-profile.entity";
import { BusinessCommissionSettlement } from "./business-commission-settlement.entity";
import { BusinessCommissionSettlementsController } from "./business-commission-settlements.controller";
import { BusinessCommissionSettlementsService } from "./business-commission-settlements.service";
import { CourierWalletModule } from "./courier-wallet.module";
import { CourierWalletTopUp } from "./courier-wallet-top-up.entity";
import { CourierWalletTransaction } from "./courier-wallet-transaction.entity";
import { PaymentEvent } from "./payment-event.entity";
import { PaymentQueueModule } from "./payment-queue.module";
import { PaymentProviderService } from "./payment-provider.service";
import { PaymentWebhookProcessor } from "./payment-webhook.processor";
import { Payment } from "./payment.entity";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentEvent,
      BusinessCommissionSettlement,
      Order,
      Business,
      CourierProfile,
      CourierWalletTopUp,
      CourierWalletTransaction
    ]),
    NotificationsModule,
    OrdersModule,
    CourierWalletModule,
    PaymentQueueModule
  ],
  controllers: [PaymentsController, BusinessCommissionSettlementsController],
  providers: [
    PaymentsService,
    PaymentProviderService,
    PaymentWebhookProcessor,
    BusinessCommissionSettlementsService
  ],
  exports: [PaymentsService, BusinessCommissionSettlementsService]
})
export class PaymentsModule {}
