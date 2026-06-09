import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Business } from '../businesses/business.entity';
import { OrderItem } from '../orders/order-item.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  businessId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', nullable: true })
  image?: string;

  @Column({ type: 'varchar', nullable: true })
  category?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceCents!: number;

  @Column({ type: 'int', default: 1 })
  minimumQuantityPerOrder!: number;

  @Column({ type: 'boolean', default: true })
  available!: boolean;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Business, (business) => business.products)
  @JoinColumn({ name: 'businessId' })
  business!: Business;

  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems?: OrderItem[];
}

// Tipo para DTO si es necesario
export type ProductType = {
  id: string;
  businessId: string;
  name: string;
  category: string;
  priceCents: number;
  minimumQuantityPerOrder: number;
  available: boolean;
  createdAt: Date;
};
