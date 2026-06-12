import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserTermsAcceptance1780300000000 implements MigrationInterface {
  name = "AddUserTermsAcceptance1780300000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsVersion" varchar`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsApp" varchar`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "termsApp"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "termsVersion"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "termsAcceptedAt"`);
  }
}
