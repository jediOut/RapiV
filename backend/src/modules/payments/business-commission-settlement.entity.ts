import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

export type BusinessCommissionSettlementStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

@Index("IDX_business_commission_settlements_business_period", ["businessId", "periodStartAt", "periodEndAt"], { unique: true })
@Entity("business_commission_settlements")
export class BusinessCommissionSettlement {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  businessId!: string;

  @Column({ type: "uuid" })
  ownerUserId!: string;

  @Column({ type: "varchar" })
  settlementWeek!: string;

  @Column({ type: "timestamp" })
  periodStartAt!: Date;

  @Column({ type: "timestamp" })
  periodEndAt!: Date;

  @Column({ type: "varchar", default: "PENDING" })
  status!: BusinessCommissionSettlementStatus;

  @Column({ type: "int", default: 0 })
  orderCount!: number;

  @Column({ type: "simple-json", nullable: true })
  orderIds?: string[] | null;

  @Column({ type: "int", default: 0 })
  grossSalesCents!: number;

  @Column({ type: "int", default: 0 })
  businessPayoutCents!: number;

  @Column({ type: "int", default: 0 })
  rapivCommissionCents!: number;

  @Column({ type: "timestamp", nullable: true })
  businessNotifiedAt?: Date | null;

  @Column({ type: "timestamp", nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: "uuid", nullable: true })
  confirmedByUserId?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
