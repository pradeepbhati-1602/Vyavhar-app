const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membership.controller');
const { requireTenantAuth, requireOwner, requireFeature } = require('../middleware/tenantIsolation');

// Apply auth AND feature flag to all routes
router.use(requireTenantAuth);
router.use(requireFeature('membership_system_enabled'));

// POST /api/v1/memberships/plans
router.post('/plans', requireOwner, membershipController.createPlan);

// POST /api/v1/memberships/assign
router.post('/assign', membershipController.assignMembership);

module.exports = router;
