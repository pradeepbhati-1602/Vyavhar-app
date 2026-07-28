import React, { createContext, useContext, useState, useEffect } from 'react';
import { FEATURE_CATEGORIES } from '../config/features.config';

const FeatureContext = createContext();

// Flatten dependencies for quick lookup
const dependencyMap = {};
FEATURE_CATEGORIES.forEach(cat => {
  cat.features.forEach(f => {
    dependencyMap[f.key] = f.dependencies || [];
  });
});

const _hasFeatureWithDeps = (features, key) => {
  // If explicitly disabled or doesn't exist, return false
  if (features[key] === false) return false;
  // If undefined, assume true for backwards compatibility if it's not in the config (optional)
  if (features[key] === undefined && key !== 'dummy') {
    // We could default to false, but let's be strict
    // return false; 
  }
  
  const deps = dependencyMap[key] || [];
  for (let dep of deps) {
    if (!_hasFeatureWithDeps(features, dep)) return false;
  }
  return true;
};

export const FeatureProvider = ({ children, tenant }) => {
  const [features, setFeatures] = useState({});

  useEffect(() => {
    if (tenant) {
      let parsedFeatures = {};
      
      // Parse JSON from tenant.features
      if (typeof tenant.features === 'string') {
        try {
          parsedFeatures = JSON.parse(tenant.features);
        } catch (e) {
          console.error("Failed to parse tenant features:", e);
        }
      } else if (typeof tenant.features === 'object' && tenant.features !== null) {
        parsedFeatures = tenant.features;
      }

      // Merge legacy booleans into parsedFeatures to ease migration
      const legacyMap = {
        'multi_store': tenant.multi_store_enabled,
        'membership_system': tenant.membership_system_enabled,
        'referral_system': tenant.referral_system_enabled,
        'whatsapp': tenant.whatsapp_auto_send_enabled,
        'eye_test': tenant.eye_test_module_enabled,
        'repair_orders': tenant.repair_module_enabled,
        'reports': tenant.advanced_reports_enabled
      };

      for (const [key, value] of Object.entries(legacyMap)) {
        if (value !== undefined && parsedFeatures[key] === undefined) {
          parsedFeatures[key] = value;
        }
      }

      setFeatures(parsedFeatures);
    } else {
      setFeatures({});
    }
  }, [tenant]);

  const hasFeature = (key) => {
    return _hasFeatureWithDeps(features, key);
  };

  return (
    <FeatureContext.Provider value={{ features, hasFeature }}>
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeatures = () => {
  return useContext(FeatureContext);
};
