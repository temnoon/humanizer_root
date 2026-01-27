/**
 * Admin API Keys Page
 *
 * System-wide API key management with search, filtering, and revocation controls.
 *
 * @module @humanizer/studio/components/admin/AdminApiKeys
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi, type AdminApiKey } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ApiKeyDisplay extends AdminApiKey {
  userEmail?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_API_KEYS: ApiKeyDisplay[] = [
  {
    id: 'key-001',
    userId: 'user-123',
    userEmail: 'developer@example.com',
    name: 'Production API Key',
    keyPrefix: 'hum_prod',
    scopes: ['read', 'write', 'transform'],
    lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
    usageCount: 1247,
    createdAt: '2024-06-15T00:00:00Z',
    revokedAt: null,
  },
  {
    id: 'key-002',
    userId: 'user-123',
    userEmail: 'developer@example.com',
    name: 'Testing Key',
    keyPrefix: 'hum_test',
    scopes: ['read', 'transform'],
    lastUsedAt: new Date(Date.now() - 86400000).toISOString(),
    usageCount: 532,
    createdAt: '2024-08-20T00:00:00Z',
    revokedAt: null,
  },
  {
    id: 'key-003',
    userId: 'user-456',
    userEmail: 'enterprise@company.com',
    name: 'Enterprise Integration',
    keyPrefix: 'hum_ent1',
    scopes: ['read', 'write', 'transform', 'admin'],
    lastUsedAt: new Date(Date.now() - 300000).toISOString(),
    usageCount: 8924,
    createdAt: '2024-03-01T00:00:00Z',
    revokedAt: null,
  },
  {
    id: 'key-004',
    userId: 'user-789',
    userEmail: 'freelancer@email.com',
    name: 'Personal Project',
    keyPrefix: 'hum_pers',
    scopes: ['read', 'transform'],
    lastUsedAt: '2024-09-15T00:00:00Z',
    usageCount: 89,
    createdAt: '2024-09-01T00:00:00Z',
    revokedAt: null,
  },
  {
    id: 'key-005',
    userId: 'user-456',
    userEmail: 'enterprise@company.com',
    name: 'Old Integration (Revoked)',
    keyPrefix: 'hum_old1',
    scopes: ['read', 'write'],
    lastUsedAt: '2024-02-28T00:00:00Z',
    usageCount: 4521,
    createdAt: '2024-01-15T00:00:00Z',
    revokedAt: '2024-03-01T00:00:00Z',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminApiKeys() {
  const api = useApi();

  // State
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all');
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try real API first
      const result = await api.admin.listApiKeys();
      if (result.keys && result.keys.length > 0) {
        setKeys(result.keys);
      } else {
        // Fall back to mock data for UI development
        setKeys(MOCK_API_KEYS);
      }
    } catch (err) {
      // Fall back to mock data if API fails
      console.warn('API keys endpoint not available, using mock data:', err);
      setKeys(MOCK_API_KEYS);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const filteredKeys = keys.filter((key) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !key.name.toLowerCase().includes(searchLower) &&
        !key.keyPrefix.toLowerCase().includes(searchLower) &&
        !(key.userEmail?.toLowerCase().includes(searchLower))
      ) {
        return false;
      }
    }

    // Status filter
    if (statusFilter === 'active' && key.revokedAt) return false;
    if (statusFilter === 'revoked' && !key.revokedAt) return false;

    return true;
  });

  const selectedKey = selectedKeyId ? keys.find((k) => k.id === selectedKeyId) : null;

  const formatLastUsed = (iso: string | null) => {
    if (!iso) return 'Never';
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'read':
        return 'admin-badge--success';
      case 'write':
        return 'admin-badge--warning';
      case 'transform':
        return 'admin-badge--primary';
      case 'admin':
        return 'admin-badge--error';
      default:
        return 'admin-badge--neutral';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleRevokeKey = async () => {
    if (!selectedKeyId) return;

    try {
      await api.admin.revokeApiKey(selectedKeyId, 'Admin revocation');

      setKeys((prev) =>
        prev.map((key) =>
          key.id === selectedKeyId
            ? { ...key, revokedAt: new Date().toISOString() }
            : key
        )
      );
      setShowRevokeConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="admin-apikeys">
      {/* Header */}
      <div className="admin-apikeys__header">
        <h1 className="admin-apikeys__title">API Keys</h1>
        <div className="admin-apikeys__stats">
          <span className="admin-apikeys__stat">
            {keys.filter((k) => !k.revokedAt).length} active
          </span>
          <span className="admin-apikeys__stat">
            {keys.reduce((sum, k) => sum + k.usageCount, 0).toLocaleString()} total requests
          </span>
        </div>
      </div>

      <div className="admin-apikeys__layout">
        {/* Key List Panel */}
        <div className="admin-apikeys__list-panel">
          {/* Filters */}
          <div className="admin-apikeys__filters">
            <input
              type="text"
              className="admin-form__input"
              placeholder="Search keys, users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="admin-form__select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'revoked')}
            >
              <option value="all">All Keys</option>
              <option value="active">Active Only</option>
              <option value="revoked">Revoked Only</option>
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
          ) : filteredKeys.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty__icon">KEY</span>
              <h3 className="admin-empty__title">No API Keys Found</h3>
              <p className="admin-empty__description">
                {search ? 'Try a different search term.' : 'No API keys have been created.'}
              </p>
            </div>
          ) : (
            <div className="admin-apikeys__list">
              {filteredKeys.map((key) => (
                <button
                  key={key.id}
                  className={`admin-apikeys__item ${
                    selectedKeyId === key.id ? 'admin-apikeys__item--selected' : ''
                  } ${key.revokedAt ? 'admin-apikeys__item--revoked' : ''}`}
                  onClick={() => setSelectedKeyId(key.id)}
                >
                  <div className="admin-apikeys__item-info">
                    <div className="admin-apikeys__item-header">
                      <span className="admin-apikeys__item-name">{key.name}</span>
                      {key.revokedAt && (
                        <span className="admin-badge admin-badge--error">Revoked</span>
                      )}
                    </div>
                    <div className="admin-apikeys__item-prefix">{key.keyPrefix}••••••••</div>
                    <div className="admin-apikeys__item-meta">
                      <span className="admin-apikeys__item-user">{key.userEmail || key.userId}</span>
                      <span className="admin-apikeys__item-sep">·</span>
                      <span className="admin-apikeys__item-usage">
                        {key.usageCount.toLocaleString()} requests
                      </span>
                    </div>
                  </div>
                  <div className="admin-apikeys__item-time">
                    {formatLastUsed(key.lastUsedAt)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Key Detail Panel */}
        <div className="admin-apikeys__detail-panel">
          {selectedKey ? (
            <div className="admin-apikey-detail">
              <div className="admin-apikey-detail__header">
                <div>
                  <h2 className="admin-apikey-detail__title">{selectedKey.name}</h2>
                  <div className="admin-apikey-detail__prefix">
                    {selectedKey.keyPrefix}••••••••••••
                  </div>
                </div>
                <div
                  className={`admin-apikey-detail__status ${
                    selectedKey.revokedAt
                      ? 'admin-apikey-detail__status--revoked'
                      : 'admin-apikey-detail__status--active'
                  }`}
                >
                  {selectedKey.revokedAt ? 'Revoked' : 'Active'}
                </div>
              </div>

              <div className="admin-apikey-detail__content">
                {/* Owner */}
                <div className="admin-apikey-detail__section">
                  <h3 className="admin-apikey-detail__section-title">Owner</h3>
                  <div className="admin-apikey-detail__grid">
                    <div className="admin-apikey-detail__field">
                      <span className="admin-apikey-detail__label">User</span>
                      <span className="admin-apikey-detail__value">
                        {selectedKey.userEmail || selectedKey.userId}
                      </span>
                    </div>
                    <div className="admin-apikey-detail__field">
                      <span className="admin-apikey-detail__label">User ID</span>
                      <span className="admin-apikey-detail__value admin-apikey-detail__value--mono">
                        {selectedKey.userId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scopes */}
                <div className="admin-apikey-detail__section">
                  <h3 className="admin-apikey-detail__section-title">Permissions</h3>
                  <div className="admin-apikey-detail__scopes">
                    {selectedKey.scopes.map((scope) => (
                      <span key={scope} className={`admin-badge ${getScopeColor(scope)}`}>
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Usage */}
                <div className="admin-apikey-detail__section">
                  <h3 className="admin-apikey-detail__section-title">Usage</h3>
                  <div className="admin-apikey-detail__grid">
                    <div className="admin-apikey-detail__field">
                      <span className="admin-apikey-detail__label">Total Requests</span>
                      <span className="admin-apikey-detail__value">
                        {selectedKey.usageCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="admin-apikey-detail__field">
                      <span className="admin-apikey-detail__label">Last Used</span>
                      <span className="admin-apikey-detail__value">
                        {formatLastUsed(selectedKey.lastUsedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="admin-apikey-detail__section">
                  <h3 className="admin-apikey-detail__section-title">Timeline</h3>
                  <div className="admin-apikey-detail__grid">
                    <div className="admin-apikey-detail__field">
                      <span className="admin-apikey-detail__label">Created</span>
                      <span className="admin-apikey-detail__value">
                        {new Date(selectedKey.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedKey.revokedAt && (
                      <div className="admin-apikey-detail__field">
                        <span className="admin-apikey-detail__label">Revoked</span>
                        <span className="admin-apikey-detail__value admin-apikey-detail__value--danger">
                          {new Date(selectedKey.revokedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!selectedKey.revokedAt && (
                  <div className="admin-apikey-detail__section">
                    <h3 className="admin-apikey-detail__section-title">Actions</h3>
                    <div className="admin-apikey-detail__actions">
                      {showRevokeConfirm ? (
                        <div className="admin-apikey-detail__confirm">
                          <p className="admin-apikey-detail__confirm-text">
                            Are you sure you want to revoke this key? This action cannot be undone.
                          </p>
                          <div className="admin-apikey-detail__confirm-actions">
                            <button
                              className="btn btn--danger btn--sm"
                              onClick={handleRevokeKey}
                            >
                              Yes, Revoke Key
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => setShowRevokeConfirm(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => setShowRevokeConfirm(true)}
                        >
                          Revoke Key
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">KEY</span>
              <h3 className="admin-empty__title">Select an API Key</h3>
              <p className="admin-empty__description">
                Choose an API key from the list to view details and manage permissions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
