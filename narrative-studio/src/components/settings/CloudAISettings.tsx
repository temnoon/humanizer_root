import { useState, useEffect } from 'react';

// Available cloud models - these are vetted and known to work well
// Order matters: recommended model first
const CLOUD_MODELS = [
  {
    id: '@cf/openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'OpenAI (via Cloudflare)',
    description: 'Best for humanization. Clean output with natural sentence variation.',
    recommended: true,
    cost: 'Standard',
  },
  {
    id: '@cf/openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'OpenAI (via Cloudflare)',
    description: 'Highest quality for complex transformations. Slower but more nuanced.',
    recommended: false,
    cost: 'Premium',
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'Meta (via Cloudflare)',
    description: 'Fast general-purpose model. Good for quick tasks.',
    recommended: false,
    cost: 'Included',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    provider: 'Meta (via Cloudflare)',
    description: 'Fastest option. Best for AI detection only.',
    recommended: false,
    cost: 'Included',
  },
];

const STORAGE_KEY = 'narrative-studio-cloud-model';

export function CloudAISettings() {
  const [selectedModel, setSelectedModel] = useState<string>('@cf/openai/gpt-oss-20b');
  const [saved, setSaved] = useState(false);

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CLOUD_MODELS.find(m => m.id === saved)) {
      setSelectedModel(saved);
    }
  }, []);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem(STORAGE_KEY, modelId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentProvider = localStorage.getItem('narrative-studio-provider') || 'local';
  const isCloudActive = currentProvider === 'cloudflare';

  return (
    <div className="p-6 space-y-6">
      {/* Status Banner */}
      {!isCloudActive && (
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid var(--warning)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--warning)' }}>
            Cloud AI is not active
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            You're currently using Local AI (Ollama). Switch to Cloud in the provider toggle to use these models.
          </p>
        </div>
      )}

      {/* Model Selection */}
      <div>
        <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
          Cloud Transformation Model
        </h3>

        <div className="space-y-2">
          {CLOUD_MODELS.map((model) => (
            <div
              key={model.id}
              className="rounded-lg p-4 cursor-pointer transition-all"
              onClick={() => handleModelChange(model.id)}
              style={{
                backgroundColor: selectedModel === model.id
                  ? 'var(--accent-primary)'
                  : 'var(--bg-tertiary)',
                border: selectedModel === model.id
                  ? '2px solid var(--accent-primary)'
                  : '1px solid var(--border-color)',
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={selectedModel === model.id}
                    onChange={() => handleModelChange(model.id)}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p
                        className="font-medium"
                        style={{
                          color: selectedModel === model.id ? 'white' : 'var(--text-primary)',
                        }}
                      >
                        {model.name}
                      </p>
                      {model.recommended && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: selectedModel === model.id
                              ? 'rgba(255,255,255,0.2)'
                              : 'var(--success)',
                            color: selectedModel === model.id ? 'white' : 'white',
                          }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs mt-1"
                      style={{
                        color: selectedModel === model.id
                          ? 'rgba(255,255,255,0.8)'
                          : 'var(--text-tertiary)',
                      }}
                    >
                      {model.provider}
                    </p>
                    <p
                      className="text-sm mt-1"
                      style={{
                        color: selectedModel === model.id
                          ? 'rgba(255,255,255,0.9)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {model.description}
                    </p>
                  </div>
                </div>
                <span
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{
                    backgroundColor: selectedModel === model.id
                      ? 'rgba(255,255,255,0.2)'
                      : 'var(--bg-secondary)',
                    color: selectedModel === model.id
                      ? 'white'
                      : 'var(--text-tertiary)',
                  }}
                >
                  {model.cost}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Save Confirmation */}
        {saved && (
          <div
            className="mt-4 p-3 rounded-lg flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid var(--success)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--success)">
              <path d="M4 10l4 4 8-8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm" style={{ color: 'var(--success)' }}>
              Model preference saved
            </span>
          </div>
        )}
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
          About Cloud Models
        </h4>
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>• All models are vetted for clean output (no AI preambles)</li>
          <li>• GPT-OSS models use structured reasoning (highest quality filtering)</li>
          <li>• Model selection applies to Persona, Style, and Namespace transforms</li>
          <li>• AI Detection always uses the lite detector (free) or GPTZero (premium)</li>
        </ul>
      </div>
    </div>
  );
}

// Export helper to get current model preference
export function getCloudModelPreference(): string {
  return localStorage.getItem(STORAGE_KEY) || '@cf/openai/gpt-oss-20b';
}
