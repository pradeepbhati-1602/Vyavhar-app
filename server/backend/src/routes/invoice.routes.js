const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

// GET /api/v1/invoices/:billId/pdf
router.get('/:billId/pdf', requireTenantAuth, invoiceController.generatePdf);

// POST /api/v1/invoices/:billId/whatsapp
router.post('/:billId/whatsapp', requireTenantAuth, invoiceController.sendWhatsApp);

module.exports = router;
