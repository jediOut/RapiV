import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

export type PaymentStatus =
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

@Index("IDX_payments_user_idempotency", ["userId", "idempotencyKey"], { unique: true })
@Index("IDX_payments_order_group", ["orderGroupId"])
@Index("IDX_payments_provider_reference", ["provider", "providerPaymentId"], { unique: true })
@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  orderGroupId!: string;

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
