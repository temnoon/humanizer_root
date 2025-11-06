// Configuration routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import type { Env, NPEPersona, NPENamespace, NPEStyle } from '../../shared/types';

const configRoutes = new Hono<{ Bindings: Env }>();

// Model information type
export interface ModelInfo {
  id: string;
  name: string;
  provider: 'cloudflare' | 'openai' | 'anthropic' | 'google';
  description: string;
  requires_api_key: boolean;
  max_tokens: number;
  recommended_use?: string;
}

/**
 * GET /config/personas - List available personas
 *
 * Returns all available narrator personas (neutral, advocate, critic, philosopher, storyteller)
 */
configRoutes.get('/personas', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM npe_personas ORDER BY id'
    ).all();

    const personas: NPEPersona[] = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      system_prompt: row.system_prompt
    }));

    return c.json(personas, 200);
  } catch (error) {
    console.error('Error fetching personas:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /config/namespaces - List available namespaces
 *
 * Returns all available fictional universes (mythology, quantum, nature, corporate, medieval, science)
 */
configRoutes.get('/namespaces', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM npe_namespaces ORDER BY id'
    ).all();

    const namespaces: NPENamespace[] = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      context_prompt: row.context_prompt
    }));

    return c.json(namespaces, 200);
  } catch (error) {
    console.error('Error fetching namespaces:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /config/styles - List available styles
 *
 * Returns all available language styles (standard, academic, poetic, technical, casual)
 */
configRoutes.get('/styles', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM npe_styles ORDER BY id'
    ).all();

    const styles: NPEStyle[] = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      style_prompt: row.style_prompt
    }));

    return c.json(styles, 200);
  } catch (error) {
    console.error('Error fetching styles:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /config/languages - List supported languages for round-trip translation
 *
 * Returns array of 18 supported intermediate languages
 */
configRoutes.get('/languages', async (c) => {
  const languages = [
    'spanish', 'french', 'german', 'italian', 'portuguese', 'russian',
    'chinese', 'japanese', 'korean', 'arabic', 'hebrew', 'hindi',
    'dutch', 'swedish', 'norwegian', 'danish', 'polish', 'czech'
  ];

  return c.json({ languages }, 200);
});

/**
 * GET /config/models - List available LLM models
 *
 * Returns models based on user tier and configured API keys
 * - Cloudflare native models: always available
 * - External provider models: only if user has API key configured (PRO+ only)
 */
configRoutes.get('/models', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);

    // Cloudflare native models (always available)
    const cloudflareModels: ModelInfo[] = [
      {
        id: '@cf/meta/llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B Instruct',
        provider: 'cloudflare',
        description: 'Current baseline model - balanced performance',
        requires_api_key: false,
        max_tokens: 8192,
        recommended_use: 'General purpose, good for most tasks'
      },
      {
        id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        name: 'Llama 3.3 70B FP8 Fast',
        provider: 'cloudflare',
        description: '70B parameter model, 2-4x faster with better quality',
        requires_api_key: false,
        max_tokens: 8192,
        recommended_use: 'High quality transformations, complex narratives'
      },
      {
        id: '@cf/meta/llama-4-scout-17b-16e-instruct',
        name: 'Llama 4 Scout 17B',
        provider: 'cloudflare',
        description: 'Newest Llama 4, multimodal MoE (Mixture of Experts)',
        requires_api_key: false,
        max_tokens: 8192,
        recommended_use: 'Latest features, experimental'
      },
      {
        id: '@cf/openai/gpt-oss-20b',
        name: 'GPT-OSS 20B',
        provider: 'cloudflare',
        description: 'OpenAI open-source model, 20B parameters',
        requires_api_key: false,
        max_tokens: 8192,
        recommended_use: 'GPT-style responses, instruction following'
      },
      {
        id: '@cf/qwen/qwq-32b',
        name: 'Qwen QwQ 32B',
        provider: 'cloudflare',
        description: 'Reasoning-focused model, 32B parameters',
        requires_api_key: false,
        max_tokens: 8192,
        recommended_use: 'Analytical tasks, reasoning-heavy transformations'
      },
      {
        id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
        name: 'DeepSeek R1 Distill 32B',
        provider: 'cloudflare',
        description: 'Chain-of-thought reasoning model',
        requires_api_key: false,
        max_tokens: 8192,
        recommended_use: 'Step-by-step reasoning, complex analysis'
      }
    ];

    const availableModels: ModelInfo[] = [...cloudflareModels];

    // Check if user has PRO+ tier and API keys configured
    const allowedRoles = ['pro', 'premium', 'admin'];
    if (allowedRoles.includes(auth.role)) {
      // Fetch configured API keys
      const row = await c.env.DB.prepare(
        'SELECT openai_api_key_encrypted, anthropic_api_key_encrypted, google_api_key_encrypted FROM users WHERE id = ?'
      ).bind(auth.userId).first();

      if (row) {
        // Add OpenAI models if key is configured
        if (row.openai_api_key_encrypted) {
          availableModels.push(
            {
              id: 'gpt-4o',
              name: 'GPT-4o',
              provider: 'openai',
              description: 'OpenAI flagship model, highly capable',
              requires_api_key: true,
              max_tokens: 16384,
              recommended_use: 'Premium quality, complex transformations'
            },
            {
              id: 'gpt-4o-mini',
              name: 'GPT-4o Mini',
              provider: 'openai',
              description: 'Faster, more affordable GPT-4 variant',
              requires_api_key: true,
              max_tokens: 16384,
              recommended_use: 'Cost-effective, still high quality'
            }
          );
        }

        // Add Anthropic models if key is configured
        if (row.anthropic_api_key_encrypted) {
          availableModels.push(
            {
              id: 'claude-3-5-sonnet-20241022',
              name: 'Claude 3.5 Sonnet',
              provider: 'anthropic',
              description: 'Anthropic flagship model, excellent for writing',
              requires_api_key: true,
              max_tokens: 8192,
              recommended_use: 'Creative writing, nuanced transformations'
            },
            {
              id: 'claude-3-5-haiku-20241022',
              name: 'Claude 3.5 Haiku',
              provider: 'anthropic',
              description: 'Fast and efficient Claude variant',
              requires_api_key: true,
              max_tokens: 8192,
              recommended_use: 'Quick transformations, lower cost'
            }
          );
        }

        // Add Google models if key is configured
        if (row.google_api_key_encrypted) {
          availableModels.push(
            {
              id: 'gemini-2.0-flash-exp',
              name: 'Gemini 2.0 Flash',
              provider: 'google',
              description: 'Google latest flash model, very fast',
              requires_api_key: true,
              max_tokens: 8192,
              recommended_use: 'Multimodal tasks, fast responses'
            },
            {
              id: 'gemini-1.5-pro',
              name: 'Gemini 1.5 Pro',
              provider: 'google',
              description: 'Google flagship model, large context window',
              requires_api_key: true,
              max_tokens: 8192,
              recommended_use: 'Long documents, complex analysis'
            }
          );
        }
      }
    }

    return c.json({ models: availableModels }, 200);

  } catch (error) {
    console.error('Error fetching models:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default configRoutes;
