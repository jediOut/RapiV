import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn
} from "typeorm";

import { User } from "./user.entity";

export type CourierAvailabilityStatus = "AVAILABLE" | "BUSY" | "OFFLINE";

@Entity("courier_profiles")
export class CourierProfile {
  @PrimaryColumn({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", default: "OFFLINE" })
  availabilityStatus!: CourierAvailabilityStatus;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  preferredLatitude?: number | null;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  preferredLongitude?: number | null;

  @Column({ type: "int", nullable: true })
  preferredRadiusKm?: number | null;

  @Column({ type: "int", nullable: true })
  maxDeliveryDistanceKm?: number | null;

  @Column({ type: "int", default: 0 })
  walletBalanceCents!: number;

  @Column({ type: "varchar", nullable: true })
  stripeConnectedAccountId?: string | null;

  @Column({ type: "varchar", nullable: true })
  stripePlatformAccountId?: string | null;

  @Column({ type: "boolean", default: false })
  stripeChargesEnabled!: boolean;

  @Column({ type: "boolean", default: false })
  stripePayoutsEnabled!: boolean;

  @Column({ type: "boolean", default: false })
  stripeDetailsSubmitted!: boolean;

  @Column({ type: "jsonb", nullable: true })
  stripeRequirementsCurrentlyDue?: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;
}
