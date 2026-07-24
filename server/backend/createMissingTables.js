require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS "super_admins" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "password_hash" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "plan_templates" (
        "id" TEXT NOT NULL,
        "plan_name" TEXT NOT NULL,
        "multi_store_enabled" BOOLEAN NOT NULL DEFAULT false,
        "membership_system_enabled" BOOLEAN NOT NULL DEFAULT true,
        "referral_system_enabled" BOOLEAN NOT NULL DEFAULT true,
        "whatsapp_auto_send_enabled" BOOLEAN NOT NULL DEFAULT true,
        "eye_test_module_enabled" BOOLEAN NOT NULL DEFAULT true,
        "repair_module_enabled" BOOLEAN NOT NULL DEFAULT true,
        "advanced_reports_enabled" BOOLEAN NOT NULL DEFAULT true,
        "max_staff_accounts" INTEGER,
        "max_stores" INTEGER,
        "max_products" INTEGER,
        "max_bills_per_month" INTEGER,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "plan_templates_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "tenant_counters" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "counter_type" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "month" INTEGER NOT NULL,
        "current_value" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tenant_counters_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "message_templates" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "trigger_event" TEXT NOT NULL,
        "message_body" TEXT NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
    );`
  ];

  for (let q of tables) {
    try {
      await client.query(q);
      console.log('Created table');
    } catch (e) {
      console.error(e.message);
    }
  }

  // Also add unique constraint for super_admins email if missing
  try {
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "super_admins_email_key" ON "super_admins"("email");`);
  } catch(e) {}

  await client.end();
}
main().catch(console.error);
