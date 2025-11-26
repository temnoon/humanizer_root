// AI Model Configuration for Post-Social
// ==========================================
// All models, prompts, and parameters are configurable here
// NO HARDCODED MODEL NAMES OR PROMPTS IN SERVICE FILES
//
// To change models:
// 1. Add new model config to the appropriate *_MODELS object
// 2. Update ACTIVE_CONFIG to use the new model id
// 3. Redeploy

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export type AIProvider = 'cloudflare' | 'openai' | 'anthropic' | 'ollama';

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  provider: AIProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  // Provider-specific options
  options?: Record<string, unknown>;
  // Cost tracking (per 1M tokens)
  costPer1MInput?: number;
  costPer1MOutput?: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;  // Use {{variable}} for interpolation
  outputFormat: 'text' | 'json';
  outputSchema?: Record<string, unknown>;
  // For testing/validation
  exampleInput?: Record<string, string>;
  exampleOutput?: string;
}

export interface EmbeddingConfig {
  id: string;
  name: string;
  description: string;
  provider: AIProvider;
  model: string;
  dimensions: number;
  maxInputTokens?: number;
}

// ==========================================
// SAFETY GATE MODELS
// ==========================================

export const SAFETY_MODELS: Record<string, ModelConfig> = {
  'llama-guard-3-8b': {
    id: 'llama-guard-3-8b',
    name: 'Llama Guard 3 8B',
    description: 'Meta\'s content safety classifier, 8B parameter version',
    provider: 'cloudflare',
    model: '@cf/meta/llama-guard-3-8b',
    maxTokens: 100,
    temperature: 0,
  },
  'llama-guard-3-1b': {
    id: 'llama-guard-3-1b',
    name: 'Llama Guard 3 1B',
    description: 'Lightweight safety classifier for faster responses',
    provider: 'cloudflare',
    model: '@cf/meta/llama-guard-3-1b',
    maxTokens: 100,
    temperature: 0,
  },
};

// ==========================================
// SAFETY PROMPTS
// ==========================================

export const SAFETY_PROMPTS: Record<string, PromptTemplate> = {
  'content-check-v1': {
    id: 'content-check-v1',
    name: 'Content Safety Check',
    description: 'Comprehensive content safety analysis',
    version: '1.0.0',
    systemPrompt: `You are a content safety classifier for a discourse platform focused on authentic, thoughtful discussion. Analyze content for safety violations.

Safety Categories:
- S1: Violence - Threats, incitement, graphic violence
- S2: Hate - Discrimination, slurs, dehumanization
- S3: Sexual - Explicit content, non-consensual themes
- S4: Self-Harm - Suicide, eating disorders, self-injury promotion
- S5: Illegal - Drug trafficking, weapons, fraud instructions
- S6: Privacy - Doxxing, personal information exposure
- S7: Manipulation - Spam, scams, coordinated inauthentic behavior

Context: This platform values open discourse. Political opinions, criticism, debate, and mature topics discussed thoughtfully are ALLOWED. Only flag content that crosses into harmful territory.

Respond with ONLY valid JSON. No explanation.`,
    userPromptTemplate: `Analyze this content for safety violations:

---
{{content}}
---

JSON Response:`,
    outputFormat: 'json',
    outputSchema: {
      type: 'object',
      properties: {
        safe: { type: 'boolean' },
        category: { type: 'string', nullable: true },
        reason: { type: 'string', nullable: true },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['safe'],
    },
    exampleInput: { content: 'I think the policy is wrong and should be changed.' },
    exampleOutput: '{"safe": true, "category": null, "reason": null, "confidence": 0.95}',
  },
};

// ==========================================
// CURATION MODELS
// ==========================================

export const CURATION_MODELS: Record<string, ModelConfig> = {
  'llama-3.1-8b': {
    id: 'llama-3.1-8b',
    name: 'Llama 3.1 8B Instruct',
    description: 'Fast, capable model for summarization and tagging',
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.1-8b-instruct',
    maxTokens: 500,
    temperature: 0.3,
  },
  'llama-3.1-70b': {
    id: 'llama-3.1-70b',
    name: 'Llama 3.1 70B Instruct',
    description: 'Higher quality for complex curation tasks',
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.1-70b-instruct',
    maxTokens: 500,
    temperature: 0.3,
  },
  'llama-3.3-70b': {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B Instruct',
    description: 'Latest Llama model with improved capabilities',
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    maxTokens: 500,
    temperature: 0.3,
  },
  'qwen-2.5-72b': {
    id: 'qwen-2.5-72b',
    name: 'Qwen 2.5 72B',
    description: 'Alibaba\'s latest model, strong reasoning',
    provider: 'cloudflare',
    model: '@cf/qwen/qwen2.5-72b-instruct',
    maxTokens: 500,
    temperature: 0.3,
  },
  // Future: Add OpenAI, Anthropic when needed
  // 'gpt-4-turbo': {
  //   id: 'gpt-4-turbo',
  //   name: 'GPT-4 Turbo',
  //   description: 'OpenAI\'s latest GPT-4 model',
  //   provider: 'openai',
  //   model: 'gpt-4-turbo-preview',
  //   maxTokens: 500,
  //   temperature: 0.3,
  //   costPer1MInput: 10,
  //   costPer1MOutput: 30,
  // },
  // 'claude-3-sonnet': {
  //   id: 'claude-3-sonnet',
  //   name: 'Claude 3 Sonnet',
  //   description: 'Anthropic\'s balanced model',
  //   provider: 'anthropic',
  //   model: 'claude-3-sonnet-20240229',
  //   maxTokens: 500,
  //   temperature: 0.3,
  //   costPer1MInput: 3,
  //   costPer1MOutput: 15,
  // },
};

// ==========================================
// CURATION PROMPTS
// ==========================================

export const CURATION_PROMPTS: Record<string, PromptTemplate> = {
  'summarize-v1': {
    id: 'summarize-v1',
    name: 'Post Summarization',
    description: 'Create concise, meaningful summary of post content',
    version: '1.0.0',
    systemPrompt: `You are a skilled summarizer for a discourse platform focused on authentic discussion. Create concise summaries that capture the essence and key insights of posts.

Guidelines:
- Be neutral and objective
- Preserve the author's intent
- Highlight key insights or questions
- Keep under 280 characters
- Don't editorialize or add opinions`,
    userPromptTemplate: `Summarize this post in 1-2 sentences (max 280 characters):

{{content}}

Summary:`,
    outputFormat: 'text',
    exampleInput: { content: 'I\'ve been thinking about how social media has changed discourse. The performative nature of public posts makes authentic conversation nearly impossible. We optimize for engagement, not understanding.' },
    exampleOutput: 'Reflection on how social media\'s performative nature undermines authentic conversation, prioritizing engagement over genuine understanding.',
  },

  'extract-tags-v1': {
    id: 'extract-tags-v1',
    name: 'Tag Extraction',
    description: 'Extract relevant topic tags from content',
    version: '1.0.0',
    systemPrompt: `You are a topic classifier for a discourse platform. Extract 3-5 relevant topic tags that would help others find this content.

Guidelines:
- Use lowercase, hyphenated tags (e.g., "social-media", "philosophy")
- Be specific enough to be useful
- Include both topic and theme tags
- Avoid generic tags like "thoughts" or "ideas"
- Respond with ONLY valid JSON`,
    userPromptTemplate: `Extract 3-5 topic tags from this content:

{{content}}

JSON Response:`,
    outputFormat: 'json',
    outputSchema: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['tags'],
    },
    exampleInput: { content: 'The intersection of Buddhist philosophy and quantum mechanics raises interesting questions about consciousness and observation.' },
    exampleOutput: '{"tags": ["buddhism", "quantum-mechanics", "consciousness", "philosophy-of-mind"]}',
  },

  'curator-response-v1': {
    id: 'curator-response-v1',
    name: 'Curator Comment Response',
    description: 'AI curator responds to comments with insights',
    version: '1.0.0',
    systemPrompt: `You are a thoughtful curator for a discourse platform focused on authentic discussion. Your role is to facilitate deeper understanding.

Your approach:
- Synthesize ideas across the conversation
- Ask clarifying questions that open new perspectives
- Point out interesting connections others might miss
- Encourage exploration without being prescriptive
- Be genuinely curious, never preachy

Style:
- Brief (2-3 sentences max)
- Conversational but substantive
- Humble about your own perspective
- Reference specific points from the discussion`,
    userPromptTemplate: `Original post:
{{postContent}}

Comment thread so far:
{{comments}}

New comment to respond to:
{{newComment}}

Curator response (2-3 sentences):`,
    outputFormat: 'text',
  },

  'synthesis-v1': {
    id: 'synthesis-v1',
    name: 'Post Synthesis',
    description: 'Synthesize post with comments into evolved understanding',
    version: '1.0.0',
    systemPrompt: `You are a synthesis engine for a discourse platform. Your role is to evolve posts based on comment discussions, similar to how a document evolves through collaborative editing.

Your task:
- Identify key insights from comments
- Integrate valuable additions into the original post
- Preserve the author's voice and intent
- Mark what was added/changed
- Create a new version that represents collective understanding

Output a new version of the post that incorporates the best insights from discussion.`,
    userPromptTemplate: `Original post (v{{version}}):
{{postContent}}

Discussion comments:
{{comments}}

Create an evolved version (v{{nextVersion}}) that synthesizes the discussion:`,
    outputFormat: 'text',
  },
};

// ==========================================
// EMBEDDING MODELS
// ==========================================

export const EMBEDDING_MODELS: Record<string, EmbeddingConfig> = {
  'bge-base-en-v1.5': {
    id: 'bge-base-en-v1.5',
    name: 'BGE Base EN v1.5',
    description: 'BAAI general embedding model, good balance of quality and speed',
    provider: 'cloudflare',
    model: '@cf/baai/bge-base-en-v1.5',
    dimensions: 768,
    maxInputTokens: 512,
  },
  'bge-large-en-v1.5': {
    id: 'bge-large-en-v1.5',
    name: 'BGE Large EN v1.5',
    description: 'Larger embedding model for higher quality semantic search',
    provider: 'cloudflare',
    model: '@cf/baai/bge-large-en-v1.5',
    dimensions: 1024,
    maxInputTokens: 512,
  },
  'bge-small-en-v1.5': {
    id: 'bge-small-en-v1.5',
    name: 'BGE Small EN v1.5',
    description: 'Fastest embedding model, lower quality',
    provider: 'cloudflare',
    model: '@cf/baai/bge-small-en-v1.5',
    dimensions: 384,
    maxInputTokens: 512,
  },
  // Future: OpenAI embeddings
  // 'text-embedding-3-small': {
  //   id: 'text-embedding-3-small',
  //   name: 'OpenAI text-embedding-3-small',
  //   description: 'OpenAI\'s efficient embedding model',
  //   provider: 'openai',
  //   model: 'text-embedding-3-small',
  //   dimensions: 1536,
  //   maxInputTokens: 8191,
  // },
};

// ==========================================
// ACTIVE CONFIGURATION
// ==========================================
// Change these values to switch models across the entire system
// No code changes needed - just update and redeploy

export const ACTIVE_CONFIG = {
  safety: {
    modelId: 'llama-guard-3-8b',
    promptId: 'content-check-v1',
    // Skip safety check for trusted users?
    skipForRoles: ['admin', 'premium'],
  },
  curation: {
    modelId: 'llama-3.1-8b',  // Use 'llama-3.1-70b' for higher quality
    summarizePromptId: 'summarize-v1',
    tagPromptId: 'extract-tags-v1',
    curatorPromptId: 'curator-response-v1',
    synthesisPromptId: 'synthesis-v1',
    // Auto-curate after this many comments
    autoSynthesizeThreshold: 5,
  },
  embedding: {
    modelId: 'bge-base-en-v1.5',  // Use 'bge-large-en-v1.5' for better search
    // Prepend this to content before embedding for better retrieval
    queryPrefix: 'Represent this sentence for searching relevant passages: ',
    documentPrefix: '',
  },
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get the active model configuration for a category
 */
export function getActiveModel(category: 'safety' | 'curation' | 'embedding'): ModelConfig | EmbeddingConfig {
  switch (category) {
    case 'safety':
      return SAFETY_MODELS[ACTIVE_CONFIG.safety.modelId];
    case 'curation':
      return CURATION_MODELS[ACTIVE_CONFIG.curation.modelId];
    case 'embedding':
      return EMBEDDING_MODELS[ACTIVE_CONFIG.embedding.modelId];
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

/**
 * Get a specific model by category and id
 */
export function getModel(category: 'safety' | 'curation' | 'embedding', modelId: string): ModelConfig | EmbeddingConfig {
  switch (category) {
    case 'safety':
      return SAFETY_MODELS[modelId];
    case 'curation':
      return CURATION_MODELS[modelId];
    case 'embedding':
      return EMBEDDING_MODELS[modelId];
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

/**
 * Get a prompt template by category and id
 */
export function getPrompt(category: 'safety' | 'curation', promptId: string): PromptTemplate {
  switch (category) {
    case 'safety':
      return SAFETY_PROMPTS[promptId];
    case 'curation':
      return CURATION_PROMPTS[promptId];
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

/**
 * Get the active prompt for a task
 */
export function getActivePrompt(task: 'safety' | 'summarize' | 'tags' | 'curator' | 'synthesis'): PromptTemplate {
  switch (task) {
    case 'safety':
      return SAFETY_PROMPTS[ACTIVE_CONFIG.safety.promptId];
    case 'summarize':
      return CURATION_PROMPTS[ACTIVE_CONFIG.curation.summarizePromptId];
    case 'tags':
      return CURATION_PROMPTS[ACTIVE_CONFIG.curation.tagPromptId];
    case 'curator':
      return CURATION_PROMPTS[ACTIVE_CONFIG.curation.curatorPromptId];
    case 'synthesis':
      return CURATION_PROMPTS[ACTIVE_CONFIG.curation.synthesisPromptId];
    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

/**
 * Interpolate variables into a prompt template
 * Replaces {{variable}} with the provided values
 */
export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in variables) {
      return variables[key];
    }
    console.warn(`Missing variable in prompt template: ${key}`);
    return match;
  });
}

/**
 * List all available models for a category
 */
export function listModels(category: 'safety' | 'curation' | 'embedding'): Array<{ id: string; name: string; description: string }> {
  let models: Record<string, ModelConfig | EmbeddingConfig>;
  switch (category) {
    case 'safety':
      models = SAFETY_MODELS;
      break;
    case 'curation':
      models = CURATION_MODELS;
      break;
    case 'embedding':
      models = EMBEDDING_MODELS;
      break;
    default:
      throw new Error(`Unknown category: ${category}`);
  }
  
  return Object.values(models).map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
  }));
}

/**
 * Validate that the active configuration references valid models/prompts
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!SAFETY_MODELS[ACTIVE_CONFIG.safety.modelId]) {
    errors.push(`Invalid safety model: ${ACTIVE_CONFIG.safety.modelId}`);
  }
  if (!SAFETY_PROMPTS[ACTIVE_CONFIG.safety.promptId]) {
    errors.push(`Invalid safety prompt: ${ACTIVE_CONFIG.safety.promptId}`);
  }
  if (!CURATION_MODELS[ACTIVE_CONFIG.curation.modelId]) {
    errors.push(`Invalid curation model: ${ACTIVE_CONFIG.curation.modelId}`);
  }
  if (!CURATION_PROMPTS[ACTIVE_CONFIG.curation.summarizePromptId]) {
    errors.push(`Invalid summarize prompt: ${ACTIVE_CONFIG.curation.summarizePromptId}`);
  }
  if (!CURATION_PROMPTS[ACTIVE_CONFIG.curation.tagPromptId]) {
    errors.push(`Invalid tag prompt: ${ACTIVE_CONFIG.curation.tagPromptId}`);
  }
  if (!CURATION_PROMPTS[ACTIVE_CONFIG.curation.curatorPromptId]) {
    errors.push(`Invalid curator prompt: ${ACTIVE_CONFIG.curation.curatorPromptId}`);
  }
  if (!EMBEDDING_MODELS[ACTIVE_CONFIG.embedding.modelId]) {
    errors.push(`Invalid embedding model: ${ACTIVE_CONFIG.embedding.modelId}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
