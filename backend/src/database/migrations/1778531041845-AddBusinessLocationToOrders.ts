import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessLocationToOrders1778531041845 implements MigrationInterface {
    name = 'AddBusinessLocationToOrders1778531041845'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessLatitude" numeric(10,7)`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessLongitude" numeric(10,7)`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessAddress" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessAddress"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessLongitude"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessLatitude"`);
    }

}
