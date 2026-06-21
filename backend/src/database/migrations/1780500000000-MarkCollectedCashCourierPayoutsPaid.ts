import { MigrationInterface, QueryRunner } from "typeorm";

export class MarkCollectedCashCourierPayoutsPaid1780500000000 implements MigrationInterface {
  name = "MarkCollectedCashCourierPayoutsPaid1780500000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "orders"
      SET
        "courierPayoutStatus" = 'PAID',
        "courierPayoutPaidAt" = COALESCE("courierPayoutPaidAt", "cashCollectedAt", "paidAt", "updatedAt"),
        "courierPayoutFailedAt" = NULL,
        "courierPayoutError" = NULL
      WHERE
        "fulfillmentMethod" = 'DELIVERY'
        AND "paymentMethod" = 'CASH'
        AND "paymentStatus" = 'PAID'
        AND "cashCollectedAt" IS NOT NULL
        AND "courierPayoutStatus" = 'PENDING'
        AND "courierPayoutCents" > 0
    `);
  }

  async down(): Promise<void> {
    // Data backfill only. Do not re-mark already collected cash payouts as pending.
  }
}
