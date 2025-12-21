/**
 * Chat Routes - Simple LLM chat endpoint for Cloudflare Workers AI
 *
 * Used by the Narrative Studio ChatPane when Cloudflare provider is selected.
 */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { CloudflareProvider } from '../services/llm-providers/cloudflare';

const app = new Hono<{ Bindings: Env }>();

interface ChatRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * POST /chat
 * Send messages to Cloudflare Workers AI and get a response
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<ChatRequest>();
    const { messages, model, temperature = 0.7, max_tokens = 2048 } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    // Default to Llama 3.1 70B if no model specified
    const modelId = model || '@cf/meta/llama-3.1-70b-instruct';

    // Check if AI binding is available
    if (!c.env.AI) {
      return c.json({
        error: 'Cloudflare AI binding not available. This endpoint requires production environment.'
      }, 503);
    }

    const provider = new CloudflareProvider(c.env, modelId);

    const response = await provider.call({
      messages,
      temperature,
      max_tokens,
    });

    return c.json({
      response: response.text,
      model: modelId,
      usage: response.usage,
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /chat/models
 * List available chat models
 */
app.get('/models', async (c) => {
  // Return the models that work well for chat
  const models = [
    { id: '@cf/meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', default: true },
    { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (Fast)' },
    { id: '@cf/qwen/qwen1.5-14b-chat-awq', name: 'Qwen 1.5 14B' },
    { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B' },
  ];

  return c.json({ models });
});

export default app;
