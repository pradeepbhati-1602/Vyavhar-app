const express = require('express');
const router = express.Router();
const billController = require('../controllers/bill.controller');
const { requireTenantAuth: requireAuth } = require('../middleware/tenantIsolation');

router.use(requireAuth);

router.get('/', billController.getBills);
router.post('/', billController.createBill);
router.post('/:id/cancel', billController.cancelBill);
router.post('/:id/mark-delivered', billController.markDelivered);
router.post('/:id/collect-payment', billController.collectPayment);

module.exports = router;
