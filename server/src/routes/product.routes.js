const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const {  requireTenantAuth  } = require('../middleware/tenantIsolation');
const { requireFeature } = require('../middleware/featureGuard');

const dashboardController = require('../controllers/dashboard.controller');

router.get('/barcode/:code', requireTenantAuth, requireFeature('product_management'), productController.lookupBarcode);
router.get('/low-stock', requireTenantAuth, requireFeature('product_management'), dashboardController.getLowStock);
router.post('/:id/adjust-stock', requireTenantAuth, requireFeature('product_management'), productController.adjustStock);

router.get('/', requireTenantAuth, requireFeature('product_management'), productController.getProducts);
router.post('/', requireTenantAuth, requireFeature('product_management'), productController.createProduct);
router.put('/:id', requireTenantAuth, requireFeature('product_management'), productController.updateProduct);
router.delete('/:id', requireTenantAuth, requireFeature('product_management'), productController.deleteProduct);

module.exports = router;
