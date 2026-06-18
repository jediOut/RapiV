import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Order } from "../orders/order.entity";
import { CourierProfile } from "../users/courier-profile.entity";
import { CourierWalletTopUp } from "./courier-wallet-top-up.entity";
import { CourierWalletTransaction } from "./courier-wallet-transaction.entity";
import { CourierWalletService } from "./courier-wallet.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourierProfile,
      Order,
      CourierWalletTopUp,
      CourierWalletTransaction
    ])
  ],
  providers: [CourierWalletService],
  exports: [CourierWalletService]
})
export class CourierWalletModule {}
