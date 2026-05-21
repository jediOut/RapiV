import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentsArchitecture1778800000000 implements MigrationInterface {
  name = "AddPaymentsArchitecture1778800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "orderGroupId" uuid NOT NULL,
        "amountCents" integer NOT NULL,
        "currency" varchar NOT NULL DEFAULT 'MXN',
        "status" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "providerPaymentId" varchar NOT NULL,
        "idempotencyKey" varchar NOT NULL,
        "providerMetadata" jsonb,
        "paidAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payments_user_idempotency" ON "payments" ("userId", "idempotencyKey")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_order_group" ON "payments" ("orderGroupId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payments_provider_reference" ON "payments" ("provider", "providerPaymentId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "provider" varchar NOT NULL,
        "providerEventId" varchar NOT NULL,
        "type" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "payload" jsonb NOT NULL,
        "processedAt" timestamp,
        "errorMessage" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_events_provider_event" ON "payment_events" ("provider", "providerEventId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_events_status" ON "payment_events" ("status")`);

    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentStatus" varchar NOT NULL DEFAULT 'UNPAID'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paidAt" timestamp`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "paidAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "paymentStatus"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payment_events_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payment_events_provider_event"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_events"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_provider_reference"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_order_group"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_user_idempotency"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
  }
}
