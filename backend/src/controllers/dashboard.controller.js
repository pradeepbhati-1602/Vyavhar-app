const { prisma } = require('../prisma');

exports.getMetrics = async (req, res) => {
  const { tenant_id } = req.user;
  
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayBills, monthBills, totalBills, totalCustomers, 
      stores,
      dueBills, undelivered, lowStock, birthdays
    ] = await Promise.all([
      prisma.bill.findMany({ where: { tenant_id, created_at: { gte: today } } }),
      prisma.bill.findMany({ where: { tenant_id, created_at: { gte: firstDayOfMonth } } }),
      prisma.bill.findMany({ where: { tenant_id } }),
      prisma.customer.count({ where: { tenant_id } }),
      prisma.store.findMany({ where: { tenant_id }, select: { store_id: true, store_name: true } }),
      prisma.bill.count({ where: { tenant_id, due_amount: { gt: 0 } } }),
      prisma.bill.count({ where: { tenant_id, delivery_status: 'PENDING' } }),
      prisma.$queryRaw`SELECT COUNT(*) FROM products WHERE tenant_id = ${tenant_id} AND current_stock <= low_stock_alert AND status = 'ACTIVE'`,
      prisma.$queryRaw`SELECT COUNT(*) FROM customers WHERE tenant_id = ${tenant_id} AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)`
    ]);

    const sum = (bills) => bills.reduce((acc, b) => acc + Number(b.total_amount), 0);

    const lsCount = Number(lowStock[0].count);
    const bdCount = Number(birthdays[0].count);

    res.json({
      today: { revenue: sum(todayBills), bills: todayBills.length },
      monthly: { revenue: sum(monthBills), bills: monthBills.length },
      overall: { revenue: sum(totalBills), bills: totalBills.length, customers: totalCustomers },
      alerts: {
        due_customers: dueBills,
        undelivered_orders: undelivered,
        low_stock_items: lsCount,
        birthday_customers: bdCount
      },
      stores
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
    res.json(bills);
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
    res.json(bills);
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
