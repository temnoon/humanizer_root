/**
 * Admin Providers Page
 *
 * LLM provider management with configuration, health status, and controls.
 *
 * @module @humanizer/studio/components/admin/AdminProviders
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ProviderModel {
  id: string;
  name: string;
  category: 'completion' | 'embedding';
  isDefault?: boolean;
}

interface Provider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  status: 'connected' | 'disconnected' | 'error';
  enabled: boolean;
  endpoint?: string;
  apiKeyConfigured: boolean;
  models: ProviderModel[];
  lastHealthCheck?: string;
  errorMessage?: string;
  rateLimitRpm?: number;
  costPerMtokInput?: number;
  costPerMtokOutput?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_PROVIDERS: Provider[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'local',
    status: 'connected',
    enabled: true,
    endpoint: 'http://localhost:11434',
    apiKeyConfigured: false,
    models: [
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B', category: 'completion' },
      { id: 'llama3.2:8b', name: 'Llama 3.2 8B', category: 'completion', isDefault: true },
      { id: 'nomic-embed-text:latest', name: 'Nomic Embed Text', category: 'embedding', isDefault: true },
    ],
    lastHealthCheck: new Date().toISOString(),
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'cloud',
    status: 'connected',
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKeyConfigured: true,
    models: [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', category: 'completion' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', category: 'completion', isDefault: true },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', category: 'completion' },
    ],
    lastHealthCheck: new Date().toISOString(),
    rateLimitRpm: 1000,
    costPerMtokInput: 3,
    costPerMtokOutput: 15,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    status: 'disconnected',
    enabled: false,
    endpoint: 'https://api.openai.com/v1',
    apiKeyConfigured: false,
    models: [
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', category: 'completion' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', category: 'completion' },
      { id: 'text-embedding-3-small', name: 'Text Embedding 3 Small', category: 'embedding' },
    ],
    lastHealthCheck: undefined,
    rateLimitRpm: 500,
    costPerMtokInput: 10,
    costPerMtokOutput: 30,
  },
  {
    id: 'groq',
    name: 'Groq',
    type: 'cloud',
    status: 'error',
    enabled: true,
    endpoint: 'https://api.groq.com',
    apiKeyConfigured: true,
    models: [
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', category: 'completion' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', category: 'completion' },
    ],
    lastHealthCheck: new Date(Date.now() - 300000).toISOString(),
    errorMessage: 'Rate limit exceeded. Retry after 60 seconds.',
    rateLimitRpm: 30,
    costPerMtokInput: 0.59,
    costPerMtokOutput: 0.79,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminProviders() {
  const api = useApi();

  // State
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editEndpoint, setEditEndpoint] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editRateLimit, setEditRateLimit] = useState('');

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.admin.listProviders();

      // Map API response to local Provider interface
      const apiProviders: Provider[] = result.providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        enabled: p.enabled,
        endpoint: p.endpoint,
        apiKeyConfigured: p.apiKeyConfigured,
        models: p.models.map((m) => ({
          id: m.id,
          name: m.name,
          category: (m.type === 'embedding' ? 'embedding' : 'completion') as 'completion' | 'embedding',
          isDefault: false,
        })),
        lastHealthCheck: p.lastHealthCheck,
        errorMessage: p.errorMessage,
        rateLimitRpm: p.rateLimitRpm,
        costPerMtokInput: p.costPerMtokInput,
        costPerMtokOutput: p.costPerMtokOutput,
      }));

      if (apiProviders.length > 0) {
        setProviders(apiProviders);
      } else {
        setProviders(MOCK_PROVIDERS);
      }
    } catch (err) {
      console.warn('Providers endpoint not available, using mock data:', err);
      setProviders(MOCK_PROVIDERS);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const selectedProvider = selectedProviderId
    ? providers.find((p) => p.id === selectedProviderId)
    : null;

  const handleSelectProvider = (id: string) => {
    setSelectedProviderId(id);
    setEditMode(false);
    const provider = providers.find((p) => p.id === id);
    if (provider) {
      setEditEndpoint(provider.endpoint || '');
      setEditRateLimit(provider.rateLimitRpm?.toString() || '');
      setEditApiKey('');
    }
  };

  const handleToggleEnabled = (id: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleTestConnection = async (id: string) => {
    // TODO: Implement real health check
    console.log('Testing connection for:', id);
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: 'connected', lastHealthCheck: new Date().toISOString(), errorMessage: undefined }
          : p
      )
    );
  };

  const handleSaveConfig = () => {
    if (!selectedProviderId) return;

    setProviders((prev) =>
      prev.map((p) =>
        p.id === selectedProviderId
          ? {
              ...p,
              endpoint: editEndpoint || p.endpoint,
              rateLimitRpm: editRateLimit ? parseInt(editRateLimit, 10) : p.rateLimitRpm,
              apiKeyConfigured: editApiKey ? true : p.apiKeyConfigured,
            }
          : p
      )
    );
    setEditMode(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const getStatusIcon = (status: Provider['status']) => {
    switch (status) {
      case 'connected':
        return '●';
      case 'disconnected':
        return '○';
      case 'error':
        return '!';
      default:
        return '?';
    }
  };

  const formatLastCheck = (iso?: string) => {
    if (!iso) return 'Never';
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="admin-providers">
      {/* Header */}
      <div className="admin-providers__header">
        <h1 className="admin-providers__title">Provider Configuration</h1>
        <div className="admin-providers__stats">
          <span className="admin-providers__stat">
            {providers.filter((p) => p.enabled).length}/{providers.length} enabled
          </span>
          <span className="admin-providers__stat">
            {providers.filter((p) => p.status === 'connected').length} connected
          </span>
        </div>
      </div>

      <div className="admin-providers__layout">
        {/* Provider List Panel */}
        <div className="admin-providers__list-panel">
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
            <div className="admin-providers__list">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  className={`admin-providers__item ${
                    selectedProviderId === provider.id ? 'admin-providers__item--selected' : ''
                  }`}
                  onClick={() => handleSelectProvider(provider.id)}
                >
                  <div className="admin-providers__item-info">
                    <div className="admin-providers__item-header">
                      <span className="admin-providers__item-name">{provider.name}</span>
                      <span
                        className={`admin-providers__item-status admin-providers__item-status--${provider.status}`}
                      >
                        {getStatusIcon(provider.status)}
                      </span>
                    </div>
                    <div className="admin-providers__item-meta">
                      <span className="admin-badge admin-badge--neutral">{provider.type}</span>
                      <span className="admin-providers__item-models">
                        {provider.models.length} models
                      </span>
                    </div>
                  </div>
                  <label
                    className="admin-providers__toggle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={() => handleToggleEnabled(provider.id)}
                    />
                    <span className="admin-providers__toggle-slider" />
                  </label>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Provider Detail Panel */}
        <div className="admin-providers__detail-panel">
          {selectedProvider ? (
            <div className="admin-provider-detail">
              <div className="admin-provider-detail__header">
                <div>
                  <h2 className="admin-provider-detail__title">{selectedProvider.name}</h2>
                  <div className="admin-provider-detail__type">
                    {selectedProvider.type === 'local' ? 'Local Provider' : 'Cloud Provider'}
                  </div>
                </div>
                <div
                  className={`admin-provider-detail__status admin-provider-detail__status--${selectedProvider.status}`}
                >
                  {selectedProvider.status}
                </div>
              </div>

              {selectedProvider.errorMessage && (
                <div className="admin-alert admin-alert--error">
                  <span className="admin-alert__icon">!</span>
                  <div className="admin-alert__content">
                    <p className="admin-alert__message">{selectedProvider.errorMessage}</p>
                  </div>
                </div>
              )}

              <div className="admin-provider-detail__content">
                {/* Connection */}
                <div className="admin-provider-detail__section">
                  <h3 className="admin-provider-detail__section-title">Connection</h3>
                  {editMode ? (
                    <div className="admin-provider-detail__form">
                      <div className="admin-form__group">
                        <label className="admin-form__label">Endpoint URL</label>
                        <input
                          type="text"
                          className="admin-form__input"
                          value={editEndpoint}
                          onChange={(e) => setEditEndpoint(e.target.value)}
                          placeholder="https://api.provider.com"
                        />
                      </div>
                      {selectedProvider.type === 'cloud' && (
                        <div className="admin-form__group">
                          <label className="admin-form__label">
                            API Key {selectedProvider.apiKeyConfigured && '(configured)'}
                          </label>
                          <input
                            type="password"
                            className="admin-form__input"
                            value={editApiKey}
                            onChange={(e) => setEditApiKey(e.target.value)}
                            placeholder="sk-••••••••••••"
                          />
                          <span className="admin-form__hint">
                            Leave blank to keep existing key
                          </span>
                        </div>
                      )}
                      <div className="admin-form__group">
                        <label className="admin-form__label">Rate Limit (RPM)</label>
                        <input
                          type="number"
                          className="admin-form__input"
                          value={editRateLimit}
                          onChange={(e) => setEditRateLimit(e.target.value)}
                          placeholder="60"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="admin-provider-detail__grid">
                      <div className="admin-provider-detail__field">
                        <span className="admin-provider-detail__label">Endpoint</span>
                        <span className="admin-provider-detail__value">
                          {selectedProvider.endpoint || 'Not configured'}
                        </span>
                      </div>
                      {selectedProvider.type === 'cloud' && (
                        <div className="admin-provider-detail__field">
                          <span className="admin-provider-detail__label">API Key</span>
                          <span className="admin-provider-detail__value">
                            {selectedProvider.apiKeyConfigured ? 'Configured' : 'Not configured'}
                          </span>
                        </div>
                      )}
                      <div className="admin-provider-detail__field">
                        <span className="admin-provider-detail__label">Rate Limit</span>
                        <span className="admin-provider-detail__value">
                          {selectedProvider.rateLimitRpm
                            ? `${selectedProvider.rateLimitRpm} RPM`
                            : 'Unlimited'}
                        </span>
                      </div>
                      <div className="admin-provider-detail__field">
                        <span className="admin-provider-detail__label">Last Health Check</span>
                        <span className="admin-provider-detail__value">
                          {formatLastCheck(selectedProvider.lastHealthCheck)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cost (for cloud providers) */}
                {selectedProvider.type === 'cloud' &&
                  (selectedProvider.costPerMtokInput || selectedProvider.costPerMtokOutput) && (
                    <div className="admin-provider-detail__section">
                      <h3 className="admin-provider-detail__section-title">Pricing</h3>
                      <div className="admin-provider-detail__grid">
                        <div className="admin-provider-detail__field">
                          <span className="admin-provider-detail__label">Input Cost</span>
                          <span className="admin-provider-detail__value">
                            ${selectedProvider.costPerMtokInput?.toFixed(2)}/MTok
                          </span>
                        </div>
                        <div className="admin-provider-detail__field">
                          <span className="admin-provider-detail__label">Output Cost</span>
                          <span className="admin-provider-detail__value">
                            ${selectedProvider.costPerMtokOutput?.toFixed(2)}/MTok
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Models */}
                <div className="admin-provider-detail__section">
                  <h3 className="admin-provider-detail__section-title">Available Models</h3>
                  <div className="admin-provider-detail__models">
                    {selectedProvider.models.map((model) => (
                      <div key={model.id} className="admin-provider-detail__model">
                        <div className="admin-provider-detail__model-info">
                          <span className="admin-provider-detail__model-name">{model.name}</span>
                          <span className="admin-provider-detail__model-id">{model.id}</span>
                        </div>
                        <div className="admin-provider-detail__model-tags">
                          <span className="admin-badge admin-badge--neutral">{model.category}</span>
                          {model.isDefault && (
                            <span className="admin-badge admin-badge--primary">Default</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="admin-provider-detail__section">
                  <h3 className="admin-provider-detail__section-title">Actions</h3>
                  <div className="admin-provider-detail__actions">
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
                          className="btn btn--ghost btn--sm"
                          onClick={() => handleTestConnection(selectedProvider.id)}
                        >
                          Test Connection
                        </button>
                        <button
                          className={`btn btn--ghost btn--sm ${
                            selectedProvider.enabled ? 'btn--danger' : ''
                          }`}
                          onClick={() => handleToggleEnabled(selectedProvider.id)}
                        >
                          {selectedProvider.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">API</span>
              <h3 className="admin-empty__title">Select a Provider</h3>
              <p className="admin-empty__description">
                Choose a provider from the list to view and edit configuration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
