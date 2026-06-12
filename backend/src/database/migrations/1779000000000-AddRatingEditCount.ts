import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRatingEditCount1779000000000 implements MigrationInterface {
  name = "AddRatingEditCount1779000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ratings"
      ADD COLUMN IF NOT EXISTS "editCount" integer NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ratings" DROP COLUMN IF EXISTS "editCount"`);
  }
}
