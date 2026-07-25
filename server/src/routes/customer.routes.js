const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

const dashboardController = require('../controllers/dashboard.controller');

// GET /api/v1/customers/lookup/:mobile
router.get('/lookup/:mobile', requireTenantAuth, customerController.lookupCustomer);
router.get('/birthdays', requireTenantAuth, dashboardController.getBirthdaysToday);
router.get('/referrals/all', requireTenantAuth, (req, res) => res.json([]));
router.get('/referrals', requireTenantAuth, (req, res) => res.json([]));
router.get('/', requireTenantAuth, (req, res) => res.json([]));
router.post('/', requireTenantAuth, (req, res) => res.json({}));
router.put('/:id', requireTenantAuth, (req, res) => res.json({}));

module.exports = router;
