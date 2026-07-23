const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

// GET /api/v1/reports/dashboard
router.get('/dashboard', requireTenantAuth, reportController.getDashboardMetrics);

module.exports = router;
