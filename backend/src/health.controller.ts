import { Controller, Get, Optional } from "@nestjs/common";

import { Public } from "./common/auth/public.decorator";
import { PaymentsService } from "./modules/payments/payments.service";

@Controller("health")
export class HealthController {
  constructor(
    @Optional()
    private readonly paymentsService?: PaymentsService
  ) {}

  @Public()
  @Get()
  async check() {
    const payments = await this.paymentsService?.getPaymentHealth();

    return {
      ok: true,
      service: "rapiv-backend",
      uptimeSeconds: Math.round(process.uptime()),
      payments
    };
  }
}
