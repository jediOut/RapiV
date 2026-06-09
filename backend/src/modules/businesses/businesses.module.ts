import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Business } from "./business.entity";
import { StripeConnectModule } from "../stripe-connect/stripe-connect.module";
import { UsersModule } from "../users/users.module";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";
import { StripeConnectReturnController } from "./stripe-connect-return.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Business]), UsersModule, StripeConnectModule],
  controllers: [BusinessesController, StripeConnectReturnController],
  providers: [BusinessesService],
  exports: [BusinessesService]
})
export class BusinessesModule {}
