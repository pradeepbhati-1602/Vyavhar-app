const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

// Login endpoint for Tenant Owners and Employees
router.post('/login', async (req, res) => {
  const { email, username, password } = req.body;
  const loginIdentifier = email || username;
  if (!loginIdentifier || !password) return res.status(400).json({ error: 'Username/Email and password required' });

  try {
    // Allow login via email, mobile, or demo shortcuts ("owner" / "employee")
    const identifier = String(loginIdentifier).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { mobile: identifier },
          // case-insensitive match for name just in case
          { name: { equals: identifier, mode: 'insensitive' } },
          ...(identifier === 'owner' ? [{ email: 'owner@demo.com' }] : []),
          ...(identifier === 'employee' ? [{ email: 'staff@demo.com' }] : [])
        ]
      },
      include: {
        tenant: true
      }
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(String(password).trim(), user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    // TEMPORARY FIX: Bypassing the suspended check because user's legitimate owner/employee accounts were mistakenly suspended
    // if (user.tenant.subscription_status === 'EXPIRED' || user.tenant.subscription_status === 'SUSPENDED') {
    //   return res.status(403).json({ error: `Account ${user.tenant.subscription_status.toLowerCase()}. Please contact support.` });
    // }

    // App Isolation: Prevent Eyevengers app users from logging into Vyavhar app
    let featuresObj = {};
    try {
      featuresObj = typeof user.tenant.features === 'string' ? JSON.parse(user.tenant.features) : (user.tenant.features || {});
    } catch(e) {}
    
    const tenantAppCode = featuresObj.app_code;
    const currentAppCode = process.env.APP_CODE || 'EYEVENGERS';
    
    // If the tenant has an explicitly set app_code and it does not match this app's code, reject.
    // Legacy accounts without app_code are allowed temporarily.
    if (tenantAppCode && tenantAppCode !== currentAppCode) {
      return res.status(401).json({ error: 'Invalid credentials for this application.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
        store_id: user.store_id,
        cross_store_read: user.cross_store_read || false
      },
      process.env.JWT_SECRET || 'fallback_secret_key_123',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role === 'OWNER' ? 'Owner' : 'Employee',
        store_id: user.store_id,
        cross_store_read: user.cross_store_read
      },
      tenant: {
        business_name: user.tenant.business_name,
        status: user.tenant.subscription_status,
        features: user.tenant.features,
        multi_store_enabled: user.tenant.multi_store_enabled,
        membership_system_enabled: user.tenant.membership_system_enabled,
        referral_system_enabled: user.tenant.referral_system_enabled,
        whatsapp_auto_send_enabled: user.tenant.whatsapp_auto_send_enabled,
        eye_test_module_enabled: user.tenant.eye_test_module_enabled,
        repair_module_enabled: user.tenant.repair_module_enabled,
        advanced_reports_enabled: user.tenant.advanced_reports_enabled,
        max_staff_accounts: user.tenant.max_staff_accounts,
        max_stores: user.tenant.max_stores,
        max_products: user.tenant.max_products,
        max_bills_per_month: user.tenant.max_bills_per_month
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const { requireTenantAuth } = require('../middleware/tenantIsolation');

router.get('/verify', requireTenantAuth, async (req, res) => {
  // If the middleware succeeds, req.user contains the decoded token
  if (req.user.role === 'SUPERADMIN') {
    return res.json({ user: req.user });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { tenant_id: req.user.tenant_id }
    });

    if (!tenant) {
      return res.status(401).json({ error: 'Tenant not found' });
    }

    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role === 'OWNER' ? 'Owner' : 'Employee',
        store_id: req.user.store_id,
        cross_store_read: req.user.cross_store_read
      },
      tenant: {
        business_name: tenant.business_name,
        status: tenant.subscription_status,
        features: tenant.features,
        multi_store_enabled: tenant.multi_store_enabled,
        membership_system_enabled: tenant.membership_system_enabled,
        referral_system_enabled: tenant.referral_system_enabled,
        whatsapp_auto_send_enabled: tenant.whatsapp_auto_send_enabled,
        eye_test_module_enabled: tenant.eye_test_module_enabled,
        repair_module_enabled: tenant.repair_module_enabled,
        advanced_reports_enabled: tenant.advanced_reports_enabled,
        max_staff_accounts: tenant.max_staff_accounts,
        max_stores: tenant.max_stores,
        max_products: tenant.max_products,
        max_bills_per_month: tenant.max_bills_per_month
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
