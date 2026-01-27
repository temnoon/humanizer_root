/**
 * Settings API Keys Page
 *
 * API key management for programmatic access.
 *
 * @module @humanizer/studio/components/settings/SettingsApiKeys
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsApiKeys() {
  const api = useApi();

  // State
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create key modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read', 'write']);
  const [newKeyExpiry, setNewKeyExpiry] = useState('90d');
  const [creating, setCreating] = useState(false);

  // Newly created key (shown only once)
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.settings.listApiKeys();
      setKeys(result.keys);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api.settings]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await api.settings.createApiKey({
        name: newKeyName,
        scopes: newKeyScopes,
        expiresIn: newKeyExpiry,
      });
      setNewKey(result.key);
      setNewKeyName('');
      setNewKeyScopes(['read', 'write']);
      setNewKeyExpiry('90d');
      fetchKeys();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }
    try {
      await api.settings.revokeApiKey(keyId);
      fetchKeys();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCopyKey = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCloseNewKey = () => {
    setNewKey(null);
    setShowCreateModal(false);
    setCopiedKey(false);
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <div>
          <h2 className="settings-section__title">API Keys</h2>
          <p className="settings-section__description">
            Manage API keys for programmatic access
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => setShowCreateModal(true)}
        >
          Create New Key
        </button>
      </div>

      <div className="settings-section__content">
        {error && (
          <div className="settings-alert settings-alert--error">{error}</div>
        )}

        {loading ? (
          <div className="settings-loading">
            <span className="settings-loading__spinner" />
          </div>
        ) : (
          <>
            {/* Active Keys */}
            <div className="settings-card">
              <h3 className="settings-card__title">
                Active Keys ({activeKeys.length})
              </h3>
              <div className="settings-card__content">
                {activeKeys.length === 0 ? (
                  <p className="settings-empty-text">
                    No active API keys. Create one to get started.
                  </p>
                ) : (
                  <div className="settings-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Key</th>
                          <th>Scopes</th>
                          <th>Last Used</th>
                          <th>Expires</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeKeys.map((key) => (
                          <tr key={key.id}>
                            <td>{key.name}</td>
                            <td className="settings-table__mono">
                              {key.keyPrefix}...
                            </td>
                            <td>
                              {key.scopes.map((s) => (
                                <span key={s} className="settings-tag">
                                  {s}
                                </span>
                              ))}
                            </td>
                            <td>
                              {key.lastUsedAt
                                ? new Date(key.lastUsedAt).toLocaleDateString()
                                : 'Never'}
                            </td>
                            <td>
                              {key.expiresAt
                                ? new Date(key.expiresAt).toLocaleDateString()
                                : 'Never'}
                            </td>
                            <td>
                              <button
                                className="btn btn--danger btn--sm"
                                onClick={() => handleRevokeKey(key.id)}
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Revoked Keys */}
            {revokedKeys.length > 0 && (
              <div className="settings-card settings-card--muted">
                <h3 className="settings-card__title">
                  Revoked Keys ({revokedKeys.length})
                </h3>
                <div className="settings-card__content">
                  <div className="settings-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Key</th>
                          <th>Revoked At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revokedKeys.map((key) => (
                          <tr key={key.id} className="settings-table__row--muted">
                            <td>{key.name}</td>
                            <td className="settings-table__mono">
                              {key.keyPrefix}...
                            </td>
                            <td>
                              {key.revokedAt
                                ? new Date(key.revokedAt).toLocaleDateString()
                                : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="settings-modal">
          <div className="settings-modal__backdrop" onClick={handleCloseNewKey} />
          <div className="settings-modal__content">
            {newKey ? (
              <>
                <h3 className="settings-modal__title">API Key Created</h3>
                <div className="settings-alert settings-alert--warning">
                  Copy your API key now. You will not be able to see it again.
                </div>
                <div className="settings-key-display">
                  <code>{newKey}</code>
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={handleCopyKey}
                  >
                    {copiedKey ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="settings-modal__actions">
                  <button className="btn btn--primary" onClick={handleCloseNewKey}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleCreateKey}>
                <h3 className="settings-modal__title">Create API Key</h3>
                <div className="settings-form__field">
                  <label htmlFor="keyName">Name</label>
                  <input
                    id="keyName"
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production API"
                    required
                  />
                </div>
                <div className="settings-form__field">
                  <label>Scopes</label>
                  <div className="settings-checkbox-group">
                    {['read', 'write', 'transform'].map((scope) => (
                      <label key={scope} className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                        />
                        {scope}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="settings-form__field">
                  <label htmlFor="keyExpiry">Expires</label>
                  <select
                    id="keyExpiry"
                    value={newKeyExpiry}
                    onChange={(e) => setNewKeyExpiry(e.target.value)}
                  >
                    <option value="30d">30 days</option>
                    <option value="90d">90 days</option>
                    <option value="365d">1 year</option>
                    <option value="never">Never</option>
                  </select>
                </div>
                <div className="settings-modal__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={handleCloseNewKey}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={creating || !newKeyName}
                  >
                    {creating ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
