const express = require('express');
const router = express.Router();
const eyetestController = require('../controllers/eyetest.controller');
const {  requireTenantAuth  } = require('../middleware/tenantIsolation');
const { requireFeature } = require('../middleware/featureGuard');

router.use(requireTenantAuth);
router.use(requireFeature('eye_test'));
router.get('/', eyetestController.getEyeTests);
router.post('/', eyetestController.createEyeTest);
router.put('/:id', eyetestController.updateEyeTest);

module.exports = router;
