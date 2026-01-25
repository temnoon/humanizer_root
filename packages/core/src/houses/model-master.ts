/**
 * Model Master Agent
 *
 * The enforcement layer for AI model routing. Routes capability requests
 * to the best available model using the ModelRegistry and ProviderManager.
 *
 * Capabilities:
 * - call-capability: Call an AI capability (actual LLM call)
 * - preview-routing: Preview which model would be used
 * - check-budget: Check user's budget status
 * - list-capabilities: List available capabilities
 * - list-models: List available models for a capability
 *
 * KEY PRINCIPLE:
 * Model-Master is NOT an independent mechanism. It queries:
 * - ModelRegistry: Source of truth for approved models
 * - ProviderManager: Executes actual LLM calls
 * - ConfigManager: Thresholds and preferences
 *
 * @see packages/core/docs/AGENT_RUNTIME_HANDOFF.md
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../runtime/types.js';
import { getConfigManager, THRESHOLD_KEYS, LIMIT_KEYS, getPrompt } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';
import { getModelRegistry } from '../models/default-model-registry.js';
import type { ModelRegistry, VettedModel, ModelCapability } from '../models/model-registry.js';
import { getProviderManager, type ProviderManager } from '../llm-providers/provider-manager.js';
import type { ChatMessage, LlmRequest } from '../llm-providers/types.js';
import { ProviderError, ProviderUnavailableError } from '../llm-providers/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS FOR MODEL MASTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Model Master specific config keys
 */
export const MODEL_MASTER_CONFIG = {
  // Capability routing
  DEFAULT_CAPABILITY_TIMEOUT: 'modelMaster.defaultCapabilityTimeout',
  MAX_RETRIES: 'modelMaster.maxRetries',
  RETRY_DELAY_MS: 'modelMaster.retryDelayMs',

  // Budget thresholds
  BUDGET_WARNING_THRESHOLD: 'modelMaster.budgetWarningThreshold',
  BUDGET_CRITICAL_THRESHOLD: 'modelMaster.budgetCriticalThreshold',
  DEFAULT_USER_BUDGET: 'modelMaster.defaultUserBudget',

  // Rate limiting
  MAX_CONCURRENT_CALLS: 'modelMaster.maxConcurrentCalls',
} as const;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * AI request for capability routing
 */
export interface AIRequest {
  capability: string;
  input: string;
  systemPrompt?: string;
  params?: Record<string, unknown>;
  userId?: string;
  modelOverride?: string;
  providerOverride?: string;
  requestId?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * AI response from capability call
 */
export interface AIResponse {
  output: string;
  modelUsed: string;
  providerUsed: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  structured?: unknown;
}

/**
 * Router decision for capability routing
 */
export interface RouterDecision {
  capability: string;
  selectedModel: string;
  selectedProvider: string;
  reason: string;
  alternatives: Array<{
    model: string;
    provider: string;
    reason: string;
  }>;
}

/**
 * Budget status for a user
 */
export interface BudgetStatus {
  userId: string;
  totalSpent: number;
  limit: number;
  remaining: number;
  isOverBudget: boolean;
  warningLevel: 'none' | 'warning' | 'critical';
}

/**
 * Model info for listing
 */
export interface ModelInfo {
  modelId: string;
  provider: string;
  capabilities: string[];
  qualityScore: number;
  costPer1k: { input: number; output: number };
}

/**
 * @deprecated Use ModelInfo instead. Retained for backward compatibility.
 */
export interface ModelClass {
  name: string;
  description: string;
  capabilities: string[];
  models: Array<{
    modelId: string;
    provider: string;
    priority: number;
    conditions?: Record<string, unknown>;
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface CallCapabilityRequest {
  capability: string;
  input: string;
  systemPrompt?: string;
  params?: Record<string, unknown>;
  userId?: string;
  modelOverride?: string;
  providerOverride?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface PreviewRoutingRequest {
  capability: string;
  userId?: string;
  modelOverride?: string;
}

interface CheckBudgetRequest {
  userId: string;
}

interface ListCapabilitiesRequest {
  userId?: string;
}

interface ListModelsRequest {
  capability: string;
}

interface TrackSpendRequest {
  userId: string;
  amount: number;
}

// ═══════════════════════════════════════════════════════════════════
// MODEL MASTER AGENT
// ═══════════════════════════════════════════════════════════════════

export class ModelMasterAgent extends AgentBase {
  readonly id = 'model-master';
  readonly name = 'Model Master';
  readonly house: HouseType = 'model-master';
  readonly capabilities = [
    'call-capability',
    'preview-routing',
    'check-budget',
    'list-capabilities',
    'list-models',
    'track-spend',
  ];

  private config: ConfigManager;
  private registry: ModelRegistry;
  private providers: ProviderManager;

  // In-memory tracking (TODO: persist to database via AuiPostgresStore)
  private userSpending: Map<string, number> = new Map();
  private activeCalls: number = 0;

  constructor() {
    super();
    this.config = getConfigManager();
    this.registry = getModelRegistry();
    this.providers = getProviderManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Initializing with ModelRegistry + ProviderManager integration');

    // Initialize the model registry
    await this.registry.initialize();

    // Subscribe to budget-related events
    this.subscribe('budget:check');
    this.subscribe('budget:exceeded');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Shutting down');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'call-capability':
        return this.handleCallCapability(message.payload as CallCapabilityRequest);

      case 'preview-routing':
        return this.handlePreviewRouting(message.payload as PreviewRoutingRequest);

      case 'check-budget':
        return this.handleCheckBudget(message.payload as CheckBudgetRequest);

      case 'list-capabilities':
        return this.handleListCapabilities(message.payload as ListCapabilitiesRequest);

      case 'list-models':
        return this.handleListModels(message.payload as ListModelsRequest);

      case 'track-spend':
        return this.handleTrackSpend(message.payload as TrackSpendRequest);

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────

  private async handleCallCapability(request: CallCapabilityRequest): Promise<AIResponse> {
    const {
      capability,
      input,
      systemPrompt,
      params,
      userId,
      modelOverride,
      providerOverride,
      temperature,
      maxTokens,
      jsonMode,
    } = request;

    // Get config values
    const maxConcurrent = await this.config.getOrDefault<number>(
      'limits',
      MODEL_MASTER_CONFIG.MAX_CONCURRENT_CALLS,
      5
    );

    // Check concurrent call limit
    if (this.activeCalls >= maxConcurrent) {
      throw new Error('Maximum concurrent calls exceeded. Please wait.');
    }

    // Check budget before calling
    if (userId) {
      const budgetStatus = await this.handleCheckBudget({ userId });
      if (budgetStatus.isOverBudget) {
        throw new Error('Budget exceeded. Cannot make AI call.');
      }
    }

    this.activeCalls++;
    const startTime = Date.now();

    try {
      // Route to appropriate model using ModelRegistry
      const routing = await this.handlePreviewRouting({
        capability,
        userId,
        modelOverride,
      });

      // Get the selected model details
      const modelId = modelOverride || routing.selectedModel;
      const model = await this.registry.get(modelId);

      if (!model) {
        throw new Error(`Model ${modelId} not found in registry`);
      }

      // Get provider (override or from model)
      const providerName = providerOverride
        ? (providerOverride as typeof model.provider)
        : model.provider;

      // Check provider availability
      const providerAvailable = await this.providers.isAvailable(providerName);
      if (!providerAvailable) {
        // Try fallback
        const fallbackModel = await this.registry.getWithFallback(capability as ModelCapability);
        if (fallbackModel.id === model.id) {
          throw new ProviderUnavailableError(providerName);
        }
        // Recursively call with fallback model
        return this.handleCallCapability({
          ...request,
          modelOverride: fallbackModel.id,
          providerOverride: fallbackModel.provider,
        });
      }

      const provider = this.providers.get(providerName);

      // Build messages
      const messages: ChatMessage[] = [];
      if (systemPrompt || params?.systemPrompt) {
        messages.push({
          role: 'system',
          content: (systemPrompt || params?.systemPrompt) as string,
        });
      }
      messages.push({
        role: 'user',
        content: input,
      });

      // Build LLM request
      const llmRequest: LlmRequest = {
        modelId,
        messages,
        temperature: temperature ?? (params?.temperature as number | undefined) ?? 0.7,
        maxTokens: maxTokens ?? (params?.maxTokens as number | undefined) ?? 2048,
        jsonMode,
      };

      // Execute the call
      const llmResponse = await provider.chat(llmRequest);

      // Calculate cost from registry
      const costs = await this.registry.getCost(modelId);
      const cost = (
        (llmResponse.usage.promptTokens * costs.input) +
        (llmResponse.usage.completionTokens * costs.output)
      ) / 1000;

      const response: AIResponse = {
        output: llmResponse.content,
        modelUsed: modelId,
        providerUsed: providerName,
        inputTokens: llmResponse.usage.promptTokens,
        outputTokens: llmResponse.usage.completionTokens,
        cost,
        latencyMs: llmResponse.latencyMs,
        structured: jsonMode ? this.tryParseJson(llmResponse.content) : undefined,
      };

      // Track spending
      if (userId) {
        await this.handleTrackSpend({ userId, amount: cost });
      }

      // Emit event for tracking
      this.publish('ai:call-completed', {
        capability,
        modelUsed: response.modelUsed,
        providerUsed: response.providerUsed,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cost: response.cost,
        latencyMs: response.latencyMs,
        userId,
      });

      return response;
    } catch (error) {
      // Log the error
      this.log('error', `Call failed: ${(error as Error).message}`);

      // Re-throw provider errors
      if (error instanceof ProviderError) {
        throw error;
      }

      throw error;
    } finally {
      this.activeCalls--;
    }
  }

  private tryParseJson(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  private async handlePreviewRouting(request: PreviewRoutingRequest): Promise<RouterDecision> {
    const { capability, modelOverride } = request;

    // If model override specified, use it directly
    if (modelOverride) {
      const model = await this.registry.get(modelOverride);
      if (model && model.vettingStatus === 'approved') {
        return {
          capability,
          selectedModel: model.id,
          selectedProvider: model.provider,
          reason: `Model override: ${modelOverride}`,
          alternatives: [],
        };
      }
    }

    // Get models for capability from ModelRegistry
    const models = await this.registry.getForCapability(capability as ModelCapability);

    if (models.length === 0) {
      // No models for this capability - try to find something close
      const defaultModel = await this.registry.getDefault('completion');
      return {
        capability,
        selectedModel: defaultModel.id,
        selectedProvider: defaultModel.provider,
        reason: `No specific model for "${capability}", using default completion model`,
        alternatives: [],
      };
    }

    // Models are already sorted by quality score from getForCapability
    const primary = models[0];

    // Check if primary's provider is available
    const providerAvailable = await this.providers.isAvailable(primary.provider);

    if (!providerAvailable && models.length > 1) {
      // Find first alternative with available provider
      for (let i = 1; i < models.length; i++) {
        if (await this.providers.isAvailable(models[i].provider)) {
          return {
            capability,
            selectedModel: models[i].id,
            selectedProvider: models[i].provider,
            reason: `Primary provider ${primary.provider} unavailable, falling back to ${models[i].id}`,
            alternatives: models.slice(i + 1).map(m => ({
              model: m.id,
              provider: m.provider,
              reason: `Quality score: ${(m.performanceProfile.qualityScore * 100).toFixed(0)}%`,
            })),
          };
        }
      }
    }

    return {
      capability,
      selectedModel: primary.id,
      selectedProvider: primary.provider,
      reason: `Highest quality model for "${capability}" (${(primary.performanceProfile.qualityScore * 100).toFixed(0)}% quality)`,
      alternatives: models.slice(1).map(m => ({
        model: m.id,
        provider: m.provider,
        reason: `Quality score: ${(m.performanceProfile.qualityScore * 100).toFixed(0)}%`,
      })),
    };
  }

  private async handleCheckBudget(request: CheckBudgetRequest): Promise<BudgetStatus> {
    const { userId } = request;

    // Get budget thresholds from config
    const warningThreshold = await this.config.getOrDefault<number>(
      'thresholds',
      MODEL_MASTER_CONFIG.BUDGET_WARNING_THRESHOLD,
      0.8
    );
    const criticalThreshold = await this.config.getOrDefault<number>(
      'thresholds',
      MODEL_MASTER_CONFIG.BUDGET_CRITICAL_THRESHOLD,
      0.95
    );
    const defaultBudget = await this.config.getOrDefault<number>(
      'limits',
      MODEL_MASTER_CONFIG.DEFAULT_USER_BUDGET,
      10.0
    );

    // Get user's limit (TODO: get from database/user profile)
    const limit = defaultBudget;
    const spent = this.userSpending.get(userId) || 0;
    const remaining = limit - spent;
    const usageRatio = spent / limit;

    let warningLevel: BudgetStatus['warningLevel'] = 'none';
    if (usageRatio >= criticalThreshold) {
      warningLevel = 'critical';
    } else if (usageRatio >= warningThreshold) {
      warningLevel = 'warning';
    }

    return {
      userId,
      totalSpent: spent,
      limit,
      remaining,
      isOverBudget: remaining <= 0,
      warningLevel,
    };
  }

  private async handleListCapabilities(_request: ListCapabilitiesRequest): Promise<ModelCapability[]> {
    // Return all unique capabilities from approved models
    const models = await this.registry.listAllModels();
    const capabilities = new Set<ModelCapability>();

    for (const model of models) {
      if (model.vettingStatus === 'approved') {
        for (const cap of model.capabilities) {
          capabilities.add(cap);
        }
      }
    }

    return Array.from(capabilities);
  }

  private async handleListModels(request: ListModelsRequest): Promise<ModelInfo[]> {
    const { capability } = request;

    const models = await this.registry.getForCapability(capability as ModelCapability);

    return models.map(m => ({
      modelId: m.id,
      provider: m.provider,
      capabilities: m.capabilities,
      qualityScore: m.performanceProfile.qualityScore,
      costPer1k: m.costPer1kTokens,
    }));
  }

  private async handleTrackSpend(request: TrackSpendRequest): Promise<void> {
    const { userId, amount } = request;
    const current = this.userSpending.get(userId) || 0;
    this.userSpending.set(userId, current + amount);

    // Check if budget warning should be emitted
    const status = await this.handleCheckBudget({ userId });
    if (status.warningLevel !== 'none') {
      this.publish('budget:warning', {
        userId,
        level: status.warningLevel,
        remaining: status.remaining,
        spent: status.totalSpent,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API (For Other Agents)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Call an AI capability (convenience method for other agents)
   */
  async callCapability(
    capability: string,
    input: string,
    options?: {
      systemPrompt?: string;
      params?: Record<string, unknown>;
      userId?: string;
      modelOverride?: string;
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
    }
  ): Promise<AIResponse> {
    return this.handleCallCapability({
      capability,
      input,
      systemPrompt: options?.systemPrompt,
      params: options?.params,
      userId: options?.userId,
      modelOverride: options?.modelOverride,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      jsonMode: options?.jsonMode,
    });
  }

  /**
   * Quick call for common capabilities
   * All prompts are sourced from the central prompt registry.
   */
  async translate(text: string, targetLanguage: string, userId?: string): Promise<string> {
    const promptDef = getPrompt('MODEL_MASTER_TRANSLATE');
    const systemPrompt = promptDef?.template
      .replace('{{targetLanguage}}', targetLanguage)
      .replace('{{text}}', text)
      ?? `Translate the following text to ${targetLanguage}. Return only the translation, no explanation.\n\nText:\n${text}`;

    const response = await this.callCapability('completion', text, {
      systemPrompt,
      userId,
    });
    return response.output;
  }

  async analyze(text: string, userId?: string): Promise<unknown> {
    const promptDef = getPrompt('MODEL_MASTER_ANALYZE');
    const systemPrompt = promptDef?.template.replace('{{text}}', text)
      ?? `Analyze the following text. Provide structured analysis.\n\nText:\n${text}`;

    const response = await this.callCapability('analysis', text, {
      systemPrompt,
      userId,
      jsonMode: true,
    });
    return response.structured || response.output;
  }

  async summarize(text: string, userId?: string): Promise<string> {
    const promptDef = getPrompt('MODEL_MASTER_SUMMARIZE');
    const systemPrompt = promptDef?.template.replace('{{text}}', text)
      ?? `Summarize the following text concisely.\n\nText:\n${text}`;

    const response = await this.callCapability('completion', text, {
      systemPrompt,
      userId,
    });
    return response.output;
  }

  async detectAI(text: string): Promise<unknown> {
    const promptDef = getPrompt('MODEL_MASTER_DETECT_AI');
    const systemPrompt = promptDef?.template.replace('{{text}}', text)
      ?? `Analyze this text for AI-generated content indicators. Return a JSON object with probability (0-1) and evidence array.\n\nText:\n${text}`;

    const response = await this.callCapability('analysis', text, {
      systemPrompt,
      jsonMode: true,
    });
    return response.structured || response.output;
  }

  async humanize(text: string, userId?: string): Promise<string> {
    const promptDef = getPrompt('MODEL_MASTER_HUMANIZE');
    const systemPrompt = promptDef?.template.replace('{{text}}', text)
      ?? `Rewrite this text to sound more natural and human-like while preserving the meaning.\n\nText:\n${text}`;

    const response = await this.callCapability('creative', text, {
      systemPrompt,
      userId,
    });
    return response.output;
  }

  async compose(prompt: string, userId?: string): Promise<string> {
    const response = await this.callCapability('creative', prompt, { userId });
    return response.output;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _modelMaster: ModelMasterAgent | null = null;

/**
 * Get the Model Master agent
 */
export function getModelMasterAgent(): ModelMasterAgent {
  if (!_modelMaster) {
    _modelMaster = new ModelMasterAgent();
  }
  return _modelMaster;
}

/**
 * Reset the Model Master agent (for testing)
 */
export function resetModelMasterAgent(): void {
  _modelMaster = null;
}
