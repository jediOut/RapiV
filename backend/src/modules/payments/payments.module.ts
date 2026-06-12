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
import { CashSettlement } from "./cash-settlement.entity";
import { CashSettlementsController } from "./cash-settlements.controller";
import { CashSettlementsService } from "./cash-settlements.service";
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
      CashSettlement,
      BusinessCommissionSettlement,
      Order,
      Business,
      CourierProfile
    ]),
    NotificationsModule,
    OrdersModule,
    PaymentQueueModule
  ],
  controllers: [PaymentsController, CashSettlementsController, BusinessCommissionSettlementsController],
  providers: [
    PaymentsService,
    PaymentProviderService,
    PaymentWebhookProcessor,
    CashSettlementsService,
    BusinessCommissionSettlementsService
  ],
  exports: [PaymentsService, CashSettlementsService, BusinessCommissionSettlementsService]
})
export class PaymentsModule {}
