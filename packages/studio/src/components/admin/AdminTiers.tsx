/**
 * Admin Tiers Page
 *
 * Tier configuration and quota management interface.
 *
 * @module @humanizer/studio/components/admin/AdminTiers
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi, type AdminTier } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TierDisplay extends AdminTier {
  name: string;
  description?: string;
  features: string[];
  priceMonthly?: number;
  priority: number;
  isPublic: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

// Tier metadata that enriches the API response
const TIER_METADATA: Record<string, {
  name: string;
  description?: string;
  features: string[];
  priceMonthly?: number;
  priority: number;
  isPublic: boolean;
}> = {
  free: {
    name: 'Free',
    description: 'Basic access for new users',
    features: ['Basic transformations'],
    priceMonthly: 0,
    priority: 0,
    isPublic: true,
  },
  member: {
    name: 'Member',
    description: 'For regular users',
    features: ['All transformations', 'API access', 'Priority support'],
    priceMonthly: 9,
    priority: 1,
    isPublic: true,
  },
  pro: {
    name: 'Pro',
    description: 'For power users',
    features: ['All transformations', 'Full API access', 'Priority support', 'Custom personas'],
    priceMonthly: 29,
    priority: 2,
    isPublic: true,
  },
  premium: {
    name: 'Premium',
    description: 'For enterprises',
    features: ['Unlimited transformations', 'Full API access', 'Dedicated support', 'Custom integrations'],
    priceMonthly: 99,
    priority: 3,
    isPublic: true,
  },
  admin: {
    name: 'Admin',
    description: 'Administrative access',
    features: ['All features', 'Admin panel'],
    priority: 99,
    isPublic: false,
  },
};

export function AdminTiers() {
  const api = useApi();

  // State
  const [tiers, setTiers] = useState<TierDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected tier for editing
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Partial<AdminTier>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchTiers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.admin.listTiers();
      // Merge API data with local metadata
      const tiersWithMetadata: TierDisplay[] = result.tiers.map((t) => {
        const meta = TIER_METADATA[t.tier] ?? {
          name: t.tier,
          description: undefined,
          features: [],
          priceMonthly: undefined,
          priority: 50,
          isPublic: true,
        };
        return { ...t, ...meta };
      });
      setTiers(tiersWithMetadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tiers');
    } finally {
      setLoading(false);
    }
  }, [api.admin]);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  // When selecting a tier, reset edit state
  useEffect(() => {
    if (selectedTierId) {
      const tier = tiers.find(t => t.tier === selectedTierId);
      if (tier) {
        setEditValues({
          tokensPerMonth: tier.tokensPerMonth,
          requestsPerMonth: tier.requestsPerMonth,
          costCentsPerMonth: tier.costCentsPerMonth,
          requestsPerMinute: tier.requestsPerMinute,
          maxApiKeys: tier.maxApiKeys,
        });
      }
      setEditMode(false);
      setSaveSuccess(false);
    }
  }, [selectedTierId, tiers]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedTierId) return;

    setSaving(true);
    try {
      // TODO: Implement actual save via API
      // await api.admin.updateTier(selectedTierId, editValues);

      // Optimistic update
      setTiers(prev => prev.map(t =>
        t.tier === selectedTierId
          ? { ...t, ...editValues }
          : t
      ));
      setSaveSuccess(true);
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tier');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const tier = tiers.find(t => t.tier === selectedTierId);
    if (tier) {
      setEditValues({
        tokensPerMonth: tier.tokensPerMonth,
        requestsPerMonth: tier.requestsPerMonth,
        costCentsPerMonth: tier.costCentsPerMonth,
        requestsPerMinute: tier.requestsPerMinute,
        maxApiKeys: tier.maxApiKeys,
      });
    }
    setEditMode(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const formatLimit = (value: number): string => {
    if (value === -1) return 'Unlimited';
    return value.toLocaleString();
  };

  const formatPrice = (cents?: number): string => {
    if (cents === undefined) return '-';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const selectedTier = selectedTierId ? tiers.find(t => t.tier === selectedTierId) : null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="admin-tiers">
      {/* Header */}
      <div className="admin-tiers__header">
        <h1 className="admin-tiers__title">Tiers & Quotas</h1>
        <div className="admin-tiers__stats">
          <span className="admin-tiers__stat">{tiers.length} tiers</span>
          <span className="admin-tiers__stat">
            {tiers.filter(t => t.isPublic).length} public
          </span>
        </div>
      </div>

      <div className="admin-tiers__layout">
        {/* Tier List Panel */}
        <div className="admin-tiers__list-panel">
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
          ) : (
            <div className="admin-tiers__list">
              {tiers.sort((a, b) => a.priority - b.priority).map((tier) => (
                <button
                  key={tier.tier}
                  className={`admin-tiers__item ${selectedTierId === tier.tier ? 'admin-tiers__item--selected' : ''}`}
                  onClick={() => setSelectedTierId(tier.tier)}
                >
                  <div className="admin-tiers__item-info">
                    <div className="admin-tiers__item-header">
                      <span className="admin-tiers__item-name">{tier.name}</span>
                      {!tier.isPublic && (
                        <span className="admin-badge admin-badge--warning">Internal</span>
                      )}
                    </div>
                    <div className="admin-tiers__item-description">
                      {tier.description || 'No description'}
                    </div>
                    <div className="admin-tiers__item-limits">
                      <span>{formatLimit(tier.tokensPerMonth)} tokens/mo</span>
                      <span>{formatLimit(tier.requestsPerMonth)} requests/mo</span>
                    </div>
                  </div>
                  {tier.priceMonthly !== undefined && tier.priceMonthly > 0 && (
                    <div className="admin-tiers__item-price">
                      ${tier.priceMonthly}/mo
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tier Detail Panel */}
        <div className="admin-tiers__detail-panel">
          {selectedTier ? (
            <div className="admin-tier-detail">
              <div className="admin-tier-detail__header">
                <div>
                  <h2 className="admin-tier-detail__title">{selectedTier.name}</h2>
                  <div className="admin-tier-detail__id">{selectedTier.tier}</div>
                </div>
                <div className="admin-tier-detail__actions">
                  {editMode ? (
                    <>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn--primary btn--sm"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => setEditMode(true)}
                    >
                      Edit Limits
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-tier-detail__content">
                {saveSuccess && (
                  <div className="admin-alert admin-alert--success">
                    <span className="admin-alert__icon">OK</span>
                    <div className="admin-alert__content">
                      <p className="admin-alert__message">Tier limits saved successfully</p>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="admin-tier-detail__section">
                  <h3 className="admin-tier-detail__section-title">Description</h3>
                  <p className="admin-tier-detail__description">
                    {selectedTier.description || 'No description'}
                  </p>
                </div>

                {/* Pricing */}
                {selectedTier.priceMonthly !== undefined && (
                  <div className="admin-tier-detail__section">
                    <h3 className="admin-tier-detail__section-title">Pricing</h3>
                    <div className="admin-tier-detail__grid">
                      <div className="admin-tier-detail__field">
                        <span className="admin-tier-detail__label">Monthly</span>
                        <span className="admin-tier-detail__value">
                          ${selectedTier.priceMonthly}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Limits */}
                <div className="admin-tier-detail__section">
                  <h3 className="admin-tier-detail__section-title">Limits</h3>
                  <div className="admin-tier-detail__limits">
                    {editMode ? (
                      <>
                        <div className="admin-form__field">
                          <label className="admin-form__label">Tokens per Month</label>
                          <input
                            type="number"
                            className="admin-form__input"
                            value={editValues.tokensPerMonth ?? 0}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              tokensPerMonth: parseInt(e.target.value, 10)
                            }))}
                          />
                          <span className="admin-form__hint">Use -1 for unlimited</span>
                        </div>
                        <div className="admin-form__field">
                          <label className="admin-form__label">Requests per Month</label>
                          <input
                            type="number"
                            className="admin-form__input"
                            value={editValues.requestsPerMonth ?? 0}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              requestsPerMonth: parseInt(e.target.value, 10)
                            }))}
                          />
                          <span className="admin-form__hint">Use -1 for unlimited</span>
                        </div>
                        <div className="admin-form__field">
                          <label className="admin-form__label">Cost Limit (cents/month)</label>
                          <input
                            type="number"
                            className="admin-form__input"
                            value={editValues.costCentsPerMonth ?? 0}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              costCentsPerMonth: parseInt(e.target.value, 10)
                            }))}
                          />
                        </div>
                        <div className="admin-form__field">
                          <label className="admin-form__label">Requests per Minute</label>
                          <input
                            type="number"
                            className="admin-form__input"
                            value={editValues.requestsPerMinute ?? 0}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              requestsPerMinute: parseInt(e.target.value, 10)
                            }))}
                          />
                        </div>
                        <div className="admin-form__field">
                          <label className="admin-form__label">Max API Keys</label>
                          <input
                            type="number"
                            className="admin-form__input"
                            value={editValues.maxApiKeys ?? 0}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              maxApiKeys: parseInt(e.target.value, 10)
                            }))}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="admin-tier-detail__grid admin-tier-detail__grid--3">
                        <div className="admin-tier-detail__field">
                          <span className="admin-tier-detail__label">Tokens/Month</span>
                          <span className="admin-tier-detail__value">
                            {formatLimit(selectedTier.tokensPerMonth)}
                          </span>
                        </div>
                        <div className="admin-tier-detail__field">
                          <span className="admin-tier-detail__label">Requests/Month</span>
                          <span className="admin-tier-detail__value">
                            {formatLimit(selectedTier.requestsPerMonth)}
                          </span>
                        </div>
                        <div className="admin-tier-detail__field">
                          <span className="admin-tier-detail__label">Cost Limit</span>
                          <span className="admin-tier-detail__value">
                            {formatPrice(selectedTier.costCentsPerMonth)}
                          </span>
                        </div>
                        <div className="admin-tier-detail__field">
                          <span className="admin-tier-detail__label">Rate Limit</span>
                          <span className="admin-tier-detail__value">
                            {formatLimit(selectedTier.requestsPerMinute)} req/min
                          </span>
                        </div>
                        <div className="admin-tier-detail__field">
                          <span className="admin-tier-detail__label">Max API Keys</span>
                          <span className="admin-tier-detail__value">
                            {formatLimit(selectedTier.maxApiKeys)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="admin-tier-detail__section">
                  <h3 className="admin-tier-detail__section-title">Features</h3>
                  <div className="admin-tier-detail__features">
                    {selectedTier.features.length > 0 ? (
                      selectedTier.features.map((feature, i) => (
                        <span key={i} className="admin-badge admin-badge--info">
                          {feature}
                        </span>
                      ))
                    ) : (
                      <span className="admin-tier-detail__no-features">No features</span>
                    )}
                  </div>
                </div>

                {/* Settings */}
                <div className="admin-tier-detail__section">
                  <h3 className="admin-tier-detail__section-title">Settings</h3>
                  <div className="admin-tier-detail__grid">
                    <div className="admin-tier-detail__field">
                      <span className="admin-tier-detail__label">Priority</span>
                      <span className="admin-tier-detail__value">{selectedTier.priority}</span>
                    </div>
                    <div className="admin-tier-detail__field">
                      <span className="admin-tier-detail__label">Visibility</span>
                      <span className="admin-tier-detail__value">
                        {selectedTier.isPublic ? 'Public' : 'Internal Only'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">$</span>
              <h3 className="admin-empty__title">Select a Tier</h3>
              <p className="admin-empty__description">
                Choose a tier from the list to view details and edit limits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
