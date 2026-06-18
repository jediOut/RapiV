import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/users/user.entity';
import { CourierProfile } from '../modules/users/courier-profile.entity';
import { PushToken } from '../modules/notifications/push-token.entity';
import { Business } from '../modules/businesses/business.entity';
import { Product } from '../modules/products/product.entity';
import { Order } from '../modules/orders/order.entity';
import { OrderItem } from '../modules/orders/order-item.entity';
import { DeliveryOffer } from '../modules/orders/delivery-offer.entity';
import { PaymentEvent } from '../modules/payments/payment-event.entity';
import { Payment } from '../modules/payments/payment.entity';
import { Rating } from '../modules/ratings/rating.entity';
import { CashSettlement } from '../modules/payments/cash-settlement.entity';
import { BusinessCommissionSettlement } from '../modules/payments/business-commission-settlement.entity';
import { CourierWalletTopUp } from '../modules/payments/courier-wallet-top-up.entity';
import { CourierWalletTransaction } from '../modules/payments/courier-wallet-transaction.entity';

function requiredConfig(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);

  if (!value) {
    throw new Error(`Missing required environment variable ${key}`);
  }

  return value;
}

function configValue(configService: ConfigService, key: string, fallbackKey: string): string {
  return configService.get<string>(key) ?? requiredConfig(configService, fallbackKey);
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: parseInt(configService.get<string>('DB_PORT', '5433'), 10),
        username: configValue(configService, 'DB_USERNAME', 'POSTGRES_USER'),
        password: configValue(configService, 'DB_PASSWORD', 'POSTGRES_PASSWORD'),
        database: configValue(configService, 'DB_NAME', 'POSTGRES_DB'),
        entities: [
          User,
          CourierProfile,
          PushToken,
          Business,
          Product,
          Order,
          OrderItem,
          DeliveryOffer,
          Payment,
          PaymentEvent,
          CourierWalletTopUp,
          CourierWalletTransaction,
          CashSettlement,
          BusinessCommissionSettlement,
          Rating
        ],
        synchronize: configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
        logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
        migrations: ['dist/database/migrations/*.js'],
        migrationsTableName: 'typeorm_migrations',
      }),
    }),
  ],
})
export class DatabaseModule {}
