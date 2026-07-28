import React, { useState, useEffect } from 'react';
import { FEATURE_CATEGORIES } from '../config/features.config';
import { ChevronDown, ChevronRight, CheckSquare, Square, Info, ShieldAlert } from 'lucide-react';

// Flat dependency map
const dependencyMap = {};
FEATURE_CATEGORIES.forEach(cat => {
  cat.features.forEach(f => {
    dependencyMap[f.key] = f.dependencies || [];
  });
});

export default function FeatureManagementPanel({ features, setFeatures, planTemplate }) {
  const [expandedCategories, setExpandedCategories] = useState(
    FEATURE_CATEGORIES.map(c => c.category) // Expand all by default
  );

  const [previewModal, setPreviewModal] = useState(null);

  const toggleCategory = (catName) => {
    setExpandedCategories(prev => 
      prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
    );
  };

  const handleToggleFeature = (featureKey) => {
    const isCurrentlyEnabled = features[featureKey] !== false;
    
    if (isCurrentlyEnabled) {
      // Disabling - Check if it affects others? No, children will just fail if parent disabled.
      // But let's show a preview warning
      setPreviewModal({
        featureKey,
        action: 'disable'
      });
    } else {
      // Enabling - Auto enable dependencies!
      const deps = dependencyMap[featureKey] || [];
      const newFeatures = { ...features, [featureKey]: true };
      
      const enableDeps = (keys) => {
        keys.forEach(k => {
          newFeatures[k] = true;
          const kDeps = dependencyMap[k] || [];
          if (kDeps.length > 0) enableDeps(kDeps);
        });
      };
      enableDeps(deps);
      
      setFeatures(newFeatures);
    }
  };

  const confirmDisable = () => {
    const featureKey = previewModal.featureKey;
    const newFeatures = { ...features, [featureKey]: false };
    
    // Auto disable features that depend on this
    const disableDependents = (disabledKey) => {
      FEATURE_CATEGORIES.forEach(cat => {
        cat.features.forEach(f => {
          if ((f.dependencies || []).includes(disabledKey)) {
            newFeatures[f.key] = false;
            disableDependents(f.key);
          }
        });
      });
    };
    disableDependents(featureKey);

    setFeatures(newFeatures);
    setPreviewModal(null);
  };

  const handleSelectAllCategory = (catName, isSelectAll) => {
    const cat = FEATURE_CATEGORIES.find(c => c.category === catName);
    if (!cat) return;
    
    const newFeatures = { ...features };
    cat.features.forEach(f => {
      newFeatures[f.key] = isSelectAll;
      if (isSelectAll) {
        // Enable deps
        const deps = dependencyMap[f.key] || [];
        const enableDeps = (keys) => {
          keys.forEach(k => {
            newFeatures[k] = true;
            const kDeps = dependencyMap[k] || [];
            if (kDeps.length > 0) enableDeps(kDeps);
          });
        };
        enableDeps(deps);
      }
    });
    setFeatures(newFeatures);
  };

  return (
    <div className="space-y-4">
      {FEATURE_CATEGORIES.map(category => {
        const isExpanded = expandedCategories.includes(category.category);
        const enabledCount = category.features.filter(f => features[f.key] !== false).length;
        const totalCount = category.features.length;

        return (
          <div key={category.category} className="bg-darkSurface border border-white/10 rounded-xl overflow-hidden">
            <div 
              className="px-4 py-3 bg-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => toggleCategory(category.category)}
            >
              <div className="flex items-center space-x-3">
                {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                <h4 className="font-bold text-white text-sm">{category.category}</h4>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono text-gray-400">
                  {enabledCount}/{totalCount} enabled
                </span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectAllCategory(category.category, enabledCount < totalCount);
                }}
                className="text-xs text-gold hover:underline font-semibold"
              >
                {enabledCount < totalCount ? 'Enable All' : 'Disable All'}
              </button>
            </div>

            {isExpanded && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.features.map(feature => {
                  const isEnabled = features[feature.key] !== false;
                  
                  return (
                    <div 
                      key={feature.key} 
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isEnabled ? 'bg-gold/5 border-gold/30' : 'bg-white/5 border-white/5 opacity-60'
                      }`}
                      onClick={() => handleToggleFeature(feature.key)}
                    >
                      <div className="pt-0.5 shrink-0">
                        {isEnabled ? (
                          <CheckSquare className="w-5 h-5 text-gold" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h5 className={`font-semibold text-sm ${isEnabled ? 'text-white' : 'text-gray-400'}`}>
                            {feature.name}
                          </h5>
                          <div className="group relative">
                            <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl border border-white/10">
                              {feature.tooltip}
                              {feature.dependencies && feature.dependencies.length > 0 && (
                                <div className="mt-1 pt-1 border-t border-white/20 text-gold text-[10px]">
                                  Requires: {feature.dependencies.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">
                          {feature.tooltip}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {previewModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-darkSurface rounded-2xl p-6 max-w-md w-full border border-red-500/30">
            <div className="flex items-center space-x-3 text-red-400 mb-4">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-bold">Disable Feature Warning</h3>
            </div>
            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              You are about to disable <strong className="text-white">{previewModal.featureKey}</strong>.
            </p>
            <p className="text-xs text-gray-400 mb-6 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              Disabling this feature will completely hide it from the client interface and block API access. Any existing data will NOT be deleted and will become visible again if re-enabled. Any features depending on this will also be automatically disabled.
            </p>
            <div className="flex space-x-3">
              <button 
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold text-white transition-colors"
                onClick={() => setPreviewModal(null)}
              >
                Cancel
              </button>
              <button 
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-bold text-white transition-colors"
                onClick={confirmDisable}
              >
                Yes, Disable It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
