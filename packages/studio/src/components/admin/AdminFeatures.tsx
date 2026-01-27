/**
 * Admin Features Page
 *
 * Feature flag management with global toggles and per-tier overrides.
 *
 * @module @humanizer/studio/components/admin/AdminFeatures
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TierOverride {
  tier: string;
  enabled: boolean;
}

interface Feature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'premium' | 'beta' | 'experimental';
  enabled: boolean;
  tierOverrides: TierOverride[];
  rolloutPercentage?: number;
  createdAt: string;
  updatedAt: string;
}

const TIERS = ['free', 'member', 'pro', 'premium', 'admin'];

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_FEATURES: Feature[] = [
  {
    id: 'semantic-search',
    name: 'Semantic Search',
    description: 'Enable vector-based semantic search across archive content',
    category: 'core',
    enabled: true,
    tierOverrides: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-15T00:00:00Z',
  },
  {
    id: 'ai-rewriting',
    name: 'AI Rewriting',
    description: 'Transform content using AI-powered persona rewriting',
    category: 'core',
    enabled: true,
    tierOverrides: [{ tier: 'free', enabled: false }],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-08-20T00:00:00Z',
  },
  {
    id: 'book-generation',
    name: 'Book Generation',
    description: 'Generate books from clusters of related content',
    category: 'premium',
    enabled: true,
    tierOverrides: [
      { tier: 'free', enabled: false },
      { tier: 'member', enabled: false },
    ],
    createdAt: '2024-03-15T00:00:00Z',
    updatedAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 'custom-prompts',
    name: 'Custom Prompts',
    description: 'Create and manage custom transformation prompts',
    category: 'premium',
    enabled: true,
    tierOverrides: [
      { tier: 'free', enabled: false },
      { tier: 'member', enabled: false },
    ],
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: '2024-10-15T00:00:00Z',
  },
  {
    id: 'api-access',
    name: 'API Access',
    description: 'Generate and manage personal API keys',
    category: 'premium',
    enabled: true,
    tierOverrides: [
      { tier: 'free', enabled: false },
      { tier: 'member', enabled: true },
    ],
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-07-01T00:00:00Z',
  },
  {
    id: 'advanced-clustering',
    name: 'Advanced Clustering',
    description: 'Access to advanced HDBSCAN clustering with parameter tuning',
    category: 'beta',
    enabled: true,
    tierOverrides: [
      { tier: 'free', enabled: false },
      { tier: 'member', enabled: false },
      { tier: 'pro', enabled: true },
    ],
    rolloutPercentage: 100,
    createdAt: '2024-09-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
  },
  {
    id: 'multi-model',
    name: 'Multi-Model Selection',
    description: 'Choose between different LLM providers and models',
    category: 'beta',
    enabled: true,
    tierOverrides: [
      { tier: 'free', enabled: false },
      { tier: 'member', enabled: false },
    ],
    rolloutPercentage: 75,
    createdAt: '2024-10-15T00:00:00Z',
    updatedAt: '2024-12-20T00:00:00Z',
  },
  {
    id: 'collaborative-books',
    name: 'Collaborative Books',
    description: 'Share and collaborate on book projects with other users',
    category: 'experimental',
    enabled: false,
    tierOverrides: [],
    rolloutPercentage: 10,
    createdAt: '2024-11-01T00:00:00Z',
    updatedAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'voice-input',
    name: 'Voice Input',
    description: 'Use voice commands and dictation for content creation',
    category: 'experimental',
    enabled: false,
    tierOverrides: [],
    rolloutPercentage: 0,
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminFeatures() {
  const api = useApi();

  // State
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editTierOverrides, setEditTierOverrides] = useState<Record<string, boolean | null>>({});
  const [editRollout, setEditRollout] = useState('');

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.admin.listFeatures();

      if (result.features && result.features.length > 0) {
        setFeatures(result.features);
      } else {
        setFeatures(MOCK_FEATURES);
      }
    } catch (err) {
      console.warn('Features endpoint not available, using mock data:', err);
      setFeatures(MOCK_FEATURES);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const categories = ['all', ...new Set(features.map((f) => f.category))];

  const filteredFeatures = features.filter((f) => {
    if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
    return true;
  });

  const selectedFeature = selectedFeatureId
    ? features.find((f) => f.id === selectedFeatureId)
    : null;

  const getTierStatus = (feature: Feature, tier: string): boolean | null => {
    const override = feature.tierOverrides.find((o) => o.tier === tier);
    if (override) return override.enabled;
    return null; // Inherits global
  };

  const getCategoryBadgeClass = (category: Feature['category']) => {
    switch (category) {
      case 'core':
        return 'admin-badge--success';
      case 'premium':
        return 'admin-badge--primary';
      case 'beta':
        return 'admin-badge--warning';
      case 'experimental':
        return 'admin-badge--neutral';
      default:
        return 'admin-badge--neutral';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleSelectFeature = (id: string) => {
    setSelectedFeatureId(id);
    setEditMode(false);
    const feature = features.find((f) => f.id === id);
    if (feature) {
      const overrides: Record<string, boolean | null> = {};
      TIERS.forEach((tier) => {
        overrides[tier] = getTierStatus(feature, tier);
      });
      setEditTierOverrides(overrides);
      setEditRollout(feature.rolloutPercentage?.toString() ?? '');
    }
  };

  const handleToggleGlobal = (id: string) => {
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, enabled: !f.enabled, updatedAt: new Date().toISOString() }
          : f
      )
    );
  };

  const handleSaveConfig = () => {
    if (!selectedFeatureId) return;

    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id !== selectedFeatureId) return f;

        const newOverrides: TierOverride[] = [];
        TIERS.forEach((tier) => {
          const value = editTierOverrides[tier];
          if (value !== null) {
            newOverrides.push({ tier, enabled: value });
          }
        });

        return {
          ...f,
          tierOverrides: newOverrides,
          rolloutPercentage: editRollout ? parseInt(editRollout, 10) : f.rolloutPercentage,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    setEditMode(false);
  };

  const handleTierOverrideChange = (tier: string, value: string) => {
    setEditTierOverrides((prev) => ({
      ...prev,
      [tier]: value === 'inherit' ? null : value === 'enabled',
    }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="admin-features">
      {/* Header */}
      <div className="admin-features__header">
        <h1 className="admin-features__title">Feature Flags</h1>
        <div className="admin-features__stats">
          <span className="admin-features__stat">
            {features.filter((f) => f.enabled).length}/{features.length} enabled
          </span>
        </div>
      </div>

      <div className="admin-features__layout">
        {/* Feature List Panel */}
        <div className="admin-features__list-panel">
          {/* Filters */}
          <div className="admin-features__filters">
            <select
              className="admin-form__select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="admin-loading">
              <span className="admin-loading__spinner" />
            </div>
          ) : error ? (
            <div className="admin-alert admin-alert--error">
              <span className="admin-alert__icon">!</span>
              <div className="admin-alert__content">
                <p className="admin-alert__message">{error}</p>
              </div>
            </div>
          ) : filteredFeatures.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty__icon">F</span>
              <h3 className="admin-empty__title">No Features Found</h3>
              <p className="admin-empty__description">
                No features match the selected filter.
              </p>
            </div>
          ) : (
            <div className="admin-features__list">
              {filteredFeatures.map((feature) => (
                <button
                  key={feature.id}
                  className={`admin-features__item ${
                    selectedFeatureId === feature.id ? 'admin-features__item--selected' : ''
                  }`}
                  onClick={() => handleSelectFeature(feature.id)}
                >
                  <div className="admin-features__item-info">
                    <div className="admin-features__item-header">
                      <span className="admin-features__item-name">{feature.name}</span>
                      <span className={`admin-badge ${getCategoryBadgeClass(feature.category)}`}>
                        {feature.category}
                      </span>
                    </div>
                    <div className="admin-features__item-description">
                      {feature.description}
                    </div>
                    {feature.rolloutPercentage !== undefined && feature.rolloutPercentage < 100 && (
                      <div className="admin-features__item-rollout">
                        {feature.rolloutPercentage}% rollout
                      </div>
                    )}
                  </div>
                  <label
                    className="admin-features__toggle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={feature.enabled}
                      onChange={() => handleToggleGlobal(feature.id)}
                    />
                    <span className="admin-features__toggle-slider" />
                  </label>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feature Detail Panel */}
        <div className="admin-features__detail-panel">
          {selectedFeature ? (
            <div className="admin-feature-detail">
              <div className="admin-feature-detail__header">
                <div>
                  <h2 className="admin-feature-detail__title">{selectedFeature.name}</h2>
                  <div className="admin-feature-detail__id">{selectedFeature.id}</div>
                </div>
                <div
                  className={`admin-feature-detail__status ${
                    selectedFeature.enabled
                      ? 'admin-feature-detail__status--enabled'
                      : 'admin-feature-detail__status--disabled'
                  }`}
                >
                  {selectedFeature.enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              <div className="admin-feature-detail__content">
                {/* Description */}
                <div className="admin-feature-detail__section">
                  <h3 className="admin-feature-detail__section-title">Description</h3>
                  <p className="admin-feature-detail__description">
                    {selectedFeature.description}
                  </p>
                  <div className="admin-feature-detail__meta">
                    <span className={`admin-badge ${getCategoryBadgeClass(selectedFeature.category)}`}>
                      {selectedFeature.category}
                    </span>
                    <span className="admin-feature-detail__updated">
                      Updated: {new Date(selectedFeature.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Rollout */}
                {(selectedFeature.category === 'beta' ||
                  selectedFeature.category === 'experimental') && (
                  <div className="admin-feature-detail__section">
                    <h3 className="admin-feature-detail__section-title">Rollout</h3>
                    {editMode ? (
                      <div className="admin-form__group">
                        <label className="admin-form__label">Rollout Percentage</label>
                        <div className="admin-feature-detail__rollout-input">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={editRollout || '0'}
                            onChange={(e) => setEditRollout(e.target.value)}
                            className="admin-form__range"
                          />
                          <span className="admin-feature-detail__rollout-value">
                            {editRollout || '0'}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-feature-detail__rollout">
                        <div className="admin-feature-detail__rollout-bar">
                          <div
                            className="admin-feature-detail__rollout-fill"
                            style={{ width: `${selectedFeature.rolloutPercentage ?? 0}%` }}
                          />
                        </div>
                        <span className="admin-feature-detail__rollout-label">
                          {selectedFeature.rolloutPercentage ?? 0}% of eligible users
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tier Overrides */}
                <div className="admin-feature-detail__section">
                  <h3 className="admin-feature-detail__section-title">Tier Access</h3>
                  <div className="admin-feature-detail__tiers">
                    {TIERS.map((tier) => {
                      const status = editMode
                        ? editTierOverrides[tier]
                        : getTierStatus(selectedFeature, tier);
                      const effectiveStatus =
                        status === null ? selectedFeature.enabled : status;

                      return (
                        <div key={tier} className="admin-feature-detail__tier">
                          <div className="admin-feature-detail__tier-info">
                            <span className="admin-feature-detail__tier-name">
                              {tier.charAt(0).toUpperCase() + tier.slice(1)}
                            </span>
                            <span
                              className={`admin-feature-detail__tier-status ${
                                effectiveStatus
                                  ? 'admin-feature-detail__tier-status--enabled'
                                  : 'admin-feature-detail__tier-status--disabled'
                              }`}
                            >
                              {effectiveStatus ? 'Enabled' : 'Disabled'}
                              {status === null && ' (inherited)'}
                            </span>
                          </div>
                          {editMode && (
                            <select
                              className="admin-form__select admin-form__select--sm"
                              value={
                                status === null ? 'inherit' : status ? 'enabled' : 'disabled'
                              }
                              onChange={(e) => handleTierOverrideChange(tier, e.target.value)}
                            >
                              <option value="inherit">Inherit Global</option>
                              <option value="enabled">Force Enabled</option>
                              <option value="disabled">Force Disabled</option>
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="admin-feature-detail__section">
                  <h3 className="admin-feature-detail__section-title">Actions</h3>
                  <div className="admin-feature-detail__actions">
                    {editMode ? (
                      <>
                        <button className="btn btn--primary btn--sm" onClick={handleSaveConfig}>
                          Save Changes
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setEditMode(false)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn--secondary btn--sm"
                          onClick={() => setEditMode(true)}
                        >
                          Edit Configuration
                        </button>
                        <button
                          className={`btn btn--ghost btn--sm ${
                            selectedFeature.enabled ? 'btn--danger' : ''
                          }`}
                          onClick={() => handleToggleGlobal(selectedFeature.id)}
                        >
                          {selectedFeature.enabled ? 'Disable Globally' : 'Enable Globally'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">F</span>
              <h3 className="admin-empty__title">Select a Feature</h3>
              <p className="admin-empty__description">
                Choose a feature flag from the list to view and edit configuration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
