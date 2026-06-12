import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourierPayoutTransferTracking1779800000000 implements MigrationInterface {
  name = "AddCourierPayoutTransferTracking1779800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierPayoutPaidAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierPayoutProviderTransferId" varchar`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierPayoutFailedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierPayoutError" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "courierPayoutError"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "courierPayoutFailedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "courierPayoutProviderTransferId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "courierPayoutPaidAt"`);
  }
}
