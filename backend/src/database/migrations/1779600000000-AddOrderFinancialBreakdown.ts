import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderFinancialBreakdown1779600000000 implements MigrationInterface {
  name = "AddOrderFinancialBreakdown1779600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryFeeCents" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierPayoutCents" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierPayoutStatus" varchar NOT NULL DEFAULT 'NOT_APPLICABLE'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "platformDeliveryMarginCents" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessCommissionCents" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessPayoutCents" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessPayoutCents"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessCommissionCents"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "platformDeliveryMarginCents"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "courierPayoutStatus"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "courierPayoutCents"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveryFeeCents"`);
  }
}
