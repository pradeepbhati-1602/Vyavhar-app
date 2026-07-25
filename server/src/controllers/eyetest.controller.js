const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getEyeTests = async (req, res) => {
  const { tenant_id } = req.user;
  const { store_id, search } = req.query;
  const where = { tenant_id };
  
  if (store_id && store_id !== 'all') where.store_id = store_id;
  if (search) {
    where.OR = [
      { customer_name: { contains: search, mode: 'insensitive' } },
      { customer_mobile: { contains: search } }
    ];
  }
  
  try {
    const tests = await prisma.eyeTest.findMany({ 
      where, 
      orderBy: { created_at: 'desc' }
    });
    res.json(tests);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createEyeTest = async (req, res) => {
  try {
    const data = { ...req.body, tenant_id: req.user.tenant_id };
    if (!data.store_id) data.store_id = req.user.store_id; // fallback
    const test = await prisma.eyeTest.create({ data });
    res.json(test);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateEyeTest = async (req, res) => {
  try {
    const data = { ...req.body };
    const test = await prisma.eyeTest.update({ where: { id: req.params.id }, data });
    res.json(test);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
