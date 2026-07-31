const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getStoreFilter } = require('../middleware/tenantIsolation');

exports.getTransfers = async (req, res) => {
  const { tenant_id } = req.user;
  const { store_id } = getStoreFilter(req);
  const where = { tenant_id };
  
  if (store_id) {
    where.OR = [
      { from_store_id: store_id },
      { to_store_id: store_id }
    ];
  }
  
  try {
    const transfers = await prisma.inventoryTransfer.findMany({ 
      where, 
      orderBy: { created_at: 'desc' },
      include: { product: true }
    });
    res.json(transfers);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createTransfer = async (req, res) => {
  try {
    const data = { ...req.body, tenant_id: req.user.tenant_id, transferred_by_id: req.user.id };
    if (data.quantity) data.quantity = parseInt(data.quantity);
    
    // In a real app, this should be a transaction that decrements from source and increments to destination
    // For now, we just record the transfer to make the frontend work
    const transfer = await prisma.inventoryTransfer.create({ data });
    res.json(transfer);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateTransferStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const transfer = await prisma.inventoryTransfer.update({ 
      where: { id: req.params.id }, 
      data: { status } 
    });
    res.json(transfer);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
