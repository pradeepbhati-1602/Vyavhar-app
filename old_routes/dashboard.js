const express = require('express');
const router = express.Router();
const { dbGet, dbAll } = require('../db');
const { authenticateToken, requireRole } = require('./auth');

// ── GET main dashboard metrics ────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const todayStr  = new Date().toISOString().split('T')[0];
    const monthStr  = todayStr.substring(0, 7);

    const { store_id } = req.query;
    const userStore = req.user ? req.user.store_id : null;
    const userRole = req.user ? req.user.role : 'Employee';
    let targetStore = store_id || userStore;
    if (userRole === 'Employee') {
      targetStore = userStore;
    }

    // 1. Today's stats
    let todayQuery = `
      SELECT COUNT(bill_id) as billsCount,
             COALESCE(SUM(total_amount), 0.00) as revenue,
             COUNT(DISTINCT customer_id) as customersCount
      FROM bills
      WHERE date(created_at, 'localtime') = date('now', 'localtime') AND bill_status = 'Active'
    `;
    const paramsToday = [];
    if (targetStore && targetStore !== 'all') {
      todayQuery += ' AND store_id = ?';
      paramsToday.push(targetStore);
    }
    const todayStats = await dbGet(todayQuery, paramsToday);

    // 2. Monthly stats
    let monthlyQuery = `
      SELECT COUNT(bill_id) as billsCount,
             COALESCE(SUM(total_amount), 0.00) as revenue,
             COUNT(DISTINCT customer_id) as customersCount
      FROM bills
      WHERE strftime('%Y-%m', created_at, 'localtime') = ? AND bill_status = 'Active'
    `;
    const paramsMonthly = [monthStr];
    if (targetStore && targetStore !== 'all') {
      monthlyQuery += ' AND store_id = ?';
      paramsMonthly.push(targetStore);
    }
    const monthlyStats = await dbGet(monthlyQuery, paramsMonthly);

    // 3. Overall stats
    let overallQuery = `SELECT COUNT(bill_id) as billsCount, COALESCE(SUM(total_amount), 0.00) as revenue FROM bills WHERE bill_status = 'Active'`;
    const paramsOverall = [];
    if (targetStore && targetStore !== 'all') {
      overallQuery += ' AND store_id = ?';
      paramsOverall.push(targetStore);
    }
    const overallStats = await dbGet(overallQuery, paramsOverall);
    
    // Total customers (global for business, or store-filtered to customers who purchased in targetStore)
    let totalCustomersQuery = 'SELECT COUNT(*) as count FROM customers';
    const paramsCustomers = [];
    if (targetStore && targetStore !== 'all') {
      totalCustomersQuery = "SELECT COUNT(DISTINCT customer_id) as count FROM bills WHERE bill_status = 'Active' AND store_id = ?";
      paramsCustomers.push(targetStore);
    }
    const totalCustomers = await dbGet(totalCustomersQuery, paramsCustomers);

    const overallRevenue = parseFloat(overallStats.revenue);
    const overallBills   = parseInt(overallStats.billsCount);
    const avgBillValue   = overallBills > 0 ? (overallRevenue / overallBills) : 0.00;

    // 4. Alert counts
    let lowStockQuery = "SELECT COUNT(*) as count FROM products WHERE current_stock <= low_stock_limit AND status = 'Active'";
    const paramsLowStock = [];
    if (targetStore && targetStore !== 'all') {
      lowStockQuery += ' AND store_id = ?';
      paramsLowStock.push(targetStore);
    }
    const lowStock = await dbGet(lowStockQuery, paramsLowStock);

    const birthdayCount = await dbGet(`SELECT COUNT(*) as count FROM customers WHERE strftime('%m-%d', birthday) = strftime('%m-%d', 'now', 'localtime')`);

    let pendingRepairsQuery = `SELECT COUNT(*) as count FROM repair_orders WHERE repair_status = 'Ready' AND delivery_status != 'Delivered'`;
    const paramsRepairs = [];
    if (targetStore && targetStore !== 'all') {
      pendingRepairsQuery += ' AND store_id = ?';
      paramsRepairs.push(targetStore);
    }
    const pendingRepairs = await dbGet(pendingRepairsQuery, paramsRepairs);

    let pendingDuesQuery = `SELECT COUNT(*) as count FROM bills WHERE due_amount > 0 AND bill_status = 'Active'`;
    const paramsDuesCount = [];
    if (targetStore && targetStore !== 'all') {
      pendingDuesQuery += ' AND store_id = ?';
      paramsDuesCount.push(targetStore);
    }
    const pendingDuesCount = await dbGet(pendingDuesQuery, paramsDuesCount);

    let totalDueQuery = `SELECT COALESCE(SUM(due_amount), 0) as total FROM bills WHERE due_amount > 0 AND bill_status = 'Active'`;
    const paramsDueAmount = [];
    if (targetStore && targetStore !== 'all') {
      totalDueQuery += ' AND store_id = ?';
      paramsDueAmount.push(targetStore);
    }
    const totalDueAmount = await dbGet(totalDueQuery, paramsDueAmount);

    let undeliveredQuery = `SELECT COUNT(*) as count FROM bills WHERE delivery_status = 'Pending' AND bill_status = 'Active'`;
    const paramsUndelivered = [];
    if (targetStore && targetStore !== 'all') {
      undeliveredQuery += ' AND store_id = ?';
      paramsUndelivered.push(targetStore);
    }
    const undeliveredOrders = await dbGet(undeliveredQuery, paramsUndelivered);

    // 4b. Expiring warranties count (next 30 days)
    let expiringWarrantiesQuery = `
      SELECT COUNT(*) as count FROM bills 
      WHERE warranty_expiry_date IS NOT NULL 
        AND warranty_expiry_date >= date('now')
        AND warranty_expiry_date <= date('now', '+30 days')
        AND bill_status = 'Active'
    `;
    const paramsWarranties = [];
    if (targetStore && targetStore !== 'all') {
      expiringWarrantiesQuery += ' AND store_id = ?';
      paramsWarranties.push(targetStore);
    }
    const expiringWarranties = await dbGet(expiringWarrantiesQuery, paramsWarranties);

    // 5. Revenue trend (last 7 days)
    let trendQuery = `
      SELECT date(created_at, 'localtime') as day, COALESCE(SUM(total_amount), 0.00) as sales
      FROM bills
      WHERE bill_status = 'Active' AND date(created_at, 'localtime') >= date('now', '-7 days', 'localtime')
    `;
    const paramsTrend = [];
    if (targetStore && targetStore !== 'all') {
      trendQuery += ' AND store_id = ?';
      paramsTrend.push(targetStore);
    }
    trendQuery += ' GROUP BY day ORDER BY day ASC';
    const trendData = await dbAll(trendQuery, paramsTrend);

    const last7DaysTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayString = d.toISOString().split('T')[0];
      const match = trendData.find(t => t.day === dayString);
      last7DaysTrend.push({
        day: new Date(dayString).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        sales: match ? parseFloat(match.sales) : 0.00
      });
    }

    // 6. Category-wise sales split
    let categoryQuery = `
      SELECT COALESCE(p.category, 'Lens / Others') as category,
             COUNT(b.bill_id) as salesCount,
             COALESCE(SUM(b.total_amount), 0.00) as revenue
      FROM bills b
      LEFT JOIN products p ON b.frame_product_id = p.product_id
      WHERE b.bill_status = 'Active'
    `;
    const paramsCategory = [];
    if (targetStore && targetStore !== 'all') {
      categoryQuery += ' AND b.store_id = ?';
      paramsCategory.push(targetStore);
    }
    categoryQuery += ' GROUP BY category';
    const categorySplit = await dbAll(categoryQuery, paramsCategory);

    res.json({
      metrics: {
        today:   { revenue: parseFloat(todayStats.revenue),   bills: parseInt(todayStats.billsCount),   customers: parseInt(todayStats.customersCount) },
        monthly: { revenue: parseFloat(monthlyStats.revenue), bills: parseInt(monthlyStats.billsCount), customers: parseInt(monthlyStats.customersCount) },
        overall: { revenue: overallRevenue, bills: overallBills, customers: totalCustomers.count, avgBill: avgBillValue },
        alerts: {
          lowStock:        lowStock.count,
          birthdays:       birthdayCount.count,
          pendingRepairs:  pendingRepairs.count,
          pendingDues:     pendingDuesCount.count,
          totalDueAmount:  parseFloat(totalDueAmount.total),
          undeliveredOrders: undeliveredOrders.count,
          expiringWarranties: expiringWarranties.count
        }
      },
      charts: {
        revenueTrend: last7DaysTrend,
        categorySplit: categorySplit.map(c => ({ name: c.category, value: parseFloat(c.revenue) }))
      }
    });

  } catch (error) {
    console.error('Dashboard aggregation failed:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard insights' });
  }
});

// ── GET Due Payments list ─────────────────────────────────────────────────
router.get('/dues', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    const userStore = req.user ? req.user.store_id : null;
    const userRole = req.user ? req.user.role : 'Employee';
    let targetStore = store_id || userStore;
    if (userRole === 'Employee') {
      targetStore = userStore;
    }

    let sql = `
      SELECT b.bill_id, b.due_amount, b.total_amount, b.created_at, b.payment_status,
             c.name as customer_name, c.mobile as customer_mobile,
             p.brand, p.frame_name
      FROM bills b
      JOIN customers c ON b.customer_id = c.customer_id
      LEFT JOIN products p ON b.frame_product_id = p.product_id
      WHERE b.due_amount > 0 AND b.bill_status = 'Active'
    `;
    const params = [];
    if (targetStore && targetStore !== 'all') {
      sql += ' AND b.store_id = ?';
      params.push(targetStore);
    }
    sql += ' ORDER BY b.due_amount DESC';

    const dues = await dbAll(sql, params);
    const totalDue = dues.reduce((sum, r) => sum + parseFloat(r.due_amount), 0);
    res.json({ dues, totalDue });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dues' });
  }
});

// ── GET Undelivered Orders list ───────────────────────────────────────────
router.get('/undelivered', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    const userStore = req.user ? req.user.store_id : null;
    const userRole = req.user ? req.user.role : 'Employee';
    let targetStore = store_id || userStore;
    if (userRole === 'Employee') {
      targetStore = userStore;
    }

    let sql = `
      SELECT b.bill_id, b.created_at, b.total_amount, b.due_amount, b.delivery_status,
             b.bill_type, b.lens_details, b.power_details,
             c.name as customer_name, c.mobile as customer_mobile,
             p.brand, p.frame_name, p.frame_color
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

    const orders = await dbAll(sql, params);
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch undelivered orders' });
  }
});

// ── GET Birthday customers today ──────────────────────────────────────────
router.get('/birthdays', authenticateToken, async (req, res) => {
  try {
    const customers = await dbAll(`
      SELECT customer_id, name, mobile, birthday, language
      FROM customers
      WHERE strftime('%m-%d', birthday) = strftime('%m-%d', 'now', 'localtime')
      ORDER BY name ASC
    `);
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch birthday customers' });
  }
});

// ── GET Inactive customers ────────────────────────────────────────────────
router.get('/inactive', authenticateToken, async (req, res) => {
  try {
    const setting = await dbGet("SELECT value FROM settings WHERE key = 'inactive_customer_days'");
    const days = parseInt(setting ? setting.value : '45');

    const customers = await dbAll(`
      SELECT customer_id, name, mobile, last_visit, total_bills, total_purchase
      FROM customers
      WHERE last_visit < datetime('now', '-${days} days', 'localtime')
         OR last_visit IS NULL
      ORDER BY last_visit ASC
    `);
    res.json({ days, customers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch inactive customers' });
  }
});

// GET store comparison metrics (Owner role only)
router.get('/comparison', authenticateToken, requireRole('Owner'), async (req, res) => {
  try {
    const stores = await dbAll('SELECT store_id, store_name FROM stores');
    const comparison = [];

    for (const store of stores) {
      // Today stats
      const today = await dbGet(`
        SELECT COALESCE(SUM(total_amount), 0.00) as revenue, COUNT(bill_id) as bills
        FROM bills
        WHERE store_id = ? AND date(created_at, 'localtime') = date('now', 'localtime') AND bill_status = 'Active'
      `, [store.store_id]);

      // Monthly stats
      const monthly = await dbGet(`
        SELECT COALESCE(SUM(total_amount), 0.00) as revenue, COUNT(bill_id) as bills
        FROM bills
        WHERE store_id = ? AND strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime') AND bill_status = 'Active'
      `, [store.store_id]);

      // Overall stats
      const overall = await dbGet(`
        SELECT COALESCE(SUM(total_amount), 0.00) as revenue, COUNT(bill_id) as bills
        FROM bills
        WHERE store_id = ? AND bill_status = 'Active'
      `, [store.store_id]);

      const rev = parseFloat(overall.revenue);
      const bcount = parseInt(overall.bills);
      const aov = bcount > 0 ? (rev / bcount) : 0.00;

      comparison.push({
        store_id: store.store_id,
        store_name: store.store_name,
        today: { revenue: parseFloat(today.revenue), bills: today.bills },
        monthly: { revenue: parseFloat(monthly.revenue), bills: monthly.bills },
        overall: { revenue: rev, bills: bcount, aov: aov }
      });
    }

    res.json(comparison);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch store comparison' });
  }
});

module.exports = router;
