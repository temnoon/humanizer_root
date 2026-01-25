/**
 * Configuration Validator
 *
 * Validates all configuration on startup to catch misconfigurations early.
 * Part of Phase 0 pre-requisites for configuration remediation.
 *
 * @module config/config-validator
 */

import type { ConfigManager, ConfigCategory, PromptTemplate } from './types.js';
import { getConfigManager } from './in-memory-config.js';

// ═══════════════════════════════════════════════════════════════════
// VALIDATION TYPES
// ═══════════════════════════════════════════════════════════════════

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  /** Category of the config with the issue */
  category: ConfigCategory | 'prompt' | 'model';

  /** Key or ID of the problematic config */
  key: string;

  /** Human-readable description of the issue */
  message: string;

  /** Severity level */
  severity: ValidationSeverity;

  /** The invalid value (if applicable) */
  value?: unknown;

  /** Expected constraint (if applicable) */
  constraint?: string;
}

export interface ConfigValidationError extends ValidationIssue {
  severity: 'error';
}

export interface ConfigValidationWarning extends ValidationIssue {
  severity: 'warning';
}

export interface ValidationReport {
  /** Overall validation passed (no errors, warnings allowed) */
  valid: boolean;

  /** Critical errors that must be fixed */
  errors: ConfigValidationError[];

  /** Warnings that should be addressed */
  warnings: ConfigValidationWarning[];

  /** When validation was performed */
  validatedAt: Date;

  /** How long validation took (ms) */
  durationMs: number;

  /** Summary counts */
  summary: {
    totalChecks: number;
    passed: number;
    errors: number;
    warnings: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// THRESHOLD DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Known thresholds with their valid ranges
 */
export interface ThresholdDefinition {
  key: string;
  category: ConfigCategory;
  min: number;
  max: number;
  description: string;
}

export const KNOWN_THRESHOLDS: ThresholdDefinition[] = [
  // Confidence thresholds (0-1)
  { key: 'confidence.min', category: 'thresholds', min: 0, max: 1, description: 'Minimum confidence score' },
  { key: 'confidence.high', category: 'thresholds', min: 0, max: 1, description: 'High confidence score' },

  // Similarity thresholds (0-1)
  { key: 'similarity.match', category: 'thresholds', min: 0, max: 1, description: 'Similarity match threshold' },
  { key: 'similarity.close', category: 'thresholds', min: 0, max: 1, description: 'Similarity close threshold' },

  // Quality thresholds (0-1)
  { key: 'quality.min', category: 'thresholds', min: 0, max: 1, description: 'Minimum quality score' },
  { key: 'quality.target', category: 'thresholds', min: 0, max: 1, description: 'Target quality score' },

  // Purity thresholds (0-1, from quantum reading)
  { key: 'purity.min', category: 'thresholds', min: 0, max: 1, description: 'Minimum purity for quality' },
  { key: 'purity.high', category: 'thresholds', min: 0, max: 1, description: 'High quality purity threshold' },

  // Entropy thresholds (0-3.5, from ln(32))
  { key: 'entropy.max', category: 'thresholds', min: 0, max: 4, description: 'Maximum acceptable entropy' },
  { key: 'entropy.low', category: 'thresholds', min: 0, max: 4, description: 'Low entropy threshold' },

  // Clustering
  { key: 'cluster.minSize', category: 'thresholds', min: 2, max: 100, description: 'Minimum cluster size' },
  { key: 'cluster.similarity', category: 'thresholds', min: 0, max: 1, description: 'Clustering similarity threshold' },

  // Timeouts (ms)
  { key: 'timeout.default', category: 'limits', min: 1000, max: 300000, description: 'Default timeout' },
  { key: 'timeout.llm', category: 'limits', min: 5000, max: 300000, description: 'LLM timeout' },
  { key: 'timeout.search', category: 'limits', min: 1000, max: 60000, description: 'Search timeout' },

  // Retries
  { key: 'retry.maxAttempts', category: 'limits', min: 0, max: 10, description: 'Maximum retry attempts' },
  { key: 'retry.initialDelay', category: 'limits', min: 100, max: 30000, description: 'Initial retry delay' },
];

// ═══════════════════════════════════════════════════════════════════
// PROMPT VARIABLE REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Known prompts with their required variables
 */
export interface PromptRequirement {
  id: string;
  requiredVariables: string[];
  description: string;
}

export const KNOWN_PROMPT_REQUIREMENTS: PromptRequirement[] = [
  // Agent system prompts
  { id: 'agent.curator', requiredVariables: [], description: 'Curator agent system prompt' },
  { id: 'agent.harvester', requiredVariables: [], description: 'Harvester agent system prompt' },
  { id: 'agent.builder', requiredVariables: [], description: 'Builder agent system prompt' },
  { id: 'agent.reviewer', requiredVariables: [], description: 'Reviewer agent system prompt' },

  // Vimalakirti boundary checks
  { id: 'vimalakirti.inquiryLevel', requiredVariables: ['text'], description: 'Inquiry level assessment prompt' },
  { id: 'vimalakirti.professionalDistance', requiredVariables: ['text'], description: 'Professional distance check prompt' },
  { id: 'vimalakirti.shadowCheck', requiredVariables: ['text'], description: 'Shadow content check prompt' },

  // Task prompts
  { id: 'task.search', requiredVariables: ['query'], description: 'Search task prompt' },
  { id: 'task.summarize', requiredVariables: ['text'], description: 'Summarization prompt' },
  { id: 'task.evaluate', requiredVariables: ['text'], description: 'Evaluation prompt' },

  // Builder prompts (Phase 1 additions)
  { id: 'builder.rewriteForPersona', requiredVariables: ['text', 'voiceTraits', 'forbiddenPhrases'], description: 'Persona rewriting prompt' },
  { id: 'builder.generateArc', requiredVariables: ['theme', 'passages'], description: 'Narrative arc generation' },
  { id: 'builder.composeChapter', requiredVariables: ['chapterTitle', 'passages', 'voiceGuidance'], description: 'Chapter composition' },
];

// ═══════════════════════════════════════════════════════════════════
// CONFIG VALIDATOR
// ═══════════════════════════════════════════════════════════════════

export interface ConfigValidatorOptions {
  /** ConfigManager to validate (defaults to singleton) */
  configManager?: ConfigManager;

  /** Model registry for model validation */
  modelRegistry?: ModelRegistryValidator;

  /** Skip prompts that don't exist (useful during migration) */
  allowMissingPrompts?: boolean;

  /** Skip thresholds that don't exist */
  allowMissingThresholds?: boolean;
}

/**
 * Model registry interface for model validation
 * (Simplified interface for config validation purposes)
 */
export interface ModelRegistryValidator {
  /** Check if a model ID is registered */
  hasModel(modelId: string): Promise<boolean>;

  /** Get all registered model IDs */
  listModels(): Promise<string[]>;
}

/**
 * Configuration Validator
 *
 * Validates all configuration entries on startup:
 * - Thresholds are within valid ranges
 * - Prompts have required placeholders
 * - Model references point to registered models
 */
export class ConfigValidator {
  private configManager: ConfigManager;
  private modelRegistry?: ModelRegistryValidator;
  private options: ConfigValidatorOptions;

  constructor(options: ConfigValidatorOptions = {}) {
    this.options = options;
    this.configManager = options.configManager ?? getConfigManager();
    this.modelRegistry = options.modelRegistry;
  }

  // ─────────────────────────────────────────────────────────────────
  // INDIVIDUAL VALIDATORS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate a numeric threshold is within acceptable range
   */
  validateThreshold(
    key: string,
    value: number,
    min: number,
    max: number
  ): ValidationIssue | null {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        category: 'thresholds',
        key,
        message: `Threshold "${key}" must be a number, got ${typeof value}`,
        severity: 'error',
        value,
        constraint: `number in range [${min}, ${max}]`,
      };
    }

    if (value < min) {
      return {
        category: 'thresholds',
        key,
        message: `Threshold "${key}" value ${value} is below minimum ${min}`,
        severity: 'error',
        value,
        constraint: `>= ${min}`,
      };
    }

    if (value > max) {
      return {
        category: 'thresholds',
        key,
        message: `Threshold "${key}" value ${value} exceeds maximum ${max}`,
        severity: 'error',
        value,
        constraint: `<= ${max}`,
      };
    }

    return null;
  }

  /**
   * Validate a prompt template has all required placeholders
   */
  validatePrompt(
    id: string,
    template: string,
    requiredVars: string[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const varName of requiredVars) {
      const pattern = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      if (!pattern.test(template)) {
        issues.push({
          category: 'prompt',
          key: id,
          message: `Prompt "${id}" is missing required variable {{${varName}}}`,
          severity: 'error',
          constraint: `Must include {{${varName}}}`,
        });
      }
    }

    // Check for unbalanced braces (common error)
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push({
        category: 'prompt',
        key: id,
        message: `Prompt "${id}" has unbalanced braces: ${openBraces} open, ${closeBraces} close`,
        severity: 'error',
      });
    }

    // Warn about very short prompts
    if (template.length < 20) {
      issues.push({
        category: 'prompt',
        key: id,
        message: `Prompt "${id}" is suspiciously short (${template.length} chars)`,
        severity: 'warning',
        value: template.length,
      });
    }

    return issues;
  }

  /**
   * Validate a model reference exists in registry
   */
  async validateModelReference(modelId: string): Promise<ValidationIssue | null> {
    if (!this.modelRegistry) {
      // No registry configured, skip validation
      return null;
    }

    const exists = await this.modelRegistry.hasModel(modelId);
    if (!exists) {
      return {
        category: 'model',
        key: modelId,
        message: `Model "${modelId}" is not registered in ModelRegistry`,
        severity: 'error',
        value: modelId,
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // FULL VALIDATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Run all validations and return a complete report
   */
  async validateAll(): Promise<ValidationReport> {
    const startTime = Date.now();
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];
    let totalChecks = 0;

    // Validate all known thresholds
    for (const def of KNOWN_THRESHOLDS) {
      totalChecks++;
      const value = await this.configManager.get<number>(def.category, def.key);

      if (value === undefined) {
        if (!this.options.allowMissingThresholds) {
          warnings.push({
            category: def.category,
            key: def.key,
            message: `Threshold "${def.key}" is not configured (using default)`,
            severity: 'warning',
          });
        }
        continue;
      }

      const issue = this.validateThreshold(def.key, value, def.min, def.max);
      if (issue) {
        if (issue.severity === 'error') {
          errors.push(issue as ConfigValidationError);
        } else {
          warnings.push(issue as ConfigValidationWarning);
        }
      }
    }

    // Validate all known prompts
    for (const req of KNOWN_PROMPT_REQUIREMENTS) {
      totalChecks++;
      const prompt = await this.configManager.getPrompt(req.id);

      if (!prompt) {
        if (!this.options.allowMissingPrompts) {
          warnings.push({
            category: 'prompt',
            key: req.id,
            message: `Prompt "${req.id}" is not configured`,
            severity: 'warning',
          });
        }
        continue;
      }

      const issues = this.validatePrompt(req.id, prompt.template, req.requiredVariables);
      for (const issue of issues) {
        if (issue.severity === 'error') {
          errors.push(issue as ConfigValidationError);
        } else {
          warnings.push(issue as ConfigValidationWarning);
        }
      }
    }

    // Validate model references in agents category
    const agentConfigs = await this.configManager.getCategory('agents');
    for (const config of agentConfigs) {
      if (config.key.endsWith('.model') || config.key.endsWith('.modelId')) {
        totalChecks++;
        const modelId = config.value as string;
        const issue = await this.validateModelReference(modelId);
        if (issue) {
          errors.push(issue as ConfigValidationError);
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date(),
      durationMs,
      summary: {
        totalChecks,
        passed: totalChecks - errors.length - warnings.length,
        errors: errors.length,
        warnings: warnings.length,
      },
    };
  }

  /**
   * Validate and throw if any errors
   */
  async validateOrThrow(): Promise<ValidationReport> {
    const report = await this.validateAll();

    if (!report.valid) {
      const errorMessages = report.errors.map(e => `  - ${e.key}: ${e.message}`).join('\n');
      throw new Error(
        `Configuration validation failed with ${report.errors.length} error(s):\n${errorMessages}`
      );
    }

    return report;
  }

  /**
   * Log validation report to console
   */
  logReport(report: ValidationReport): void {
    console.log(`\n═══ Configuration Validation Report ═══`);
    console.log(`Status: ${report.valid ? '✓ VALID' : '✗ INVALID'}`);
    console.log(`Checks: ${report.summary.totalChecks} total, ${report.summary.passed} passed`);
    console.log(`Duration: ${report.durationMs}ms`);

    if (report.errors.length > 0) {
      console.log(`\n❌ ERRORS (${report.errors.length}):`);
      for (const error of report.errors) {
        console.log(`  [${error.category}] ${error.key}: ${error.message}`);
      }
    }

    if (report.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${report.warnings.length}):`);
      for (const warning of report.warnings) {
        console.log(`  [${warning.category}] ${warning.key}: ${warning.message}`);
      }
    }

    console.log(`\n═══════════════════════════════════════\n`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate configuration on startup
 *
 * @example
 * ```typescript
 * import { validateConfigOnStartup } from './config/config-validator';
 *
 * // At app startup
 * await validateConfigOnStartup({ throwOnError: true });
 * ```
 */
export async function validateConfigOnStartup(options?: {
  throwOnError?: boolean;
  logReport?: boolean;
  configManager?: ConfigManager;
  modelRegistry?: ModelRegistryValidator;
}): Promise<ValidationReport> {
  const validator = new ConfigValidator({
    configManager: options?.configManager,
    modelRegistry: options?.modelRegistry,
    allowMissingPrompts: true, // Lenient during migration
    allowMissingThresholds: true,
  });

  const report = await validator.validateAll();

  if (options?.logReport !== false) {
    validator.logReport(report);
  }

  if (options?.throwOnError && !report.valid) {
    throw new Error(`Configuration validation failed with ${report.errors.length} error(s)`);
  }

  return report;
}
