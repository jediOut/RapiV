import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRatings1778900000000 implements MigrationInterface {
  name = "AddRatings1778900000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ratings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderGroupId" uuid NOT NULL,
        "customerId" uuid NOT NULL,
        "targetType" varchar NOT NULL,
        "targetId" uuid NOT NULL,
        "score" integer NOT NULL,
        "comment" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ratings_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ratings_score" CHECK ("score" >= 1 AND "score" <= 5)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ratings_order_target" ON "ratings" ("orderGroupId", "targetType", "targetId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ratings_target" ON "ratings" ("targetType", "targetId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ratings_target"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ratings_order_target"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ratings"`);
  }
}
