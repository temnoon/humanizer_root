/**
 * Review Hooks Manager
 *
 * Coordinates automatic code reviews triggered by development events.
 * Implements the key insight: "They work better the more they are referred to"
 * by automatically triggering agent reviews on file changes, commits, and PRs.
 *
 * This keeps the system cohesive and prevents bloat through continuous oversight.
 */

import { getMessageBus, type MessageBus } from '../bus/message-bus.js';
import { getConfigManager, type ConfigManager } from '../config/index.js';
import type {
  DevelopmentHouseType,
  FileChangeEvent,
  ReviewResult,
  ReviewTrigger,
  CodeIssue,
  Severity,
} from '../houses/codeguard/types.js';
import { DEVELOPMENT_CONFIG } from '../houses/codeguard/types.js';
import {
  getArchitectAgent,
  getStylistAgent,
  getSecurityAgent,
  getAccessibilityAgent,
  getDataAgent,
} from '../houses/codeguard/index.js';
import type { DevelopmentAgentBase } from '../houses/codeguard/development-agent-base.js';

// ═══════════════════════════════════════════════════════════════════
// HOOK CONFIG
// ═══════════════════════════════════════════════════════════════════

/**
 * Review hook configuration
 */
export interface ReviewHooksConfig {
  /** Master switch for hooks */
  enabled: boolean;

  /** Auto-trigger settings */
  autoTriggers: {
    onFileChange: boolean;
    onPreCommit: boolean;
    onPrePush: boolean;
    onPullRequest: boolean;
    onDependencyChange: boolean;
  };

  /** Agent-specific settings */
  agents: {
    architect: {
      enabled: boolean;
      triggerOnStructuralChanges: boolean;
      minFilesForReview: number;
    };
    stylist: {
      enabled: boolean;
      enforceOnCommit: boolean;
      strictness: 'lenient' | 'moderate' | 'strict';
    };
    security: {
      enabled: boolean;
      blockOnSecrets: boolean;
      scanDependencies: boolean;
    };
    accessibility: {
      enabled: boolean;
      wcagLevel: 'A' | 'AA' | 'AAA';
      triggerOnUIChanges: boolean;
    };
    data: {
      enabled: boolean;
      requireZodSchemas: boolean;
      checkCompatibility: boolean;
    };
  };

  /** File patterns that trigger reviews */
  triggerPatterns: {
    structural: string[];
    ui: string[];
    sensitive: string[];
    config: string[];
  };

  /** Timeout for review operations (ms) */
  timeout: number;

  /** Whether to block operations on errors */
  blockOnError: boolean;
}

const DEFAULT_CONFIG: ReviewHooksConfig = {
  enabled: true,
  autoTriggers: {
    onFileChange: true,
    onPreCommit: true,
    onPrePush: false,
    onPullRequest: true,
    onDependencyChange: true,
  },
  agents: {
    architect: {
      enabled: true,
      triggerOnStructuralChanges: true,
      minFilesForReview: 3,
    },
    stylist: {
      enabled: true,
      enforceOnCommit: true,
      strictness: 'moderate',
    },
    security: {
      enabled: true,
      blockOnSecrets: true,
      scanDependencies: true,
    },
    accessibility: {
      enabled: true,
      wcagLevel: 'AA',
      triggerOnUIChanges: true,
    },
    data: {
      enabled: true,
      requireZodSchemas: true,
      checkCompatibility: true,
    },
  },
  triggerPatterns: {
    structural: ['**/package.json', '**/tsconfig*.json', '**/index.ts', '**/types.ts'],
    ui: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte'],
    sensitive: ['**/.env*', '**/secret*', '**/credential*', '**/auth*', '**/key*'],
    config: ['**/config.*', '**/*.config.*', '**/settings.*'],
  },
  timeout: 30000,
  blockOnError: false,
};

// ═══════════════════════════════════════════════════════════════════
// REVIEW RESULT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Combined result from all agent reviews
 */
export interface CombinedReviewResult {
  /** Overall pass/fail status */
  passed: boolean;

  /** Should block the operation */
  shouldBlock: boolean;

  /** Individual agent results */
  agentResults: Map<DevelopmentHouseType, ReviewResult>;

  /** All blockers from all agents */
  allBlockers: CodeIssue[];

  /** All warnings from all agents */
  allWarnings: CodeIssue[];

  /** Summary message */
  summary: string;

  /** Time taken for all reviews (ms) */
  totalTimeMs: number;

  /** Timestamp */
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════
// REVIEW HOOKS MANAGER
// ═══════════════════════════════════════════════════════════════════

/**
 * Manages automatic code reviews across development agents
 */
export class ReviewHooksManager {
  private bus: MessageBus;
  private configManager: ConfigManager;
  private config: ReviewHooksConfig;
  private agents: Map<DevelopmentHouseType, DevelopmentAgentBase>;
  private initialized: boolean = false;

  constructor() {
    this.bus = getMessageBus();
    this.configManager = getConfigManager();
    this.config = DEFAULT_CONFIG;
    this.agents = new Map();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Initialize the hook manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load configuration
    await this.loadConfig();

    // Get agent instances
    this.agents.set('architect', getArchitectAgent() as unknown as DevelopmentAgentBase);
    this.agents.set('stylist', getStylistAgent() as unknown as DevelopmentAgentBase);
    this.agents.set('security', getSecurityAgent() as unknown as DevelopmentAgentBase);
    this.agents.set('accessibility', getAccessibilityAgent() as unknown as DevelopmentAgentBase);
    this.agents.set('data', getDataAgent() as unknown as DevelopmentAgentBase);

    // Subscribe to development events
    this.subscribeToEvents();

    this.initialized = true;
    console.log('[ReviewHooks] Manager initialized');
  }

  /**
   * Shutdown the hook manager
   */
  async shutdown(): Promise<void> {
    this.agents.clear();
    this.initialized = false;
    console.log('[ReviewHooks] Manager shutdown');
  }

  /**
   * Load configuration from ConfigManager
   */
  private async loadConfig(): Promise<void> {
    // Load individual settings from config manager
    const enabled = await this.configManager.getOrDefault<boolean>(
      'features',
      DEVELOPMENT_CONFIG.HOOKS_ENABLED,
      true
    );

    const blockOnError = await this.configManager.getOrDefault<boolean>(
      'features',
      DEVELOPMENT_CONFIG.HOOKS_BLOCK_ON_ERROR,
      false
    );

    const timeout = await this.configManager.getOrDefault<number>(
      'limits',
      DEVELOPMENT_CONFIG.HOOKS_TIMEOUT,
      30000
    );

    this.config = {
      ...DEFAULT_CONFIG,
      enabled,
      blockOnError,
      timeout,
    };
  }

  /**
   * Subscribe to development events
   */
  private subscribeToEvents(): void {
    this.bus.subscribe('development:file-changed', async (message) => {
      if (!this.config.enabled || !this.config.autoTriggers.onFileChange) return;

      const event = message.payload as FileChangeEvent;
      await this.handleFileChange(event);
    });

    this.bus.subscribe('development:pre-commit', async (message) => {
      if (!this.config.enabled || !this.config.autoTriggers.onPreCommit) return;

      const stagedFiles = message.payload as string[];
      await this.handlePreCommit(stagedFiles);
    });

    this.bus.subscribe('development:pre-push', async (message) => {
      if (!this.config.enabled || !this.config.autoTriggers.onPrePush) return;

      const commits = message.payload as string[];
      await this.handlePrePush(commits);
    });

    this.bus.subscribe('development:dependency-changed', async (message) => {
      if (!this.config.enabled || !this.config.autoTriggers.onDependencyChange) return;

      const packageFile = message.payload as string;
      await this.handleDependencyChange(packageFile);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Handle file change events
   */
  async handleFileChange(event: FileChangeEvent): Promise<CombinedReviewResult> {
    const startTime = Date.now();
    const results = new Map<DevelopmentHouseType, ReviewResult>();

    // Determine which agents should review
    const agentsToRun = this.determineAgentsForFiles(event.files);

    // Run reviews in parallel
    const reviewPromises: Promise<void>[] = [];

    for (const agentType of agentsToRun) {
      const agent = this.agents.get(agentType);
      if (agent && agent.onFileChange) {
        reviewPromises.push(
          this.runWithTimeout(
            agent.onFileChange(event),
            this.config.timeout
          ).then(result => {
            results.set(agentType, result);
          }).catch(error => {
            console.error(`[ReviewHooks] ${agentType} review failed:`, error);
            results.set(agentType, this.createErrorResult(agentType, 'file-change', error));
          })
        );
      }
    }

    await Promise.all(reviewPromises);

    return this.combineResults(results, 'file-change', startTime);
  }

  /**
   * Handle pre-commit hook
   */
  async handlePreCommit(stagedFiles: string[]): Promise<CombinedReviewResult> {
    const startTime = Date.now();
    const results = new Map<DevelopmentHouseType, ReviewResult>();

    // Determine which agents should review
    const agentsToRun = this.determineAgentsForFiles(stagedFiles);

    // Run reviews in parallel
    const reviewPromises: Promise<void>[] = [];

    for (const agentType of agentsToRun) {
      const agent = this.agents.get(agentType);
      if (agent && agent.onPreCommit) {
        reviewPromises.push(
          this.runWithTimeout(
            agent.onPreCommit(stagedFiles),
            this.config.timeout
          ).then(result => {
            results.set(agentType, result);
          }).catch(error => {
            console.error(`[ReviewHooks] ${agentType} pre-commit failed:`, error);
            results.set(agentType, this.createErrorResult(agentType, 'pre-commit', error));
          })
        );
      }
    }

    await Promise.all(reviewPromises);

    const combined = this.combineResults(results, 'pre-commit', startTime);

    // Emit event for UI/tooling
    this.bus.publish('development:pre-commit-result', combined);

    return combined;
  }

  /**
   * Handle pre-push hook
   */
  async handlePrePush(commits: string[]): Promise<CombinedReviewResult> {
    const startTime = Date.now();
    const results = new Map<DevelopmentHouseType, ReviewResult>();

    // All enabled agents review on push
    const reviewPromises: Promise<void>[] = [];

    for (const [agentType, agent] of this.agents) {
      if (this.isAgentEnabled(agentType) && agent.onPrePush) {
        reviewPromises.push(
          this.runWithTimeout(
            agent.onPrePush(commits),
            this.config.timeout
          ).then(result => {
            results.set(agentType, result);
          }).catch(error => {
            console.error(`[ReviewHooks] ${agentType} pre-push failed:`, error);
            results.set(agentType, this.createErrorResult(agentType, 'pre-push', error));
          })
        );
      }
    }

    await Promise.all(reviewPromises);

    const combined = this.combineResults(results, 'pre-push', startTime);

    // Emit event for UI/tooling
    this.bus.publish('development:pre-push-result', combined);

    return combined;
  }

  /**
   * Handle dependency file changes
   */
  async handleDependencyChange(packageFile: string): Promise<void> {
    if (!this.config.agents.security.scanDependencies) return;

    const securityAgent = this.agents.get('security');
    if (securityAgent) {
      // Trigger security scan for dependencies
      this.bus.publish('development:security-scan-requested', {
        type: 'dependencies',
        file: packageFile,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // MANUAL TRIGGERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Manually trigger a review for specific files
   */
  async triggerReview(
    files: string[],
    agents?: DevelopmentHouseType[]
  ): Promise<CombinedReviewResult> {
    const event: FileChangeEvent = {
      files,
      changeType: 'modify',
      timestamp: Date.now(),
    };

    // If specific agents requested, filter
    if (agents) {
      const startTime = Date.now();
      const results = new Map<DevelopmentHouseType, ReviewResult>();

      for (const agentType of agents) {
        const agent = this.agents.get(agentType);
        if (agent && agent.onFileChange) {
          try {
            const result = await this.runWithTimeout(
              agent.onFileChange(event),
              this.config.timeout
            );
            results.set(agentType, result);
          } catch (error) {
            results.set(agentType, this.createErrorResult(agentType, 'manual', error));
          }
        }
      }

      return this.combineResults(results, 'manual', startTime);
    }

    return this.handleFileChange(event);
  }

  /**
   * Run all development agents on a set of files
   */
  async runFullReview(files: string[]): Promise<CombinedReviewResult> {
    const allAgents: DevelopmentHouseType[] = ['architect', 'stylist', 'security', 'accessibility'];
    return this.triggerReview(files, allAgents);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Determine which agents should run based on changed files
   */
  private determineAgentsForFiles(files: string[]): DevelopmentHouseType[] {
    const agents: Set<DevelopmentHouseType> = new Set();

    for (const file of files) {
      // Structural changes -> Architect
      if (this.config.agents.architect.enabled) {
        if (this.matchesPatterns(file, this.config.triggerPatterns.structural)) {
          agents.add('architect');
        }
      }

      // Code files -> Stylist
      if (this.config.agents.stylist.enabled) {
        if (/\.(ts|tsx|js|jsx|py|css|scss)$/.test(file)) {
          agents.add('stylist');
        }
      }

      // Sensitive files -> Security
      if (this.config.agents.security.enabled) {
        if (this.matchesPatterns(file, this.config.triggerPatterns.sensitive)) {
          agents.add('security');
        }
        // All code files get basic security scan
        if (/\.(ts|tsx|js|jsx|py)$/.test(file)) {
          agents.add('security');
        }
      }

      // UI files -> Accessibility
      if (this.config.agents.accessibility.enabled && this.config.agents.accessibility.triggerOnUIChanges) {
        if (this.matchesPatterns(file, this.config.triggerPatterns.ui)) {
          agents.add('accessibility');
        }
      }
    }

    return Array.from(agents);
  }

  /**
   * Check if file matches any of the patterns
   */
  private matchesPatterns(file: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      return new RegExp(regex).test(file);
    });
  }

  /**
   * Check if an agent is enabled
   */
  private isAgentEnabled(agentType: DevelopmentHouseType): boolean {
    return this.config.agents[agentType]?.enabled ?? false;
  }

  /**
   * Run a promise with timeout
   */
  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Review timeout'));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create an error result
   */
  private createErrorResult(
    agent: DevelopmentHouseType,
    trigger: string,
    error: unknown
  ): ReviewResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      agent,
      trigger,
      timestamp: Date.now(),
      passed: !this.config.blockOnError,
      blockers: this.config.blockOnError ? [{
        id: `error-${agent}`,
        severity: 'error' as Severity,
        message: `Review failed: ${message}`,
        rule: 'review-error',
      }] : [],
      warnings: [],
      summary: `Review failed: ${message}`,
    };
  }

  /**
   * Combine results from multiple agents
   */
  private combineResults(
    results: Map<DevelopmentHouseType, ReviewResult>,
    trigger: string,
    startTime: number
  ): CombinedReviewResult {
    const allBlockers: CodeIssue[] = [];
    const allWarnings: CodeIssue[] = [];
    let allPassed = true;

    for (const result of results.values()) {
      if (!result.passed) allPassed = false;
      allBlockers.push(...result.blockers);
      allWarnings.push(...result.warnings);
    }

    const shouldBlock = allBlockers.length > 0 && this.config.blockOnError;

    // Build summary
    const agentSummaries = Array.from(results.entries())
      .map(([agent, result]) => `${agent}: ${result.passed ? '✓' : '✗'}`)
      .join(', ');

    const summary = allPassed
      ? `All reviews passed (${agentSummaries})`
      : `Issues found: ${allBlockers.length} blockers, ${allWarnings.length} warnings (${agentSummaries})`;

    return {
      passed: allPassed,
      shouldBlock,
      agentResults: results,
      allBlockers,
      allWarnings,
      summary,
      totalTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update hook configuration
   */
  setConfig(config: Partial<ReviewHooksConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ReviewHooksConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable hooks
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Enable/disable a specific agent
   */
  setAgentEnabled(agent: DevelopmentHouseType, enabled: boolean): void {
    if (this.config.agents[agent]) {
      this.config.agents[agent].enabled = enabled;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _hookManager: ReviewHooksManager | null = null;

export function getReviewHooksManager(): ReviewHooksManager {
  if (!_hookManager) {
    _hookManager = new ReviewHooksManager();
  }
  return _hookManager;
}

export function resetReviewHooksManager(): void {
  _hookManager = null;
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Trigger file change review (convenience function)
 */
export async function triggerFileChangeReview(
  event: FileChangeEvent,
  agents?: DevelopmentHouseType[]
): Promise<ReviewResult[]> {
  const manager = getReviewHooksManager();
  await manager.initialize();
  
  const result = await manager.triggerReview(event.files, agents);
  return Array.from(result.agentResults.values());
}

/**
 * Run full review on files (convenience function)
 */
export async function runFullReview(files: string[]): Promise<ReviewResult[]> {
  const manager = getReviewHooksManager();
  await manager.initialize();
  
  const result = await manager.runFullReview(files);
  return Array.from(result.agentResults.values());
}

/**
 * Set hooks enabled state (convenience function)
 */
export async function setReviewHooksEnabled(enabled: boolean): Promise<void> {
  const manager = getReviewHooksManager();
  await manager.initialize();
  manager.setEnabled(enabled);
}

/**
 * Check if hooks are enabled (convenience function)
 */
export async function areReviewHooksEnabled(): Promise<boolean> {
  const manager = getReviewHooksManager();
  await manager.initialize();
  return manager.getConfig().enabled;
}

/**
 * Get review triggers configuration (convenience function)
 */
export function getReviewTriggers(): ReviewTrigger[] {
  const manager = getReviewHooksManager();
  const config = manager.getConfig();
  
  const triggers: ReviewTrigger[] = [];
  
  for (const [agent, agentConfig] of Object.entries(config.agents)) {
    triggers.push({
      agent: agent as DevelopmentHouseType,
      condition: 'file-change',
      enabled: agentConfig.enabled,
    });
  }
  
  return triggers;
}
