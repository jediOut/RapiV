import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Business } from '../businesses/business.entity';
import { OrderItem } from './order-item.entity';
import type {
  BusinessOrder as ContractBusinessOrder,
  BusinessOrderStatus as ContractBusinessOrderStatus,
  OrderGroup as ContractOrderGroup,
  OrderGroupStatus as ContractOrderGroupStatus,
  OrderItemSnapshot as ContractOrderItemSnapshot,
  OrderFulfillmentMethod as ContractOrderFulfillmentMethod,
  OrderPaymentMethod as ContractOrderPaymentMethod,
  OrderPaymentStatus as ContractOrderPaymentStatus
} from "@rapidin/contracts";

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'assigned'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export type BusinessOrderStatus = ContractBusinessOrderStatus;
export type OrderGroupStatus = ContractOrderGroupStatus;
export type OrderItemSnapshot = ContractOrderItemSnapshot;
export type BusinessOrder = ContractBusinessOrder;
export type OrderGroup = ContractOrderGroup;
export type OrderFulfillmentMethod = ContractOrderFulfillmentMethod;
export type OrderPaymentMethod = ContractOrderPaymentMethod;
export type OrderPaymentStatus = ContractOrderPaymentStatus;
export type BusinessCashPayoutStatus = 'NOT_APPLICABLE' | 'PENDING' | 'CONFIRMED' | 'CANCELLED';

@Index('IDX_orders_user_idempotency', ['userId', 'idempotencyKey'], { unique: true })
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  businessId!: string;

  @Column({ type: 'uuid', nullable: true })
  orderGroupId!: string;

  @Column({ type: 'uuid', nullable: true })
  courierId?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  customerLatitude?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  customerLongitude?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  courierLatitude?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  courierLongitude?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  arrivalNotifiedAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  idempotencyKey?: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: OrderStatus | BusinessOrderStatus;

  @Column({ type: 'varchar', default: 'UNPAID' })
  paymentStatus!: OrderPaymentStatus;

  @Column({ type: 'varchar', default: 'CARD' })
  paymentMethod!: OrderPaymentMethod;

  @Column({ type: 'varchar', default: 'DELIVERY' })
  fulfillmentMethod!: OrderFulfillmentMethod;

  @Column({ type: 'int', nullable: true })
  cashReceivedCents?: number | null;

  @Column({ type: 'int', nullable: true })
  cashChangeCents?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  cashCollectedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  subtotalCents!: number;

  @Column({ type: 'int', default: 0 })
  deliveryFeeCents!: number;

  @Column({ type: 'int', default: 0 })
  courierPayoutCents!: number;

  @Column({ type: 'varchar', default: 'NOT_APPLICABLE' })
  courierPayoutStatus!: 'NOT_APPLICABLE' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

  @Column({ type: 'timestamp', nullable: true })
  courierPayoutPaidAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  courierPayoutProviderTransferId?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  courierPayoutFailedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  courierPayoutError?: string | null;

  @Column({ type: 'int', default: 0 })
  platformDeliveryMarginCents!: number;

  @Column({ type: 'int', default: 0 })
  businessCommissionCents!: number;

  @Column({ type: 'int', default: 0 })
  businessPayoutCents!: number;

  @Column({ type: 'varchar', default: 'NOT_APPLICABLE' })
  businessCashPayoutStatus!: BusinessCashPayoutStatus;

  @Column({ type: 'timestamp', nullable: true })
  businessCashPayoutConfirmedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  businessCashPayoutConfirmedByUserId?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice!: number;

  @Column({ type: 'text' })
  deliveryAddress!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Business, (business) => business.orders)
  @JoinColumn({ name: 'businessId' })
  business!: Business;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  businessLatitude?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  businessLongitude?: number | null;

  @Column({ type: 'text', nullable: true })
  businessAddress?: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items?: OrderItem[];
}
