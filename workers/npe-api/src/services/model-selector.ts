/**
 * Model Selector Service
 * Dynamically selects the appropriate LLM model based on:
 * 1. User preferences (if set)
 * 2. User tier (free, pro, premium, admin)
 * 3. Use case requirements
 * 4. Environment (cloud vs local)
 * 5. Available API keys
 */

import type { Env } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { hasCloudflareAI } from '../config/llm-models';

export interface ModelInfo {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow: number;
  costPerKInput: number;
  costPerKOutput: number;
  requiresApiKey: boolean;
  tierRequired: string;
  status: string;
  outputFilterStrategy: string;
}

export interface ModelSelectionResult {
  model: ModelInfo;
  reason: 'user_preference' | 'default' | 'fallback';
  environment: 'cloud' | 'local';
}

type UseCase = 'persona' | 'style' | 'translation' | 'round_trip' | 'detection' | 'general' | 'extraction';

/**
 * Get all available models from registry
 */
export async function getAvailableModels(env: Env, options?: {
  capability?: string;
  provider?: string;
  tierRequired?: string;
  status?: string;
}): Promise<ModelInfo[]> {
  let query = 'SELECT * FROM model_registry WHERE 1=1';
  const params: string[] = [];

  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  } else {
    query += ' AND status = ?';
    params.push('active');
  }

  if (options?.provider) {
    query += ' AND provider = ?';
    params.push(options.provider);
  }

  if (options?.tierRequired) {
    query += ' AND tier_required = ?';
    params.push(options.tierRequired);
  }

  query += ' ORDER BY display_name';

  const stmt = env.DB.prepare(query);
  const result = await stmt.bind(...params).all();

  return (result.results || []).map(row => ({
    id: row.id as string,
    provider: row.provider as string,
    modelId: row.model_id as string,
    displayName: row.display_name as string,
    capabilities: JSON.parse(row.capabilities as string || '[]'),
    contextWindow: row.context_window as number,
    costPerKInput: row.cost_per_1k_input as number,
    costPerKOutput: row.cost_per_1k_output as number,
    requiresApiKey: row.requires_api_key === 1,
    tierRequired: row.tier_required as string,
    status: row.status as string,
    outputFilterStrategy: row.output_filter_strategy as string,
  })).filter(model => {
    // Filter by capability if specified
    if (options?.capability) {
      return model.capabilities.includes(options.capability);
    }
    return true;
  });
}

/**
 * Get models available to a specific user (based on tier and API keys)
 */
export async function getModelsForUser(
  env: Env,
  userId: string,
  userTier: string,
  capability?: string
): Promise<ModelInfo[]> {
  // Get all active models
  const allModels = await getAvailableModels(env, { capability, status: 'active' });

  // Get user's API keys
  const userRow = await env.DB.prepare(`
    SELECT
      openai_api_key_encrypted,
      anthropic_api_key_encrypted,
      google_api_key_encrypted,
      groq_api_key_encrypted
    FROM users WHERE id = ?
  `).bind(userId).first();

  const hasApiKey: Record<string, boolean> = {
    openai: !!userRow?.openai_api_key_encrypted,
    anthropic: !!userRow?.anthropic_api_key_encrypted,
    google: !!userRow?.google_api_key_encrypted,
    groq: !!userRow?.groq_api_key_encrypted,
  };

  // Tier hierarchy
  const tierOrder = ['free', 'pro', 'premium', 'admin'];
  const userTierIndex = tierOrder.indexOf(userTier);

  // Filter models based on tier and API key availability
  return allModels.filter(model => {
    const modelTierIndex = tierOrder.indexOf(model.tierRequired);

    // Check tier
    if (userTierIndex < modelTierIndex) {
      return false;
    }

    // Check API key for external providers
    if (model.requiresApiKey && !hasApiKey[model.provider]) {
      return false;
    }

    return true;
  });
}

/**
 * Get user's model preference for a use case
 */
export async function getUserModelPreference(
  env: Env,
  userId: string,
  useCase: UseCase
): Promise<string | null> {
  const result = await env.DB.prepare(`
    SELECT model_id FROM user_model_preferences
    WHERE user_id = ? AND use_case = ?
  `).bind(userId, useCase).first();

  return result?.model_id as string | null;
}

/**
 * Set user's model preference for a use case
 */
export async function setUserModelPreference(
  env: Env,
  userId: string,
  useCase: UseCase,
  modelId: string
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO user_model_preferences (user_id, use_case, model_id, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(user_id, use_case) DO UPDATE SET
      model_id = excluded.model_id,
      updated_at = excluded.updated_at
  `).bind(userId, useCase, modelId).run();
}

/**
 * Get default model for a use case
 */
export async function getDefaultModel(
  env: Env,
  useCase: UseCase,
  environment: 'cloud' | 'local'
): Promise<ModelInfo | null> {
  const column = environment === 'cloud' ? 'cloud_model_id' : 'local_model_id';

  const result = await env.DB.prepare(`
    SELECT mr.* FROM model_registry mr
    JOIN default_model_settings dms ON mr.id = dms.${column}
    WHERE dms.use_case = ?
  `).bind(useCase).first();

  if (!result) return null;

  return {
    id: result.id as string,
    provider: result.provider as string,
    modelId: result.model_id as string,
    displayName: result.display_name as string,
    capabilities: JSON.parse(result.capabilities as string || '[]'),
    contextWindow: result.context_window as number,
    costPerKInput: result.cost_per_1k_input as number,
    costPerKOutput: result.cost_per_1k_output as number,
    requiresApiKey: result.requires_api_key === 1,
    tierRequired: result.tier_required as string,
    status: result.status as string,
    outputFilterStrategy: result.output_filter_strategy as string,
  };
}

/**
 * Get model by ID from registry
 */
export async function getModelById(env: Env, modelId: string): Promise<ModelInfo | null> {
  const result = await env.DB.prepare(`
    SELECT * FROM model_registry WHERE id = ?
  `).bind(modelId).first();

  if (!result) return null;

  return {
    id: result.id as string,
    provider: result.provider as string,
    modelId: result.model_id as string,
    displayName: result.display_name as string,
    capabilities: JSON.parse(result.capabilities as string || '[]'),
    contextWindow: result.context_window as number,
    costPerKInput: result.cost_per_1k_input as number,
    costPerKOutput: result.cost_per_1k_output as number,
    requiresApiKey: result.requires_api_key === 1,
    tierRequired: result.tier_required as string,
    status: result.status as string,
    outputFilterStrategy: result.output_filter_strategy as string,
  };
}

/**
 * Select the best model for a user and use case
 */
export async function selectModel(
  env: Env,
  userId: string,
  userTier: string,
  useCase: UseCase
): Promise<ModelSelectionResult> {
  const environment = hasCloudflareAI(env) ? 'cloud' : 'local';

  // 1. Check user preference first
  const preferredModelId = await getUserModelPreference(env, userId, useCase);
  if (preferredModelId) {
    const model = await getModelById(env, preferredModelId);
    if (model) {
      // Verify user can still use this model (tier + API key)
      const availableModels = await getModelsForUser(env, userId, userTier);
      const isAvailable = availableModels.some(m => m.id === model.id);

      if (isAvailable) {
        return { model, reason: 'user_preference', environment };
      }
    }
  }

  // 2. Get default model for use case
  const defaultModel = await getDefaultModel(env, useCase, environment);
  if (defaultModel) {
    return { model: defaultModel, reason: 'default', environment };
  }

  // 3. Fallback to general purpose
  const fallbackModel = await getDefaultModel(env, 'general', environment);
  if (fallbackModel) {
    return { model: fallbackModel, reason: 'fallback', environment };
  }

  // 4. Ultimate fallback (should never happen if DB is seeded)
  throw new Error(`No model available for use case: ${useCase}`);
}

/**
 * Create an LLM provider for a use case (convenience function)
 */
export async function createProviderForUseCase(
  env: Env,
  userId: string,
  userTier: string,
  useCase: UseCase
): Promise<{ provider: LLMProvider; model: ModelInfo; environment: 'cloud' | 'local' }> {
  const selection = await selectModel(env, userId, userTier, useCase);

  console.log(`[ModelSelector] Use case: ${useCase}, Model: ${selection.model.displayName}, Reason: ${selection.reason}`);

  const provider = await createLLMProvider(
    selection.model.modelId,
    env,
    userId
  );

  return {
    provider,
    model: selection.model,
    environment: selection.environment,
  };
}

/**
 * Track API usage for cost monitoring
 */
export async function trackApiUsage(
  env: Env,
  userId: string,
  model: ModelInfo,
  tokensInput: number,
  tokensOutput: number,
  useCase?: string
): Promise<void> {
  const estimatedCost = (tokensInput / 1000 * model.costPerKInput) +
                        (tokensOutput / 1000 * model.costPerKOutput);

  // Insert individual usage record
  await env.DB.prepare(`
    INSERT INTO api_key_usage (user_id, provider, model_id, tokens_input, tokens_output, estimated_cost, use_case)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(userId, model.provider, model.modelId, tokensInput, tokensOutput, estimatedCost, useCase || null).run();

  // Update monthly aggregate
  const yearMonth = new Date().toISOString().slice(0, 7); // '2025-12'
  await env.DB.prepare(`
    INSERT INTO api_key_usage_monthly (user_id, provider, year_month, total_tokens_input, total_tokens_output, total_estimated_cost, call_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, unixepoch())
    ON CONFLICT(user_id, provider, year_month) DO UPDATE SET
      total_tokens_input = total_tokens_input + excluded.total_tokens_input,
      total_tokens_output = total_tokens_output + excluded.total_tokens_output,
      total_estimated_cost = total_estimated_cost + excluded.total_estimated_cost,
      call_count = call_count + 1,
      updated_at = excluded.updated_at
  `).bind(userId, model.provider, yearMonth, tokensInput, tokensOutput, estimatedCost).run();
}

/**
 * Get user's API usage summary
 */
export async function getUserUsageSummary(
  env: Env,
  userId: string,
  yearMonth?: string
): Promise<{
  provider: string;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalEstimatedCost: number;
  callCount: number;
}[]> {
  const month = yearMonth || new Date().toISOString().slice(0, 7);

  const result = await env.DB.prepare(`
    SELECT provider, total_tokens_input, total_tokens_output, total_estimated_cost, call_count
    FROM api_key_usage_monthly
    WHERE user_id = ? AND year_month = ?
  `).bind(userId, month).all();

  return (result.results || []).map(row => ({
    provider: row.provider as string,
    totalTokensInput: row.total_tokens_input as number,
    totalTokensOutput: row.total_tokens_output as number,
    totalEstimatedCost: row.total_estimated_cost as number,
    callCount: row.call_count as number,
  }));
}
