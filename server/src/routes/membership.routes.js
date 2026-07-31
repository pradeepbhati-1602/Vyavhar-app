const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membership.controller');
const { requireTenantAuth, requireOwner, requireFeature } = require('../middleware/tenantIsolation');

// Apply auth AND feature flag to all routes
router.use(requireTenantAuth);
router.use(requireFeature('membership_system_enabled'));

// GET /api/v1/memberships/plans
router.get('/plans', membershipController.getPlans);

// GET /api/v1/memberships/active/:id
router.get('/active/:id', membershipController.getActiveMembership);

// POST /api/v1/memberships/plans
router.post('/plans', requireOwner, membershipController.createPlan);

// POST /api/v1/memberships/assign
router.post('/assign', membershipController.assignMembership);

// DELETE /api/v1/memberships/plans/:id
router.delete('/plans/:id', requireOwner, membershipController.deletePlan);

// DELETE /api/v1/memberships/active/:id
router.delete('/active/:id', membershipController.deleteMembership);

module.exports = router;
