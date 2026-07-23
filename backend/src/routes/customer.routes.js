const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

// GET /api/v1/customers/lookup/:mobile
router.get('/lookup/:mobile', requireTenantAuth, customerController.lookupCustomer);

module.exports = router;
