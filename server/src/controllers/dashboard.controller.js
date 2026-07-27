const { prisma } = require('../prisma');

exports.getMetrics = async (req, res) => {
  const { tenant_id } = req.user;
  
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayAgg, monthAgg, totalAgg, 
      todayCount, monthCount, totalCount,
      totalCustomers, stores, dueBillsCount, dueAmountAgg, undelivered, lowStock, birthdays
    ] = await Promise.all([
      prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id, created_at: { gte: today } } }),
      prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id, created_at: { gte: firstDayOfMonth } } }),
      prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id } }),
      prisma.bill.count({ where: { tenant_id, created_at: { gte: today } } }),
      prisma.bill.count({ where: { tenant_id, created_at: { gte: firstDayOfMonth } } }),
      prisma.bill.count({ where: { tenant_id } }),
      prisma.customer.count({ where: { tenant_id } }),
      prisma.store.findMany({ where: { tenant_id }, select: { store_id: true, store_name: true } }),
      prisma.bill.count({ where: { tenant_id, due_amount: { gt: 0 } } }),
      prisma.bill.aggregate({ _sum: { due_amount: true }, where: { tenant_id, due_amount: { gt: 0 } } }),
      prisma.bill.count({ where: { tenant_id, delivery_status: 'PENDING' } }),
      prisma.$queryRaw`SELECT COUNT(*) FROM products WHERE tenant_id = ${tenant_id} AND current_stock <= low_stock_alert AND status = 'ACTIVE'`,
      prisma.$queryRaw`SELECT COUNT(*) FROM customers WHERE tenant_id = ${tenant_id} AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)`
    ]);

    const lsCount = Number(lowStock[0].count);
    const bdCount = Number(birthdays[0].count);

    const revToday = Number(todayAgg._sum.total_amount || 0);
    const revMonth = Number(monthAgg._sum.total_amount || 0);
    const revTotal = Number(totalAgg._sum.total_amount || 0);
    const totalDue = Number(dueAmountAgg._sum.due_amount || 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const recentBillsForCharts = await prisma.bill.findMany({
      where: { tenant_id, created_at: { gte: sevenDaysAgo } }
    });

    const revenueMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      revenueMap[dayStr] = 0;
    }

    const categoryMap = { 'FRAMES': 0, 'SUNGLASSES': 0, 'CONTACT LENSES': 0, 'ACCESSORIES': 0 };

    recentBillsForCharts.forEach(b => {
      const dayStr = new Date(b.created_at).toLocaleDateString('en-US', { weekday: 'short' });
      if (revenueMap[dayStr] !== undefined) {
        revenueMap[dayStr] += Number(b.total_amount);
      }
      const cat = b.bill_type === 'SUNGLASSES' ? 'SUNGLASSES' : 'FRAMES';
      categoryMap[cat] += Number(b.total_amount);
    });

    const revenueTrend = Object.keys(revenueMap).map(day => ({ day, sales: revenueMap[day] }));
    const categorySplit = Object.keys(categoryMap).filter(k => categoryMap[k] > 0).map(name => ({ name, value: categoryMap[name] }));

    res.json({
      metrics: {
        today: { revenue: revToday, bills: todayCount },
        monthly: { revenue: revMonth, bills: monthCount },
        overall: { 
          revenue: revTotal, 
          bills: totalCount, 
          customers: totalCustomers,
          avgBill: totalCount > 0 ? revTotal / totalCount : 0
        },
        alerts: {
          totalDueAmount: totalDue,
          pendingDues: dueBillsCount,
          undelivered_orders: undelivered,
          low_stock_items: lsCount,
          expiringWarranties: 0,
          birthday_customers: bdCount
        },
        stores
      },
      charts: {
        revenueTrend,
        categorySplit
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getBirthdaysToday = async (req, res) => {
  const { tenant_id } = req.user;
  try {
    // In PostgreSQL, to find today's birthdays regardless of year:
    // We can fetch all and filter, or use raw SQL. For simplicity, fetch customers with birthdays and filter in JS if small,
    // or use a raw query.
    const customers = await prisma.$queryRaw`
      SELECT id, name, mobile, birthday 
      FROM customers 
      WHERE tenant_id = ${tenant_id} 
      AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
    `;
    res.json(customers);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getDuePayments = async (req, res) => {
  const { tenant_id } = req.user;
  try {
    const bills = await prisma.bill.findMany({
      where: { tenant_id, due_amount: { gt: 0 } },
      include: { customer: { select: { name: true, mobile: true } } },
      orderBy: { created_at: 'desc' }
    });
    const formatted = bills.map(b => ({
      ...b,
      bill_id: b.invoice_number, // UI expects invoice_number here
      customer_name: b.customer?.name || 'Unknown',
      customer_mobile: b.customer?.mobile || ''
    }));
    res.json(formatted);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getUndelivered = async (req, res) => {
  const { tenant_id } = req.user;
  try {
    const bills = await prisma.bill.findMany({
      where: { tenant_id, delivery_status: 'PENDING' },
      include: { customer: { select: { name: true, mobile: true } } },
      orderBy: { created_at: 'asc' }
    });
    const formatted = bills.map(b => {
      let brand = 'Unknown';
      let frameName = 'Item';
      if (b.lens_details && Array.isArray(b.lens_details) && b.lens_details.length > 0) {
        brand = b.lens_details[0].brand || 'Unknown';
        frameName = b.lens_details[0].product_name || 'Item';
      }
      return {
        ...b,
        bill_id: b.invoice_number,
        customer_name: b.customer?.name || 'Unknown',
        customer_mobile: b.customer?.mobile || '',
        brand,
        frame_name: frameName
      };
    });
    res.json(formatted);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getLowStock = async (req, res) => {
  const { tenant_id } = req.user;
  try {
    // Current stock <= low stock alert
    const products = await prisma.$queryRaw`
      SELECT id, barcode, product_name, brand, current_stock, low_stock_alert 
      FROM products 
      WHERE tenant_id = ${tenant_id} 
      AND current_stock <= low_stock_alert
      AND status = 'ACTIVE'
    `;
    res.json(products);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
