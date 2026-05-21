import { Controller, Get, Header } from "@nestjs/common";

import { Public } from "../../common/auth/public.decorator";
import { MonitoringService } from "./monitoring.service";

@Controller()
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Public()
  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4")
  metrics(): string {
    return this.monitoring.prometheusMetrics();
  }

  @Public()
  @Get("monitoring/snapshot")
  snapshot() {
    return this.monitoring.snapshot();
  }
}
