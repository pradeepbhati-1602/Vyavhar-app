const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenant.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

// GET /api/v1/tenant/profile
router.get('/profile', requireTenantAuth, tenantController.getProfile);

// PUT /api/v1/tenant/profile
router.put('/profile', requireTenantAuth, tenantController.updateProfile);

module.exports = router;
