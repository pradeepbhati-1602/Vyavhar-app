const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { requireTenantAuth: requireAuth } = require('../middleware/tenantIsolation');

router.use(requireAuth);

router.get('/', dashboardController.getMetrics);
router.get('/comparison', dashboardController.getComparison || ((req, res) => res.json({})));
router.get('/due-payments', dashboardController.getDuePayments);
router.get('/undelivered', dashboardController.getUndelivered);

module.exports = router;
