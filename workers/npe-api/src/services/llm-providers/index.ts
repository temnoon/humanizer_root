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
import { decryptAPIKey } from '../../utils/encryption';

export * from './base';
export { CloudflareProvider } from './cloudflare';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { GoogleProvider } from './google';

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

    default:
      // Fallback to Cloudflare
      return new CloudflareProvider(env, '@cf/meta/llama-3.1-8b-instruct');
  }
}
