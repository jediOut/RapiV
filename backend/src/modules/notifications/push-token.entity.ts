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

@Index("IDX_push_tokens_token", ["token"], { unique: true })
@Index("IDX_push_tokens_user", ["userId"])
@Entity("push_tokens")
export class PushToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  token!: string;

  @Column({ type: "varchar" })
  app!: "cliente" | "negocio" | "repartidor";

  @Column({ type: "varchar", nullable: true })
  deviceId?: string | null;

  @Column({ type: "timestamp", nullable: true })
  lastUsedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;
}
