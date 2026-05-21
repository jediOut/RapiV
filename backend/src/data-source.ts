import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from './modules/users/user.entity';
import { Business } from './modules/businesses/business.entity';
import { Product } from './modules/products/product.entity';
import { Order } from './modules/orders/order.entity';
import { OrderItem } from './modules/orders/order-item.entity';
import { DeliveryOffer } from './modules/orders/delivery-offer.entity';
import { CourierProfile } from './modules/users/courier-profile.entity';
import { PushToken } from './modules/notifications/push-token.entity';
import { PaymentEvent } from './modules/payments/payment-event.entity';
import { Payment } from './modules/payments/payment.entity';

loadEnv({ path: '../.env', quiet: true });
loadEnv({ path: '.env', override: true, quiet: true });

function requiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable ${key}`);
  }

  return value;
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  username: process.env.DB_USERNAME ?? requiredEnv('POSTGRES_USER'),
  password: process.env.DB_PASSWORD ?? requiredEnv('POSTGRES_PASSWORD'),
  database: process.env.DB_NAME ?? requiredEnv('POSTGRES_DB'),
  synchronize: false,
  logging: false,
  entities: [User, CourierProfile, PushToken, Business, Product, Order, OrderItem, DeliveryOffer, Payment, PaymentEvent],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: [],
});
