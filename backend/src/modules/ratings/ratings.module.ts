import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Business } from "../businesses/business.entity";
import { Order } from "../orders/order.entity";
import { Rating } from "./rating.entity";
import { RatingsController } from "./ratings.controller";
import { RatingsService } from "./ratings.service";

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Order, Business])],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService]
})
export class RatingsModule {}
