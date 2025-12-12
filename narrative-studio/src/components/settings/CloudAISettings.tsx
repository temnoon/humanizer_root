import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Cloud Model Configuration
 *
 * ALL models listed here MUST be vetted in:
 * workers/npe-api/src/services/model-vetting/profiles.ts
 *
 * Neuron costs (approximate, per 1K tokens):
 * - Llama 3.1 70B: ~130 input, ~260 output (~$0.004/1K neurons)
 * - Llama 3.1 8B: ~15 input, ~30 output
 * - GPT-OSS 120B: Similar to 70B (structured output)
 * - GPT-OSS 20B: Similar to 8B
 *
 * At $0.011 per 1,000 neurons (Cloudflare paid plan):
 * - 70B model: ~$0.004 per 1K tokens processed
 * - 8B model: ~$0.0005 per 1K tokens processed
 */

interface CloudModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  recommended: boolean;
  cost: string;
  neuronsPerKToken: { input: number; output: number };
  adminOnly?: boolean;
}

// Standard models available to all users
const STANDARD_CLOUD_MODELS: CloudModel[] = [
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'Meta (via Cloudflare)',
    description: 'Primary transformation model. Best quality for humanization.',
    recommended: true,
    cost: 'Included',
    neuronsPerKToken: { input: 130, output: 260 },
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    provider: 'Meta (via Cloudflare)',
    description: 'Fastest option. 9x cheaper. Good for quick transforms.',
    recommended: false,
    cost: 'Included',
    neuronsPerKToken: { input: 15, output: 30 },
  },
];

// Extended models available only to admin users (for testing/vetting)
const ADMIN_CLOUD_MODELS: CloudModel[] = [
  {
    id: '@cf/openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'OpenAI (via Cloudflare)',
    description: 'OpenAI reasoning model. Structured output, clean results. Best for complex transformations.',
    recommended: false,
    cost: 'Testing',
    neuronsPerKToken: { input: 150, output: 300 },
    adminOnly: true,
  },
  {
    id: '@cf/openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'OpenAI (via Cloudflare)',
    description: 'Smaller OpenAI model. Good balance of quality and speed.',
    recommended: false,
    cost: 'Testing',
    neuronsPerKToken: { input: 20, output: 40 },
    adminOnly: true,
  },
  {
    id: '@cf/meta/llama-3-70b-instruct',
    name: 'Llama 3 70B (Legacy)',
    provider: 'Meta (via Cloudflare)',
    description: 'Previous generation Llama. For comparison testing only.',
    recommended: false,
    cost: 'Testing',
    neuronsPerKToken: { input: 130, output: 260 },
    adminOnly: true,
  },
];

const STORAGE_KEY = 'narrative-studio-cloud-model';

// Get all available models (combine standard + admin based on user role)
function getAvailableModels(isAdmin: boolean): CloudModel[] {
  return isAdmin
    ? [...STANDARD_CLOUD_MODELS, ...ADMIN_CLOUD_MODELS]
    : STANDARD_CLOUD_MODELS;
}

export function CloudAISettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const availableModels = getAvailableModels(isAdmin);

  const [selectedModel, setSelectedModel] = useState<string>('@cf/meta/llama-3.1-70b-instruct');
  const [saved, setSaved] = useState(false);

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && availableModels.find(m => m.id === saved)) {
      setSelectedModel(saved);
    }
  }, [availableModels]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem(STORAGE_KEY, modelId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentProvider = localStorage.getItem('narrative-studio-provider') || 'local';
  const isCloudActive = currentProvider === 'cloudflare';
  const selectedModelData = availableModels.find(m => m.id === selectedModel);

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
          {availableModels.map((model) => (
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
                  : model.adminOnly
                    ? '1px dashed var(--warning)'
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
                            color: 'white',
                          }}
                        >
                          Recommended
                        </span>
                      )}
                      {model.adminOnly && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: selectedModel === model.id
                              ? 'rgba(255,255,255,0.2)'
                              : 'var(--warning)',
                            color: selectedModel === model.id ? 'white' : 'black',
                          }}
                        >
                          Admin
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
                    <p
                      className="text-xs mt-2 font-mono"
                      style={{
                        color: selectedModel === model.id
                          ? 'rgba(255,255,255,0.7)'
                          : 'var(--text-tertiary)',
                      }}
                    >
                      ~{model.neuronsPerKToken.input + model.neuronsPerKToken.output} neurons/1K tokens
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
          <li>• Llama 3.1 70B is recommended for highest quality transformations</li>
          <li>• Model selection applies to Persona, Style, and Namespace transforms</li>
          <li>• AI Detection uses a fast local detector (free tier)</li>
        </ul>
      </div>
    </div>
  );
}

// All models combined (for validation)
const ALL_CLOUD_MODELS = [...STANDARD_CLOUD_MODELS, ...ADMIN_CLOUD_MODELS];

// Export helper to get current model preference
export function getCloudModelPreference(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  // If saved model is not in our vetted list, return default
  if (saved && ALL_CLOUD_MODELS.find(m => m.id === saved)) {
    return saved;
  }
  // Default to the recommended (first) model
  return '@cf/meta/llama-3.1-70b-instruct';
}

// Export the model list for other components
export { ALL_CLOUD_MODELS, STANDARD_CLOUD_MODELS, ADMIN_CLOUD_MODELS };
export type { CloudModel };
