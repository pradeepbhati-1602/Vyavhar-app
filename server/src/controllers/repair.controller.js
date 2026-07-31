const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getStoreFilter, getTargetStoreId } = require('../middleware/tenantIsolation');

exports.getRepairs = async (req, res) => {
  const { tenant_id } = req.user;
  const { store_id, search } = req.query;
  const where = { tenant_id, ...getStoreFilter(req) };
  
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobile: { contains: search } } }
    ];
  }
  
  try {
    const repairs = await prisma.repairOrder.findMany({ 
      where, 
      orderBy: { created_at: 'desc' },
      include: { customer: true }
    });
    
    // Flatten customer details for frontend compatibility
    const formatted = repairs.map(r => ({
      ...r,
      repair_id: r.id,
      customer_name: r.customer.name,
      customer_mobile: r.customer.mobile
    }));
    
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createRepair = async (req, res) => {
  try {
    const { customer_name, mobile, frame_details, repair_type, charges, expected_date } = req.body;
    const tenant_id = req.user.tenant_id;
    
    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { tenant_id_mobile: { tenant_id, mobile } }
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { tenant_id, name: customer_name, mobile }
      });
    }

    let targetStoreId = getTargetStoreId(req);
    if (!targetStoreId || targetStoreId === 'all') {
      const defaultStore = await prisma.store.findFirst({ where: { tenant_id } });
      if (!defaultStore) throw new Error("No store found. Please create a store first.");
      targetStoreId = defaultStore.store_id;
    }

    const data = { 
      tenant_id,
      store_id: targetStoreId,
      customer_id: customer.id,
      frame_details,
      repair_type,
      charges: parseFloat(charges),
      expected_date: new Date(expected_date)
    };
    
    const repair = await prisma.repairOrder.create({ 
      data,
      include: { customer: true }
    });
    
    // Flatten customer details for frontend compatibility
    res.json({
      ...repair,
      repair_id: repair.id,
      customer_name: repair.customer.name,
      customer_mobile: repair.customer.mobile
    });
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
