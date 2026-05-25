import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStripeConnectBusinesses1779300000000 implements MigrationInterface {
  name = "AddStripeConnectBusinesses1779300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripeConnectedAccountId" varchar`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripeChargesEnabled" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "stripeChargesEnabled"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "stripeConnectedAccountId"`);
  }
}
