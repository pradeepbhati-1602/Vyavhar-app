const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll, runTransaction, logAuditEvent } = require('../db');
const { authenticateToken } = require('./auth');

// Helper: log inventory history event
const logInventoryEvent = async (product_id, added_quantity, previous_stock, new_stock, updated_by, reason, store_id = null) => {
  const history_id = 'invh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  await dbRun(`
    INSERT INTO inventory_history (history_id, product_id, added_quantity, previous_stock, new_stock, updated_by, reason, store_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [history_id, product_id, added_quantity, previous_stock, new_stock, updated_by, reason, store_id]);
};

// GET all transfers
router.get('/', authenticateToken, async (req, res) => {
  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';

  let sql = `
    SELECT t.*, 
           p.barcode, p.brand, p.frame_name, p.category,
           s_from.store_name as from_store_name,
           s_to.store_name as to_store_name
    FROM inventory_transfers t
    JOIN products p ON t.product_id = p.product_id
    JOIN stores s_from ON t.from_store_id = s_from.store_id
    JOIN stores s_to ON t.to_store_id = s_to.store_id
  `;
  const params = [];

  if (userRole === 'Employee' && userStore) {
    sql += ' WHERE t.from_store_id = ? OR t.to_store_id = ?';
    params.push(userStore, userStore);
  }

  sql += ' ORDER BY t.created_at DESC';

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch transfers log' });
  }
});

// POST request a transfer
router.post('/', authenticateToken, async (req, res) => {
  const { product_id, from_store_id, to_store_id, quantity } = req.body;
  const qty = parseInt(quantity);

  if (!product_id || !from_store_id || !to_store_id || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Required fields missing or invalid quantity' });
  }

  if (from_store_id === to_store_id) {
    return res.status(400).json({ error: 'Source and target stores cannot be the same' });
  }

  const requestedBy = req.user ? req.user.name || req.user.username : 'System';

  try {
    const result = await runTransaction(async () => {
      // 1. Verify source product exists and has enough stock
      const sourceProduct = await dbGet('SELECT * FROM products WHERE product_id = ? AND store_id = ?', [product_id, from_store_id]);
      if (!sourceProduct) {
        throw new Error('Source product not found in the selected source location.');
      }
      if (sourceProduct.current_stock < qty) {
        throw new Error(`Insufficient stock in source store. Available: ${sourceProduct.current_stock}`);
      }

      // 2. Lock stock: deduct quantity from source store
      const prevStock = sourceProduct.current_stock;
      const newStock = prevStock - qty;
      await dbRun('UPDATE products SET current_stock = ?, last_updated_date = CURRENT_TIMESTAMP WHERE product_id = ?', [newStock, product_id]);

      // 3. Log initial inventory change on source store
      await logInventoryEvent(product_id, -qty, prevStock, newStock, requestedBy, `Transfer Out Pending to ${to_store_id}`, from_store_id);

      // 4. Record transfer request
      const transfer_id = 'trsf-' + Date.now();
      await dbRun(`
        INSERT INTO inventory_transfers (transfer_id, product_id, from_store_id, to_store_id, quantity, status, requested_by)
        VALUES (?, ?, ?, ?, ?, 'Pending', ?)
      `, [transfer_id, product_id, from_store_id, to_store_id, qty, requestedBy]);

      return transfer_id;
    });

    await logAuditEvent(req.user?.user_id, req.user?.username, 'Transfer Stock Requested', { transfer_id: result, product_id, from_store_id, to_store_id, quantity: qty });

    res.status(201).json({ message: 'Stock transfer request submitted successfully', transfer_id: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Stock transfer request failed' });
  }
});

// PUT Approve transfer (Owner role only)
router.put('/:id/approve', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const actionBy = req.user ? req.user.name || req.user.username : 'System';

  try {
    await runTransaction(async () => {
      // 1. Fetch transfer details
      const transfer = await dbGet('SELECT * FROM inventory_transfers WHERE transfer_id = ?', [id]);
      if (!transfer) throw new Error('Transfer request not found');
      if (transfer.status !== 'Pending') throw new Error('This transfer request has already been processed');

      // 2. Fetch source product metadata
      const sourceProduct = await dbGet('SELECT * FROM products WHERE product_id = ?', [transfer.product_id]);
      if (!sourceProduct) throw new Error('Source product metadata not found');

      // 3. Find or create target product in destination store
      let targetProduct = await dbGet('SELECT * FROM products WHERE barcode = ? AND store_id = ?', [sourceProduct.barcode, transfer.to_store_id]);
      let targetProductId;
      let prevTargetStock = 0;

      if (targetProduct) {
        targetProductId = targetProduct.product_id;
        prevTargetStock = targetProduct.current_stock;
        const newTargetStock = prevTargetStock + transfer.quantity;

        await dbRun('UPDATE products SET current_stock = ?, last_updated_date = CURRENT_TIMESTAMP WHERE product_id = ?', [newTargetStock, targetProductId]);
        await logInventoryEvent(targetProductId, transfer.quantity, prevTargetStock, newTargetStock, actionBy, `Transfer In from ${transfer.from_store_id}`, transfer.to_store_id);
      } else {
        // Automatically replicate product metadata to target store
        targetProductId = 'prod-' + Date.now();
        await dbRun(`
          INSERT INTO products (
            product_id, barcode, category, brand, frame_name, frame_color, size,
            purchase_price, selling_price, opening_stock, current_stock, low_stock_limit,
            supplier, store_id, warranty_months, last_updated_date, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Active')
        `, [
          targetProductId, sourceProduct.barcode, sourceProduct.category, sourceProduct.brand,
          sourceProduct.frame_name, sourceProduct.frame_color, sourceProduct.size,
          sourceProduct.purchase_price, sourceProduct.selling_price, transfer.quantity,
          sourceProduct.low_stock_limit, sourceProduct.supplier, transfer.to_store_id,
          sourceProduct.warranty_months
        ]);

        await logInventoryEvent(targetProductId, transfer.quantity, 0, transfer.quantity, actionBy, `Transfer In (New SKU replicate) from ${transfer.from_store_id}`, transfer.to_store_id);
      }

      // 4. Update transfer status
      await dbRun(`
        UPDATE inventory_transfers 
        SET status = 'Approved', action_by = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE transfer_id = ?
      `, [actionBy, id]);
    });

    await logAuditEvent(req.user?.user_id, req.user?.username, 'Transfer Stock Approved', { transfer_id: id });

    res.json({ message: 'Stock transfer approved and executed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to approve stock transfer' });
  }
});

// PUT Reject transfer (Owner role only)
router.put('/:id/reject', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const actionBy = req.user ? req.user.name || req.user.username : 'System';

  try {
    await runTransaction(async () => {
      // 1. Fetch transfer details
      const transfer = await dbGet('SELECT * FROM inventory_transfers WHERE transfer_id = ?', [id]);
      if (!transfer) throw new Error('Transfer request not found');
      if (transfer.status !== 'Pending') throw new Error('This transfer request has already been processed');

      // 2. Fetch source product
      const sourceProduct = await dbGet('SELECT * FROM products WHERE product_id = ?', [transfer.product_id]);
      if (!sourceProduct) throw new Error('Source product not found');

      // 3. Refund stock to source store
      const prevStock = sourceProduct.current_stock;
      const newStock = prevStock + transfer.quantity;
      await dbRun('UPDATE products SET current_stock = ?, last_updated_date = CURRENT_TIMESTAMP WHERE product_id = ?', [newStock, transfer.product_id]);
      await logInventoryEvent(transfer.product_id, transfer.quantity, prevStock, newStock, actionBy, 'Transfer Request Rejected (Stock Restored)', transfer.from_store_id);

      // 4. Update transfer status
      await dbRun(`
        UPDATE inventory_transfers 
        SET status = 'Rejected', action_by = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE transfer_id = ?
      `, [actionBy, id]);
    });

    await logAuditEvent(req.user?.user_id, req.user?.username, 'Transfer Stock Rejected', { transfer_id: id });

    res.json({ message: 'Stock transfer request rejected and stock returned' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to reject stock transfer' });
  }
});

module.exports = router;
