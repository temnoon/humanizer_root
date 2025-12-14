/**
 * LLM Provider Factory
 * Creates the appropriate provider based on model ID and available API keys
 */

import type { Env } from '../../../shared/types';
import type { LLMProvider } from './base';
import { getProviderType } from './base';
import { CloudflareProvider } from './cloudflare';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { GroqProvider } from './groq';
import { OllamaProvider } from './ollama';
import { decryptAPIKey } from '../../utils/encryption';

export * from './base';
export { CloudflareProvider } from './cloudflare';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { GoogleProvider } from './google';
export { GroqProvider } from './groq';
export { OllamaProvider } from './ollama';

/**
 * Create an LLM provider instance based on model ID
 *
 * @param modelId - The model identifier (e.g., '@cf/meta/llama-3.1-8b-instruct', 'gpt-4o', 'claude-3-5-sonnet-20241022')
 * @param env - Cloudflare environment bindings
 * @param userId - User ID (needed to decrypt API keys)
 * @returns LLMProvider instance
 * @throws Error if external provider requires API key but none is configured
 */
export async function createLLMProvider(
  modelId: string,
  env: Env,
  userId: string
): Promise<LLMProvider> {
  const providerType = getProviderType(modelId);

  switch (providerType) {
    case 'cloudflare':
      // Cloudflare models don't need API keys
      return new CloudflareProvider(env, modelId);

    case 'openai': {
      // Fetch and decrypt OpenAI API key
      const row = await env.DB.prepare(
        'SELECT openai_api_key_encrypted FROM users WHERE id = ?'
      ).bind(userId).first();

      if (!row || !row.openai_api_key_encrypted) {
        throw new Error('OpenAI API key not configured. Please add your API key in settings.');
      }

      const apiKey = await decryptAPIKey(
        row.openai_api_key_encrypted as string,
        env.JWT_SECRET,
        userId
      );

      return new OpenAIProvider(apiKey, modelId);
    }

    case 'anthropic': {
      // Fetch and decrypt Anthropic API key
      const row = await env.DB.prepare(
        'SELECT anthropic_api_key_encrypted FROM users WHERE id = ?'
      ).bind(userId).first();

      if (!row || !row.anthropic_api_key_encrypted) {
        throw new Error('Anthropic API key not configured. Please add your API key in settings.');
      }

      const apiKey = await decryptAPIKey(
        row.anthropic_api_key_encrypted as string,
        env.JWT_SECRET,
        userId
      );

      return new AnthropicProvider(apiKey, modelId);
    }

    case 'google': {
      // Fetch and decrypt Google API key
      const row = await env.DB.prepare(
        'SELECT google_api_key_encrypted FROM users WHERE id = ?'
      ).bind(userId).first();

      if (!row || !row.google_api_key_encrypted) {
        throw new Error('Google API key not configured. Please add your API key in settings.');
      }

      const apiKey = await decryptAPIKey(
        row.google_api_key_encrypted as string,
        env.JWT_SECRET,
        userId
      );

      return new GoogleProvider(apiKey, modelId);
    }

    case 'groq': {
      // Fetch and decrypt Groq API key
      const row = await env.DB.prepare(
        'SELECT groq_api_key_encrypted FROM users WHERE id = ?'
      ).bind(userId).first();

      if (!row || !row.groq_api_key_encrypted) {
        throw new Error('Groq API key not configured. Please add your API key in settings.');
      }

      const apiKey = await decryptAPIKey(
        row.groq_api_key_encrypted as string,
        env.JWT_SECRET,
        userId
      );

      // Strip 'groq/' prefix if present
      const groqModel = modelId.replace(/^groq\//, '');
      return new GroqProvider(apiKey, groqModel);
    }

    case 'ollama': {
      // Extract model name (remove 'ollama/' or 'local/' prefix)
      const ollamaModel = modelId.replace(/^(ollama|local)\//, '');
      const ollamaUrl = env.OLLAMA_URL || 'http://localhost:11434';

      console.log(`Creating Ollama provider: model=${ollamaModel}, url=${ollamaUrl}`);
      return new OllamaProvider(ollamaModel, ollamaUrl);
    }

    default:
      // Fallback to Cloudflare
      return new CloudflareProvider(env, '@cf/meta/llama-3.1-8b-instruct');
  }
}
