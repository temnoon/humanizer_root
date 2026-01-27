/**
 * Admin Models Page
 *
 * Model registry management with list, status, and configuration capabilities.
 *
 * @module @humanizer/studio/components/admin/AdminModels
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Model {
  id: string;
  name: string;
  provider: string;
  category: string;
  dimensions?: number;
  contextWindow?: number;
  status: 'available' | 'unavailable' | 'deprecated';
  isDefault?: boolean;
  costPerMtok?: {
    input: number;
    output: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminModels() {
  const api = useApi();

  // State
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  // Selected model for details
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call when endpoint is implemented
      // const result = await api.admin.listModels();

      // Mock data for UI development
      const mockModels: Model[] = [
        {
          id: 'nomic-embed-text:latest',
          name: 'Nomic Embed Text',
          provider: 'ollama',
          category: 'embedding',
          dimensions: 768,
          status: 'available',
          isDefault: true,
        },
        {
          id: 'llama3.2:3b',
          name: 'Llama 3.2 3B',
          provider: 'ollama',
          category: 'completion',
          contextWindow: 8192,
          status: 'available',
        },
        {
          id: 'llama3.2:8b',
          name: 'Llama 3.2 8B',
          provider: 'ollama',
          category: 'completion',
          contextWindow: 8192,
          status: 'available',
          isDefault: true,
        },
        {
          id: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          provider: 'anthropic',
          category: 'completion',
          contextWindow: 200000,
          status: 'available',
          costPerMtok: { input: 3, output: 15 },
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          provider: 'anthropic',
          category: 'completion',
          contextWindow: 200000,
          status: 'available',
          costPerMtok: { input: 0.25, output: 1.25 },
        },
        {
          id: 'gpt-4-turbo-preview',
          name: 'GPT-4 Turbo',
          provider: 'openai',
          category: 'completion',
          contextWindow: 128000,
          status: 'available',
          costPerMtok: { input: 10, output: 30 },
        },
        {
          id: 'text-embedding-3-small',
          name: 'Text Embedding 3 Small',
          provider: 'openai',
          category: 'embedding',
          dimensions: 1536,
          status: 'available',
          costPerMtok: { input: 0.02, output: 0 },
        },
      ];

      setModels(mockModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  // Get unique categories and providers for filters
  const categories = ['all', ...new Set(models.map(m => m.category))];
  const providers = ['all', ...new Set(models.map(m => m.provider))];

  // Filter models
  const filteredModels = models.filter((m) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!m.name.toLowerCase().includes(searchLower) &&
          !m.id.toLowerCase().includes(searchLower) &&
          !m.provider.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    if (providerFilter !== 'all' && m.provider !== providerFilter) return false;
    return true;
  });

  const selectedModel = selectedModelId ? models.find(m => m.id === selectedModelId) : null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="admin-models">
      {/* Header */}
      <div className="admin-models__header">
        <h1 className="admin-models__title">Model Registry</h1>
        <div className="admin-models__stats">
          <span className="admin-models__stat">{models.length} models</span>
          <span className="admin-models__stat">
            {models.filter(m => m.status === 'available').length} available
          </span>
        </div>
      </div>

      <div className="admin-models__layout">
        {/* Model List Panel */}
        <div className="admin-models__list-panel">
          {/* Filters */}
          <div className="admin-models__filters">
            <input
              type="text"
              className="admin-form__input"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="admin-models__filter-row">
              <select
                className="admin-form__select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
              <select
                className="admin-form__select"
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
              >
                {providers.map(prov => (
                  <option key={prov} value={prov}>
                    {prov === 'all' ? 'All Providers' : prov}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Model List */}
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
          ) : filteredModels.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty__icon">AI</span>
              <h3 className="admin-empty__title">No Models Found</h3>
              <p className="admin-empty__description">
                {search ? 'Try a different search term.' : 'No models configured.'}
              </p>
            </div>
          ) : (
            <div className="admin-models__list">
              {filteredModels.map((model) => (
                <button
                  key={model.id}
                  className={`admin-models__item ${selectedModelId === model.id ? 'admin-models__item--selected' : ''}`}
                  onClick={() => setSelectedModelId(model.id)}
                >
                  <div className="admin-models__item-info">
                    <div className="admin-models__item-header">
                      <span className="admin-models__item-name">{model.name}</span>
                      {model.isDefault && (
                        <span className="admin-badge admin-badge--primary">Default</span>
                      )}
                    </div>
                    <div className="admin-models__item-id">{model.id}</div>
                    <div className="admin-models__item-tags">
                      <span className="admin-badge admin-badge--neutral">{model.provider}</span>
                      <span className="admin-badge admin-badge--neutral">{model.category}</span>
                    </div>
                  </div>
                  <div className={`admin-models__item-status admin-models__item-status--${model.status}`}>
                    {model.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model Detail Panel */}
        <div className="admin-models__detail-panel">
          {selectedModel ? (
            <div className="admin-model-detail">
              <div className="admin-model-detail__header">
                <div>
                  <h2 className="admin-model-detail__title">{selectedModel.name}</h2>
                  <div className="admin-model-detail__id">{selectedModel.id}</div>
                </div>
                <div className={`admin-model-detail__status admin-model-detail__status--${selectedModel.status}`}>
                  {selectedModel.status}
                </div>
              </div>

              <div className="admin-model-detail__content">
                {/* Provider & Category */}
                <div className="admin-model-detail__section">
                  <h3 className="admin-model-detail__section-title">Configuration</h3>
                  <div className="admin-model-detail__grid">
                    <div className="admin-model-detail__field">
                      <span className="admin-model-detail__label">Provider</span>
                      <span className="admin-model-detail__value">{selectedModel.provider}</span>
                    </div>
                    <div className="admin-model-detail__field">
                      <span className="admin-model-detail__label">Category</span>
                      <span className="admin-model-detail__value">{selectedModel.category}</span>
                    </div>
                    {selectedModel.dimensions && (
                      <div className="admin-model-detail__field">
                        <span className="admin-model-detail__label">Dimensions</span>
                        <span className="admin-model-detail__value">{selectedModel.dimensions}</span>
                      </div>
                    )}
                    {selectedModel.contextWindow && (
                      <div className="admin-model-detail__field">
                        <span className="admin-model-detail__label">Context Window</span>
                        <span className="admin-model-detail__value">
                          {selectedModel.contextWindow.toLocaleString()} tokens
                        </span>
                      </div>
                    )}
                    <div className="admin-model-detail__field">
                      <span className="admin-model-detail__label">Default</span>
                      <span className="admin-model-detail__value">
                        {selectedModel.isDefault ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cost */}
                {selectedModel.costPerMtok && (
                  <div className="admin-model-detail__section">
                    <h3 className="admin-model-detail__section-title">Cost per Million Tokens</h3>
                    <div className="admin-model-detail__grid">
                      <div className="admin-model-detail__field">
                        <span className="admin-model-detail__label">Input</span>
                        <span className="admin-model-detail__value">
                          ${selectedModel.costPerMtok.input.toFixed(2)}
                        </span>
                      </div>
                      <div className="admin-model-detail__field">
                        <span className="admin-model-detail__label">Output</span>
                        <span className="admin-model-detail__value">
                          ${selectedModel.costPerMtok.output.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="admin-model-detail__section">
                  <h3 className="admin-model-detail__section-title">Actions</h3>
                  <div className="admin-model-detail__actions">
                    {!selectedModel.isDefault && (
                      <button className="btn btn--secondary btn--sm">
                        Set as Default
                      </button>
                    )}
                    <button className="btn btn--ghost btn--sm">
                      Test Connection
                    </button>
                    {selectedModel.status === 'available' && (
                      <button className="btn btn--ghost btn--sm btn--danger">
                        Disable
                      </button>
                    )}
                    {selectedModel.status === 'unavailable' && (
                      <button className="btn btn--ghost btn--sm">
                        Enable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">AI</span>
              <h3 className="admin-empty__title">Select a Model</h3>
              <p className="admin-empty__description">
                Choose a model from the list to view details and configuration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
