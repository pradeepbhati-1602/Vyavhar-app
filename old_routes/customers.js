const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db');
const { authenticateToken } = require('./auth');

// GET all customers with search and sorting
router.get('/', authenticateToken, async (req, res) => {
  const { search, sortBy = 'created_at', order = 'DESC', is_paginated, page = 1, limit = 50 } = req.query;
  
  let sql = `
    SELECT c.*, 
    EXISTS(
      SELECT 1 FROM customer_memberships m 
      WHERE m.customer_id = c.customer_id 
      AND m.expiry_date >= date('now', 'localtime')
    ) as has_active_membership
    FROM customers c
  `;
  let countSql = 'SELECT COUNT(*) as total FROM customers';
  const params = [];

  if (search) {
    const whereClause = ' WHERE name LIKE ? OR mobile LIKE ?';
    sql += whereClause;
    countSql += whereClause;
    params.push(`%${search}%`, `%${search}%`);
  }

  // Sanitize sortBy columns
  const allowedSortFields = ['name', 'last_visit', 'total_bills', 'total_purchase', 'current_cashback', 'created_at'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  sql += ` ORDER BY ${sortField} ${sortOrder}`;

  try {
    if (is_paginated === 'true') {
      const parsedPage = parseInt(page) || 1;
      const parsedLimit = parseInt(limit) || 50;
      const offset = (parsedPage - 1) * parsedLimit;
      
      const totalRes = await dbGet(countSql, params);
      const total = totalRes ? totalRes.total : 0;
      
      sql += ` LIMIT ? OFFSET ?`;
      params.push(parsedLimit, offset);
      
      const customers = await dbAll(sql, params);
      return res.json({ data: customers, total, page: parsedPage, limit: parsedLimit });
    } else {
      const customers = await dbAll(sql, params);
      res.json(customers);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET today's birthdays
router.get('/birthdays', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM customers 
      WHERE strftime('%m-%d', birthday) = strftime('%m-%d', 'now', 'localtime')
    `;
    const list = await dbAll(query);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch birthdays' });
  }
});

// GET inactive customers (configurable threshold)
router.get('/inactive', authenticateToken, async (req, res) => {
  try {
    const setting = await dbGet("SELECT value FROM settings WHERE key = 'inactive_customer_days'");
    const thresholdDays = setting ? parseInt(setting.value) : 45;

    const query = `
      SELECT * FROM customers 
      WHERE last_visit <= datetime('now', '-' || ? || ' days')
      OR (last_visit IS NULL AND created_at <= datetime('now', '-' || ? || ' days'))
      ORDER BY last_visit ASC
    `;
    const list = await dbAll(query, [thresholdDays, thresholdDays]);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch inactive customers' });
  }
});

// GET referral code details
router.get('/referral/:code', authenticateToken, async (req, res) => {
  const { code } = req.params;
  try {
    const member = await dbGet("SELECT * FROM referral_members WHERE referral_code = ? AND status = 'Active'", [code]);
    if (!member) {
      return res.status(404).json({ error: 'Referral code not found or inactive' });
    }
    res.json(member);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to lookup referral code' });
  }
});

// GET customer by mobile (used for real-time POS check)
router.get('/lookup/:mobile', authenticateToken, async (req, res) => {
  const { mobile } = req.params;
  try {
    const customer = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Fetch customer's billing history
    const bills = await dbAll(`
      SELECT b.*, p.brand, p.frame_name 
      FROM bills b
      LEFT JOIN products p ON b.frame_product_id = p.product_id
      WHERE b.customer_id = ? 
      ORDER BY b.created_at DESC
    `, [customer.customer_id]);

    res.json({ customer, bills });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to lookup customer' });
  }
});

// GET customer profile by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await dbGet('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const bills = await dbAll(`
      SELECT b.*, p.brand, p.frame_name, s.store_name
      FROM bills b
      LEFT JOIN products p ON b.frame_product_id = p.product_id
      LEFT JOIN stores s ON b.store_id = s.store_id
      WHERE b.customer_id = ? 
      ORDER BY b.created_at DESC
    `, [customer.customer_id]);

    const eyeTests = await dbAll(`
      SELECT e.*, s.store_name
      FROM eye_tests e
      LEFT JOIN stores s ON e.store_id = s.store_id
      WHERE e.customer_id = ? 
      ORDER BY e.created_at DESC
    `, [customer.customer_id]);

    const repairs = await dbAll(`
      SELECT r.*, s.store_name
      FROM repair_orders r
      LEFT JOIN stores s ON r.store_id = s.store_id
      WHERE r.customer_id = ? 
      ORDER BY r.created_at DESC
    `, [customer.customer_id]);

    const referral = await dbGet('SELECT * FROM referral_members WHERE mobile = ?', [customer.mobile]);

    res.json({
      customer,
      bills,
      eyeTests,
      repairs,
      referral
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch customer profile' });
  }
});

// POST create manual customer
router.post('/', authenticateToken, async (req, res) => {
  const { name, mobile, birthday, gender, address, language = 'English' } = req.body;
  if (!name || !mobile) {
    return res.status(400).json({ error: 'Name and mobile number are required' });
  }

  try {
    const existing = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
    if (existing) {
      return res.status(400).json({ error: 'Customer with this mobile number already exists' });
    }

    const customer_id = 'cust-' + Date.now();
    await dbRun(`
      INSERT INTO customers (customer_id, name, mobile, birthday, gender, address, language)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [customer_id, name, mobile, birthday || null, gender || null, address || null, language]);

    const created = await dbGet('SELECT * FROM customers WHERE customer_id = ?', [customer_id]);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT update customer
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, mobile, birthday, gender, address, language } = req.body;
  if (!name || !mobile) {
    return res.status(400).json({ error: 'Name and mobile number are required' });
  }

  try {
    const existing = await dbGet('SELECT * FROM customers WHERE mobile = ? AND customer_id != ?', [mobile, req.params.id]);
    if (existing) {
      return res.status(400).json({ error: 'Another customer is already using this mobile number' });
    }

    await dbRun(`
      UPDATE customers 
      SET name = ?, mobile = ?, birthday = ?, gender = ?, address = ?, language = ? 
      WHERE customer_id = ?
    `, [name, mobile, birthday || null, gender || null, address || null, language, req.params.id]);

    const updated = await dbGet('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// GET all referral members
router.get('/referrals/all', authenticateToken, async (req, res) => {
  try {
    const list = await dbAll('SELECT * FROM referral_members ORDER BY created_at DESC');
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch referral members' });
  }
});

// POST register referral member (auto generates EYE100x code)
router.post('/referrals', authenticateToken, async (req, res) => {
  const { customer_name, mobile } = req.body;
  if (!customer_name || !mobile) {
    return res.status(400).json({ error: 'Name and mobile number are required' });
  }

  try {
    const existing = await dbGet('SELECT * FROM referral_members WHERE mobile = ?', [mobile]);
    if (existing) {
      return res.status(400).json({ error: 'This member is already registered in the referral system' });
    }

    const countResult = await dbGet('SELECT COUNT(*) as count FROM referral_members');
    const referral_code = `EYE${1001 + countResult.count}`;
    const referral_id = 'ref-' + Date.now();

    await dbRun(`
      INSERT INTO referral_members (referral_id, customer_name, mobile, referral_code, referral_count, cashback_earned, cashback_used, status)
      VALUES (?, ?, ?, ?, 0, 0.00, 0.00, 'Active')
    `, [referral_id, customer_name, mobile, referral_code]);

    const created = await dbGet('SELECT * FROM referral_members WHERE referral_id = ?', [referral_id]);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to register referral member' });
  }
});

// PUT update referral status
router.put('/referrals/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  if (!status || !['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: 'Status must be Active or Inactive' });
  }

  try {
    await dbRun('UPDATE referral_members SET status = ? WHERE referral_id = ?', [status, req.params.id]);
    const updated = await dbGet('SELECT * FROM referral_members WHERE referral_id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update referral member status' });
  }
});

// POST bulk import customers
router.post('/bulk-import', authenticateToken, async (req, res) => {
  const { customers } = req.body;
  if (!Array.isArray(customers)) {
    return res.status(400).json({ error: 'Expected an array of customers' });
  }

  try {
    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const c of customers) {
      if (!c.name || !c.mobile) {
        skipped++;
        errors.push(`Row missing name or mobile (Mobile: ${c.mobile || 'N/A'})`);
        continue;
      }
      
      const existing = await dbGet('SELECT * FROM customers WHERE mobile = ?', [c.mobile]);
      if (existing) {
        // Skip duplicates or update them. For now, we skip as instructed or update.
        // Prompt says: "skip or update" - skipping is safer for bulk import
        skipped++;
        continue;
      }

      const customer_id = 'cust-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      await dbRun(`
        INSERT INTO customers (customer_id, name, mobile, birthday, gender, address, language, total_purchase, current_cashback, total_bills)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, 0)
      `, [customer_id, c.name, c.mobile, c.birthday || null, c.gender || null, c.address || null, c.language || 'English']);
      
      imported++;
    }

    res.status(201).json({ imported, skipped, errors });
  } catch (error) {
    console.error('Bulk Import Error:', error);
    res.status(500).json({ error: error.message || 'Failed to import customers', stack: error.stack });
  }
});

module.exports = router;
