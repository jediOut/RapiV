import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessCheckoutRules1779200000000 implements MigrationInterface {
  name = "AddBusinessCheckoutRules1779200000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "acceptsCash" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "acceptsCard" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "minimumOrderItems" integer NOT NULL DEFAULT 1`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "minimumOrderItems"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "acceptsCard"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "acceptsCash"`);
  }
}
