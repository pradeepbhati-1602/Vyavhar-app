const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

// Login endpoint for Tenant Owners and Employees
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    // Allow login via email, mobile, or demo shortcuts ("owner" / "employee")
    const identifier = String(email).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { mobile: identifier },
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

    // Check if the tenant subscription is active
    if (user.tenant.subscription_status === 'EXPIRED' || user.tenant.subscription_status === 'SUSPENDED') {
      return res.status(403).json({ error: `Account ${user.tenant.subscription_status.toLowerCase()}. Please contact support.` });
    }

    const token = jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        store_id: user.store_id,
        cross_store_read: user.cross_store_read
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_id: user.store_id,
        cross_store_read: user.cross_store_read
      },
      tenant: {
        business_name: user.tenant.business_name,
        status: user.tenant.subscription_status,
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

router.get('/verify', requireTenantAuth, (req, res) => {
  // If the middleware succeeds, req.user contains the decoded token
  res.json({ user: req.user });
});

module.exports = router;
