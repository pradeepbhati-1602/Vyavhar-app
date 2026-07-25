const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

const dashboardController = require('../controllers/dashboard.controller');

router.get('/barcode/:code', requireTenantAuth, productController.lookupBarcode);
router.get('/low-stock', requireTenantAuth, dashboardController.getLowStock);
router.post('/:id/adjust-stock', requireTenantAuth, productController.adjustStock);

router.get('/', requireTenantAuth, (req, res) => res.json([]));
router.post('/', requireTenantAuth, (req, res) => res.json({}));
router.put('/:id', requireTenantAuth, (req, res) => res.json({}));
router.delete('/:id', requireTenantAuth, (req, res) => res.json({}));

module.exports = router;
