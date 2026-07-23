const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll, runTransaction } = require('../db');
const { authenticateToken } = require('./auth');

// GET all repairs
router.get('/', authenticateToken, async (req, res) => {
  const { store_id } = req.query;
  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore;
  if (userRole === 'Employee') {
    targetStore = userStore;
  }

  let sql = `
    SELECT r.*, c.name as customer_name, c.mobile as customer_mobile
    FROM repair_orders r
    JOIN customers c ON r.customer_id = c.customer_id
  `;
  const params = [];
  if (targetStore && targetStore !== 'all') {
    sql += ' WHERE r.store_id = ?';
    params.push(targetStore);
  }
  sql += ' ORDER BY r.created_at DESC';

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch repairs' });
  }
});

// POST create repair order (auto-creates customer if new)
router.post('/', authenticateToken, async (req, res) => {
  const { customer_name, mobile, frame_details, repair_type, charges, expected_date, store_id } = req.body;

  if (!customer_name || !mobile || !frame_details || !repair_type || charges === undefined || !expected_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const userStore = req.user ? req.user.store_id : null;
  const finalStoreId = store_id || userStore || 'store-main';

  try {
    const result = await runTransaction(async () => {
      // Find or create customer
      let customer = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
      let customer_id;
      if (customer) {
        customer_id = customer.customer_id;
      } else {
        customer_id = 'cust-' + Date.now();
        await dbRun(`
          INSERT INTO customers (customer_id, name, mobile, gender, language)
          VALUES (?, ?, ?, 'Other', 'English')
        `, [customer_id, customer_name, mobile]);
      }

      const repair_id = 'rep-' + Date.now();
      await dbRun(`
        INSERT INTO repair_orders (repair_id, customer_id, frame_details, repair_type, charges, expected_date, repair_status, delivery_status, store_id)
        VALUES (?, ?, ?, ?, ?, ?, 'Received', 'Pending', ?)
      `, [repair_id, customer_id, frame_details, repair_type, parseFloat(charges), expected_date, finalStoreId]);

      return { repair_id, customer_id };
    });

    const created = await dbGet(`
      SELECT r.*, c.name as customer_name, c.mobile as customer_mobile 
      FROM repair_orders r
      JOIN customers c ON r.customer_id = c.customer_id
      WHERE r.repair_id = ?
    `, [result.repair_id]);

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create repair order' });
  }
});

// PUT update status & return WhatsApp link if status becomes 'Ready'
router.put('/:id/status', authenticateToken, async (req, res) => {
  const { repair_status, delivery_status } = req.body;
  const { id } = req.params;

  if (!repair_status) {
    return res.status(400).json({ error: 'Repair status is required' });
  }

  try {
    const order = await dbGet(`
      SELECT r.*, c.name as customer_name, c.mobile as customer_mobile 
      FROM repair_orders r
      JOIN customers c ON r.customer_id = c.customer_id
      WHERE r.repair_id = ?
    `, [id]);

    if (!order) return res.status(404).json({ error: 'Repair order not found' });

    let finalDeliveryStatus = delivery_status || order.delivery_status;
    if (repair_status === 'Delivered') {
      finalDeliveryStatus = 'Delivered';
    }

    await dbRun(`
      UPDATE repair_orders 
      SET repair_status = ?, delivery_status = ? 
      WHERE repair_id = ?
    `, [repair_status, finalDeliveryStatus, id]);

    let waLink = null;
    let toast = `✅ Repair status updated to ${repair_status}`;

    if (repair_status === 'Ready') {
      const textMsg = `Hi *${order.customer_name}*, your glasses repair for *${order.frame_details}* is ready for collection at Eyevengers Optical! Total charges: ₹${parseFloat(order.charges).toFixed(2)}. Please visit our store soon.`;
      waLink = `https://wa.me/91${order.customer_mobile}?text=${encodeURIComponent(textMsg)}`;
      toast += ` • WhatsApp pickup notification is ready.`;
    }

    const updated = await dbGet(`
      SELECT r.*, c.name as customer_name, c.mobile as customer_mobile 
      FROM repair_orders r
      JOIN customers c ON r.customer_id = c.customer_id
      WHERE r.repair_id = ?
    `, [id]);

    res.json({
      updated,
      waLink,
      toast
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
