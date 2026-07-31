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
    const qty = data.quantity;

    if (!data.from_store_id || !data.to_store_id || !data.product_id || !qty) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transfer = await prisma.$transaction(async (tx) => {
      // 1. Get source product
      const sourceProduct = await tx.product.findFirst({
        where: { tenant_id: data.tenant_id, store_id: data.from_store_id, id: data.product_id }
      });

      if (!sourceProduct || sourceProduct.current_stock < qty) {
        throw new Error('Insufficient stock in source store');
      }

      // 2. Decrement source stock
      const updatedSource = await tx.product.update({
        where: { id: sourceProduct.id },
        data: { current_stock: { decrement: qty } }
      });

      // 3. Create history for source
      await tx.inventoryHistory.create({
        data: {
          tenant_id: data.tenant_id,
          store_id: data.from_store_id,
          product_id: sourceProduct.id,
          added_quantity: -qty,
          previous_stock: sourceProduct.current_stock,
          new_stock: updatedSource.current_stock,
          updated_by_id: data.transferred_by_id,
          reason: 'Transfer Out'
        }
      });

      // 4. Find or create destination product
      let destProduct = await tx.product.findFirst({
        where: { tenant_id: data.tenant_id, store_id: data.to_store_id, barcode: sourceProduct.barcode }
      });

      let previousDestStock = 0;
      if (destProduct) {
        previousDestStock = destProduct.current_stock;
        destProduct = await tx.product.update({
          where: { id: destProduct.id },
          data: { current_stock: { increment: qty } }
        });
      } else {
        destProduct = await tx.product.create({
          data: {
            tenant_id: data.tenant_id,
            store_id: data.to_store_id,
            product_name: sourceProduct.product_name,
            category: sourceProduct.category,
            brand: sourceProduct.brand,
            barcode: sourceProduct.barcode,
            purchase_price: sourceProduct.purchase_price,
            selling_price: sourceProduct.selling_price,
            opening_stock: qty,
            current_stock: qty,
            low_stock_alert: sourceProduct.low_stock_alert,
            status: sourceProduct.status,
            color: sourceProduct.color,
            size: sourceProduct.size
          }
        });
      }

      // 5. Create history for destination
      await tx.inventoryHistory.create({
        data: {
          tenant_id: data.tenant_id,
          store_id: data.to_store_id,
          product_id: destProduct.id,
          added_quantity: qty,
          previous_stock: previousDestStock,
          new_stock: destProduct.current_stock,
          updated_by_id: data.transferred_by_id,
          reason: 'Transfer In'
        }
      });

      // 6. Record transfer
      return tx.inventoryTransfer.create({
        data: {
          tenant_id: data.tenant_id,
          from_store_id: data.from_store_id,
          to_store_id: data.to_store_id,
          product_id: sourceProduct.id,
          quantity: qty,
          status: 'COMPLETED',
          transferred_by_id: data.transferred_by_id,
          notes: data.notes
        }
      });
    });

    res.json(transfer);
  } catch (err) { res.status(400).json({ error: err.message }); }
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
