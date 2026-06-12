import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Business } from "../businesses/business.entity";
import { BusinessCommissionSettlement } from "../payments/business-commission-settlement.entity";
import { CashSettlement } from "../payments/cash-settlement.entity";
import { User } from "../users/user.entity";
import { AdminSettlementsController } from "./admin-settlements.controller";
import { AdminSettlementsService } from "./admin-settlements.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CashSettlement,
      BusinessCommissionSettlement,
      User,
      Business
    ])
  ],
  controllers: [AdminSettlementsController],
  providers: [AdminSettlementsService]
})
export class AdminModule {}
