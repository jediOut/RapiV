import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCashPaymentOrders1779100000000 implements MigrationInterface {
  name = "AddCashPaymentOrders1779100000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentMethod" varchar NOT NULL DEFAULT 'CARD'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cashReceivedCents" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cashChangeCents" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cashCollectedAt" TIMESTAMP`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cashCollectedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cashChangeCents"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cashReceivedCents"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "paymentMethod"`);
  }
}
