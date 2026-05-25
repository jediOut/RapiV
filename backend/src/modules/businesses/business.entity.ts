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
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { Order } from '../orders/order.entity';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  ownerUserId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', nullable: true })
  logo?: string;

  @Column({ type: 'varchar', nullable: true })
  address?: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating?: number | null;

  @Column({ type: 'int', nullable: true })
  deliveryTime?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumOrder?: number;

  @Column({ type: 'boolean', default: true })
  acceptsCash!: boolean;

  @Column({ type: 'boolean', default: true })
  acceptsCard!: boolean;

  @Column({ type: 'varchar', nullable: true })
  stripeConnectedAccountId?: string | null;

  @Column({ type: 'boolean', default: false })
  stripeChargesEnabled!: boolean;

  @Column({ type: 'int', default: 1 })
  minimumOrderItems!: number;

  @Column({ type: 'boolean', default: true })
  isOpen!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.businesses)
  @JoinColumn({ name: 'ownerUserId' })
  owner!: User;

  @OneToMany(() => Product, (product) => product.business)
  products?: Product[];

  @OneToMany(() => Order, (order) => order.business)
  orders?: Order[];
}
