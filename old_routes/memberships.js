const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun, runTransaction } = require('../db');
const { authenticateToken } = require('./auth');

// GET all membership plans
router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const plans = await dbAll('SELECT * FROM membership_plans ORDER BY price ASC');
    res.json(plans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve membership plans' });
  }
});

// GET active membership for a customer
router.get('/active/:customer_id', authenticateToken, async (req, res) => {
  try {
    const membership = await dbGet(`
      SELECT m.*, p.plan_name, p.discount_percent
      FROM customer_memberships m
      JOIN membership_plans p ON m.plan_id = p.plan_id
      WHERE m.customer_id = ? AND m.expiry_date >= date('now', 'localtime') AND (m.status = 'Active' OR m.status IS NULL)
      ORDER BY m.expiry_date DESC LIMIT 1
    `, [req.params.customer_id]);

    res.json(membership || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to query active membership status' });
  }
});

// POST purchase membership
router.post('/purchase', authenticateToken, async (req, res) => {
  const { customer_id, plan_id, store_id } = req.body;
  const targetStore = store_id || req.user?.store_id || 'store-main';

  if (!customer_id || !plan_id) {
    return res.status(400).json({ error: 'Required parameters missing' });
  }

  try {
    const result = await runTransaction(async () => {
      // 1. Fetch plan details
      const plan = await dbGet('SELECT * FROM membership_plans WHERE plan_id = ?', [plan_id]);
      if (!plan) throw new Error('Selected membership plan not found');

      // 2. Fetch customer details
      const customer = await dbGet('SELECT * FROM customers WHERE customer_id = ?', [customer_id]);
      if (!customer) throw new Error('Customer account not found');

      // 3. Deactivate any prior active memberships by setting expiry to now
      await dbRun("UPDATE customer_memberships SET expiry_date = date('now', 'localtime') WHERE customer_id = ?", [customer_id]);

      // 4. Compute start & expiry dates
      const startDate = new Date();
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + plan.duration_months);

      const startStr = startDate.toISOString().split('T')[0];
      const expiryStr = expiryDate.toISOString().split('T')[0];

      const membership_id = 'memb-' + Date.now();
      await dbRun(`
        INSERT INTO customer_memberships (membership_id, customer_id, plan_id, start_date, expiry_date, payment_status, amount_paid, store_id)
        VALUES (?, ?, ?, ?, ?, 'Paid', ?, ?)
      `, [membership_id, customer_id, plan_id, startStr, expiryStr, plan.price, targetStore]);

      // 5. Generate a retail Bill for this purchase (adds to revenue!)
      const billId = 'BILL-MEMB-' + Date.now();
      await dbRun(`
        INSERT INTO bills (
          bill_id, customer_id, subtotal, discount, cashback_used, advance_paid,
          due_amount, total_amount, payment_status, delivery_status, bill_type, bill_status, store_id, lens_details
        ) VALUES (?, ?, ?, 0.00, 0.00, ?, 0.00, ?, 'Paid', 'Delivered', 'Regular', 'Active', ?, ?)
      `, [
        billId, customer_id, plan.price, plan.price, plan.price, targetStore,
        `Paid Membership Enrollment: ${plan.plan_name}`
      ]);

      // Update customer stats
      await dbRun(`
        UPDATE customers
        SET total_bills = total_bills + 1,
            total_purchase = total_purchase + ?,
            last_visit = CURRENT_TIMESTAMP
        WHERE customer_id = ?
      `, [plan.price, customer_id]);

      return { membership_id, billId };
    });

    res.status(201).json({
      message: 'Membership purchased and activated successfully',
      membership_id: result.membership_id,
      bill_id: result.billId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Membership purchase transaction failed' });
  }
});

// POST upgrade membership
router.post('/upgrade', authenticateToken, async (req, res) => {
  const { customer_id, plan_id, store_id } = req.body;
  const targetStore = store_id || req.user?.store_id || 'store-main';

  if (!customer_id || !plan_id) {
    return res.status(400).json({ error: 'Required parameters missing' });
  }

  try {
    const result = await runTransaction(async () => {
      // 1. Fetch new plan details
      const newPlan = await dbGet('SELECT * FROM membership_plans WHERE plan_id = ?', [plan_id]);
      if (!newPlan) throw new Error('Selected membership plan not found');

      // 2. Fetch customer details
      const customer = await dbGet('SELECT * FROM customers WHERE customer_id = ?', [customer_id]);
      if (!customer) throw new Error('Customer account not found');

      // 3. Fetch active membership
      const activeMemb = await dbGet(`
        SELECT m.*, p.price as old_price, p.plan_name as old_plan_name
        FROM customer_memberships m
        JOIN membership_plans p ON m.plan_id = p.plan_id
        WHERE m.customer_id = ? AND m.expiry_date >= date('now', 'localtime') AND m.status = 'Active'
        ORDER BY m.expiry_date DESC LIMIT 1
      `, [customer_id]);

      if (!activeMemb) {
        throw new Error('No active membership found to upgrade');
      }

      // Deactivate prior active membership
      await dbRun("UPDATE customer_memberships SET status = 'Upgraded', expiry_date = date('now', 'localtime') WHERE membership_id = ?", [activeMemb.membership_id]);

      // Calculate the difference
      let amountToCharge = newPlan.price - activeMemb.old_price;
      if (amountToCharge < 0) amountToCharge = 0; // Don't allow negative charge

      // 4. Compute start & expiry dates
      const startDate = new Date();
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + newPlan.duration_months);

      const startStr = startDate.toISOString().split('T')[0];
      const expiryStr = expiryDate.toISOString().split('T')[0];

      const membership_id = 'memb-' + Date.now();
      await dbRun(`
        INSERT INTO customer_memberships (membership_id, customer_id, plan_id, start_date, expiry_date, payment_status, amount_paid, store_id, status)
        VALUES (?, ?, ?, ?, ?, 'Paid', ?, ?, 'Active')
      `, [membership_id, customer_id, plan_id, startStr, expiryStr, amountToCharge, targetStore]);

      // 5. Generate a retail Bill for this purchase (adds to revenue!)
      const billId = 'BILL-UPGRADE-' + Date.now();
      await dbRun(`
        INSERT INTO bills (
          bill_id, customer_id, subtotal, discount, cashback_used, advance_paid,
          due_amount, total_amount, payment_status, delivery_status, bill_type, bill_status, store_id, lens_details
        ) VALUES (?, ?, ?, 0.00, 0.00, ?, 0.00, ?, 'Paid', 'Delivered', 'Regular', 'Active', ?, ?)
      `, [
        billId, customer_id, amountToCharge, amountToCharge, amountToCharge, targetStore,
        `Membership Upgrade: ${activeMemb.old_plan_name} to ${newPlan.plan_name}`
      ]);

      // Update customer stats
      await dbRun(`
        UPDATE customers
        SET total_bills = total_bills + 1,
            total_purchase = total_purchase + ?,
            last_visit = CURRENT_TIMESTAMP
        WHERE customer_id = ?
      `, [amountToCharge, customer_id]);

      return { membership_id, billId, amountCharged: amountToCharge };
    });

    res.status(201).json({
      message: 'Membership upgraded successfully',
      membership_id: result.membership_id,
      bill_id: result.billId,
      amount_charged: result.amountCharged
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Membership upgrade failed' });
  }
});

module.exports = router;
