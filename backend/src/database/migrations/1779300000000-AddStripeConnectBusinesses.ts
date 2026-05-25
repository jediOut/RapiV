import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStripeConnectBusinesses1779300000000 implements MigrationInterface {
  name = "AddStripeConnectBusinesses1779300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripeConnectedAccountId" varchar`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripeChargesEnabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripeDetailsSubmitted" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripeRequirementsCurrentlyDue" jsonb`);
    await queryRunner.query(`UPDATE "businesses" SET "acceptsCard" = false WHERE "stripeConnectedAccountId" IS NULL OR "stripeChargesEnabled" = false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "stripeRequirementsCurrentlyDue"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "stripeDetailsSubmitted"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "stripePayoutsEnabled"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "stripeChargesEnabled"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "stripeConnectedAccountId"`);
  }
}
