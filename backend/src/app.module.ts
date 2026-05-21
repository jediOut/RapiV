import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";

import { DatabaseModule } from "./database/database.module";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard";
import { RolesGuard } from "./common/auth/roles.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessesModule } from "./modules/businesses/businesses.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { ProductsModule } from "./modules/products/products.module";
import { UsersModule } from "./modules/users/users.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { HealthController } from "./health.controller";
import { MediaModule } from "./modules/media/media.module";
import { MonitoringModule } from "./modules/monitoring/monitoring.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../.env", ".env"] }),
    MonitoringModule,
    DatabaseModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
      signOptions: { expiresIn: "7d" }
    }),
    UsersModule,
    AuthModule,
    BusinessesModule,
    ProductsModule,
    NotificationsModule,
    MediaModule,
    PaymentsModule,
    OrdersModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ],
  controllers: [HealthController]
})
export class AppModule {}
