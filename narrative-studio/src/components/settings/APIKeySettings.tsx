import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface ProviderStatus {
  configured: boolean;
  testing?: boolean;
  testResult?: { valid: boolean; message: string } | null;
}

interface APIKeyState {
  openai: ProviderStatus;
  anthropic: ProviderStatus;
  google: ProviderStatus;
  groq: ProviderStatus;
}

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o Mini, o1 Reasoning',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 4 Sonnet, Claude 4 Opus, Claude 3.5',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini 2.5 Pro, Gemini 2.0 Flash',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast Llama 3.3 70B, Mixtral 8x7B',
    placeholder: 'gsk_...',
    helpUrl: 'https://console.groq.com/keys',
  },
] as const;

type ProviderId = typeof PROVIDERS[number]['id'];

export function APIKeySettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isPaidTier = ['pro', 'premium', 'admin'].includes(user?.role || '');

  // Get token from localStorage (same key used by AuthContext)
  const getToken = () => localStorage.getItem('narrative-studio-auth-token');

  const [status, setStatus] = useState<APIKeyState>({
    openai: { configured: false },
    anthropic: { configured: false },
    google: { configured: false },
    groq: { configured: false },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Input values for new keys (admin only)
  const [inputs, setInputs] = useState<Record<ProviderId, string>>({
    openai: '',
    anthropic: '',
    google: '',
    groq: '',
  });

  const API_BASE = import.meta.env.VITE_API_URL || 'https://npe-api.tem-527.workers.dev';

  // Load current API key status
  useEffect(() => {
    async function loadStatus() {
      const token = getToken();
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE}/api/model-settings/api-keys`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setStatus({
            openai: { configured: data.providers.openai.configured },
            anthropic: { configured: data.providers.anthropic.configured },
            google: { configured: data.providers.google.configured },
            groq: { configured: data.providers.groq.configured },
          });
        }
      } catch (err) {
        console.error('Failed to load API key status:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, [user, API_BASE]);

  const handleSaveKey = async (providerId: ProviderId) => {
    const apiKey = inputs[providerId];
    if (!apiKey || apiKey.length < 10) {
      setError('Please enter a valid API key');
      return;
    }

    setError(null);
    setSuccess(null);
    const token = getToken();

    try {
      const response = await fetch(`${API_BASE}/api/model-settings/api-keys/${providerId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });

      if (response.ok) {
        setStatus(prev => ({
          ...prev,
          [providerId]: { configured: true },
        }));
        setInputs(prev => ({ ...prev, [providerId]: '' }));
        setSuccess(`${PROVIDERS.find(p => p.id === providerId)?.name} API key saved successfully`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save API key');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleTestKey = async (providerId: ProviderId) => {
    setStatus(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], testing: true, testResult: null },
    }));
    const token = getToken();

    try {
      const response = await fetch(`${API_BASE}/api/model-settings/api-keys/${providerId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      setStatus(prev => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          testing: false,
          testResult: data,
        },
      }));
    } catch (err) {
      setStatus(prev => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          testing: false,
          testResult: { valid: false, message: 'Network error' },
        },
      }));
    }
  };

  const handleRemoveKey = async (providerId: ProviderId) => {
    if (!confirm(`Remove ${PROVIDERS.find(p => p.id === providerId)?.name} API key?`)) {
      return;
    }
    const token = getToken();

    try {
      const response = await fetch(`${API_BASE}/api/model-settings/api-keys/${providerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setStatus(prev => ({
          ...prev,
          [providerId]: { configured: false, testResult: null },
        }));
        setSuccess('API key removed');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError('Failed to remove API key');
    }
  };

  if (!isPaidTier) {
    return (
      <div className="p-6">
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid var(--warning)',
          }}
        >
          <p className="font-medium" style={{ color: 'var(--warning)' }}>
            Pro Tier Required
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            API key management requires a Pro subscription or higher. Upgrade to use your own
            OpenAI, Anthropic, Google, or Groq API keys.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading API key status...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          External AI Provider Keys
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Add your own API keys to use external AI providers. Keys are encrypted and stored securely.
        </p>
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

      {/* Provider Cards */}
      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const providerStatus = status[provider.id];
          return (
            <div
              key={provider.id}
              className="rounded-lg p-4"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: providerStatus.configured
                  ? '1px solid var(--success)'
                  : '1px solid var(--border-color)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {provider.name}
                    </h4>
                    {providerStatus.configured && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--success)',
                          color: 'white',
                        }}
                      >
                        Configured
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {provider.description}
                  </p>
                </div>
                <a
                  href={provider.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  Get Key
                </a>
              </div>

              {/* Test Result */}
              {providerStatus.testResult && (
                <div
                  className="mb-3 p-2 rounded text-xs"
                  style={{
                    backgroundColor: providerStatus.testResult.valid
                      ? 'rgba(34, 197, 94, 0.1)'
                      : 'rgba(220, 38, 38, 0.1)',
                    color: providerStatus.testResult.valid
                      ? 'var(--success)'
                      : 'var(--accent-red, #dc2626)',
                  }}
                >
                  {providerStatus.testResult.message}
                </div>
              )}

              {providerStatus.configured ? (
                /* Configured: Show test/remove buttons */
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTestKey(provider.id)}
                    disabled={providerStatus.testing}
                    className="px-3 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {providerStatus.testing ? 'Testing...' : 'Test Key'}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveKey(provider.id)}
                      className="px-3 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        color: 'var(--accent-red, #dc2626)',
                        border: '1px solid var(--accent-red, #dc2626)',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                /* Not configured: Show input field (admin only) */
                isAdmin && (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={inputs[provider.id]}
                      onChange={(e) =>
                        setInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                      }
                      placeholder={provider.placeholder}
                      className="flex-1 px-3 py-1.5 rounded text-sm font-mono"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      onClick={() => handleSaveKey(provider.id)}
                      disabled={!inputs[provider.id]}
                      className="px-4 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                      }}
                    >
                      Save
                    </button>
                  </div>
                )
              )}

              {!providerStatus.configured && !isAdmin && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Contact admin to configure this provider.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Section */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <h4 className="font-medium text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
          About API Keys
        </h4>
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>• Keys are encrypted before storage (AES-GCM)</li>
          <li>• Usage is tracked per provider for cost monitoring</li>
          <li>• Free Cloudflare models are always available</li>
          <li>• Set model preferences in the "Cloud AI" tab</li>
        </ul>
      </div>
    </div>
  );
}
