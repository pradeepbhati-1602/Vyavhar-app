const express = require('express');
const router = express.Router();
const billController = require('../controllers/bill.controller');
const {  requireTenantAuth: requireAuth  } = require('../middleware/tenantIsolation');
const { requireFeature } = require('../middleware/featureGuard');

router.use(requireAuth);
router.use(requireFeature('billing'));

router.get('/', billController.getBills);
router.post('/', billController.createBill);
router.post('/:id/cancel', billController.cancelBill);
router.put('/:id/deliver', billController.markDelivered);
router.put('/:id/collect-payment', billController.collectPayment);

module.exports = router;
