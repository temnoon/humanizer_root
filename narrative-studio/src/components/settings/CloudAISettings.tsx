import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Cloud AI Settings - Model Preferences per Use Case
 *
 * Fetches available models from the model registry and allows users
 * to set preferences for each transformation use case.
 *
 * Models are filtered based on:
 * 1. User's tier (free, pro, premium, admin)
 * 2. Configured API keys (for external providers)
 */

interface ModelInfo {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow: number;
  costPerKInput: number;
  costPerKOutput: number;
  requiresApiKey: boolean;
  tierRequired: string;
}

interface ModelsByProvider {
  [provider: string]: ModelInfo[];
}

// Use case definitions with display names and descriptions
const USE_CASES = [
  {
    id: 'general',
    name: 'General Transformations',
    description: 'Default model for most operations',
    icon: '🔄',
  },
  {
    id: 'persona',
    name: 'Persona Transformation',
    description: 'Apply writing style of authors/personas',
    icon: '👤',
  },
  {
    id: 'style',
    name: 'Style Adjustment',
    description: 'Modify tone, formality, and voice',
    icon: '✨',
  },
  {
    id: 'translation',
    name: 'Translation',
    description: 'Translate between languages',
    icon: '🌐',
  },
  {
    id: 'round_trip',
    name: 'Round-Trip Translation',
    description: 'Translate away and back for paraphrasing',
    icon: '🔁',
  },
  {
    id: 'detection',
    name: 'AI Detection',
    description: 'Analyze text for AI patterns',
    icon: '🔍',
  },
  {
    id: 'extraction',
    name: 'Profile Extraction',
    description: 'Extract writing profiles from samples',
    icon: '📊',
  },
] as const;

type UseCaseId = typeof USE_CASES[number]['id'];

// Fallback models when API isn't configured
const FALLBACK_MODELS: ModelInfo[] = [
  {
    id: 'cf-llama-3.3-70b',
    provider: 'cloudflare',
    modelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    displayName: 'Llama 3.3 70B Fast (Cloudflare)',
    capabilities: ['persona', 'style', 'translation', 'round_trip', 'detection', 'general', 'extraction'],
    contextWindow: 128000,
    costPerKInput: 0,
    costPerKOutput: 0,
    requiresApiKey: false,
    tierRequired: 'free',
  },
  {
    id: 'cf-llama-3.1-8b',
    provider: 'cloudflare',
    modelId: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B (Cloudflare)',
    capabilities: ['persona', 'style', 'translation', 'round_trip', 'detection', 'general', 'extraction'],
    contextWindow: 128000,
    costPerKInput: 0,
    costPerKOutput: 0,
    requiresApiKey: false,
    tierRequired: 'free',
  },
];

// Provider display names and colors
const PROVIDER_META: Record<string, { name: string; color: string }> = {
  cloudflare: { name: 'Cloudflare (Free)', color: 'var(--accent-primary)' },
  openai: { name: 'OpenAI', color: '#10a37f' },
  anthropic: { name: 'Anthropic', color: '#d4a373' },
  google: { name: 'Google AI', color: '#4285f4' },
  groq: { name: 'Groq', color: '#f55036' },
  ollama: { name: 'Ollama (Local)', color: '#666' },
};

export function CloudAISettings() {
  const { user } = useAuth();
  const isPaidTier = ['pro', 'premium', 'admin'].includes(user?.role || '');
  const getToken = () => localStorage.getItem('narrative-studio-auth-token');

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [preferences, setPreferences] = useState<Record<UseCaseId, string | null>>({
    general: null,
    persona: null,
    style: null,
    translation: null,
    round_trip: null,
    detection: null,
    extraction: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'https://npe-api.tem-527.workers.dev';

  // Fetch available models and preferences
  useEffect(() => {
    async function loadData() {
      const token = getToken();

      try {
        // Fetch available models (works for both auth and unauth)
        const modelsEndpoint = token
          ? `${API_BASE}/api/model-settings/models/available`
          : `${API_BASE}/api/model-settings/models`;

        const modelsRes = await fetch(modelsEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (modelsRes.ok) {
          const data = await modelsRes.json();
          setModels(data.models || []);
        } else {
          // Use fallback models
          setModels(FALLBACK_MODELS);
        }

        // Fetch preferences if authenticated
        if (token) {
          const prefsRes = await fetch(`${API_BASE}/api/model-settings/preferences`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (prefsRes.ok) {
            const prefsData = await prefsRes.json();
            setPreferences(prefsData.preferences || {});
          }
        }
      } catch (err) {
        console.error('Failed to load model settings:', err);
        setModels(FALLBACK_MODELS);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, API_BASE]);

  // Group models by provider
  const modelsByProvider: ModelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as ModelsByProvider);

  // Get models that support a specific use case
  const getModelsForUseCase = (useCase: string): ModelInfo[] => {
    return models.filter((m) => m.capabilities.includes(useCase));
  };

  // Save preference to server
  const handlePreferenceChange = async (useCase: UseCaseId, modelId: string | null) => {
    const token = getToken();
    if (!token) {
      setError('Please log in to save preferences');
      return;
    }

    setSaving(useCase);
    setError(null);
    setSuccess(null);

    try {
      if (modelId === null || modelId === '') {
        // Remove preference
        await fetch(`${API_BASE}/api/model-settings/preferences/${useCase}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // Set preference
        const res = await fetch(`${API_BASE}/api/model-settings/preferences/${useCase}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ modelId }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to save preference');
        }
      }

      setPreferences((prev) => ({ ...prev, [useCase]: modelId }));
      setSuccess(`${USE_CASES.find((u) => u.id === useCase)?.name} preference saved`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preference');
    } finally {
      setSaving(null);
    }
  };

  // Provider summary
  const providerCount = Object.keys(modelsByProvider).length;
  const externalProviders = Object.keys(modelsByProvider).filter(
    (p) => !['cloudflare', 'ollama'].includes(p)
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading model settings...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          Model Preferences
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Choose which AI model to use for each type of transformation.
          {!isPaidTier && (
            <span style={{ color: 'var(--warning)' }}>
              {' '}
              Upgrade to Pro for external providers.
            </span>
          )}
        </p>
      </div>

      {/* Provider Summary */}
      <div
        className="rounded-lg p-4 flex flex-wrap gap-3"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Available providers:
        </span>
        {Object.keys(modelsByProvider).map((provider) => (
          <span
            key={provider}
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: PROVIDER_META[provider]?.color || 'var(--text-primary)',
              border: `1px solid ${PROVIDER_META[provider]?.color || 'var(--border-color)'}`,
            }}
          >
            {PROVIDER_META[provider]?.name || provider} ({modelsByProvider[provider].length})
          </span>
        ))}
      </div>

      {/* Status Messages */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid var(--accent-red, #dc2626)',
            color: 'var(--accent-red, #dc2626)',
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid var(--success)',
            color: 'var(--success)',
          }}
        >
          {success}
        </div>
      )}

      {/* Use Case Preferences */}
      <div className="space-y-4">
        {USE_CASES.map((useCase) => {
          const availableModels = getModelsForUseCase(useCase.id);
          const currentPref = preferences[useCase.id];
          const selectedModel = currentPref
            ? models.find((m) => m.id === currentPref)
            : null;

          return (
            <div
              key={useCase.id}
              className="rounded-lg p-4"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg">{useCase.icon}</span>
                  <div>
                    <h4 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      {useCase.name}
                    </h4>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {useCase.description}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 min-w-[200px]">
                  <select
                    value={currentPref || ''}
                    onChange={(e) =>
                      handlePreferenceChange(useCase.id, e.target.value || null)
                    }
                    disabled={saving === useCase.id}
                    className="w-full px-3 py-1.5 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">Use default</option>
                    {Object.entries(modelsByProvider).map(([provider, providerModels]) => {
                      const filteredModels = providerModels.filter((m) =>
                        m.capabilities.includes(useCase.id)
                      );
                      if (filteredModels.length === 0) return null;

                      return (
                        <optgroup key={provider} label={PROVIDER_META[provider]?.name || provider}>
                          {filteredModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.displayName}
                              {model.costPerKInput > 0 &&
                                ` (~$${((model.costPerKInput + model.costPerKOutput) * 0.5).toFixed(4)}/1K)`}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Show current selection details */}
              {selectedModel && (
                <div
                  className="mt-3 pt-3 flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--border-color)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Using:{' '}
                    <span style={{ color: PROVIDER_META[selectedModel.provider]?.color }}>
                      {selectedModel.displayName}
                    </span>
                  </span>
                  {selectedModel.costPerKInput > 0 && (
                    <span
                      className="text-xs font-mono"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      ${selectedModel.costPerKInput}/1K in • $
                      {selectedModel.costPerKOutput}/1K out
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* External API Notice */}
      {externalProviders.length > 0 && (
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid var(--success)',
          }}
        >
          <h4 className="font-medium text-sm mb-2" style={{ color: 'var(--success)' }}>
            External APIs Connected
          </h4>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            You have {externalProviders.length} external provider
            {externalProviders.length > 1 ? 's' : ''} configured:{' '}
            {externalProviders.map((p) => PROVIDER_META[p]?.name || p).join(', ')}.
            Usage costs will be billed to your API keys.
          </p>
        </div>
      )}

      {/* Deep Analysis Section (Paid Tiers Only) */}
      <DeepAnalysisSettings isPaidTier={isPaidTier} />

      {/* Info Section */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <h4 className="font-medium text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
          About Model Selection
        </h4>
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>• Cloudflare models are free and included with your account</li>
          <li>• External providers (OpenAI, Anthropic, Google, Groq) require API keys</li>
          <li>• Configure API keys in the &quot;API Keys&quot; tab</li>
          <li>• &quot;Use default&quot; selects the best available model automatically</li>
          <li>• Costs shown are estimates per 1,000 tokens</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Deep Analysis Settings Section
 * Controls Subjective Intentional Constraint (SIC) analysis
 */
function DeepAnalysisSettings({ isPaidTier }: { isPaidTier: boolean }) {
  const [enabled, setEnabled] = useState(() => getDeepAnalysisPreference());

  const handleToggle = () => {
    if (!isPaidTier) return;
    const newValue = !enabled;
    setEnabled(newValue);
    setDeepAnalysisPreference(newValue);
  };

  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        opacity: isPaidTier ? 1 : 0.6,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔬</span>
            <h4 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              Deep Constraint Analysis
            </h4>
            {!isPaidTier && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--warning)',
                  color: 'white',
                }}
              >
                Pro
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Uses Subjective Intentional Constraint (SIC) analysis to identify missing human
            authorship signals and guide humanization with targeted constraint injection.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
            <strong>Note:</strong> Adds ~30-60 seconds to processing time. Uses additional LLM calls.
          </p>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={handleToggle}
            disabled={!isPaidTier}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{
              backgroundColor: enabled && isPaidTier ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              cursor: isPaidTier ? 'pointer' : 'not-allowed',
            }}
          >
            <span
              className="inline-block h-4 w-4 transform rounded-full transition-transform"
              style={{
                backgroundColor: 'white',
                transform: enabled && isPaidTier ? 'translateX(1.375rem)' : 'translateX(0.25rem)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Resource Usage Info */}
      {isPaidTier && (
        <div
          className="mt-3 pt-3"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <strong>Resource usage:</strong> ~2-4 additional LLM calls per transformation.
            Applies to Computer Humanizer and future SIC-enabled tools.
          </p>
        </div>
      )}

      {!isPaidTier && (
        <div
          className="mt-3 pt-3"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <p className="text-xs" style={{ color: 'var(--warning)' }}>
            Upgrade to Pro or Premium to enable deep constraint analysis.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DEEP ANALYSIS (SIC) SETTINGS
// ============================================================

/**
 * Storage key for deep analysis preference
 */
const DEEP_ANALYSIS_KEY = 'narrative-studio-deep-analysis';

/**
 * Get deep analysis (SIC) preference
 * Returns true if enabled, false otherwise
 */
export function getDeepAnalysisPreference(): boolean {
  return localStorage.getItem(DEEP_ANALYSIS_KEY) === 'true';
}

/**
 * Set deep analysis (SIC) preference
 */
export function setDeepAnalysisPreference(enabled: boolean): void {
  localStorage.setItem(DEEP_ANALYSIS_KEY, enabled ? 'true' : 'false');
}

// Legacy exports for backward compatibility
const STORAGE_KEY = 'narrative-studio-cloud-model';

export function getCloudModelPreference(): string {
  return localStorage.getItem(STORAGE_KEY) || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
}
