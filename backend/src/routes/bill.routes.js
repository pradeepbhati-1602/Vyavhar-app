const express = require('express');
const router = express.Router();
const billController = require('../controllers/bill.controller');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);

router.post('/', billController.createBill);
router.post('/:id/cancel', billController.cancelBill);
router.post('/:id/mark-delivered', billController.markDelivered);
router.post('/:id/collect-payment', billController.collectPayment);

module.exports = router;
