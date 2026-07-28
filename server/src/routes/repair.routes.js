const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repair.controller');
const {  requireTenantAuth  } = require('../middleware/tenantIsolation');
const { requireFeature } = require('../middleware/featureGuard');

router.use(requireTenantAuth);
router.use(requireFeature('repair_orders'));
router.get('/', repairController.getRepairs);
router.post('/', repairController.createRepair);
router.put('/:id', repairController.updateRepair);

module.exports = router;
