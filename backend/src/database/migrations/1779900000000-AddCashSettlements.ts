import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCashSettlements1779900000000 implements MigrationInterface {
  name = "AddCashSettlements1779900000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_settlements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "courierId" uuid NOT NULL,
        "settlementDate" varchar NOT NULL,
        "periodStartAt" TIMESTAMP NOT NULL,
        "periodEndAt" TIMESTAMP NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "orderGroupCount" integer NOT NULL DEFAULT 0,
        "orderGroupIds" text,
        "cashCollectedCents" integer NOT NULL DEFAULT 0,
        "cashChangeCents" integer NOT NULL DEFAULT 0,
        "businessPayoutCents" integer NOT NULL DEFAULT 0,
        "rapivCommissionCents" integer NOT NULL DEFAULT 0,
        "courierPayoutCents" integer NOT NULL DEFAULT 0,
        "platformDeliveryMarginCents" integer NOT NULL DEFAULT 0,
        "netDueToRapivCents" integer NOT NULL DEFAULT 0,
        "courierNotifiedAt" TIMESTAMP,
        "courierOverdueNotifiedAt" TIMESTAMP,
        "confirmedAt" TIMESTAMP,
        "confirmedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cash_settlements_courier_date"
      ON "cash_settlements" ("courierId", "settlementDate")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_settlements_courier_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_settlements"`);
  }
}
