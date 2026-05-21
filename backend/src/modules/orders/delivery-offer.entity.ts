import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import { User } from "../users/user.entity";

export type DeliveryOfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";

@Index("IDX_delivery_offers_order_courier", ["orderGroupId", "courierId"], { unique: true })
@Index("IDX_delivery_offers_courier_status", ["courierId", "status"])
@Entity("delivery_offers")
export class DeliveryOffer {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  orderGroupId!: string;

  @Column({ type: "uuid" })
  courierId!: string;

  @Column({ type: "varchar", default: "PENDING" })
  status!: DeliveryOfferStatus;

  @Column({ type: "int", default: 0 })
  score!: number;

  @Column({ type: "timestamp" })
  expiresAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  acceptedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "courierId" })
  courier!: User;
}
