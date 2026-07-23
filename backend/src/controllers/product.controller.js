const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.lookupBarcode = async (req, res) => {
  try {
    const { code } = req.params;
    const tenant_id = req.user.tenant_id;
    const store_id = req.user.store_id || req.query.store_id; // Need store_id context

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required for product lookup' });
    }

    const product = await prisma.product.findUnique({
      where: {
        tenant_id_store_id_barcode: {
          tenant_id,
          store_id,
          barcode: code
        }
      }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Product barcode lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup product' });
  }
};

exports.adjustStock = async (req, res) => {
  const { tenant_id, user_id, store_id } = req.user;
  const { id } = req.params;
  const { adjustment_quantity, reason = 'Stock Adjustment' } = req.body;

  try {
    const qty = parseInt(adjustment_quantity, 10);
    if (isNaN(qty)) throw new Error('Invalid adjustment quantity');

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.tenant_id !== tenant_id) throw new Error('Product not found');

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          current_stock: { increment: qty },
          last_updated_date: new Date(),
          ...(qty > 0 ? { last_purchase_date: new Date() } : {})
        }
      });

      await tx.inventoryHistory.create({
        data: {
          tenant_id,
          store_id,
          product_id: product.id,
          added_quantity: qty,
          previous_stock: product.current_stock,
          new_stock: updatedProduct.current_stock,
          updated_by_id: user_id,
          reason
        }
      });

      return updatedProduct;
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
