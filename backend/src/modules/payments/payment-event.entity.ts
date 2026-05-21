import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

export type PaymentEventStatus = "PENDING" | "PROCESSED" | "FAILED";

@Index("IDX_payment_events_provider_event", ["provider", "providerEventId"], { unique: true })
@Index("IDX_payment_events_status", ["status"])
@Entity("payment_events")
export class PaymentEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  provider!: string;

  @Column({ type: "varchar" })
  providerEventId!: string;

  @Column({ type: "varchar" })
  type!: string;

  @Column({ type: "varchar", default: "PENDING" })
  status!: PaymentEventStatus;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "timestamp", nullable: true })
  processedAt?: Date | null;

  @Column({ type: "text", nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
