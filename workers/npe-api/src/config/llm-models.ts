/**
 * LLM Model Configuration
 * Maps use cases to appropriate models based on environment
 */

export interface ModelConfig {
  // Cloud (production) model - uses Cloudflare AI binding
  cloud: string;
  // Local (development) model - uses Ollama
  local: string;
  // Description of what this model is used for
  description: string;
}

/**
 * Model configurations for different transformation types
 */
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Persona transformation: Requires strong creative writing
  persona: {
    cloud: '@cf/meta/llama-3.1-70b-instruct',  // Cloudflare's largest Llama model
    local: 'ollama/qwen3:latest',               // Ollama qwen3 8B (good for creative tasks)
    description: 'Persona transformation - changes narrative voice/perspective',
  },

  // Style transformation: Requires understanding of literary styles
  style: {
    cloud: '@cf/meta/llama-3.1-70b-instruct',
    local: 'ollama/qwen3:latest',               // Qwen3 has strong language understanding
    description: 'Style transformation - changes writing patterns',
  },

  // Round-trip translation: Requires multilingual support
  roundTrip: {
    cloud: '@cf/meta/llama-3.1-70b-instruct',
    local: 'ollama/qwen3:14b',                  // Larger Qwen3 for translation tasks
    description: 'Round-trip translation - semantic drift analysis',
  },

  // Namespace transformation: Requires deep semantic understanding
  namespace: {
    cloud: '@cf/meta/llama-3.1-70b-instruct',
    local: 'ollama/qwen3:14b',                  // Larger model for complex reasoning
    description: 'Namespace transformation - domain remapping',
  },

  // Allegorical projection: Requires creative reasoning
  allegorical: {
    cloud: '@cf/meta/llama-3.1-70b-instruct',
    local: 'ollama/qwen3:14b',
    description: 'Allegorical projection - multi-stage transformation',
  },

  // General purpose: Balanced performance/quality
  general: {
    cloud: '@cf/meta/llama-3.1-8b-instruct',
    local: 'ollama/mistral:7b',                 // Fast, reliable general purpose model
    description: 'General purpose LLM operations',
  },
};

/**
 * Get the appropriate model for a use case based on environment
 */
export function getModelForUseCase(useCase: keyof typeof MODEL_CONFIGS, env: 'local' | 'cloud'): string {
  const config = MODEL_CONFIGS[useCase] || MODEL_CONFIGS.general;
  return env === 'local' ? config.local : config.cloud;
}

/**
 * Detect environment based on available bindings
 * Returns 'local' if AI binding is not available (wrangler dev --local)
 * Returns 'cloud' if AI binding is available (production or wrangler dev without --local)
 */
export function detectEnvironment(hasAIBinding: boolean): 'local' | 'cloud' {
  return hasAIBinding ? 'cloud' : 'local';
}

/**
 * Check if AI binding is available
 * In local dev with --local flag, env.AI exists but throws when used
 *
 * Strategy: When running `wrangler dev --local`, we want to use Ollama
 * The --local flag makes env.AI unavailable for actual use
 */
export function hasCloudflareAI(env: any): boolean {
  // Primary check: if ENVIRONMENT is not 'production', assume local development
  // This covers both 'development' (from wrangler.toml [env.dev]) and 'local'
  if (env.ENVIRONMENT !== 'production') {
    return false;
  }

  // Secondary check: verify AI binding exists
  if (!env.AI || typeof env.AI.run !== 'function') {
    return false;
  }

  return true;
}
