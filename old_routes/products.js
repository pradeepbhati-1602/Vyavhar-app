const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db');
const { authenticateToken, requireRole } = require('./auth');

// ── GET all products with filtering ──────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  const { search, category, brand, lowStock, store_id } = req.query;

  let sql = "SELECT * FROM products WHERE status = 'Active'";
  const params = [];

  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore;
  
  if (userRole === 'Employee') {
    targetStore = userStore;
  }

  if (targetStore && targetStore !== 'all') {
    sql += ' AND store_id = ?';
    params.push(targetStore);
  }

  if (search) {
    sql += ' AND (brand LIKE ? OR frame_name LIKE ? OR barcode = ?)';
    params.push(`%${search}%`, `%${search}%`, search);
  }
  if (category && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (brand) {
    sql += ' AND brand = ?';
    params.push(brand);
  }
  if (lowStock === 'true') {
    sql += ' AND current_stock <= low_stock_limit';
  }

  sql += ' ORDER BY created_at DESC';

  try {
    const { is_paginated, page = 1, limit = 50 } = req.query;
    if (is_paginated === 'true') {
      const parsedPage = parseInt(page) || 1;
      const parsedLimit = parseInt(limit) || 50;
      const offset = (parsedPage - 1) * parsedLimit;
      
      const countSql = `SELECT COUNT(*) as total FROM (${sql}) as subquery`;
      const totalRes = await dbGet(countSql, params);
      const total = totalRes ? totalRes.total : 0;
      
      sql += ` LIMIT ? OFFSET ?`;
      params.push(parsedLimit, offset);
      
      const list = await dbAll(sql, params);
      return res.json({ data: list, total, page: parsedPage, limit: parsedLimit });
    } else {
      const list = await dbAll(sql, params);
      res.json(list);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ── GET low stock products (dashboard alert) ──────────────────────────────
router.get('/low-stock', authenticateToken, async (req, res) => {
  const { store_id } = req.query;
  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore;
  if (userRole === 'Employee') {
    targetStore = userStore;
  }

  let sql = "SELECT * FROM products WHERE current_stock <= low_stock_limit AND status = 'Active'";
  const params = [];
  
  if (targetStore && targetStore !== 'all') {
    sql += ' AND store_id = ?';
    params.push(targetStore);
  }

  sql += ' ORDER BY current_stock ASC';

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch low stock alerts' });
  }
});

// ── GET product by barcode (scanner lookup) ───────────────────────────────
router.get('/barcode/:barcode', authenticateToken, async (req, res) => {
  const { store_id } = req.query;
  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore || 'store-main';
  if (userRole === 'Employee') {
    targetStore = userStore || 'store-main';
  }

  try {
    const product = await dbGet("SELECT * FROM products WHERE barcode = ? AND store_id = ? AND status = 'Active'", [req.params.barcode, targetStore]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to lookup barcode' });
  }
});

// ── GET product inventory history ─────────────────────────────────────────
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const product = await dbGet('SELECT * FROM products WHERE product_id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const history = await dbAll(`
      SELECT h.*, p.brand, p.frame_name
      FROM inventory_history h
      JOIN products p ON h.product_id = p.product_id
      WHERE h.product_id = ?
      ORDER BY h.date DESC
    `, [req.params.id]);

    res.json({ product, history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch inventory history' });
  }
});

// ── GET single product ────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await dbGet('SELECT * FROM products WHERE product_id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ── POST Create product ───────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  const { barcode, category, brand, frame_name, frame_color, size,
    purchase_price, selling_price, opening_stock, low_stock_limit = 5, supplier, store_id, warranty_months = 0 } = req.body;

  if (!barcode || !category || !brand || !frame_name ||
    purchase_price === undefined || selling_price === undefined || opening_stock === undefined) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  const finalStoreId = userRole === 'Employee' ? userStore : (store_id || userStore || 'store-main');

  try {
    const existing = await dbGet('SELECT * FROM products WHERE barcode = ? AND store_id = ?', [barcode, finalStoreId]);
    if (existing) return res.status(400).json({ error: 'A product with this barcode already exists in this store' });

    const product_id = 'prod-' + Date.now();
    await dbRun(`
      INSERT INTO products (product_id, barcode, category, brand, frame_name, frame_color, size,
        purchase_price, selling_price, opening_stock, current_stock, low_stock_limit, supplier,
        store_id, warranty_months, last_updated_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Active')
    `, [product_id, barcode, category, brand, frame_name, frame_color || null, size || null,
        purchase_price, selling_price, opening_stock, opening_stock, low_stock_limit, supplier || null,
        finalStoreId, parseInt(warranty_months)]);

    // Log initial stock event
    const history_id = 'invh-' + Date.now();
    const updatedBy = req.user ? req.user.name || req.user.username : 'System';
    await dbRun(`
      INSERT INTO inventory_history (history_id, product_id, added_quantity, previous_stock, new_stock, updated_by, reason, store_id)
      VALUES (?, ?, ?, 0, ?, ?, 'Opening Stock', ?)
    `, [history_id, product_id, opening_stock, opening_stock, updatedBy, finalStoreId]);

    const created = await dbGet('SELECT * FROM products WHERE product_id = ?', [product_id]);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ── POST Restock product (v2 Edit Stock workflow) ─────────────────────────
router.post('/:id/restock', authenticateToken, async (req, res) => {
  const { add_quantity, updated_by } = req.body;
  const qty = parseInt(add_quantity);

  if (!qty || qty <= 0) {
    return res.status(400).json({ error: 'Add New Stock must be a positive number' });
  }

  try {
    const product = await dbGet('SELECT * FROM products WHERE product_id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (req.user && req.user.role === 'Employee' && product.store_id !== req.user.store_id) {
      return res.status(403).json({ error: 'Permission denied. Staff can only restock products for their assigned store.' });
    }

    const prevStock = product.current_stock;
    const newStock  = prevStock + qty;

    await dbRun(`
      UPDATE products
      SET current_stock = ?,
          last_purchase_date = date('now', 'localtime'),
          last_updated_date = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `, [newStock, req.params.id]);

    const history_id = 'invh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    await dbRun(`
      INSERT INTO inventory_history (history_id, product_id, added_quantity, previous_stock, new_stock, updated_by, reason, store_id)
      VALUES (?, ?, ?, ?, ?, ?, 'Stock Refill', ?)
    `, [history_id, req.params.id, qty, prevStock, newStock, updated_by || 'Owner', product.store_id]);

    res.json({
      message: `Stock updated: ${prevStock} → ${newStock}`,
      previous_stock: prevStock,
      new_stock: newStock,
      added: qty
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to restock product' });
  }
});

// ── PUT Update product ────────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  const { barcode, category, brand, frame_name, frame_color, size,
    purchase_price, selling_price, low_stock_limit, supplier, status } = req.body;

  try {
    const product = await dbGet('SELECT * FROM products WHERE product_id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (req.user && req.user.role === 'Employee' && product.store_id !== req.user.store_id) {
      return res.status(403).json({ error: 'Permission denied. Staff can only update products for their assigned store.' });
    }

    const existing = await dbGet('SELECT * FROM products WHERE barcode = ? AND store_id = ? AND product_id != ?', [barcode, product.store_id, req.params.id]);
    if (existing) return res.status(400).json({ error: 'Another product in this store is already using this barcode' });

    await dbRun(`
      UPDATE products
      SET barcode = ?, category = ?, brand = ?, frame_name = ?, frame_color = ?, size = ?,
          purchase_price = ?, selling_price = ?, low_stock_limit = ?, supplier = ?,
          status = ?, last_updated_date = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `, [barcode, category, brand, frame_name, frame_color || null, size || null,
        purchase_price, selling_price, low_stock_limit, supplier || null,
        status || 'Active', req.params.id]);

    const updated = await dbGet('SELECT * FROM products WHERE product_id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ── DELETE / Discontinue product (Owner only) ─────────────────────────────
router.delete('/:id', authenticateToken, requireRole('Owner'), async (req, res) => {
  try {
    await dbRun("UPDATE products SET status = 'Discontinued' WHERE product_id = ?", [req.params.id]);
    res.json({ message: 'Product discontinued successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to discontinue product' });
  }
});

module.exports = router;
