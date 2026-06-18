import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from "typeorm";

export type CourierWalletTransactionType =
  | "TOP_UP"
  | "CASH_ORDER_SETTLEMENT"
  | "WITHDRAWAL"
  | "ADMIN_ADJUSTMENT";

@Index("IDX_courier_wallet_transactions_courier_created", ["courierId", "createdAt"])
@Index("IDX_courier_wallet_transactions_reference", ["type", "referenceId"], { unique: true })
@Entity("courier_wallet_transactions")
export class CourierWalletTransaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  courierId!: string;

  @Column({ type: "varchar" })
  type!: CourierWalletTransactionType;

  @Column({ type: "int" })
  amountCents!: number;

  @Column({ type: "int" })
  balanceAfterCents!: number;

  @Column({ type: "uuid", nullable: true })
  orderGroupId?: string | null;

  @Column({ type: "varchar", nullable: true })
  referenceId?: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
