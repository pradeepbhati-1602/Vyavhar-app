require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  console.log('Starting migration script...');

  try {
    await client.query('BEGIN');

    // 1. Create missing tables: tenants, plan_templates, tenant_counters, message_templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
          "tenant_id" TEXT NOT NULL,
          "business_name" TEXT NOT NULL,
          "owner_name" TEXT NOT NULL,
          "owner_email" TEXT NOT NULL,
          "owner_mobile" TEXT NOT NULL,
          "shop_logo_url" TEXT,
          "shop_address" TEXT,
          "gst_number" TEXT,
          "subscription_plan" TEXT NOT NULL DEFAULT 'MONTHLY',
          "subscription_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
          "subscription_status" TEXT NOT NULL DEFAULT 'TRIAL',
          "trial_ends_at" TIMESTAMP(3),
          "subscription_expiry_date" TIMESTAMP(3),
          "plan_template_id" TEXT,
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

          CONSTRAINT "tenants_pkey" PRIMARY KEY ("tenant_id")
      );
    `);

    // 2. Insert the default tenant
    const defaultTenantId = 'eyevengers-default-tenant';
    const res = await client.query(`SELECT tenant_id FROM tenants WHERE tenant_id = $1`, [defaultTenantId]);
    if (res.rows.length === 0) {
      await client.query(`
        INSERT INTO tenants (
          tenant_id, business_name, owner_name, owner_email, owner_mobile, subscription_status
        ) VALUES (
          $1, 'Eyevengers Optical', 'Admin', 'admin@eyevengers.com', '1234567890', 'ACTIVE'
        )
      `, [defaultTenantId]);
      console.log('Default tenant created.');
    }

    // 3. Add columns to existing tables if they don't exist, as NULLABLE initially
    const tablesToUpdate = [
      'users', 'customers', 'products', 'bills', 'eye_tests', 'repair_orders', 
      'inventory_history', 'referral_members', 'membership_plans', 'customer_memberships', 
      'settings', 'stores', 'audit_logs'
    ];

    for (const table of tablesToUpdate) {
      try {
        await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT`);
        // Backfill the tenant_id
        await client.query(`UPDATE "${table}" SET "tenant_id" = $1 WHERE "tenant_id" IS NULL`, [defaultTenantId]);
        // Set to NOT NULL
        await client.query(`ALTER TABLE "${table}" ALTER COLUMN "tenant_id" SET NOT NULL`);
      } catch (err) {
        if (!err.message.includes('does not exist')) {
          console.error(`Error on table ${table}:`, err.message);
        }
      }
    }

    // Fix specific tables (id, updated_at)
    const tablesWithUpdated = ['users', 'customers', 'products', 'referral_members', 'membership_plans', 'settings', 'stores'];
    for (const table of tablesWithUpdated) {
        try {
            await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3)`);
            await client.query(`UPDATE "${table}" SET "updated_at" = CURRENT_TIMESTAMP WHERE "updated_at" IS NULL`);
            await client.query(`ALTER TABLE "${table}" ALTER COLUMN "updated_at" SET NOT NULL`);
        } catch (e) {}
    }

    // users
    try {
        await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id" TEXT`);
        await client.query(`UPDATE "users" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
        await client.query(`ALTER TABLE "users" ALTER COLUMN "id" SET NOT NULL`);

        await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT`);
        await client.query(`UPDATE "users" SET "password_hash" = 'dummy' WHERE "password_hash" IS NULL`);
        await client.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
    } catch (e) {}

    // settings
    try {
        await client.query(`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "id" TEXT`);
        await client.query(`UPDATE "settings" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
        await client.query(`ALTER TABLE "settings" ALTER COLUMN "id" SET NOT NULL`);
    } catch(e) {}

    // customers
    try {
        await client.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "id" TEXT`);
        await client.query(`UPDATE "customers" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
        await client.query(`ALTER TABLE "customers" ALTER COLUMN "id" SET NOT NULL`);
    } catch (e) {}
    
    // products
    try {
        await client.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "id" TEXT`);
        await client.query(`UPDATE "products" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
        await client.query(`ALTER TABLE "products" ALTER COLUMN "id" SET NOT NULL`);
        
        await client.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_name" TEXT`);
        await client.query(`UPDATE "products" SET "product_name" = 'Unknown' WHERE "product_name" IS NULL`);
        await client.query(`ALTER TABLE "products" ALTER COLUMN "product_name" SET NOT NULL`);
    } catch(e) {}

    // membership_plans
    try {
        await client.query(`ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "id" TEXT`);
        await client.query(`UPDATE "membership_plans" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
        await client.query(`ALTER TABLE "membership_plans" ALTER COLUMN "id" SET NOT NULL`);

        await client.query(`ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "duration_days" INTEGER`);
        await client.query(`UPDATE "membership_plans" SET "duration_days" = 30 WHERE "duration_days" IS NULL`);
        await client.query(`ALTER TABLE "membership_plans" ALTER COLUMN "duration_days" SET NOT NULL`);
        
        await client.query(`ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "name" TEXT`);
        await client.query(`UPDATE "membership_plans" SET "name" = 'Default Plan' WHERE "name" IS NULL`);
        await client.query(`ALTER TABLE "membership_plans" ALTER COLUMN "name" SET NOT NULL`);
    } catch (e) {}

    // referral_members
    try {
        await client.query(`ALTER TABLE "referral_members" ADD COLUMN IF NOT EXISTS "id" TEXT`);
        await client.query(`UPDATE "referral_members" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
        await client.query(`ALTER TABLE "referral_members" ALTER COLUMN "id" SET NOT NULL`);
    } catch(e) {}

    await client.query('COMMIT');
    console.log('Migration completed successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}
main().catch(console.error);
