const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);

router.get('/metrics', dashboardController.getMetrics);
router.get('/birthdays-today', dashboardController.getBirthdaysToday);
router.get('/due-payments', dashboardController.getDuePayments);
router.get('/undelivered', dashboardController.getUndelivered);
router.get('/low-stock', dashboardController.getLowStock);

module.exports = router;
