const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all Membership Plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: { tenant_id: req.user.tenant_id }
    });
    
    // Map to frontend expectations
    const mappedPlans = plans.map(p => ({
      ...p,
      plan_id: p.id,
      plan_name: p.name,
      price: p.price,
      duration_days: p.duration_days,
      discount_percent: p.discount_percent,
      perks: p.perks
    }));
    
    res.json(mappedPlans);
  } catch (error) {
    console.error('Get Plans Error:', error);
    res.status(500).json({ error: 'Failed to fetch membership plans' });
  }
};

// Get active membership for a customer
exports.getActiveMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const membership = await prisma.customerMembership.findFirst({
      where: { 
        tenant_id: req.user.tenant_id,
        customer_id: id,
        status: 'ACTIVE',
        expiry_date: { gt: new Date() }
      },
      include: { plan: true },
      orderBy: { created_at: 'desc' }
    });
    
    if (!membership) return res.status(404).json({ error: 'No active membership found' });
    
    // Map to frontend expectations
    const mappedMembership = {
      ...membership,
      plan_name: membership.plan.name,
      discount_percent: membership.plan.discount_percent
    };
    
    res.json(mappedMembership);
  } catch (error) {
    console.error('Get Active Membership Error:', error);
    res.status(500).json({ error: 'Failed to fetch active membership' });
  }
};

// Create a new Membership Plan
exports.createPlan = async (req, res) => {
  try {
    const { name, price, duration_days, discount_percent, perks } = req.body;
    const tenant_id = req.user.tenant_id;

    const plan = await prisma.membershipPlan.create({
      data: {
        tenant_id,
        name,
        price,
        duration_days: parseInt(duration_days),
        discount_percent: parseFloat(discount_percent),
        perks
      }
    });

    res.status(201).json({ message: 'Membership plan created', plan });
  } catch (error) {
    console.error('Create Plan Error:', error);
    res.status(500).json({ error: 'Failed to create membership plan' });
  }
};

// Delete a Membership Plan
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user.tenant_id;

    const plan = await prisma.membershipPlan.findFirst({ where: { id, tenant_id } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    await prisma.membershipPlan.delete({ where: { id } });
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Delete Plan Error:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
};

// Assign Membership to Customer
exports.assignMembership = async (req, res) => {
  try {
    const { customer_id, plan_id } = req.body;
    const tenant_id = req.user.tenant_id;

    const plan = await prisma.membershipPlan.findFirst({
      where: { id: plan_id, tenant_id }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Membership plan not found' });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customer_id, tenant_id }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const start_date = new Date();
    const expiry_date = new Date();
    expiry_date.setDate(expiry_date.getDate() + plan.duration_days);

    const membership = await prisma.customerMembership.create({
      data: {
        tenant_id,
        customer_id,
        membership_plan_id: plan_id,
        start_date,
        expiry_date,
        status: 'ACTIVE'
      }
    });

    res.status(201).json({ message: 'Membership assigned successfully', membership });
  } catch (error) {
    console.error('Assign Membership Error:', error);
    res.status(500).json({ error: 'Failed to assign membership' });
  }
};

// Delete active membership of a customer
exports.deleteMembership = async (req, res) => {
  try {
    const { id } = req.params; // customer_id
    const tenant_id = req.user.tenant_id;

    // Find active membership
    const membership = await prisma.customerMembership.findFirst({
      where: {
        tenant_id,
        customer_id: id,
        status: 'ACTIVE'
      }
    });

    if (!membership) return res.status(404).json({ error: 'No active membership found' });

    await prisma.customerMembership.delete({ where: { id: membership.id } });
    res.json({ success: true, message: 'Membership revoked successfully' });
  } catch (error) {
    console.error('Delete Membership Error:', error);
    res.status(500).json({ error: 'Failed to revoke membership' });
  }
};
