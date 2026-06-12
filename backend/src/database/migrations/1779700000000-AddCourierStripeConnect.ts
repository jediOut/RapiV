import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourierStripeConnect1779700000000 implements MigrationInterface {
  name = "AddCourierStripeConnect1779700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courier_profiles" ADD COLUMN IF NOT EXISTS "stripeConnectedAccountId" varchar`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" ADD COLUMN IF NOT EXISTS "stripePlatformAccountId" varchar`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" ADD COLUMN IF NOT EXISTS "stripeChargesEnabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" ADD COLUMN IF NOT EXISTS "stripeDetailsSubmitted" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" ADD COLUMN IF NOT EXISTS "stripeRequirementsCurrentlyDue" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courier_profiles" DROP COLUMN IF EXISTS "stripeRequirementsCurrentlyDue"`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" DROP COLUMN IF EXISTS "stripeDetailsSubmitted"`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" DROP COLUMN IF EXISTS "stripePayoutsEnabled"`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" DROP COLUMN IF EXISTS "stripeChargesEnabled"`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" DROP COLUMN IF EXISTS "stripePlatformAccountId"`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" DROP COLUMN IF EXISTS "stripeConnectedAccountId"`);
  }
}
