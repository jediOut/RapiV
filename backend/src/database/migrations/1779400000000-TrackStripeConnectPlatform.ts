import { MigrationInterface, QueryRunner } from "typeorm";

export class TrackStripeConnectPlatform1779400000000 implements MigrationInterface {
  name = "TrackStripeConnectPlatform1779400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripePlatformAccountId" varchar`);
    await queryRunner.query(`
      UPDATE "businesses"
      SET
        "stripeConnectedAccountId" = NULL,
        "stripePlatformAccountId" = NULL,
        "stripeChargesEnabled" = false,
        "stripePayoutsEnabled" = false,
        "stripeDetailsSubmitted" = false,
        "stripeRequirementsCurrentlyDue" = NULL,
        "acceptsCard" = false
      WHERE "stripeConnectedAccountId" IS NOT NULL
        AND "stripePlatformAccountId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "stripePlatformAccountId"`);
  }
}
