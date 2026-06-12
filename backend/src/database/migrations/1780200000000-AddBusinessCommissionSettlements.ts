import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessCommissionSettlements1780200000000 implements MigrationInterface {
  name = "AddBusinessCommissionSettlements1780200000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_commission_settlements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "businessId" uuid NOT NULL,
        "ownerUserId" uuid NOT NULL,
        "settlementWeek" varchar NOT NULL,
        "periodStartAt" TIMESTAMP NOT NULL,
        "periodEndAt" TIMESTAMP NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "orderCount" integer NOT NULL DEFAULT 0,
        "orderIds" text,
        "grossSalesCents" integer NOT NULL DEFAULT 0,
        "businessPayoutCents" integer NOT NULL DEFAULT 0,
        "rapivCommissionCents" integer NOT NULL DEFAULT 0,
        "businessNotifiedAt" TIMESTAMP,
        "confirmedAt" TIMESTAMP,
        "confirmedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_business_commission_settlements_business_period"
      ON "business_commission_settlements" ("businessId", "periodStartAt", "periodEndAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_business_commission_settlements_business_period"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_commission_settlements"`);
  }
}
