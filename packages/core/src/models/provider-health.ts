/**
 * Provider Health Check Service
 *
 * Monitors provider availability and updates health status in database.
 * Supports configurable check intervals and graceful degradation.
 *
 * Features:
 * - Periodic health checks for all configured providers
 * - Exponential backoff for failed providers
 * - Health status persistence via ProviderConfigService
 * - Event emission for health changes
 * - Circuit breaker pattern for repeated failures
 *
 * @module models/provider-health
 */

import type { ModelProvider } from './model-registry.js';
import type { ProviderConfigService, ProviderHealthStatus } from '../aui/service/provider-config-service.js';
import { validateApiKey, providerRequiresApiKey } from './provider-validator.js';
import { OllamaDiscoveryService } from './ollama-discovery.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Health check result for a provider
 */
export interface ProviderHealthCheck {
  provider: ModelProvider;
  status: ProviderHealthStatus;
  latencyMs: number;
  error?: string;
  timestamp: Date;
  consecutiveFailures: number;
}

/**
 * Health check event
 */
export interface HealthCheckEvent {
  type: 'check' | 'status_change' | 'recovery' | 'degraded';
  provider: ModelProvider;
  previousStatus?: ProviderHealthStatus;
  currentStatus: ProviderHealthStatus;
  timestamp: Date;
}

/**
 * Options for ProviderHealthService
 */
export interface ProviderHealthServiceOptions {
  /** Default check interval in milliseconds */
  checkIntervalMs?: number;
  /** Check interval when provider is unhealthy (exponential backoff base) */
  unhealthyCheckIntervalMs?: number;
  /** Maximum consecutive failures before marking as unhealthy */
  maxConsecutiveFailures?: number;
  /** Timeout for individual health checks */
  checkTimeoutMs?: number;
  /** Providers to monitor (empty = all configured) */
  providers?: ModelProvider[];
  /** Default tenant ID */
  defaultTenantId?: string;
}

/**
 * Health check listener callback
 */
export type HealthCheckListener = (event: HealthCheckEvent) => void;

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER HEALTH SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ProviderHealthService monitors provider availability.
 */
export class ProviderHealthService {
  private providerConfigService: ProviderConfigService | null = null;
  private ollamaDiscovery: OllamaDiscoveryService | null = null;
  private options: Required<ProviderHealthServiceOptions>;

  private checkTimers: Map<ModelProvider, NodeJS.Timeout> = new Map();
  private healthStatus: Map<ModelProvider, ProviderHealthCheck> = new Map();
  private listeners: Set<HealthCheckListener> = new Set();
  private running = false;

  constructor(options?: ProviderHealthServiceOptions) {
    this.options = {
      checkIntervalMs: options?.checkIntervalMs ?? 60_000, // 1 minute
      unhealthyCheckIntervalMs: options?.unhealthyCheckIntervalMs ?? 30_000, // 30 seconds base
      maxConsecutiveFailures: options?.maxConsecutiveFailures ?? 3,
      checkTimeoutMs: options?.checkTimeoutMs ?? 10_000,
      providers: options?.providers ?? [],
      defaultTenantId: options?.defaultTenantId ?? 'humanizer',
    };
  }

  /**
   * Set the ProviderConfigService for persistence.
   */
  setProviderConfigService(service: ProviderConfigService): void {
    this.providerConfigService = service;
  }

  /**
   * Set the OllamaDiscoveryService for Ollama health checks.
   */
  setOllamaDiscoveryService(service: OllamaDiscoveryService): void {
    this.ollamaDiscovery = service;
  }

  /**
   * Add a listener for health check events.
   */
  addListener(listener: HealthCheckListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener.
   */
  removeListener(listener: HealthCheckListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Start monitoring providers.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Get providers to monitor
    const providers = await this.getProvidersToMonitor();

    // Start checks for each provider
    for (const provider of providers) {
      await this.startProviderCheck(provider);
    }
  }

  /**
   * Stop monitoring.
   */
  stop(): void {
    this.running = false;

    for (const timer of this.checkTimers.values()) {
      clearTimeout(timer);
    }
    this.checkTimers.clear();
  }

  /**
   * Run a single health check for a provider.
   */
  async checkProvider(provider: ModelProvider, userId?: string): Promise<ProviderHealthCheck> {
    const startTime = Date.now();
    const previousCheck = this.healthStatus.get(provider);
    const previousStatus = previousCheck?.status ?? 'unknown';

    try {
      let status: ProviderHealthStatus = 'healthy';
      let error: string | undefined;

      if (provider === 'ollama') {
        // Use OllamaDiscoveryService for Ollama
        if (this.ollamaDiscovery) {
          const available = await this.ollamaDiscovery.isAvailable();
          status = available ? 'healthy' : 'unhealthy';
          if (!available) {
            error = 'Ollama not responding';
          }
        } else {
          // Fallback to basic check
          const response = await this.checkOllamaBasic();
          status = response.status;
          error = response.error;
        }
      } else if (provider === 'local') {
        // Local provider is always healthy
        status = 'healthy';
      } else if (providerRequiresApiKey(provider)) {
        // Check cloud provider with API key
        const apiKey = await this.getApiKey(provider, userId);

        if (!apiKey) {
          status = 'unknown';
          error = 'No API key configured';
        } else {
          const result = await validateApiKey(provider, apiKey, {
            timeoutMs: this.options.checkTimeoutMs,
          });

          if (result.valid) {
            status = 'healthy';
          } else {
            status = result.errorCode === 'connection_error' ? 'unhealthy' : 'degraded';
            error = result.error;
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const consecutiveFailures = status === 'healthy' ? 0 : (previousCheck?.consecutiveFailures ?? 0) + 1;

      // Apply circuit breaker
      if (consecutiveFailures >= this.options.maxConsecutiveFailures && status === 'degraded') {
        status = 'unhealthy';
      }

      const check: ProviderHealthCheck = {
        provider,
        status,
        latencyMs,
        error,
        timestamp: new Date(),
        consecutiveFailures,
      };

      this.healthStatus.set(provider, check);

      // Persist to database
      await this.persistHealthStatus(provider, status, error, userId);

      // Emit events
      this.emitEvent({
        type: status === previousStatus ? 'check' :
              status === 'healthy' && previousStatus !== 'healthy' ? 'recovery' :
              status !== 'healthy' && previousStatus === 'healthy' ? 'degraded' : 'status_change',
        provider,
        previousStatus,
        currentStatus: status,
        timestamp: new Date(),
      });

      return check;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const latencyMs = Date.now() - startTime;
      const consecutiveFailures = (previousCheck?.consecutiveFailures ?? 0) + 1;

      const check: ProviderHealthCheck = {
        provider,
        status: 'unhealthy',
        latencyMs,
        error,
        timestamp: new Date(),
        consecutiveFailures,
      };

      this.healthStatus.set(provider, check);
      await this.persistHealthStatus(provider, 'unhealthy', error, userId);

      this.emitEvent({
        type: previousStatus === 'healthy' ? 'degraded' : 'check',
        provider,
        previousStatus,
        currentStatus: 'unhealthy',
        timestamp: new Date(),
      });

      return check;
    }
  }

  /**
   * Check all providers immediately.
   */
  async checkAllProviders(userId?: string): Promise<Map<ModelProvider, ProviderHealthCheck>> {
    const providers = await this.getProvidersToMonitor();
    const results = new Map<ModelProvider, ProviderHealthCheck>();

    await Promise.all(
      providers.map(async provider => {
        const check = await this.checkProvider(provider, userId);
        results.set(provider, check);
      })
    );

    return results;
  }

  /**
   * Get current health status for a provider.
   */
  getHealthStatus(provider: ModelProvider): ProviderHealthCheck | undefined {
    return this.healthStatus.get(provider);
  }

  /**
   * Get health status for all monitored providers.
   */
  getAllHealthStatus(): Map<ModelProvider, ProviderHealthCheck> {
    return new Map(this.healthStatus);
  }

  /**
   * Check if a provider is healthy.
   */
  isHealthy(provider: ModelProvider): boolean {
    const status = this.healthStatus.get(provider);
    return status?.status === 'healthy';
  }

  /**
   * Get healthy providers from a list.
   */
  getHealthyProviders(providers: ModelProvider[]): ModelProvider[] {
    return providers.filter(p => this.isHealthy(p));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private async getProvidersToMonitor(): Promise<ModelProvider[]> {
    if (this.options.providers.length > 0) {
      return this.options.providers;
    }

    // Get all configured providers from ProviderConfigService
    if (this.providerConfigService) {
      const configs = await this.providerConfigService.listConfigs(null, undefined, this.options.defaultTenantId);
      const providers = configs
        .filter(c => c.isEnabled)
        .map(c => c.provider);

      // Add Ollama if not explicitly configured but OllamaDiscovery is set
      if (this.ollamaDiscovery && !providers.includes('ollama')) {
        providers.push('ollama');
      }

      return providers.length > 0 ? providers : ['ollama', 'openai', 'anthropic'];
    }

    // Default set of providers
    return ['ollama', 'openai', 'anthropic'];
  }

  private async startProviderCheck(provider: ModelProvider): Promise<void> {
    // Run initial check
    await this.checkProvider(provider);

    // Schedule next check
    this.scheduleNextCheck(provider);
  }

  private scheduleNextCheck(provider: ModelProvider): void {
    if (!this.running) return;

    const currentCheck = this.healthStatus.get(provider);
    let interval = this.options.checkIntervalMs;

    // Use exponential backoff for unhealthy providers
    if (currentCheck && currentCheck.status !== 'healthy') {
      const backoff = Math.min(
        this.options.unhealthyCheckIntervalMs * Math.pow(2, currentCheck.consecutiveFailures - 1),
        this.options.checkIntervalMs * 5 // Cap at 5x normal interval
      );
      interval = backoff;
    }

    const timer = setTimeout(async () => {
      if (!this.running) return;
      await this.checkProvider(provider);
      this.scheduleNextCheck(provider);
    }, interval);

    this.checkTimers.set(provider, timer);
  }

  private async checkOllamaBasic(): Promise<{ status: ProviderHealthStatus; error?: string }> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(this.options.checkTimeoutMs),
      });

      if (response.ok) {
        return { status: 'healthy' };
      }

      return {
        status: 'unhealthy',
        error: `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async getApiKey(provider: ModelProvider, userId?: string): Promise<string | null> {
    if (!this.providerConfigService) return null;

    return this.providerConfigService.getApiKey(provider, userId ?? null, this.options.defaultTenantId);
  }

  private async persistHealthStatus(
    provider: ModelProvider,
    status: ProviderHealthStatus,
    error: string | undefined,
    userId?: string
  ): Promise<void> {
    if (!this.providerConfigService) return;

    try {
      await this.providerConfigService.updateHealth(
        provider,
        status,
        error ?? null,
        userId ?? null,
        this.options.defaultTenantId
      );
    } catch (err) {
      console.warn(`[ProviderHealth] Failed to persist status for ${provider}:`, err);
    }
  }

  private emitEvent(event: HealthCheckEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('[ProviderHealth] Listener error:', err);
      }
    }
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.healthStatus.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _healthService: ProviderHealthService | null = null;

/**
 * Initialize the provider health service.
 */
export function initProviderHealthService(
  options?: ProviderHealthServiceOptions
): ProviderHealthService {
  _healthService = new ProviderHealthService(options);
  return _healthService;
}

/**
 * Get the provider health service.
 */
export function getProviderHealthService(): ProviderHealthService | null {
  return _healthService;
}

/**
 * Reset the provider health service.
 */
export function resetProviderHealthService(): void {
  if (_healthService) {
    _healthService.destroy();
    _healthService = null;
  }
}
