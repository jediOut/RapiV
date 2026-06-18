import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourierWallet1780400000000 implements MigrationInterface {
  name = "AddCourierWallet1780400000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courier_profiles" ADD COLUMN IF NOT EXISTS "walletBalanceCents" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courier_wallet_top_ups" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "courierId" uuid NOT NULL,
        "amountCents" integer NOT NULL,
        "currency" varchar NOT NULL DEFAULT 'MXN',
        "status" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "providerPaymentId" varchar NOT NULL,
        "idempotencyKey" varchar NOT NULL,
        "providerMetadata" jsonb,
        "paidAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_courier_wallet_topups_courier_idempotency"
      ON "courier_wallet_top_ups" ("courierId", "idempotencyKey")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_courier_wallet_topups_provider_reference"
      ON "courier_wallet_top_ups" ("provider", "providerPaymentId")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courier_wallet_transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "courierId" uuid NOT NULL,
        "type" varchar NOT NULL,
        "amountCents" integer NOT NULL,
        "balanceAfterCents" integer NOT NULL,
        "orderGroupId" uuid,
        "referenceId" varchar,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_courier_wallet_transactions_courier_created"
      ON "courier_wallet_transactions" ("courierId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_courier_wallet_transactions_reference"
      ON "courier_wallet_transactions" ("type", "referenceId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_courier_wallet_transactions_reference"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_courier_wallet_transactions_courier_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courier_wallet_transactions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_courier_wallet_topups_provider_reference"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_courier_wallet_topups_courier_idempotency"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courier_wallet_top_ups"`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" DROP COLUMN IF EXISTS "walletBalanceCents"`);
  }
}
