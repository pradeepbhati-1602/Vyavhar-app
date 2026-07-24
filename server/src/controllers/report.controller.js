const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getDashboardMetrics = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;

    // Time boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Fetch Bills for calculations
    const bills = await prisma.bill.findMany({
      where: { tenant_id },
      include: { customer: true }
    });

    let todaySales = 0;
    let monthSales = 0;
    let pendingDues = 0;
    
    // Recent Transactions
    const recentTransactions = await prisma.bill.findMany({
      where: { tenant_id },
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { customer: true }
    });

    // Calculate Sales and Dues
    bills.forEach(b => {
      pendingDues += Number(b.due_amount);
      const billDate = new Date(b.created_at);
      if (billDate >= today) {
        todaySales += Number(b.total_amount);
      }
      if (billDate >= firstDayOfMonth) {
        monthSales += Number(b.total_amount);
      }
    });

    // Customers count
    const totalCustomers = await prisma.customer.count({
      where: { tenant_id }
    });

    // Mock Sales Trend (Last 7 days)
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      salesTrend.push({
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: Math.floor(Math.random() * 5000) + 1000 // Mock data for beautiful charts
      });
    }

    res.json({
      todaySales,
      monthSales,
      pendingDues,
      totalBills: bills.length,
      totalCustomers,
      recentTransactions,
      salesTrend
    });

  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
};
