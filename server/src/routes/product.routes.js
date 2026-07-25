const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

const dashboardController = require('../controllers/dashboard.controller');

router.get('/barcode/:code', requireTenantAuth, productController.lookupBarcode);
router.get('/low-stock', requireTenantAuth, dashboardController.getLowStock);
router.post('/:id/adjust-stock', requireTenantAuth, productController.adjustStock);

router.get('/', requireTenantAuth, productController.getProducts);
router.post('/', requireTenantAuth, productController.createProduct);
router.put('/:id', requireTenantAuth, productController.updateProduct);
router.delete('/:id', requireTenantAuth, productController.deleteProduct);

module.exports = router;
