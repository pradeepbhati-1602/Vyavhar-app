const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { dbRun, dbGet, dbAll, runTransaction, logAuditEvent } = require('../db');
const { authenticateToken, requireRole } = require('./auth');
const { generateInvoicePDF } = require('../utils/pdfGenerator');

// Helper: load settings map
const getSettings = async () => {
  const rows = await dbAll('SELECT * FROM settings');
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
};

// Helper: log inventory history event
const logInventoryEvent = async (product_id, added_quantity, previous_stock, new_stock, updated_by, reason, bill_id = null, store_id = null) => {
  const history_id = 'invh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  await dbRun(`
    INSERT INTO inventory_history (history_id, product_id, added_quantity, previous_stock, new_stock, updated_by, reason, bill_id, store_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [history_id, product_id, added_quantity, previous_stock, new_stock, updated_by, reason, bill_id, store_id]);
};

// ── GET all bills with optional search ────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  const { search, delivery_status, bill_type, store_id } = req.query;
  let sql = `
    SELECT b.*, c.name as customer_name, c.mobile as customer_mobile, p.brand, p.frame_name
    FROM bills b
    JOIN customers c ON b.customer_id = c.customer_id
    LEFT JOIN products p ON b.frame_product_id = p.product_id
    WHERE b.bill_status = 'Active'
  `;
  const params = [];

  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore;
  if (userRole === 'Employee') {
    targetStore = userStore;
  }

  if (targetStore && targetStore !== 'all') {
    sql += ' AND b.store_id = ?';
    params.push(targetStore);
  }

  if (search) {
    sql += ' AND (b.bill_id LIKE ? OR c.name LIKE ? OR c.mobile LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (delivery_status) {
    sql += ' AND b.delivery_status = ?';
    params.push(delivery_status);
  }
  if (bill_type) {
    sql += ' AND b.bill_type = ?';
    params.push(bill_type);
  }

  sql += ' ORDER BY b.created_at DESC';

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
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// ── GET undelivered bills (Pending Delivery) ──────────────────────────────
router.get('/undelivered', authenticateToken, async (req, res) => {
  const { store_id } = req.query;
  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore;
  if (userRole === 'Employee') {
    targetStore = userStore;
  }

  let sql = `
    SELECT b.*, c.name as customer_name, c.mobile as customer_mobile,
           p.brand, p.frame_name
    FROM bills b
    JOIN customers c ON b.customer_id = c.customer_id
    LEFT JOIN products p ON b.frame_product_id = p.product_id
    WHERE b.delivery_status = 'Pending' AND b.bill_status = 'Active'
  `;
  const params = [];

  if (targetStore && targetStore !== 'all') {
    sql += ' AND b.store_id = ?';
    params.push(targetStore);
  }

  sql += ' ORDER BY b.created_at ASC';

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch undelivered bills' });
  }
});

// ── GET delivered history ─────────────────────────────────────────────────
router.get('/delivered', authenticateToken, async (req, res) => {
  const { store_id } = req.query;
  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore;
  if (userRole === 'Employee') {
    targetStore = userStore;
  }

  let sql = `
    SELECT b.*, c.name as customer_name, c.mobile as customer_mobile,
           p.brand, p.frame_name
    FROM bills b
    JOIN customers c ON b.customer_id = c.customer_id
    LEFT JOIN products p ON b.frame_product_id = p.product_id
    WHERE b.delivery_status = 'Delivered' AND b.bill_status = 'Active'
  `;
  const params = [];

  if (targetStore && targetStore !== 'all') {
    sql += ' AND b.store_id = ?';
    params.push(targetStore);
  }

  sql += ' ORDER BY b.delivery_date DESC';

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch delivered bills' });
  }
});

// ── GET single bill detail ────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const bill = await dbGet('SELECT * FROM bills WHERE bill_id = ?', [req.params.id]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const customer = await dbGet('SELECT * FROM customers WHERE customer_id = ?', [bill.customer_id]);
    let product = null;
    if (bill.frame_product_id) {
      product = await dbGet('SELECT * FROM products WHERE product_id = ?', [bill.frame_product_id]);
    }

    const settings = await getSettings();
    const pdfPath = path.join(__dirname, '..', 'public', 'invoices', `${bill.bill_id}.pdf`);
    const relativeUrl = `/invoices/${bill.bill_id}.pdf`;

    if (!fs.existsSync(pdfPath)) {
      await generateInvoicePDF(bill, customer, product, settings, pdfPath);
    }

    res.json({ bill, customer, product, pdfUrl: relativeUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch bill details' });
  }
});

// ── POST Create Bill (full automation chain) ──────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  const {
    name,
    mobile,
    birthday,
    gender,
    address,
    language = 'English',
    referral_code,
    frame_product_id,
    lens_details,
    power_details,
    subtotal,
    discount = 0,
    cashback_used = 0,
    advance_paid = 0,
    bill_type = 'Regular',
    store_id
  } = req.body;

  if (!name || !mobile || subtotal === undefined) {
    return res.status(400).json({ error: 'Customer Name, Mobile, and Subtotal are required' });
  }
  if (String(mobile).length !== 10) {
    return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' });
  }

  const userStore = req.user ? req.user.store_id : null;
  const finalStoreId = store_id || userStore || 'store-main';
  const updatedBy = req.user ? req.user.name || req.user.username : 'System';

  try {
    const result = await runTransaction(async () => {
      const settings = await getSettings();
      const refPercent = parseFloat(settings.referral_cashback_percent || '5');

      // 1. Fetch or create customer
      let customer = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
      let isNewCustomer = false;
      let customer_id;

      const bill_subtotal    = parseFloat(subtotal);
      const bill_discount    = parseFloat(discount);
      const bill_cashback    = parseFloat(cashback_used);
      const bill_advance     = parseFloat(advance_paid);
      const bill_total       = bill_subtotal - bill_discount - bill_cashback;
      const bill_due         = Math.max(0, bill_total - bill_advance);

      if (bill_cashback > 0 && (!customer || customer.current_cashback < bill_cashback)) {
        throw new Error(`Insufficient cashback balance. Available: ₹${customer ? customer.current_cashback : 0}`);
      }

      if (customer) {
        customer_id = customer.customer_id;
        await dbRun(`
          UPDATE customers
          SET last_visit = CURRENT_TIMESTAMP,
              total_bills = total_bills + 1,
              total_purchase = total_purchase + ?,
              current_cashback = current_cashback - ?,
              pending_due = pending_due + ?
          WHERE customer_id = ?
        `, [bill_total, bill_cashback, bill_due, customer_id]);
      } else {
        isNewCustomer = true;
        customer_id = 'cust-' + Date.now();
        await dbRun(`
          INSERT INTO customers
          (customer_id, name, mobile, birthday, gender, address, language, last_visit,
           total_bills, total_purchase, current_cashback, pending_due, referral_code_used)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, ?, 0.00, ?, ?)
        `, [customer_id, name, mobile, birthday || null, gender || null,
            address || null, language, bill_total, bill_due, referral_code || null]);
        customer = { customer_id, name, mobile, birthday, gender, address, language, current_cashback: 0.00 };
      }

      // 2. Referral processing
      let earnedCashback = 0;
      let referralMember = null;
      if (referral_code) {
        referralMember = await dbGet("SELECT * FROM referral_members WHERE referral_code = ? AND status = 'Active'", [referral_code]);
        if (referralMember) {
          earnedCashback = bill_subtotal * (refPercent / 100.0);
          await dbRun(`
            UPDATE referral_members
            SET referral_count = referral_count + 1,
                cashback_earned = cashback_earned + ?
            WHERE referral_code = ?
          `, [earnedCashback, referral_code]);
          await dbRun(`
            UPDATE customers SET current_cashback = current_cashback + ?
            WHERE mobile = ?
          `, [earnedCashback, referralMember.mobile]);
        } else {
          throw new Error('Invalid or Inactive Referral Code.');
        }
      }

      // 3. Cashback redemption on referral member ledger
      if (bill_cashback > 0) {
        await dbRun(`
          UPDATE referral_members SET cashback_used = cashback_used + ?
          WHERE mobile = ?
        `, [bill_cashback, mobile]);
      }

      // 4. Inventory deduction + history log
      let product = null;
      if (frame_product_id) {
        product = await dbGet("SELECT * FROM products WHERE product_id = ? AND status = 'Active'", [frame_product_id]);
        if (!product) throw new Error('Frame product not found or is discontinued.');
        if (product.current_stock <= 0) throw new Error(`${product.brand} ${product.frame_name} is out of stock.`);

        const prevStock = product.current_stock;
        const newStock  = prevStock - 1;

        await dbRun(`
          UPDATE products SET current_stock = ?, last_updated_date = CURRENT_TIMESTAMP
          WHERE product_id = ?
        `, [newStock, frame_product_id]);

        // Will be called after bill_id is known — store args for later
        product._prevStock = prevStock;
        product._newStock  = newStock;
      }

      // 5. Generate sequential invoice number
      const prefix = settings.invoice_prefix || 'INV-';
      const billCount = await dbGet('SELECT COUNT(*) as count FROM bills');
      const bill_id = `${prefix}${1001 + billCount.count}`;

      let payment_status = 'Due';
      if (bill_due === 0) payment_status = 'Paid';
      else if (bill_advance > 0) payment_status = 'Partial';

      // 5.5 Calculate warranty expiry if product has warranty_months
      let warrantyExpiryDate = null;
      if (product && product.warranty_months > 0) {
        const saleDate = new Date();
        saleDate.setMonth(saleDate.getMonth() + product.warranty_months);
        warrantyExpiryDate = saleDate.toISOString().split('T')[0];
      }

      // 6. Save bill record
      await dbRun(`
        INSERT INTO bills (
          bill_id, customer_id, referral_code, frame_product_id,
          lens_details, power_details, subtotal, discount,
          cashback_used, advance_paid, due_amount, total_amount,
          payment_status, delivery_status, bill_type, bill_status, store_id, warranty_expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, 'Active', ?, ?)
      `, [
        bill_id, customer_id, referral_code || null, frame_product_id || null,
        lens_details ? JSON.stringify(lens_details) : null,
        power_details ? JSON.stringify(power_details) : null,
        bill_subtotal, bill_discount, bill_cashback, bill_advance,
        bill_due, bill_total, payment_status, bill_type, finalStoreId, warrantyExpiryDate
      ]);

      // 7. Log inventory history now that we have bill_id
      if (product && product._prevStock !== undefined) {
        await logInventoryEvent(
          frame_product_id, -1, product._prevStock, product._newStock,
          updatedBy, 'Sale', bill_id, finalStoreId
        );
      }

      return {
        bill_id, customer_id, earnedCashback,
        referralOwner: referralMember ? referralMember.customer_name : null,
        bill_total, bill_due, isNewCustomer
      };
    });

    // 8. Generate PDF
    const newBill     = await dbGet('SELECT * FROM bills WHERE bill_id = ?', [result.bill_id]);
    const finalCust   = await dbGet('SELECT * FROM customers WHERE customer_id = ?', [result.customer_id]);
    let finalProduct  = null;
    if (frame_product_id) {
      finalProduct = await dbGet('SELECT * FROM products WHERE product_id = ?', [frame_product_id]);
    }

    const settings = await getSettings();
    const pdfPath   = path.join(__dirname, '..', 'public', 'invoices', `${result.bill_id}.pdf`);
    await generateInvoicePDF(newBill, finalCust, finalProduct, settings, pdfPath);

    const pdfUrl = `/invoices/${result.bill_id}.pdf`;
    const waMsg  = `Dear *${finalCust.name}*, thank you for visiting ${settings.store_name || 'Eyevengers Optical'}! 🎉\n\nYour invoice *${newBill.bill_id}* for ₹${newBill.total_amount} is ready.\n💳 Due Amount: ₹${newBill.due_amount}\n\nWe'll notify you when your order is ready for delivery. For any queries call us.`;
    const waLink = `https://wa.me/91${finalCust.mobile}?text=${encodeURIComponent(waMsg)}`;

    await logAuditEvent(req.user?.user_id, req.user?.username, 'Invoice Checkout', { bill_id: newBill.bill_id, customer: newBill.customer_id, total: newBill.total_amount });

    res.status(201).json({
      message: 'Bill saved successfully',
      billId: newBill.bill_id,
      pdfUrl,
      waLink,
      customer: finalCust,
      earnedCashback: result.earnedCashback,
      referralOwner: result.referralOwner,
      toast: `✅ Bill ${newBill.bill_id} saved • Stock updated${result.earnedCashback > 0 ? ` • ₹${result.earnedCashback.toFixed(2)} cashback credited to ${result.referralOwner}` : ''} • Delivery: Pending`
    });

  } catch (error) {
    console.error('Billing failed, rolling back:', error);
    res.status(500).json({ error: error.message || 'Billing transaction failed' });
  }
});

// ── PUT Mark Bill as Delivered ────────────────────────────────────────────
router.put('/:id/deliver', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const bill = await dbGet('SELECT * FROM bills WHERE bill_id = ?', [id]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.delivery_status === 'Delivered') {
      return res.status(400).json({ error: 'Bill already marked as Delivered' });
    }
    if (bill.bill_status === 'Cancelled') {
      return res.status(400).json({ error: 'Cannot deliver a cancelled bill' });
    }

    await dbRun(`
      UPDATE bills SET delivery_status = 'Delivered', delivery_date = CURRENT_TIMESTAMP
      WHERE bill_id = ?
    `, [id]);

    const settings = await getSettings();
    const customer = await dbGet('SELECT * FROM customers WHERE customer_id = ?', [bill.customer_id]);
    
    let msgEn = settings.whatsapp_delivery_template_en || 'Dear *{customer_name}*, we are pleased to inform you that your spectacles for invoice *{bill_id}* have been handed over. Thank you for choosing Eyevengers Optical!';
    let msgHi = settings.whatsapp_delivery_template_hi || 'प्रिय *{customer_name}*, हमें आपको सूचित करते हुए खुशी हो रही है कि आपके बिल *{bill_id}* का चश्मा डिलीवर कर दिया गया है। Eyevengers Optical को चुनने के लिए धन्यवाद!';

    const feedbackLinkStr = settings.feedback_link || 'https://g.page/r/eyevengers-optical/review';
    msgEn = msgEn.replace(/{customer_name}/g, customer.name)
                 .replace(/{bill_id}/g, bill.bill_id)
                 .replace(/{feedback_link}/g, feedbackLinkStr);
    msgHi = msgHi.replace(/{customer_name}/g, customer.name)
                 .replace(/{bill_id}/g, bill.bill_id)
                 .replace(/{feedback_link}/g, feedbackLinkStr);

    const waLinkEn = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(msgEn)}`;
    const waLinkHi = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(msgHi)}`;

    await logAuditEvent(req.user?.user_id, req.user?.username, 'Order Handover', { bill_id: id });

    res.json({ 
      message: `Bill ${id} marked as Delivered`, 
      delivery_date: new Date().toISOString(),
      waLinkEn,
      waLinkHi,
      customer
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark bill as delivered' });
  }
});

// ── PUT Collect Payment (mark due as paid) ────────────────────────────────
router.put('/:id/collect-payment', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const bill = await dbGet('SELECT * FROM bills WHERE bill_id = ?', [id]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.bill_status === 'Cancelled') return res.status(400).json({ error: 'Bill is cancelled' });
    if (bill.due_amount <= 0) return res.status(400).json({ error: 'No due amount on this bill' });

    const prevDue = parseFloat(bill.due_amount);

    await runTransaction(async () => {
      // Clear due on bill
      await dbRun(`
        UPDATE bills SET due_amount = 0, payment_status = 'Paid', advance_paid = total_amount
        WHERE bill_id = ?
      `, [id]);

      // Reduce customer pending_due
      await dbRun(`
        UPDATE customers SET pending_due = MAX(0, pending_due - ?)
        WHERE customer_id = ?
      `, [prevDue, bill.customer_id]);
    });

    await logAuditEvent(req.user?.user_id, req.user?.username, 'Payment Collection', { bill_id: id, due_collected: prevDue });

    res.json({ message: `Payment of ₹${prevDue} collected for bill ${id}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to collect payment' });
  }
});

// ── POST Cancel Bill (Owner only) ─────────────────────────────────────────
router.post('/:id/cancel', authenticateToken, requireRole('Owner'), async (req, res) => {
  const { id } = req.params;
  const updatedBy = req.user ? req.user.name || req.user.username : 'System';

  try {
    const bill = await dbGet('SELECT * FROM bills WHERE bill_id = ?', [id]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.bill_status === 'Cancelled') return res.status(400).json({ error: 'Bill is already cancelled' });

    const refSetting = await dbGet("SELECT value FROM settings WHERE key = 'referral_cashback_percent'");
    const refPercent = refSetting ? parseFloat(refSetting.value) : 5.0;

    await runTransaction(async () => {
      // 1. Mark bill cancelled
      await dbRun("UPDATE bills SET bill_status = 'Cancelled' WHERE bill_id = ?", [id]);

      // 2. Adjust customer metrics
      await dbRun(`
        UPDATE customers
        SET total_bills = total_bills - 1,
            total_purchase = total_purchase - ?,
            current_cashback = current_cashback + ?,
            pending_due = MAX(0, pending_due - ?)
        WHERE customer_id = ?
      `, [bill.total_amount, bill.cashback_used, bill.due_amount, bill.customer_id]);

      // 3. Revert referral reward
      if (bill.referral_code) {
        const referralMember = await dbGet("SELECT * FROM referral_members WHERE referral_code = ?", [bill.referral_code]);
        if (referralMember) {
          const cashbackEarned = bill.subtotal * (refPercent / 100.0);
          await dbRun(`
            UPDATE referral_members
            SET referral_count = MAX(0, referral_count - 1),
                cashback_earned = MAX(0, cashback_earned - ?)
            WHERE referral_code = ?
          `, [cashbackEarned, bill.referral_code]);
          await dbRun(`
            UPDATE customers SET current_cashback = MAX(0, current_cashback - ?)
            WHERE mobile = ?
          `, [cashbackEarned, referralMember.mobile]);
        }
      }

      // 4. Revert cashback used on referral member ledger
      if (parseFloat(bill.cashback_used) > 0) {
        const cust = await dbGet('SELECT mobile FROM customers WHERE customer_id = ?', [bill.customer_id]);
        if (cust) {
          await dbRun(`
            UPDATE referral_members SET cashback_used = MAX(0, cashback_used - ?)
            WHERE mobile = ?
          `, [bill.cashback_used, cust.mobile]);
        }
      }

      // 5. Restore inventory stock + history log
      if (bill.frame_product_id) {
        const prod = await dbGet('SELECT * FROM products WHERE product_id = ?', [bill.frame_product_id]);
        if (prod) {
          const prevStock = prod.current_stock;
          const newStock  = prevStock + 1;
          await dbRun(`
            UPDATE products SET current_stock = ?, last_updated_date = CURRENT_TIMESTAMP
            WHERE product_id = ?
          `, [newStock, bill.frame_product_id]);
          await logInventoryEvent(
            bill.frame_product_id, 1, prevStock, newStock,
            updatedBy, 'Cancellation Restore', id, bill.store_id
          );
        }
      }
    });

    await logAuditEvent(req.user?.user_id, req.user?.username, 'Invoice Cancellation', { bill_id: id });

    res.json({ message: `Bill ${id} cancelled successfully. All reversals processed.` });
  } catch (error) {
    console.error('Cancellation failed:', error);
    res.status(500).json({ error: 'Failed to cancel bill' });
  }
});

// GET warranties expiring in the next 30 days (default) or scoped by store_id
router.get('/warranty-expirations', authenticateToken, async (req, res) => {
  const { store_id } = req.query;
  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore;
  if (userRole === 'Employee') {
    targetStore = userStore;
  }

  let sql = `
    SELECT b.bill_id, b.created_at, b.warranty_expiry_date, b.total_amount,
           c.name as customer_name, c.mobile as customer_mobile,
           p.brand, p.frame_name
    FROM bills b
    JOIN customers c ON b.customer_id = c.customer_id
    LEFT JOIN products p ON b.frame_product_id = p.product_id
    WHERE b.warranty_expiry_date IS NOT NULL 
      AND b.warranty_expiry_date >= date('now')
      AND b.warranty_expiry_date <= date('now', '+30 days')
      AND b.bill_status = 'Active'
  `;
  const params = [];
  if (targetStore && targetStore !== 'all') {
    sql += ' AND b.store_id = ?';
    params.push(targetStore);
  }
  sql += ' ORDER BY b.warranty_expiry_date ASC';

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch warranty expirations' });
  }
});

module.exports = router;
