import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Order } from "./order.entity";
import { DeliveryOffer } from "./delivery-offer.entity";
import { OrderItem } from "./order-item.entity";
import { Product } from "../products/product.entity";
import { User } from "../users/user.entity";
import { CourierProfile } from "../users/courier-profile.entity";
import { BusinessesModule } from "../businesses/businesses.module";
import { ProductsModule } from "../products/products.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrderProcessingQueue } from "./order-processing.queue";
import { OrderOfferProcessor } from "./order-offer.processor";
import { UsersModule } from "../users/users.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, DeliveryOffer, Product, User, CourierProfile]),
    BusinessesModule,
    ProductsModule,
    UsersModule,
    NotificationsModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderProcessingQueue, OrderOfferProcessor],
  exports: [OrdersService]
})
export class OrdersModule {}
