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
  status: 'connected' | 'disconnected' | 'error' | 'healthy' | 'unhealthy' | 'unknown' | 'degraded';
  enabled: boolean;
  endpoint?: string;
  apiKeyConfigured: boolean;
  apiKeyHint?: string;
  models: ProviderModel[];
  healthStatus?: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastHealthCheck?: string;
  healthError?: string;
  errorMessage?: string;
  rateLimitRpm?: number;
  costPerMtokInput?: number;
  costPerMtokOutput?: number;
  priority?: number;
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

  // API key validation state
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyValidationResult, setKeyValidationResult] = useState<{
    valid: boolean;
    error?: string;
    availableModels?: string[];
  } | null>(null);

  // Ollama discovery state
  const [discoveringOllama, setDiscoveringOllama] = useState(false);
  const [ollamaDiscoveryResult, setOllamaDiscoveryResult] = useState<{
    success: boolean;
    modelsFound: number;
    error?: string;
  } | null>(null);

  // Health check state
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);

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
        apiKeyHint: p.apiKeyHint,
        models: p.models.map((m) => ({
          id: m.id,
          name: m.name,
          category: (m.type === 'embedding' ? 'embedding' : 'completion') as 'completion' | 'embedding',
          isDefault: false,
        })),
        healthStatus: p.healthStatus,
        lastHealthCheck: p.lastHealthCheck,
        healthError: p.healthError,
        errorMessage: p.errorMessage ?? p.healthError,
        rateLimitRpm: p.rateLimitRpm,
        costPerMtokInput: p.costPerMtokInput,
        costPerMtokOutput: p.costPerMtokOutput,
        priority: p.priority,
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
    setKeyValidationResult(null);
    setOllamaDiscoveryResult(null);
    const provider = providers.find((p) => p.id === id);
    if (provider) {
      setEditEndpoint(provider.endpoint || '');
      setEditRateLimit(provider.rateLimitRpm?.toString() || '');
      setEditApiKey('');
    }
  };

  const handleToggleEnabled = async (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    try {
      await api.admin.updateProvider(id, { enabled: !provider.enabled });
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
      );
    } catch (err) {
      console.error('Failed to toggle provider:', err);
      // Fallback to local state update
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
      );
    }
  };

  const handleTestConnection = async (id: string) => {
    setCheckingHealth(id);
    try {
      const result = await api.admin.checkProviderHealth(id);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: result.status as Provider['status'],
                healthStatus: result.status as Provider['healthStatus'],
                lastHealthCheck: result.checkedAt,
                healthError: result.error,
                errorMessage: result.error,
              }
            : p
        )
      );
    } catch (err) {
      console.error('Health check failed:', err);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: 'error', errorMessage: 'Health check failed' }
            : p
        )
      );
    } finally {
      setCheckingHealth(null);
    }
  };

  const handleValidateApiKey = async () => {
    if (!selectedProviderId || !editApiKey) return;

    setValidatingKey(true);
    setKeyValidationResult(null);

    try {
      const result = await api.admin.validateProviderKey(selectedProviderId, editApiKey);
      setKeyValidationResult({
        valid: result.valid,
        error: result.error,
        availableModels: result.availableModels,
      });
    } catch (err) {
      setKeyValidationResult({
        valid: false,
        error: err instanceof Error ? err.message : 'Validation failed',
      });
    } finally {
      setValidatingKey(false);
    }
  };

  const handleDiscoverOllamaModels = async () => {
    setDiscoveringOllama(true);
    setOllamaDiscoveryResult(null);

    try {
      const result = await api.admin.discoverOllamaModels();
      setOllamaDiscoveryResult({
        success: result.success,
        modelsFound: result.modelsFound,
        error: result.error,
      });

      // Refresh providers list to show new models
      if (result.success) {
        await fetchProviders();
      }
    } catch (err) {
      setOllamaDiscoveryResult({
        success: false,
        modelsFound: 0,
        error: err instanceof Error ? err.message : 'Discovery failed',
      });
    } finally {
      setDiscoveringOllama(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!selectedProviderId) return;

    try {
      await api.admin.removeProviderApiKey(selectedProviderId);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === selectedProviderId
            ? { ...p, apiKeyConfigured: false, apiKeyHint: undefined }
            : p
        )
      );
      setEditApiKey('');
      setKeyValidationResult(null);
    } catch (err) {
      console.error('Failed to remove API key:', err);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedProviderId) return;

    try {
      await api.admin.updateProvider(selectedProviderId, {
        endpoint: editEndpoint || undefined,
        apiKey: editApiKey || undefined,
      });

      setProviders((prev) =>
        prev.map((p) =>
          p.id === selectedProviderId
            ? {
                ...p,
                endpoint: editEndpoint || p.endpoint,
                rateLimitRpm: editRateLimit ? parseInt(editRateLimit, 10) : p.rateLimitRpm,
                apiKeyConfigured: editApiKey ? true : p.apiKeyConfigured,
                apiKeyHint: editApiKey ? `...${editApiKey.slice(-4)}` : p.apiKeyHint,
              }
            : p
        )
      );
      setEditMode(false);
      setEditApiKey('');
      setKeyValidationResult(null);
    } catch (err) {
      console.error('Failed to save config:', err);
      // Still update local state as fallback
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
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const getStatusIcon = (status: Provider['status']) => {
    switch (status) {
      case 'connected':
      case 'healthy':
        return '●';
      case 'disconnected':
      case 'unhealthy':
        return '○';
      case 'error':
        return '!';
      case 'degraded':
        return '◐';
      case 'unknown':
      default:
        return '?';
    }
  };

  const getStatusClass = (status: Provider['status']) => {
    switch (status) {
      case 'connected':
      case 'healthy':
        return 'connected';
      case 'disconnected':
      case 'unhealthy':
        return 'disconnected';
      case 'error':
        return 'error';
      case 'degraded':
        return 'error';
      default:
        return 'disconnected';
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
                        className={`admin-providers__item-status admin-providers__item-status--${getStatusClass(provider.status)}`}
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

              {ollamaDiscoveryResult && selectedProvider.id === 'ollama' && (
                <div className={`admin-alert ${ollamaDiscoveryResult.success ? 'admin-alert--success' : 'admin-alert--error'}`}>
                  <span className="admin-alert__icon">{ollamaDiscoveryResult.success ? '✓' : '!'}</span>
                  <div className="admin-alert__content">
                    <p className="admin-alert__message">
                      {ollamaDiscoveryResult.success
                        ? `Discovered ${ollamaDiscoveryResult.modelsFound} models from Ollama`
                        : `Discovery failed: ${ollamaDiscoveryResult.error}`}
                    </p>
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
                            API Key {selectedProvider.apiKeyConfigured && selectedProvider.apiKeyHint && `(${selectedProvider.apiKeyHint})`}
                          </label>
                          <div className="admin-form__input-group">
                            <input
                              type="password"
                              className="admin-form__input"
                              value={editApiKey}
                              onChange={(e) => {
                                setEditApiKey(e.target.value);
                                setKeyValidationResult(null);
                              }}
                              placeholder="sk-••••••••••••"
                            />
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={handleValidateApiKey}
                              disabled={!editApiKey || validatingKey}
                            >
                              {validatingKey ? 'Validating...' : 'Validate'}
                            </button>
                          </div>
                          {keyValidationResult && (
                            <div className={`admin-form__validation ${keyValidationResult.valid ? 'admin-form__validation--success' : 'admin-form__validation--error'}`}>
                              {keyValidationResult.valid ? (
                                <>
                                  <span className="admin-form__validation-icon">✓</span>
                                  <span>Valid key</span>
                                  {keyValidationResult.availableModels && (
                                    <span className="admin-form__validation-detail">
                                      ({keyValidationResult.availableModels.length} models available)
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="admin-form__validation-icon">✗</span>
                                  <span>{keyValidationResult.error}</span>
                                </>
                              )}
                            </div>
                          )}
                          <span className="admin-form__hint">
                            {selectedProvider.apiKeyConfigured
                              ? 'Enter new key to replace, or leave blank to keep existing'
                              : 'Enter API key for this provider'}
                          </span>
                          {selectedProvider.apiKeyConfigured && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm btn--danger"
                              onClick={handleRemoveApiKey}
                              style={{ marginTop: 'var(--space-xs)' }}
                            >
                              Remove API Key
                            </button>
                          )}
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
                            {selectedProvider.apiKeyConfigured
                              ? `Configured ${selectedProvider.apiKeyHint ? `(${selectedProvider.apiKeyHint})` : ''}`
                              : 'Not configured'}
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
                          disabled={checkingHealth === selectedProvider.id}
                        >
                          {checkingHealth === selectedProvider.id ? 'Checking...' : 'Test Connection'}
                        </button>
                        {selectedProvider.id === 'ollama' && (
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={handleDiscoverOllamaModels}
                            disabled={discoveringOllama}
                          >
                            {discoveringOllama ? 'Discovering...' : 'Discover Models'}
                          </button>
                        )}
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
