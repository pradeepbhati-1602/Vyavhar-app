const express = require('express');
const router = express.Router();
const { getTenantDb, prisma } = require('../prisma');
const { requireTenantAuth, requireOwner } = require('../middleware/tenantIsolation');

// All store routes require tenant authentication
router.use(requireTenantAuth);

// 1. Get all stores for current tenant (both Owner and Employee can view)
router.get('/', async (req, res) => {
  try {
    const tenantDb = getTenantDb(req.tenant_id);
    const stores = await tenantDb.store.findMany({
      orderBy: { created_at: 'asc' }
    });
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Add new store (Owner only)
router.post('/', requireOwner, async (req, res) => {
  const { store_name, address, phone, gst_number, custom_receipt_footer } = req.body;
  if (!store_name) return res.status(400).json({ error: 'Store name is required' });

  try {
    // Check max stores limit
    const tenant = await prisma.tenant.findUnique({ where: { tenant_id: req.tenant_id } });
    if (tenant.max_stores !== null) {
      const storeCount = await prisma.store.count({ where: { tenant_id: req.tenant_id } });
      if (storeCount >= tenant.max_stores) {
        return res.status(403).json({ error: `You have reached your limit of ${tenant.max_stores} stores. Please upgrade your plan.` });
      }
    }

    const tenantDb = getTenantDb(req.tenant_id);
    const store = await tenantDb.store.create({
      data: {
        store_name,
        address,
        phone,
        gst_number,
        custom_receipt_footer
      }
    });
    res.status(201).json(store);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Update store (Owner only)
router.put('/:id', requireOwner, async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const tenantDb = getTenantDb(req.tenant_id);
    const updated = await tenantDb.store.update({
      where: { store_id: id },
      data
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Delete store (Owner only)
router.delete('/:id', requireOwner, async (req, res) => {
  const { id } = req.params;

  try {
    const tenantDb = getTenantDb(req.tenant_id);
    
    // Prevent deleting the last store
    const storeCount = await tenantDb.store.count();
    if (storeCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only remaining store.' });
    }

    await tenantDb.store.delete({
      where: { store_id: id }
    });
    res.json({ message: 'Store deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
