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
          user_id,
          change_type: 'ADJUSTMENT',
          quantity_changed: qty,
          new_stock: product.current_stock + qty,
          reason
        }
      });

      return updatedProduct;
    });

    res.json(result);
  } catch (error) {
    console.error('Stock adjustment error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  const { tenant_id } = req.user;
  const { category, search, store_id } = req.query;
  const where = { tenant_id, status: 'ACTIVE' };
  
  if (category && category !== 'All') where.category = category.toUpperCase().replace(' ', '_');
  if (store_id && store_id !== 'all') where.store_id = store_id;
  if (search) {
    where.OR = [
      { brand: { contains: search, mode: 'insensitive' } },
      { product_name: { contains: search, mode: 'insensitive' } },
      { barcode: search }
    ];
  }
  
  try {
    const products = await prisma.product.findMany({ where, orderBy: { created_at: 'desc' } });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createProduct = async (req, res) => {
  try {
    const { 
      barcode, category, brand, frame_name, product_name, 
      color, frame_color, size, purchase_price, selling_price, 
      opening_stock, current_stock, low_stock_limit, low_stock_alert, supplier_name, supplier
    } = req.body;

    let targetStoreId = req.body.store_id || req.user.store_id;
    if (!targetStoreId || targetStoreId === 'all') {
      const defaultStore = await prisma.store.findFirst({ where: { tenant_id: req.user.tenant_id } });
      if (!defaultStore) throw new Error("No store found. Please create a store first.");
      targetStoreId = defaultStore.store_id;
    }

    const data = { 
      tenant_id: req.user.tenant_id,
      store_id: targetStoreId,
      barcode,
      category: category ? category.toUpperCase().replace(' ', '_') : 'FRAMES',
      brand,
      product_name: product_name || frame_name,
      color: color || frame_color,
      size,
      purchase_price: parseFloat(purchase_price || 0),
      selling_price: parseFloat(selling_price || 0),
      opening_stock: parseInt(opening_stock || current_stock || 0),
      current_stock: parseInt(current_stock || opening_stock || 0),
      low_stock_alert: parseInt(low_stock_alert || low_stock_limit || 5),
      supplier_name: supplier_name || supplier
    };
    
    const product = await prisma.product.create({ data });
    res.json(product);
  } catch (err) { 
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A product with this barcode already exists for this store.' });
    }
    res.status(500).json({ error: err.message }); 
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.category) data.category = data.category.toUpperCase().replace(' ', '_');
    if (data.price) data.price = parseFloat(data.price);
    if (data.current_stock) data.current_stock = parseInt(data.current_stock);
    if (data.low_stock_limit) data.low_stock_limit = parseInt(data.low_stock_limit);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { status: 'DISCONTINUED' } });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
