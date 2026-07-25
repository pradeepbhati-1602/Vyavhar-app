const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getEyeTests = async (req, res) => {
  const { tenant_id } = req.user;
  const { store_id, search } = req.query;
  const where = { tenant_id };
  
  if (store_id && store_id !== 'all') where.store_id = store_id;
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobile: { contains: search } } }
    ];
  }
  
  try {
    const tests = await prisma.eyeTest.findMany({ 
      where, 
      orderBy: { created_at: 'desc' },
      include: { customer: true }
    });
    
    // Flatten customer details for frontend compatibility
    const formatted = tests.map(t => ({
      ...t,
      patient_name: t.customer.name,
      mobile: t.customer.mobile
    }));
    
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createEyeTest = async (req, res) => {
  try {
    const { patient_name, mobile, ...rest } = req.body;
    const tenant_id = req.user.tenant_id;
    
    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { tenant_id_mobile: { tenant_id, mobile } }
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { tenant_id, name: patient_name, mobile }
      });
    }

    const data = { 
      ...rest,
      tenant_id,
      customer_id: customer.id,
      store_id: req.body.store_id || req.user.store_id
    };
    
    const test = await prisma.eyeTest.create({ 
      data,
      include: { customer: true }
    });
    
    // Flatten customer details
    res.json({
      ...test,
      patient_name: test.customer.name,
      mobile: test.customer.mobile
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateEyeTest = async (req, res) => {
  try {
    const data = { ...req.body };
    const test = await prisma.eyeTest.update({ where: { id: req.params.id }, data });
    res.json(test);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
