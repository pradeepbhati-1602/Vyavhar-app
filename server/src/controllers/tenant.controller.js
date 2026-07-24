const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getProfile = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const tenant = await prisma.tenant.findUnique({
      where: { tenant_id: tenant_id }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { business_name, address, contact_phone } = req.body;

    const updatedTenant = await prisma.tenant.update({
      where: { tenant_id: tenant_id },
      data: {
        business_name,
        address,
        contact_phone
      }
    });

    res.json({ message: 'Profile updated successfully', tenant: updatedTenant });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
