import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1778530000000 implements MigrationInterface {
  name = "InitialSchema1778530000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL,
        "username" varchar NOT NULL,
        "fullName" varchar NOT NULL,
        "phone" varchar,
        "address" varchar,
        "passwordHash" varchar NOT NULL,
        "roles" text NOT NULL DEFAULT '["CUSTOMER"]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "businesses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerUserId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "logo" varchar,
        "address" varchar,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "rating" numeric(3,2),
        "deliveryTime" integer,
        "minimumOrder" numeric(10,2),
        "isOpen" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_businesses_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "image" varchar,
        "category" varchar,
        "priceCents" numeric(10,2) NOT NULL,
        "available" boolean NOT NULL DEFAULT true,
        "stock" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "businessId" uuid NOT NULL,
        "orderGroupId" uuid,
        "courierId" uuid,
        "customerLatitude" numeric(10,7),
        "customerLongitude" numeric(10,7),
        "courierLatitude" numeric(10,7),
        "courierLongitude" numeric(10,7),
        "idempotencyKey" varchar,
        "status" varchar NOT NULL DEFAULT 'pending',
        "subtotalCents" integer NOT NULL DEFAULT 0,
        "totalPrice" numeric(10,2) NOT NULL,
        "deliveryAddress" text NOT NULL,
        "notes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "productName" varchar NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_user_idempotency" ON "orders" ("userId", "idempotencyKey")`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_businesses_ownerUserId_users_id') THEN
          ALTER TABLE "businesses" ADD CONSTRAINT "FK_businesses_ownerUserId_users_id" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_products_businessId_businesses_id') THEN
          ALTER TABLE "products" ADD CONSTRAINT "FK_products_businessId_businesses_id" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_userId_users_id') THEN
          ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_businessId_businesses_id') THEN
          ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_businessId_businesses_id" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_order_items_orderId_orders_id') THEN
          ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_orderId_orders_id" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_order_items_productId_products_id') THEN
          ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_productId_products_id" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_order_items_productId_products_id"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_order_items_orderId_orders_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_businessId_businesses_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_userId_users_id"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_businessId_businesses_id"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP CONSTRAINT IF EXISTS "FK_businesses_ownerUserId_users_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_user_idempotency"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "businesses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
