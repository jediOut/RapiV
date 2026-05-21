import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { CorrelationIdMiddleware } from "./correlation-id.middleware";
import { HttpMonitoringInterceptor } from "./http-monitoring.interceptor";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringService } from "./monitoring.service";
import { RequestContextService } from "./request-context.service";

@Global()
@Module({
  controllers: [MonitoringController],
  providers: [
    RequestContextService,
    MonitoringService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMonitoringInterceptor
    }
  ],
  exports: [MonitoringService, RequestContextService]
})
export class MonitoringModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
