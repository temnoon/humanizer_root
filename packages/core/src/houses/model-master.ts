/**
 * Model Master Agent
 *
 * The AI Master Control wrapped as a council agent.
 * Routes capability requests to the best available model.
 *
 * Capabilities:
 * - call-capability: Call an AI capability
 * - preview-routing: Preview which model would be used
 * - check-budget: Check user's budget status
 * - list-capabilities: List available capabilities
 * - list-models: List available models for a capability
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed - see config/default-thresholds.ts
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../runtime/types.js';
import { getConfigManager, THRESHOLD_KEYS, LIMIT_KEYS } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';

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
  params?: Record<string, unknown>;
  userId?: string;
  modelOverride?: string;
  providerOverride?: string;
  requestId?: string;
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
 * Model class definition
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

/**
 * Model info for listing
 */
export interface ModelInfo {
  modelId: string;
  provider: string;
  priority: number;
  conditions?: unknown;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface CallCapabilityRequest {
  capability: string;
  input: string;
  params?: Record<string, unknown>;
  userId?: string;
  modelOverride?: string;
  providerOverride?: string;
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

  // In-memory tracking (would be persisted in production)
  private userSpending: Map<string, number> = new Map();
  private activeCalls: number = 0;

  constructor() {
    super();
    this.config = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Initializing with ConfigManager integration');

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
    const { capability, input, params, userId, modelOverride, providerOverride } = request;

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
      // Route to appropriate model/provider
      const routing = await this.handlePreviewRouting({
        capability,
        userId,
        modelOverride,
      });

      // Simulate AI call (would connect to actual AI service)
      // In production, this would call the AI control service
      const response: AIResponse = {
        output: `[Simulated response for capability: ${capability}]`,
        modelUsed: modelOverride || routing.selectedModel,
        providerUsed: providerOverride || routing.selectedProvider,
        inputTokens: Math.ceil(input.length / 4),
        outputTokens: 100,
        cost: 0.001,
        latencyMs: Date.now() - startTime,
      };

      // Track spending
      if (userId) {
        await this.handleTrackSpend({ userId, amount: response.cost });
      }

      // Emit event for tracking
      this.publish('ai:call-completed', {
        capability,
        modelUsed: response.modelUsed,
        providerUsed: response.providerUsed,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cost: response.cost,
        userId,
      });

      return response;
    } finally {
      this.activeCalls--;
    }
  }

  private async handlePreviewRouting(request: PreviewRoutingRequest): Promise<RouterDecision> {
    const { capability, modelOverride } = request;

    // Get available models for this capability from config
    const modelClasses = await this.config.get<Record<string, ModelClass>>(
      'agents',
      'modelClasses'
    ) || this.getDefaultModelClasses();

    const modelClass = modelClasses[capability];

    if (!modelClass) {
      // Fallback to default
      return {
        capability,
        selectedModel: modelOverride || 'claude-3-sonnet',
        selectedProvider: 'anthropic',
        reason: `No specific routing for capability "${capability}", using default`,
        alternatives: [],
      };
    }

    // Sort by priority
    const sortedModels = [...modelClass.models].sort((a, b) => a.priority - b.priority);
    const primary = sortedModels[0];

    return {
      capability,
      selectedModel: modelOverride || primary.modelId,
      selectedProvider: primary.provider,
      reason: `Routed to ${primary.modelId} (priority ${primary.priority})`,
      alternatives: sortedModels.slice(1).map(m => ({
        model: m.modelId,
        provider: m.provider,
        reason: `Alternative with priority ${m.priority}`,
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

    // Get user's limit (would come from user profile in production)
    const limit = 10.0; // Default $10 limit
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

  private async handleListCapabilities(_request: ListCapabilitiesRequest): Promise<ModelClass[]> {
    const modelClasses = await this.config.get<Record<string, ModelClass>>(
      'agents',
      'modelClasses'
    ) || this.getDefaultModelClasses();

    return Object.values(modelClasses);
  }

  private async handleListModels(request: ListModelsRequest): Promise<ModelInfo[]> {
    const { capability } = request;

    const modelClasses = await this.config.get<Record<string, ModelClass>>(
      'agents',
      'modelClasses'
    ) || this.getDefaultModelClasses();

    const modelClass = modelClasses[capability];

    if (!modelClass) {
      throw new Error(`Unknown capability: ${capability}`);
    }

    return modelClass.models.map(pref => ({
      modelId: pref.modelId,
      provider: pref.provider,
      priority: pref.priority,
      conditions: pref.conditions,
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
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // DEFAULT MODEL CLASSES
  // ─────────────────────────────────────────────────────────────────

  private getDefaultModelClasses(): Record<string, ModelClass> {
    return {
      'analysis': {
        name: 'Analysis',
        description: 'Text analysis and understanding',
        capabilities: ['analysis'],
        models: [
          { modelId: 'claude-3-sonnet', provider: 'anthropic', priority: 1 },
          { modelId: 'gpt-4-turbo', provider: 'openai', priority: 2 },
        ],
      },
      'creative': {
        name: 'Creative',
        description: 'Creative writing and composition',
        capabilities: ['creative'],
        models: [
          { modelId: 'claude-3-opus', provider: 'anthropic', priority: 1 },
          { modelId: 'claude-3-sonnet', provider: 'anthropic', priority: 2 },
        ],
      },
      'summarization': {
        name: 'Summarization',
        description: 'Text summarization',
        capabilities: ['summarization'],
        models: [
          { modelId: 'claude-3-haiku', provider: 'anthropic', priority: 1 },
          { modelId: 'gpt-4-turbo', provider: 'openai', priority: 2 },
        ],
      },
      'detection': {
        name: 'AI Detection',
        description: 'Detect AI-generated content',
        capabilities: ['detection'],
        models: [
          { modelId: 'claude-3-sonnet', provider: 'anthropic', priority: 1 },
        ],
      },
      'humanizer': {
        name: 'Humanizer',
        description: 'Make text more human-like',
        capabilities: ['humanizer'],
        models: [
          { modelId: 'claude-3-opus', provider: 'anthropic', priority: 1 },
        ],
      },
      'embedding': {
        name: 'Embedding',
        description: 'Text embeddings',
        capabilities: ['embedding'],
        models: [
          { modelId: 'text-embedding-3-small', provider: 'openai', priority: 1 },
          { modelId: 'voyage-2', provider: 'voyage', priority: 2 },
        ],
      },
    };
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
      params?: Record<string, unknown>;
      userId?: string;
      modelOverride?: string;
    }
  ): Promise<AIResponse> {
    return this.handleCallCapability({
      capability,
      input,
      params: options?.params,
      userId: options?.userId,
      modelOverride: options?.modelOverride,
    });
  }

  /**
   * Quick call for common capabilities
   */
  async translate(text: string, targetLanguage: string, userId?: string): Promise<string> {
    const response = await this.callCapability('translation', text, {
      params: { targetLanguage },
      userId,
    });
    return response.output;
  }

  async analyze(text: string, userId?: string): Promise<unknown> {
    const response = await this.callCapability('analysis', text, { userId });
    return response.structured || response.output;
  }

  async summarize(text: string, userId?: string): Promise<string> {
    const response = await this.callCapability('summarization', text, { userId });
    return response.output;
  }

  async detectAI(text: string): Promise<unknown> {
    const response = await this.callCapability('detection', text);
    return response.structured || response.output;
  }

  async humanize(text: string, userId?: string): Promise<string> {
    const response = await this.callCapability('humanizer', text, { userId });
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
