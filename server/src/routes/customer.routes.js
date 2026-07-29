const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const {  requireTenantAuth  } = require('../middleware/tenantIsolation');
const { requireFeature } = require('../middleware/featureGuard');

const dashboardController = require('../controllers/dashboard.controller');

// GET /api/v1/customers/lookup/:mobile
router.get('/lookup/:mobile', requireTenantAuth, requireFeature('customer_management'), customerController.lookupCustomer);
router.get('/birthdays', requireTenantAuth, requireFeature('customer_management'), dashboardController.getBirthdaysToday);
router.get('/referrals/all', requireTenantAuth, requireFeature('customer_management'), customerController.getReferrals);
router.get('/referrals/:code', requireTenantAuth, requireFeature('customer_management'), customerController.lookupReferral);
router.get('/referrals', requireTenantAuth, requireFeature('customer_management'), customerController.getReferrals);
router.post('/referrals', requireTenantAuth, requireFeature('customer_management'), customerController.createReferral);
router.get('/', requireTenantAuth, requireFeature('customer_management'), customerController.getCustomers);
router.get('/:id', requireTenantAuth, requireFeature('customer_management'), customerController.getCustomerById);
router.post('/', requireTenantAuth, requireFeature('customer_management'), customerController.createCustomer);
router.put('/:id', requireTenantAuth, requireFeature('customer_management'), customerController.updateCustomer);
router.post('/bulk-import', requireTenantAuth, requireFeature('customer_management'), customerController.bulkImport);
router.post('/import-batch', requireTenantAuth, requireFeature('customer_management'), customerController.importBatch);

module.exports = router;
