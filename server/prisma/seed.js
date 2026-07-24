// ─────────────────────────────────────────────────────────────────
// Database Seed Script — run with: npm run db:seed
// Creates SuperAdmin, default Tenant, Store, Owner/Employee, settings, 
// sample products, and a demo referral member (Tony Stark / EYE1001).
// ─────────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── 0. SUPER ADMIN ────────────────────────────────────────────────
  const superAdminExists = await prisma.superAdmin.findFirst({ where: { email: 'bhatipradeep420@gmail.com' } });
  if (!superAdminExists) {
    const adminHash = await bcrypt.hash('heygoogle420@123', 10);
    await prisma.superAdmin.create({
      data: {
        email: 'bhatipradeep420@gmail.com',
        password_hash: adminHash
      }
    });
    console.log('  ✅ SuperAdmin seeded (bhatipradeep420@gmail.com)');
  } else {
    console.log('  ⏭️  SuperAdmin already exists, skipping.');
  }

  // ── 1. TENANT & STORE ─────────────────────────────────────────────
  let demoTenant = await prisma.tenant.findFirst({ where: { owner_email: 'owner@demo.com' } });
  let demoStore;
  if (!demoTenant) {
    demoTenant = await prisma.tenant.create({
      data: {
        business_name: 'Eyevengers Optical',
        owner_name: 'Dr. Stark',
        owner_email: 'owner@demo.com',
        owner_mobile: '9876543210',
        subscription_status: 'ACTIVE',
        subscription_plan: 'YEARLY'
      }
    });
    
    demoStore = await prisma.store.create({
      data: {
        tenant_id: demoTenant.tenant_id,
        store_name: 'Main Branch',
        phone: '9876543210'
      }
    });
    console.log('  ✅ Demo Tenant and Store seeded');
  } else {
    demoStore = await prisma.store.findFirst({ where: { tenant_id: demoTenant.tenant_id } });
    console.log('  ⏭️  Demo Tenant already exists, skipping.');
  }

  const tenantId = demoTenant.tenant_id;
  const storeId = demoStore.store_id;

  // ── 2. USERS ────────────────────────────────────────────────────
  const ownerExists = await prisma.user.findFirst({ where: { tenant_id: tenantId, role: 'OWNER' } });
  if (!ownerExists) {
    const ownerHash = await bcrypt.hash('owner123', 10);
    const empHash   = await bcrypt.hash('emp123', 10);

    await prisma.user.createMany({
      data: [
        { tenant_id: tenantId, name: 'Dr. Stark (Owner)',    email: 'owner@demo.com', mobile: '9876543210', password_hash: ownerHash, role: 'OWNER' },
        { tenant_id: tenantId, store_id: storeId, name: 'Peter Parker (Staff)', email: 'staff@demo.com', mobile: '9876543211', password_hash: empHash, role: 'EMPLOYEE' }
      ]
    });
    console.log('  ✅ Users seeded (owner@demo.com / owner123, staff@demo.com / emp123)');
  }

  // ── 3. SETTINGS ─────────────────────────────────────────────────
  const defaultSettings = {
    store_name:                'Eyevengers Optical',
    gst_number:                '27EYEVEN1001A1Z0',
    store_address:             '101 Golden Frame Blvd, Sector 7, New Delhi',
    store_mobile:              '9876543210',
    store_logo_url:            '',
    store_qr_url:              '',
    upi_id:                    'eyevengers@upi',
    referral_cashback_percent: '5',
    inactive_days_threshold:   '45',
    low_stock_alert_default:   '5',
    whatsapp_auto_send:        'false',
    invoice_number_format:     'INV-',
    default_language:          'ENGLISH'
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const exists = await prisma.setting.findFirst({ where: { tenant_id: tenantId, key } });
    if (!exists) {
      await prisma.setting.create({
        data: { tenant_id: tenantId, key, value }
      });
    }
  }
  console.log('  ✅ Settings seeded (13 configuration keys)');

  // ── 4. SAMPLE PRODUCTS ──────────────────────────────────────────
  const productCount = await prisma.product.count({ where: { tenant_id: tenantId } });
  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        {
          tenant_id: tenantId, store_id: storeId,
          barcode: '8053672000123', category: 'FRAMES', brand: 'Ray-Ban',
          product_name: 'Aviator Classic', color: 'Gold/Green', size: 'Medium',
          purchase_price: 4000, selling_price: 6500,
          opening_stock: 10, current_stock: 10, low_stock_alert: 3,
          supplier_name: 'Rayban Distributors'
        },
        {
          tenant_id: tenantId, store_id: storeId,
          barcode: 'ESL-CRIZ-01', category: 'LENS', brand: 'Essilor',
          product_name: 'Crizal Prevencia', color: 'Clear Blue-Cut', size: 'Standard',
          purchase_price: 1500, selling_price: 2500,
          opening_stock: 30, current_stock: 30, low_stock_alert: 5,
          supplier_name: 'Essilor Lab'
        }
      ]
    });
    console.log('  ✅ Products seeded');
  }

  // ── 5. DEMO REFERRAL MEMBER + CUSTOMER ──────────────────────────
  const refExists = await prisma.referralMember.findFirst({ where: { tenant_id: tenantId, referral_code: 'EYE1001' } });
  if (!refExists) {
    await prisma.referralMember.create({
      data: {
        tenant_id: tenantId, customer_name: 'Tony Stark', mobile: '9999999999',
        referral_code: 'EYE1001', referral_count: 3,
        cashback_earned: 450, cashback_used: 100, status: 'ACTIVE'
      }
    });

    await prisma.customer.create({
      data: {
        tenant_id: tenantId, name: 'Tony Stark', mobile: '9999999999',
        current_cashback: 350, pending_due: 0,
        total_bills: 3, total_purchase: 9000,
        last_visit: new Date(), language: 'ENGLISH'
      }
    });
    console.log('  ✅ Demo referral member seeded');
  }

  console.log('\n🎉 Seed complete!');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
