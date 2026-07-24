const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { requireTenantAuth, requireFeature } = require('../middleware/tenantIsolation');

router.use(requireTenantAuth);
router.use(requireFeature('advanced_reports_enabled'));

// GET /api/v1/reports/dashboard
router.get('/dashboard', requireTenantAuth, reportController.getDashboardMetrics);

module.exports = router;
