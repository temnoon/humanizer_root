/**
 * Model Vetting Profiles
 *
 * Each model has known output patterns that we filter.
 * UNVETTED models will ERROR - no fallback, no silent failure.
 *
 * Philosophy: Errors are preferable to low quality output.
 */

export interface ModelVettingProfile {
  modelId: string;
  displayName: string;
  provider: 'cloudflare' | 'ollama' | 'openai' | 'anthropic';

  // Known output patterns for this model
  patterns: {
    // XML-style thinking tags (e.g., <think>, <reasoning>)
    thinkingTags: string[];
    // Preamble phrases that indicate meta-commentary before content
    preamblePhrases: string[];
    // Closing phrases that indicate meta-commentary after content
    closingPhrases: string[];
    // Role prefix patterns (e.g., "[assistant]:")
    rolePrefixes: string[];
  };

  // Filtering strategy
  // - xml-tags: Strip <think>, <reasoning> etc. (Qwen, DeepSeek)
  // - heuristic: Strip conversational preambles/closings (Llama, Mistral)
  // - structured: Response has explicit output/reasoning blocks (GPT-OSS)
  // - none: No filtering needed
  strategy: 'xml-tags' | 'heuristic' | 'structured' | 'none';

  // Vetting status
  vetted: boolean;
  vettedDate?: string;
  notes?: string;
}

/**
 * Registry of vetted models
 *
 * To add a new model:
 * 1. Run derive-profile.ts tests against the model
 * 2. Review the derived patterns
 * 3. Add to this registry with vetted: true
 * 4. Document in notes what behavior was observed
 */
export const MODEL_VETTING_PROFILES: Record<string, ModelVettingProfile> = {

  // ============================================
  // CLOUDFLARE WORKERS AI MODELS
  // ============================================

  '@cf/meta/llama-3.1-70b-instruct': {
    modelId: '@cf/meta/llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B Instruct',
    provider: 'cloudflare',
    patterns: {
      thinkingTags: [],  // Llama 3.1 doesn't use thinking tags
      preamblePhrases: [
        'Here is',
        'Here\'s the',
        'Here\'s a',
        'I\'ve rewritten',
        'I have rewritten',
        'Let me',
        'Sure,',
        'Sure!',
        'Okay,',
        'Of course',
        'Based on',
        'The following is',
        'Below is',
      ],
      closingPhrases: [
        'I hope this',
        'Let me know if',
        'Is there anything',
        'Feel free to',
        'Would you like',
        'If you\'d like',
        'I\'m happy to',
      ],
      rolePrefixes: [
        '[assistant]:',
        'assistant:',
      ],
    },
    strategy: 'heuristic',
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'Primary transformation model. Uses conversational preambles. No XML tags.'
  },

  '@cf/meta/llama-3.1-8b-instruct': {
    modelId: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B Instruct',
    provider: 'cloudflare',
    patterns: {
      thinkingTags: [],
      preamblePhrases: [
        'Here is',
        'Here\'s',
        'Sure,',
        'Sure!',
        'Let me',
        'I\'ll',
        'I will',
      ],
      closingPhrases: [
        'Let me know',
        'I hope',
        'Feel free',
      ],
      rolePrefixes: [
        '[assistant]:',
        'assistant:',
      ],
    },
    strategy: 'heuristic',
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'Smaller Llama model. Similar patterns to 70B but less verbose.'
  },

  '@cf/meta/llama-3-70b-instruct': {
    modelId: '@cf/meta/llama-3-70b-instruct',
    displayName: 'Llama 3 70B Instruct (Legacy)',
    provider: 'cloudflare',
    patterns: {
      thinkingTags: [],
      preamblePhrases: [
        'Here is',
        'Here\'s',
        'Sure,',
        'Let me',
      ],
      closingPhrases: [
        'Let me know',
        'I hope this helps',
      ],
      rolePrefixes: [
        '[assistant]:',
        'assistant:',
      ],
    },
    strategy: 'heuristic',
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'Older Llama 3 model. Used by humanizer. Migrate to 3.1 when possible.'
  },

  // ============================================
  // OPENAI GPT-OSS MODELS (on Cloudflare)
  // ============================================

  '@cf/openai/gpt-oss-120b': {
    modelId: '@cf/openai/gpt-oss-120b',
    displayName: 'GPT-OSS 120B',
    provider: 'cloudflare',
    patterns: {
      thinkingTags: [],  // Reasoning is structurally separated, not in text
      preamblePhrases: [],  // Clean output in vetting tests
      closingPhrases: [],  // No meta-commentary observed
      rolePrefixes: [],
    },
    strategy: 'structured',  // Uses explicit output/reasoning blocks
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'OpenAI reasoning model. Response has structured output[] array with type=reasoning and type=message blocks. Extract output_text from message block. 5/5 test cases passed with clean output. Ideal for transformations.'
  },

  '@cf/openai/gpt-oss-20b': {
    modelId: '@cf/openai/gpt-oss-20b',
    displayName: 'GPT-OSS 20B',
    provider: 'cloudflare',
    patterns: {
      thinkingTags: [],
      preamblePhrases: [],
      closingPhrases: [],
      rolePrefixes: [],
    },
    strategy: 'structured',  // Same response format as 120B
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'Smaller GPT-OSS model. Same structured response format as 120B. Good for faster/cheaper operations.'
  },

  // ============================================
  // OLLAMA LOCAL MODELS
  // ============================================

  'llama3.2:3b': {
    modelId: 'llama3.2:3b',
    displayName: 'Llama 3.2 3B',
    provider: 'ollama',
    patterns: {
      thinkingTags: [],
      preamblePhrases: [
        'Here is',
        'Here\'s',
        'Sure,',
        'Sure!',
      ],
      closingPhrases: [
        'Let me know',
      ],
      rolePrefixes: [],
    },
    strategy: 'heuristic',
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'Default Ollama model. Compact, fast, minimal preambles.'
  },

  'qwen2.5:3b': {
    modelId: 'qwen2.5:3b',
    displayName: 'Qwen 2.5 3B',
    provider: 'ollama',
    patterns: {
      thinkingTags: [
        '<think>',
        '</think>',
        '<thinking>',
        '</thinking>',
      ],
      preamblePhrases: [],  // Qwen is clean after thinking tags
      closingPhrases: [],
      rolePrefixes: [],
    },
    strategy: 'xml-tags',
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'Uses XML thinking tags. Content after tags is clean.'
  },

  'qwen2.5:7b': {
    modelId: 'qwen2.5:7b',
    displayName: 'Qwen 2.5 7B',
    provider: 'ollama',
    patterns: {
      thinkingTags: [
        '<think>',
        '</think>',
        '<thinking>',
        '</thinking>',
      ],
      preamblePhrases: [],
      closingPhrases: [],
      rolePrefixes: [],
    },
    strategy: 'xml-tags',
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'Larger Qwen model. Same tag pattern as 3B.'
  },

  'deepseek-r1:8b': {
    modelId: 'deepseek-r1:8b',
    displayName: 'DeepSeek R1 8B',
    provider: 'ollama',
    patterns: {
      thinkingTags: [
        '<think>',
        '</think>',
        '<reasoning>',
        '</reasoning>',
      ],
      preamblePhrases: [],
      closingPhrases: [],
      rolePrefixes: [],
    },
    strategy: 'xml-tags',
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'DeepSeek reasoning model. Uses <think> and sometimes <reasoning>.'
  },

  'mistral:7b': {
    modelId: 'mistral:7b',
    displayName: 'Mistral 7B',
    provider: 'ollama',
    patterns: {
      thinkingTags: [],
      preamblePhrases: [
        'Here is',
        'Here\'s',
        'Certainly',
        'Sure,',
      ],
      closingPhrases: [
        'Let me know',
        'Feel free',
      ],
      rolePrefixes: [],
    },
    strategy: 'heuristic',
    vetted: true,
    vettedDate: '2025-12-06',
    notes: 'Standard Mistral. Conversational preambles, no XML tags.'
  },

  'qwen3:latest': {
    modelId: 'qwen3:latest',
    displayName: 'Qwen 3 8B',
    provider: 'ollama',
    patterns: {
      thinkingTags: [
        '<think>',
        '</think>',
        '<thinking>',
        '</thinking>',
      ],
      // Qwen3 often outputs reasoning as plain text without tags
      preamblePhrases: [
        'Okay, let',
        'Okay,',
        'Let me',
        'First,',
        'First I',
        'I need to',
        'I\'ll',
        'The user wants',
        'The task is',
        'So,',
        'Alright,',
      ],
      closingPhrases: [
        'Let me know',
        'I hope this',
        'Is there anything',
      ],
      rolePrefixes: [],
    },
    strategy: 'heuristic',  // Changed from xml-tags - Qwen3 outputs reasoning as plain text
    vetted: true,
    vettedDate: '2025-12-09',
    notes: 'Qwen 3 8B model. Unlike Qwen 2.5, outputs reasoning as plain text without <think> tags. Uses heuristic filtering.'
  },

  'qwen3:14b': {
    modelId: 'qwen3:14b',
    displayName: 'Qwen 3 14B',
    provider: 'ollama',
    patterns: {
      thinkingTags: [
        '<think>',
        '</think>',
        '<thinking>',
        '</thinking>',
      ],
      preamblePhrases: [
        'Okay, let',
        'Okay,',
        'Let me',
        'First,',
        'First I',
        'I need to',
        'I\'ll',
        'The user wants',
        'The task is',
        'So,',
        'Alright,',
      ],
      closingPhrases: [
        'Let me know',
        'I hope this',
        'Is there anything',
      ],
      rolePrefixes: [],
    },
    strategy: 'heuristic',  // Same as qwen3:latest
    vetted: true,
    vettedDate: '2025-12-09',
    notes: 'Larger Qwen 3 model. Same behavior as 8B - reasoning as plain text.'
  },
};

/**
 * Normalize model ID by stripping provider prefixes
 * (e.g., 'ollama/qwen3:latest' -> 'qwen3:latest')
 */
function normalizeModelId(modelId: string): string {
  return modelId.replace(/^(ollama|local)\//, '');
}

/**
 * Get profile for a model, or undefined if not vetted
 * Handles both prefixed (ollama/model) and raw (model) IDs
 */
export function getVettingProfile(modelId: string): ModelVettingProfile | undefined {
  // Try raw ID first
  const profile = MODEL_VETTING_PROFILES[modelId];
  if (profile) return profile;

  // Try normalized ID (strip ollama/ or local/ prefix)
  const normalizedId = normalizeModelId(modelId);
  return MODEL_VETTING_PROFILES[normalizedId];
}

/**
 * Check if a model is vetted
 * Handles both prefixed (ollama/model) and raw (model) IDs
 */
export function isModelVetted(modelId: string): boolean {
  const profile = getVettingProfile(modelId);
  return profile?.vetted === true;
}

/**
 * Get all vetted models for a provider
 */
export function getVettedModelsForProvider(
  provider: ModelVettingProfile['provider']
): ModelVettingProfile[] {
  return Object.values(MODEL_VETTING_PROFILES)
    .filter(p => p.provider === provider && p.vetted);
}

/**
 * List all vetted model IDs
 */
export function listVettedModelIds(): string[] {
  return Object.keys(MODEL_VETTING_PROFILES)
    .filter(id => MODEL_VETTING_PROFILES[id].vetted);
}
