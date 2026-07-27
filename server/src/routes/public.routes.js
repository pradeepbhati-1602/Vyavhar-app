const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// Public PDF endpoints (no auth required because UUID is unguessable)
router.get('/bills/:id/pdf', publicController.downloadInvoicePDF);
router.get('/eye-tests/:id/pdf', publicController.downloadPrescriptionPDF);

module.exports = router;
