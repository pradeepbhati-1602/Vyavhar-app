const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

// GET /api/v1/products/barcode/:code
router.get('/barcode/:code', requireTenantAuth, productController.lookupBarcode);

// POST /api/v1/products/:id/adjust-stock
router.post('/:id/adjust-stock', requireTenantAuth, productController.adjustStock);

module.exports = router;
