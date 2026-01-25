/**
 * Prompt Types
 *
 * Defines the structure for LLM prompts with requirements, versioning, and testing.
 * Part of Phase 3: LLM Prompt Centralization.
 *
 * All prompts should be registered using these types to enable:
 * - Automatic model selection based on capabilities
 * - Output validation against schemas
 * - Versioning and deprecation tracking
 * - Test case management
 *
 * @module config/prompt-types
 */

import type { PromptOutputSchema } from './prompt-output-schema.js';

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT CAPABILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LLM capabilities that a prompt may require.
 * Used to match prompts with compatible models.
 */
export type PromptCapability =
  | 'vision'           // Can process images
  | 'thinking'         // Extended thinking/reasoning (Claude)
  | 'long-context'     // Handles 100k+ tokens
  | 'json-mode'        // Structured JSON output
  | 'streaming'        // Supports streaming responses
  | 'function-calling' // Tool/function calling support
  | 'code-execution'   // Can execute code
  | 'web-search'       // Has web search capability
  | 'file-handling';   // Can process file attachments

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Requirements for executing a prompt.
 * Used to select appropriate models and configure API calls.
 */
export interface PromptLlmRequirements {
  /**
   * Required model capabilities.
   * Model must support all listed capabilities.
   */
  capabilities: PromptCapability[];

  /**
   * Minimum context window size in tokens.
   * Used for long prompts or when including large documents.
   */
  minContextWindow?: number;

  /**
   * Preferred models for this prompt (in order of preference).
   * Falls back to capability-based selection if none available.
   */
  preferredModels?: string[];

  /**
   * Recommended temperature setting.
   * Lower = more deterministic, higher = more creative.
   */
  temperature?: number;

  /**
   * Maximum tokens to generate in response.
   */
  maxTokens?: number;

  /**
   * Whether to use extended thinking mode (if available).
   */
  useThinking?: boolean;

  /**
   * Stop sequences to end generation.
   */
  stopSequences?: string[];

  /**
   * Maximum cost per 1k tokens (for budget-conscious operations).
   */
  maxCostPer1k?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Test case for validating prompt behavior.
 */
export interface PromptTestCase {
  /** Unique test case identifier */
  id: string;

  /** Human-readable description */
  description: string;

  /** Input variables for the prompt */
  variables: Record<string, unknown>;

  /**
   * Expected output patterns (for validation).
   * Can be exact match, regex, or JSON schema check.
   */
  expectedPatterns?: string[];

  /**
   * Expected JSON output (for json-mode prompts).
   * Uses partial matching - output must contain these keys with similar values.
   */
  expectedJson?: Record<string, unknown>;

  /**
   * Minimum quality score (0-1) from evaluation.
   */
  minQualityScore?: number;

  /**
   * Tags for categorizing test cases.
   */
  tags?: string[];
}

/**
 * Result of running a prompt test case.
 */
export interface PromptTestResult {
  /** Test case that was run */
  testCaseId: string;

  /** Whether the test passed */
  passed: boolean;

  /** Actual output from the LLM */
  output: string;

  /** Parsed JSON output (if applicable) */
  parsedOutput?: unknown;

  /** Pattern match results */
  patternMatches?: Record<string, boolean>;

  /** Quality score (0-1) */
  qualityScore?: number;

  /** Error message (if failed) */
  error?: string;

  /** Execution time in ms */
  durationMs: number;

  /** Model used */
  model: string;

  /** Token usage */
  tokens?: {
    input: number;
    output: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete definition of a prompt for the prompt registry.
 */
export interface PromptDefinition {
  /**
   * Unique identifier for the prompt.
   * Convention: AGENT_ACTION (e.g., 'BUILDER_OUTLINE_CREATION')
   */
  id: string;

  /**
   * Human-readable name.
   */
  name: string;

  /**
   * Description of what the prompt does.
   */
  description: string;

  /**
   * The prompt template with variables.
   * Supports:
   * - {{variable}} - Simple replacement
   * - {{#if var}}...{{else}}...{{/if}} - Conditionals
   * - {{#each array}}{{this}}{{/each}} - Iteration
   */
  template: string;

  /**
   * LLM requirements for executing this prompt.
   */
  requirements: PromptLlmRequirements;

  /**
   * Expected output schema (for validation).
   */
  outputSchema?: PromptOutputSchema;

  /**
   * Current version number.
   * Increment when making breaking changes to the template.
   */
  version: number;

  /**
   * Whether this prompt is deprecated.
   */
  deprecated?: boolean;

  /**
   * ID of the prompt that replaces this one (if deprecated).
   */
  replacedBy?: string;

  /**
   * Test cases for validating prompt behavior.
   */
  testCases?: PromptTestCase[];

  /**
   * Which agents/components use this prompt.
   */
  usedBy?: string[];

  /**
   * Additional metadata.
   */
  metadata?: Record<string, unknown>;

  /**
   * When the prompt was last updated.
   */
  updatedAt?: Date;

  /**
   * Author or source of the prompt.
   */
  author?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT CATEGORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Categories for organizing prompts.
 */
export type PromptCategory =
  | 'agent-loop'   // Core agentic loop prompts
  | 'builder'      // Book/chapter building prompts
  | 'curator'      // Content curation prompts
  | 'harvester'    // Content harvesting prompts
  | 'reviewer'     // Review and quality check prompts
  | 'vimalakirti'  // Boundary check prompts
  | 'search'       // Search and retrieval prompts
  | 'transform'    // Text transformation prompts
  | 'utility';     // General utility prompts

/**
 * Maps prompt IDs to their categories.
 */
export interface PromptCategoryMapping {
  [promptId: string]: PromptCategory;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT REGISTRY TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registry of all prompts.
 */
export type PromptRegistry = Record<string, PromptDefinition>;

/**
 * Options for prompt lookup.
 */
export interface PromptLookupOptions {
  /** Only return prompts with these capabilities */
  requireCapabilities?: PromptCapability[];

  /** Only return prompts in these categories */
  categories?: PromptCategory[];

  /** Include deprecated prompts */
  includeDeprecated?: boolean;

  /** Only return prompts used by these agents */
  usedBy?: string[];
}

/**
 * Result of compiling a prompt.
 */
export interface CompiledPromptResult {
  /** The compiled prompt text */
  text: string;

  /** Variables that were substituted */
  substitutedVars: string[];

  /** Variables in template that weren't provided */
  missingVars: string[];

  /** Warnings during compilation */
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a minimal prompt definition with defaults.
 */
export function createPromptDefinition(
  partial: Pick<PromptDefinition, 'id' | 'name' | 'template'> &
    Partial<PromptDefinition>
): PromptDefinition {
  return {
    description: partial.description ?? partial.name,
    requirements: partial.requirements ?? { capabilities: [] },
    version: partial.version ?? 1,
    ...partial,
  };
}

/**
 * Check if a prompt requires a specific capability.
 */
export function promptRequiresCapability(
  prompt: PromptDefinition,
  capability: PromptCapability
): boolean {
  return prompt.requirements.capabilities.includes(capability);
}

/**
 * Get all capabilities required by a prompt.
 */
export function getRequiredCapabilities(prompt: PromptDefinition): PromptCapability[] {
  return prompt.requirements.capabilities;
}

/**
 * Check if a prompt is deprecated.
 */
export function isPromptDeprecated(prompt: PromptDefinition): boolean {
  return prompt.deprecated === true;
}

/**
 * Get the replacement prompt ID if deprecated.
 */
export function getReplacementPromptId(prompt: PromptDefinition): string | undefined {
  return prompt.deprecated ? prompt.replacedBy : undefined;
}
