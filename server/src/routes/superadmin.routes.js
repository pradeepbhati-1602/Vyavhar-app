const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');
const { requireSuperAdmin } = require('../middleware/tenantIsolation');
const crypto = require('crypto');

// 1. Super Admin Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'SUPERADMIN' },
      process.env.JWT_SECRET || 'fallback_secret_key_123',
      { expiresIn: '7d' }
    );

    res.json({ token, user: { email: admin.email, role: 'SUPERADMIN' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Use middleware for all routes below
router.use(requireSuperAdmin);

// 2. Get All Tenants
router.get('/tenants', async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        stores: true
      }
    });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Create New Client
router.post('/tenants', async (req, res) => {
  const { 
    owner_name, owner_email, owner_mobile, 
    business_name, shop_logo_url, shop_address, gst_number,
    store_name, store_phone,
    subscription_plan, subscription_price, trial_days,
    password,
    plan_template_id,
    multi_store_enabled,
    membership_system_enabled,
    referral_system_enabled,
    whatsapp_auto_send_enabled,
    eye_test_module_enabled,
    repair_module_enabled,
    advanced_reports_enabled,
    max_staff_accounts,
    max_stores,
    max_products,
    max_bills_per_month
  } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    const passwordHash = await bcrypt.hash(password, 10);

    const daysToAdd = trial_days ? parseInt(trial_days) : (subscription_plan === 'YEARLY' ? 365 : 30);
    const subscription_expiry_date = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
        
    const trial_ends_at = trial_days 
        ? new Date(Date.now() + parseInt(trial_days) * 24 * 60 * 60 * 1000)
        : null;

    // Use interactive transaction
    const newTenant = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          business_name,
          owner_name,
          owner_email,
          owner_mobile,
          shop_logo_url: shop_logo_url || null,
          shop_address: shop_address || null,
          gst_number: gst_number || null,
          subscription_plan: subscription_plan || 'MONTHLY',
          subscription_price: subscription_price ? parseFloat(subscription_price) : 0,
          subscription_status: trial_days ? 'TRIAL' : 'ACTIVE',
          trial_ends_at,
          subscription_expiry_date,
          plan_template_id: plan_template_id || null,
          multi_store_enabled: multi_store_enabled ?? false,
          membership_system_enabled: membership_system_enabled ?? true,
          referral_system_enabled: referral_system_enabled ?? true,
          whatsapp_auto_send_enabled: whatsapp_auto_send_enabled ?? true,
          eye_test_module_enabled: eye_test_module_enabled ?? true,
          repair_module_enabled: repair_module_enabled ?? true,
          advanced_reports_enabled: advanced_reports_enabled ?? true,
          max_staff_accounts: max_staff_accounts || null,
          max_stores: max_stores || null,
          max_products: max_products || null,
          max_bills_per_month: max_bills_per_month || null
        }
      });

      // 2. Create first Store
      const store = await tx.store.create({
        data: {
          tenant_id: tenant.tenant_id,
          store_name: store_name || `${business_name} - Main`,
          address: shop_address || null,
          gst_number: gst_number || null,
          phone: store_phone || owner_mobile,
        }
      });

      // 3. Create Owner User
      const user = await tx.user.create({
        data: {
          tenant_id: tenant.tenant_id,
          store_id: store.store_id, // Since it's owner, they can have null, but let's assign them the primary store
          name: owner_name,
          email: owner_email,
          mobile: owner_mobile,
          password_hash: passwordHash,
          role: 'OWNER'
        }
      });

      return { tenant, store, user, rawPassword: password };
    });

    res.status(201).json({
      message: 'Client created successfully',
      tenant: newTenant.tenant,
      store: newTenant.store,
      credentials: {
        email: newTenant.user.email,
        password: newTenant.rawPassword
      }
    });

  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'Email or Mobile';
      return res.status(400).json({ error: `A client with this ${field} already exists. Please use a unique value.` });
    }
    res.status(400).json({ error: error.message });
  }
});

// 4. Update Client (Edit)
router.put('/tenants/:id', async (req, res) => {
  const { id } = req.params;
  
  // Extract only allowed fields
  const {
    business_name, owner_name, owner_email, owner_mobile,
    shop_logo_url, shop_address, gst_number,
    subscription_plan, subscription_price,
    plan_template_id,
    multi_store_enabled,
    membership_system_enabled,
    referral_system_enabled,
    whatsapp_auto_send_enabled,
    eye_test_module_enabled,
    repair_module_enabled,
    advanced_reports_enabled,
    max_staff_accounts,
    max_stores,
    max_products,
    max_bills_per_month
  } = req.body;
  
  const data = {
    ...(business_name && { business_name }),
    ...(owner_name && { owner_name }),
    ...(owner_email && { owner_email }),
    ...(owner_mobile && { owner_mobile }),
    ...(shop_logo_url !== undefined && { shop_logo_url }),
    ...(shop_address !== undefined && { shop_address }),
    ...(gst_number !== undefined && { gst_number }),
    ...(subscription_plan && { subscription_plan }),
    ...(subscription_price !== undefined && { subscription_price: parseFloat(subscription_price) }),
    ...(plan_template_id !== undefined && { plan_template_id }),
    ...(multi_store_enabled !== undefined && { multi_store_enabled }),
    ...(membership_system_enabled !== undefined && { membership_system_enabled }),
    ...(referral_system_enabled !== undefined && { referral_system_enabled }),
    ...(whatsapp_auto_send_enabled !== undefined && { whatsapp_auto_send_enabled }),
    ...(eye_test_module_enabled !== undefined && { eye_test_module_enabled }),
    ...(repair_module_enabled !== undefined && { repair_module_enabled }),
    ...(advanced_reports_enabled !== undefined && { advanced_reports_enabled }),
    ...(max_staff_accounts !== undefined && { max_staff_accounts }),
    ...(max_stores !== undefined && { max_stores }),
    ...(max_products !== undefined && { max_products }),
    ...(max_bills_per_month !== undefined && { max_bills_per_month })
  };

  try {
    const updated = await prisma.tenant.update({
      where: { tenant_id: id },
      data
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5. Mark Paid
router.post('/tenants/:id/mark-paid', async (req, res) => {
  const { id } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { tenant_id: id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Extend expiry by plan duration
    const daysToAdd = tenant.subscription_plan === 'YEARLY' ? 365 : 30;
    const baseDate = tenant.subscription_expiry_date && tenant.subscription_expiry_date > new Date()
      ? tenant.subscription_expiry_date
      : new Date();
    
    const newExpiryDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    const updated = await prisma.tenant.update({
      where: { tenant_id: id },
      data: {
        subscription_status: 'ACTIVE',
        subscription_expiry_date: newExpiryDate
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 6. Suspend / Reactivate
router.post('/tenants/:id/toggle-status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'ACTIVE', 'SUSPENDED', etc.
  try {
    const updated = await prisma.tenant.update({
      where: { tenant_id: id },
      data: { subscription_status: status }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// 7. Export Tenant Data
router.get('/tenants/:id/export', async (req, res) => {
  const { id } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { tenant_id: id },
      include: { stores: true, users: true }
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const customers = await prisma.customer.findMany({ where: { tenant_id: id } });
    const products = await prisma.product.findMany({ where: { tenant_id: id } });
    const bills = await prisma.bill.findMany({ where: { tenant_id: id } });
    
    // We can also fetch memberships, referrals, etc. if needed
    const memberships = await prisma.customerMembership.findMany({ where: { tenant_id: id } });

    res.json({
      tenant,
      customers,
      products,
      bills,
      memberships,
      exported_at: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
