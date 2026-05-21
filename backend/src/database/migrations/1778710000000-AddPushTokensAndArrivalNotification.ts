import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPushTokensAndArrivalNotification1778710000000 implements MigrationInterface {
  name = "AddPushTokensAndArrivalNotification1778710000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "token" varchar NOT NULL,
        "app" varchar NOT NULL,
        "deviceId" varchar,
        "lastUsedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_tokens_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_push_tokens_token" ON "push_tokens" ("token")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_push_tokens_user" ON "push_tokens" ("userId")`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "arrivalNotifiedAt" TIMESTAMP`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_push_tokens_userId_users_id') THEN
          ALTER TABLE "push_tokens" ADD CONSTRAINT "FK_push_tokens_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "push_tokens" DROP CONSTRAINT IF EXISTS "FK_push_tokens_userId_users_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_push_tokens_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_push_tokens_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "push_tokens"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "arrivalNotifiedAt"`);
  }
}
