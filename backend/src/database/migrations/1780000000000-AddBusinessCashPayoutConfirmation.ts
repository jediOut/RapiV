import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessCashPayoutConfirmation1780000000000 implements MigrationInterface {
  name = "AddBusinessCashPayoutConfirmation1780000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessCashPayoutStatus" varchar NOT NULL DEFAULT 'NOT_APPLICABLE'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessCashPayoutConfirmedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessCashPayoutConfirmedByUserId" uuid`);
    await queryRunner.query(`
      UPDATE "orders"
      SET "businessCashPayoutStatus" = 'PENDING'
      WHERE "paymentMethod" = 'CASH'
        AND "businessPayoutCents" > 0
        AND "status" <> 'CANCELLED'
        AND "businessCashPayoutStatus" = 'NOT_APPLICABLE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessCashPayoutConfirmedByUserId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessCashPayoutConfirmedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessCashPayoutStatus"`);
  }
}
