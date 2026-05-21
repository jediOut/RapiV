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
  OrderItemSnapshot as ContractOrderItemSnapshot
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
export type OrderPaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

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

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  subtotalCents!: number;

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
