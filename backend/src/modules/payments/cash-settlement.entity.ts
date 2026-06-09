import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

export type CashSettlementStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

@Index("IDX_cash_settlements_courier_date", ["courierId", "settlementDate"], { unique: true })
@Entity("cash_settlements")
export class CashSettlement {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  courierId!: string;

  @Column({ type: "varchar" })
  settlementDate!: string;

  @Column({ type: "timestamp" })
  periodStartAt!: Date;

  @Column({ type: "timestamp" })
  periodEndAt!: Date;

  @Column({ type: "varchar", default: "PENDING" })
  status!: CashSettlementStatus;

  @Column({ type: "int", default: 0 })
  orderGroupCount!: number;

  @Column({ type: "simple-json", nullable: true })
  orderGroupIds?: string[] | null;

  @Column({ type: "int", default: 0 })
  cashCollectedCents!: number;

  @Column({ type: "int", default: 0 })
  cashChangeCents!: number;

  @Column({ type: "int", default: 0 })
  businessPayoutCents!: number;

  @Column({ type: "int", default: 0 })
  rapivCommissionCents!: number;

  @Column({ type: "int", default: 0 })
  courierPayoutCents!: number;

  @Column({ type: "int", default: 0 })
  platformDeliveryMarginCents!: number;

  @Column({ type: "int", default: 0 })
  netDueToRapivCents!: number;

  @Column({ type: "timestamp", nullable: true })
  courierNotifiedAt?: Date | null;

  @Column({ type: "timestamp", nullable: true })
  courierOverdueNotifiedAt?: Date | null;

  @Column({ type: "timestamp", nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: "uuid", nullable: true })
  confirmedByUserId?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
