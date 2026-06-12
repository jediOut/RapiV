import { Module } from "@nestjs/common";

import { StripeConnectService } from "./stripe-connect.service";

@Module({
  providers: [StripeConnectService],
  exports: [StripeConnectService]
})
export class StripeConnectModule {}
