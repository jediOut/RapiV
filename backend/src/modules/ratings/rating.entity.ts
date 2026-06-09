import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import type { RatingTargetType } from "@rapidin/contracts";

@Index("IDX_ratings_order_target", ["orderGroupId", "targetType", "targetId"], { unique: true })
@Index("IDX_ratings_target", ["targetType", "targetId"])
@Entity("ratings")
export class Rating {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  orderGroupId!: string;

  @Column({ type: "uuid" })
  customerId!: string;

  @Column({ type: "varchar" })
  targetType!: RatingTargetType;

  @Column({ type: "uuid" })
  targetId!: string;

  @Column({ type: "int" })
  score!: number;

  @Column({ type: "text", nullable: true })
  comment?: string | null;

  @Column({ type: "int", default: 0 })
  editCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
