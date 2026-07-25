const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db');
const { authenticateToken, requireRole } = require('./auth');

// GET all stores
router.get('/', authenticateToken, async (req, res) => {
  try {
    const stores = await dbAll('SELECT * FROM stores ORDER BY created_at DESC');
    res.json(stores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// POST create a store (Owner-only)
router.post('/', authenticateToken, requireRole('Owner'), async (req, res) => {
  const { store_name, address, gst_number, phone } = req.body;
  if (!store_name) {
    return res.status(400).json({ error: 'Store name is required' });
  }

  const store_id = 'store-' + Date.now();
  try {
    await dbRun(`
      INSERT INTO stores (store_id, store_name, address, gst_number, phone)
      VALUES (?, ?, ?, ?, ?)
    `, [store_id, store_name, address || null, gst_number || null, phone || null]);

    const created = await dbGet('SELECT * FROM stores WHERE store_id = ?', [store_id]);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

// PUT update a store (Owner-only)
router.put('/:id', authenticateToken, requireRole('Owner'), async (req, res) => {
  const { store_name, address, gst_number, phone, status } = req.body;
  if (!store_name) {
    return res.status(400).json({ error: 'Store name is required' });
  }

  try {
    await dbRun(`
      UPDATE stores 
      SET store_name = ?, address = ?, gst_number = ?, phone = ?, status = ?
      WHERE store_id = ?
    `, [store_name, address || null, gst_number || null, phone || null, status || 'Active', req.params.id]);

    const updated = await dbGet('SELECT * FROM stores WHERE store_id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update store' });
  }
});

module.exports = router;
