import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import type { PaymentStatus } from "./payment.entity";

@Index("IDX_courier_wallet_topups_courier_idempotency", ["courierId", "idempotencyKey"], { unique: true })
@Index("IDX_courier_wallet_topups_provider_reference", ["provider", "providerPaymentId"], { unique: true })
@Entity("courier_wallet_top_ups")
export class CourierWalletTopUp {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  courierId!: string;

  @Column({ type: "int" })
  amountCents!: number;

  @Column({ type: "varchar", default: "MXN" })
  currency!: string;

  @Column({ type: "varchar" })
  status!: PaymentStatus;

  @Column({ type: "varchar" })
  provider!: string;

  @Column({ type: "varchar" })
  providerPaymentId!: string;

  @Column({ type: "varchar" })
  idempotencyKey!: string;

  @Column({ type: "jsonb", nullable: true })
  providerMetadata?: Record<string, unknown> | null;

  @Column({ type: "timestamp", nullable: true })
  paidAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
