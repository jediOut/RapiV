import { MigrationInterface, QueryRunner } from "typeorm";

export class ProductMinimumQuantity1779500000000 implements MigrationInterface {
  name = "ProductMinimumQuantity1779500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "minimumQuantityPerOrder" integer NOT NULL DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "minimumOrderItems"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "minimumOrderItems" integer NOT NULL DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "minimumQuantityPerOrder"`);
  }
}
