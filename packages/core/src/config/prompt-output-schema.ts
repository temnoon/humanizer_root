/**
 * Prompt Output Schema
 *
 * Links prompt outputs to configuration thresholds.
 * Ensures threshold changes remain valid when prompts change.
 * Part of Phase 2: Configuration Centralization (Council Addition).
 *
 * This module provides:
 * - PromptOutputSchema interface for defining expected outputs
 * - Threshold mappings that link output fields to config keys
 * - Output range validation
 * - Pre-defined schemas for common prompts
 *
 * @module config/prompt-output-schema
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Defines the expected output structure of a prompt.
 * Used for validation and threshold-prompt coupling.
 */
export interface PromptOutputSchema {
  /** Output format type */
  type: 'json' | 'text' | 'number' | 'boolean';

  /** JSON schema definition (when type is 'json') */
  schema?: Record<string, FieldDefinition>;

  /**
   * Maps output field names to threshold config keys.
   * When a threshold changes, we can identify which prompts are affected.
   */
  thresholdMappings?: Record<string, string>;

  /**
   * Expected ranges for numeric output fields.
   * Used for validation and anomaly detection.
   */
  outputRanges?: Record<string, OutputRange>;

  /**
   * Description of what this output represents.
   */
  description?: string;
}

/**
 * Field type definition for JSON schema
 */
export type FieldDefinition =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | { type: 'array'; items: FieldDefinition }
  | { type: 'object'; properties: Record<string, FieldDefinition> };

/**
 * Defines valid range for a numeric output field
 */
export interface OutputRange {
  /** Minimum valid value (inclusive) */
  min: number;

  /** Maximum valid value (inclusive) */
  max: number;

  /** Optional: typical/expected value for sanity checking */
  typical?: number;

  /** Optional: warning threshold (outputs outside this range trigger warnings) */
  warnBelow?: number;
  warnAbove?: number;
}

/**
 * Result of validating an output against its schema
 */
export interface OutputValidationResult {
  /** Whether the output is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings (output valid but unusual) */
  warnings: string[];

  /** Fields that were out of range */
  outOfRange: Array<{
    field: string;
    value: number;
    expected: OutputRange;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRE-DEFINED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema for Curator assessment prompt output.
 * Used by the Curator agent to evaluate content quality.
 */
export const CURATOR_ASSESSMENT_SCHEMA: PromptOutputSchema = {
  type: 'json',
  description: 'Curator agent content quality assessment',
  schema: {
    clarity: 'number',
    depth: 'number',
    originality: 'number',
    relevance: 'number',
    overallQuality: 'number',
    isGem: 'boolean',
    reasoning: 'string',
  },
  thresholdMappings: {
    overallQuality: 'curator.qualityThreshold',
    isGem: 'curator.gemThreshold',
  },
  outputRanges: {
    clarity: { min: 0, max: 1, typical: 0.6 },
    depth: { min: 0, max: 1, typical: 0.5 },
    originality: { min: 0, max: 1, typical: 0.4 },
    relevance: { min: 0, max: 1, typical: 0.7 },
    overallQuality: { min: 0, max: 1, typical: 0.5 },
  },
};

/**
 * Schema for Vimalakirti boundary check outputs.
 * Used for inquiry level, professional distance, and shadow detection.
 */
export const VIMALAKIRTI_INQUIRY_SCHEMA: PromptOutputSchema = {
  type: 'json',
  description: 'Vimalakirti inquiry level assessment',
  schema: {
    level: 'number',
    category: 'string',
    indicators: { type: 'array', items: 'string' },
    confidence: 'number',
    recommendation: 'string',
  },
  thresholdMappings: {
    level: 'vimalakirti.inquiryLevelThreshold',
    confidence: 'vimalakirti.confidenceThreshold',
  },
  outputRanges: {
    level: { min: 1, max: 5, typical: 2 },
    confidence: { min: 0, max: 1, typical: 0.7 },
  },
};

export const VIMALAKIRTI_DISTANCE_SCHEMA: PromptOutputSchema = {
  type: 'json',
  description: 'Vimalakirti professional distance assessment',
  schema: {
    distance: 'number',
    concerns: { type: 'array', items: 'string' },
    isAppropriate: 'boolean',
    reasoning: 'string',
  },
  thresholdMappings: {
    distance: 'vimalakirti.professionalDistanceThreshold',
  },
  outputRanges: {
    distance: { min: 0, max: 1, typical: 0.7, warnBelow: 0.3 },
  },
};

export const VIMALAKIRTI_SHADOW_SCHEMA: PromptOutputSchema = {
  type: 'json',
  description: 'Vimalakirti shadow content detection',
  schema: {
    hasShadowContent: 'boolean',
    shadowScore: 'number',
    indicators: { type: 'array', items: 'string' },
    recommendation: 'string',
  },
  thresholdMappings: {
    shadowScore: 'vimalakirti.shadowThreshold',
  },
  outputRanges: {
    shadowScore: { min: 0, max: 1, typical: 0.1, warnAbove: 0.5 },
  },
};

/**
 * Schema for semantic similarity search ranking.
 */
export const SEARCH_RANKING_SCHEMA: PromptOutputSchema = {
  type: 'json',
  description: 'Search result ranking output',
  schema: {
    relevance: 'number',
    matchType: 'string',
    explanation: 'string',
  },
  thresholdMappings: {
    relevance: 'search.relevanceThreshold',
  },
  outputRanges: {
    relevance: { min: 0, max: 1, typical: 0.6 },
  },
};

/**
 * Schema for Builder persona rewrite assessment.
 */
export const BUILDER_REWRITE_SCHEMA: PromptOutputSchema = {
  type: 'json',
  description: 'Builder agent persona rewrite output',
  schema: {
    rewritten: 'string',
    changesApplied: { type: 'array', items: 'string' },
    remainingIssues: { type: 'array', items: 'string' },
    voiceMatchScore: 'number',
  },
  thresholdMappings: {
    voiceMatchScore: 'builder.voiceMatchThreshold',
  },
  outputRanges: {
    voiceMatchScore: { min: 0, max: 1, typical: 0.8, warnBelow: 0.6 },
  },
};

/**
 * Schema for Harvester content extraction.
 */
export const HARVESTER_EXTRACT_SCHEMA: PromptOutputSchema = {
  type: 'json',
  description: 'Harvester agent content extraction output',
  schema: {
    passages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: 'string',
          relevance: 'number',
          themes: { type: 'array', items: 'string' },
        },
      },
    },
    totalFound: 'number',
    confidence: 'number',
  },
  thresholdMappings: {
    confidence: 'harvester.confidenceThreshold',
  },
  outputRanges: {
    confidence: { min: 0, max: 1, typical: 0.7 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registry of all known prompt output schemas.
 * Maps prompt IDs to their schemas.
 */
export const PROMPT_OUTPUT_SCHEMAS: Record<string, PromptOutputSchema> = {
  'curator.assessment': CURATOR_ASSESSMENT_SCHEMA,
  'vimalakirti.inquiryLevel': VIMALAKIRTI_INQUIRY_SCHEMA,
  'vimalakirti.professionalDistance': VIMALAKIRTI_DISTANCE_SCHEMA,
  'vimalakirti.shadowCheck': VIMALAKIRTI_SHADOW_SCHEMA,
  'search.ranking': SEARCH_RANKING_SCHEMA,
  'builder.rewrite': BUILDER_REWRITE_SCHEMA,
  'harvester.extract': HARVESTER_EXTRACT_SCHEMA,
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a prompt output against its schema.
 */
export function validatePromptOutput(
  output: unknown,
  schema: PromptOutputSchema
): OutputValidationResult {
  const result: OutputValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    outOfRange: [],
  };

  if (schema.type === 'json') {
    if (typeof output !== 'object' || output === null) {
      result.valid = false;
      result.errors.push(`Expected JSON object, got ${typeof output}`);
      return result;
    }

    // Validate schema fields if defined
    if (schema.schema) {
      for (const [field, expectedType] of Object.entries(schema.schema)) {
        const value = (output as Record<string, unknown>)[field];

        if (value === undefined) {
          result.warnings.push(`Missing optional field: ${field}`);
          continue;
        }

        // Type validation
        const actualType = typeof value;
        const simpleType = typeof expectedType === 'string' ? expectedType : expectedType.type;

        if (simpleType === 'array' && !Array.isArray(value)) {
          result.valid = false;
          result.errors.push(`Field ${field}: expected array, got ${actualType}`);
        } else if (simpleType !== 'array' && simpleType !== 'object' && actualType !== simpleType) {
          result.valid = false;
          result.errors.push(`Field ${field}: expected ${simpleType}, got ${actualType}`);
        }
      }
    }

    // Validate output ranges
    if (schema.outputRanges) {
      for (const [field, range] of Object.entries(schema.outputRanges)) {
        const value = (output as Record<string, unknown>)[field];

        if (typeof value === 'number') {
          if (value < range.min || value > range.max) {
            result.valid = false;
            result.outOfRange.push({ field, value, expected: range });
            result.errors.push(
              `Field ${field}: value ${value} outside range [${range.min}, ${range.max}]`
            );
          } else if (range.warnBelow !== undefined && value < range.warnBelow) {
            result.warnings.push(`Field ${field}: value ${value} below warning threshold ${range.warnBelow}`);
          } else if (range.warnAbove !== undefined && value > range.warnAbove) {
            result.warnings.push(`Field ${field}: value ${value} above warning threshold ${range.warnAbove}`);
          }
        }
      }
    }
  } else if (schema.type === 'number') {
    if (typeof output !== 'number') {
      result.valid = false;
      result.errors.push(`Expected number, got ${typeof output}`);
    }
  } else if (schema.type === 'boolean') {
    if (typeof output !== 'boolean') {
      result.valid = false;
      result.errors.push(`Expected boolean, got ${typeof output}`);
    }
  } else if (schema.type === 'text') {
    if (typeof output !== 'string') {
      result.valid = false;
      result.errors.push(`Expected string, got ${typeof output}`);
    }
  }

  return result;
}

/**
 * Get all threshold config keys that a prompt output depends on.
 */
export function getThresholdDependencies(schema: PromptOutputSchema): string[] {
  if (!schema.thresholdMappings) {
    return [];
  }
  return Object.values(schema.thresholdMappings);
}

/**
 * Find all prompts that depend on a given threshold config key.
 */
export function findPromptsUsingThreshold(thresholdKey: string): string[] {
  const prompts: string[] = [];

  for (const [promptId, schema] of Object.entries(PROMPT_OUTPUT_SCHEMAS)) {
    const deps = getThresholdDependencies(schema);
    if (deps.includes(thresholdKey)) {
      prompts.push(promptId);
    }
  }

  return prompts;
}

/**
 * Get the schema for a prompt by ID.
 */
export function getPromptOutputSchema(promptId: string): PromptOutputSchema | undefined {
  return PROMPT_OUTPUT_SCHEMAS[promptId];
}
