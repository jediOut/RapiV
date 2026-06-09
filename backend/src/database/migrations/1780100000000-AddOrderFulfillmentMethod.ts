import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderFulfillmentMethod1780100000000 implements MigrationInterface {
  name = "AddOrderFulfillmentMethod1780100000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillmentMethod" varchar NOT NULL DEFAULT 'DELIVERY'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "fulfillmentMethod"`);
  }
}
