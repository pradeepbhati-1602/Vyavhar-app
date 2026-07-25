const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getRepairs = async (req, res) => {
  const { tenant_id } = req.user;
  const { store_id, search } = req.query;
  const where = { tenant_id };
  
  if (store_id && store_id !== 'all') where.store_id = store_id;
  if (search) {
    where.OR = [
      { order_number: { contains: search, mode: 'insensitive' } },
      { customer_name: { contains: search, mode: 'insensitive' } },
      { customer_mobile: { contains: search } }
    ];
  }
  
  try {
    const repairs = await prisma.repairOrder.findMany({ 
      where, 
      orderBy: { created_at: 'desc' }
    });
    res.json(repairs);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createRepair = async (req, res) => {
  try {
    const data = { ...req.body, tenant_id: req.user.tenant_id };
    if (!data.store_id) data.store_id = req.user.store_id; // fallback
    if (data.estimated_cost) data.estimated_cost = parseFloat(data.estimated_cost);
    if (data.advance_paid) data.advance_paid = parseFloat(data.advance_paid);
    const repair = await prisma.repairOrder.create({ data });
    res.json(repair);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateRepair = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.estimated_cost) data.estimated_cost = parseFloat(data.estimated_cost);
    if (data.advance_paid) data.advance_paid = parseFloat(data.advance_paid);
    const repair = await prisma.repairOrder.update({ where: { id: req.params.id }, data });
    res.json(repair);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
