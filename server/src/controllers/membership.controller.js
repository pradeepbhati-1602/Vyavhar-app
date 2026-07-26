const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all Membership Plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: { tenant_id: req.user.tenant_id }
    });
    res.json(plans);
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
        valid_until: { gt: new Date() }
      },
      include: { plan: true },
      orderBy: { created_at: 'desc' }
    });
    
    if (!membership) return res.status(404).json({ error: 'No active membership found' });
    res.json(membership);
  } catch (error) {
    console.error('Get Active Membership Error:', error);
    res.status(500).json({ error: 'Failed to fetch active membership' });
  }
};

// Create a new Membership Plan (Tier)
exports.createPlan = async (req, res) => {
  try {
    const { tier_name, discount_percent, validity_days } = req.body;
    const tenant_id = req.user.tenant_id;

    const plan = await prisma.membershipPlan.create({
      data: {
        tenant_id,
        tier_name,
        discount_percent,
        validity_days
      }
    });

    res.status(201).json({ message: 'Membership plan created', plan });
  } catch (error) {
    console.error('Create Plan Error:', error);
    res.status(500).json({ error: 'Failed to create membership plan' });
  }
};

// Assign Membership to Customer
exports.assignMembership = async (req, res) => {
  try {
    const { customer_id, plan_id } = req.body;
    const tenant_id = req.user.tenant_id;

    // Verify Plan exists and belongs to tenant
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: plan_id, tenant_id }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Membership plan not found' });
    }

    // Verify Customer exists and belongs to tenant
    const customer = await prisma.customer.findUnique({
      where: { id: customer_id, tenant_id }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Calculate expiry date
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + plan.validity_days);

    // Create Customer Membership
    const membership = await prisma.customerMembership.create({
      data: {
        tenant_id,
        customer_id,
        plan_id,
        valid_until: validUntil,
        status: 'ACTIVE'
      }
    });

    res.status(201).json({ message: 'Membership assigned successfully', membership });
  } catch (error) {
    console.error('Assign Membership Error:', error);
    res.status(500).json({ error: 'Failed to assign membership' });
  }
};
