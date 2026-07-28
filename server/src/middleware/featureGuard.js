const { prisma } = require('../prisma');
const { FEATURE_CATEGORIES } = require('../config/features.config');

// In-memory cache for tenant features
const featureCache = new Map();

// Build a flat dependency map for quick lookups
const dependencyMap = {};
FEATURE_CATEGORIES.forEach(cat => {
  cat.features.forEach(f => {
    dependencyMap[f.key] = f.dependencies || [];
  });
});

/**
 * Validates if a feature and all its dependencies are enabled.
 */
const hasFeatureWithDeps = (features, key) => {
  if (!features[key]) return false;
  const deps = dependencyMap[key] || [];
  for (let dep of deps) {
    if (!hasFeatureWithDeps(features, dep)) return false;
  }
  return true;
};

/**
 * Clear cache for a tenant when SuperAdmin modifies it.
 */
const invalidateTenantFeatureCache = (tenant_id) => {
  featureCache.delete(tenant_id);
};

/**
 * Middleware to enforce feature access.
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    const tenant_id = req.tenant_id || req.user?.tenant_id;
    if (!tenant_id) {
      return res.status(401).json({ error: 'Tenant context required for feature check' });
    }

    try {
      let features = featureCache.get(tenant_id);
      
      if (!features) {
        const tenant = await prisma.tenant.findUnique({
          where: { tenant_id },
          select: { features: true }
        });
        
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }
        
        // Handle migration from old booleans to JSON or missing features gracefully
        features = typeof tenant.features === 'string' ? JSON.parse(tenant.features) : (tenant.features || {});
        featureCache.set(tenant_id, features);
      }

      if (!hasFeatureWithDeps(features, featureKey)) {
        return res.status(403).json({ 
          error: 'Feature Disabled', 
          message: `The '${featureKey}' feature is not enabled for your current subscription plan.` 
        });
      }

      next();
    } catch (error) {
      console.error('Feature Guard Error:', error);
      res.status(500).json({ error: 'Internal feature validation error' });
    }
  };
};

module.exports = {
  requireFeature,
  invalidateTenantFeatureCache,
  hasFeatureWithDeps
};
