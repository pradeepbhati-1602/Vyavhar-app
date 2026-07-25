const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.lookupCustomer = async (req, res) => {
  try {
    const { mobile } = req.params;
    const tenant_id = req.user.tenant_id;

    const customer = await prisma.customer.findUnique({
      where: {
        tenant_id_mobile: {
          tenant_id,
          mobile
        }
      },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { plan: true }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Customer lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup customer' });
  }
};

exports.getCustomers = async (req, res) => {
  const { search } = req.query;
  const where = { tenant_id: req.user.tenant_id };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search } }
    ];
  }
  try {
    const customers = await prisma.customer.findMany({ where, orderBy: { created_at: 'desc' }, include: { memberships: true } });
    res.json(customers);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createCustomer = async (req, res) => {
  try {
    const data = { ...req.body, tenant_id: req.user.tenant_id };
    if (data.birthday) data.birthday = new Date(data.birthday);
    const customer = await prisma.customer.create({ data });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateCustomer = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.birthday) data.birthday = new Date(data.birthday);
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getReferrals = async (req, res) => {
  try {
    const members = await prisma.referralMember.findMany({ where: { tenant_id: req.user.tenant_id }, include: { customer: true } });
    res.json(members);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createReferral = async (req, res) => {
  try {
    const { customer_name, mobile } = req.body;
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

    // Generate code
    const referral_code = (customer_name.substring(0, 3).toUpperCase() + mobile.substring(mobile.length - 4)).replace(/[^A-Z0-9]/g, '');

    const referral = await prisma.referralMember.create({ 
      data: {
        tenant_id,
        customer_id: customer.id,
        referral_code
      },
      include: { customer: true }
    });
    res.json(referral);
  } catch (err) { 
    if (err.code === 'P2002') return res.status(400).json({ error: 'Referral member already exists' });
    res.status(500).json({ error: err.message }); 
  }
};

exports.bulkImport = async (req, res) => {
  res.json({ message: 'Not fully implemented yet, but route is active!' });
};
