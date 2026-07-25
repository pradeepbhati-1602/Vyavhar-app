const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

const dashboardController = require('../controllers/dashboard.controller');

// GET /api/v1/customers/lookup/:mobile
router.get('/lookup/:mobile', requireTenantAuth, customerController.lookupCustomer);
router.get('/birthdays', requireTenantAuth, dashboardController.getBirthdaysToday);
router.get('/referrals/all', requireTenantAuth, customerController.getReferrals);
router.get('/referrals', requireTenantAuth, customerController.getReferrals);
router.get('/', requireTenantAuth, customerController.getCustomers);
router.post('/', requireTenantAuth, customerController.createCustomer);
router.put('/:id', requireTenantAuth, customerController.updateCustomer);
router.post('/bulk-import', requireTenantAuth, customerController.bulkImport);

module.exports = router;
