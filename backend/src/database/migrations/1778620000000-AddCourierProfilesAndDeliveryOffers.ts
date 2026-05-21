import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourierProfilesAndDeliveryOffers1778620000000 implements MigrationInterface {
  name = "AddCourierProfilesAndDeliveryOffers1778620000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courier_profiles" (
        "userId" uuid NOT NULL,
        "availabilityStatus" varchar NOT NULL DEFAULT 'OFFLINE',
        "preferredLatitude" numeric(10,7),
        "preferredLongitude" numeric(10,7),
        "preferredRadiusKm" integer,
        "maxDeliveryDistanceKm" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courier_profiles_userId" PRIMARY KEY ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "delivery_offers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderGroupId" uuid NOT NULL,
        "courierId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "score" integer NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP NOT NULL,
        "acceptedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_delivery_offers_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_delivery_offers_order_courier" ON "delivery_offers" ("orderGroupId", "courierId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_delivery_offers_courier_status" ON "delivery_offers" ("courierId", "status")`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_courier_profiles_userId_users_id') THEN
          ALTER TABLE "courier_profiles" ADD CONSTRAINT "FK_courier_profiles_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_delivery_offers_courierId_users_id') THEN
          ALTER TABLE "delivery_offers" ADD CONSTRAINT "FK_delivery_offers_courierId_users_id" FOREIGN KEY ("courierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "delivery_offers" DROP CONSTRAINT IF EXISTS "FK_delivery_offers_courierId_users_id"`);
    await queryRunner.query(`ALTER TABLE "courier_profiles" DROP CONSTRAINT IF EXISTS "FK_courier_profiles_userId_users_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_delivery_offers_courier_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_delivery_offers_order_courier"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_offers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courier_profiles"`);
  }
}
