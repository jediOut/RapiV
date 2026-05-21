import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Business } from '../businesses/business.entity';
import { Order } from '../orders/order.entity';
import type { UserRole as ContractUserRole } from "@rapidin/contracts";

export type UserRole = ContractUserRole;

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ type: 'varchar' })
  fullName!: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'varchar', nullable: true })
  address?: string;

  @Column({ type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'simple-array', default: '["CUSTOMER"]' })
  roles!: UserRole[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Business, (business) => business.owner)
  businesses?: Business[];

  @OneToMany(() => Order, (order) => order.user)
  orders?: Order[];
}
