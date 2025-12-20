/**
 * V3 AI Detection Types
 *
 * Core type definitions for the V3 analyzer which combines:
 * - Sentence-level perplexity analysis
 * - Narrative-level Chekhov ratio (specificity fulfillment)
 * - Transformation suggestions
 */

// ============================================================
// Sentence-Level Analysis
// ============================================================

export interface SentenceAnalysis {
  index: number;
  text: string;
  position: number;           // 0-1 position in document
  wordCount: number;

  // Perplexity metrics
  perplexity: number;         // Lower = more predictable = more AI-like
  perplexityRank: 'low' | 'medium' | 'high';

  // Burstiness (variance from neighbors)
  burstiness: number;         // Higher = more variance = more human-like

  // Flags
  flags: SentenceFlag[];

  // Transformation suggestions
  transformations: Transformation[];
}

export type SentenceFlag =
  | 'LOW_PERPLEXITY'          // Too smooth/predictable
  | 'LOW_BURSTINESS'          // Too uniform with neighbors
  | 'FORMULAIC_OPENER'        // Starts with common AI pattern
  | 'EXPLICIT_MORAL'          // States lesson directly
  | 'ORPHANED_ENTITY'         // Introduces entity that never pays off
  | 'GENERIC_SPECIFICITY'     // Uses "the city" instead of naming
  | 'STOCK_PHRASE';           // Common AI phrase pattern

// ============================================================
// Entity Tracking (Chekhov Analysis)
// ============================================================

export interface TrackedEntity {
  id: string;                 // Unique identifier
  text: string;               // The entity text as first seen
  type: EntityType;
  normalizedForm: string;     // Canonical form for matching

  // Occurrence tracking
  occurrences: EntityOccurrence[];
  firstPosition: number;      // 0-1 position of first mention
  lastPosition: number;       // 0-1 position of last mention

  // Fulfillment analysis
  mentionCount: number;
  appearsInResolution: boolean;  // In final 20% of text
  hasPayoff: boolean;            // Referenced meaningfully after intro
  fulfillmentScore: number;      // 0-1 score

  // Classification
  status: EntityStatus;
}

export type EntityType =
  | 'PERSON'                  // Character names
  | 'LOCATION'                // Places, geography
  | 'ORGANIZATION'            // Companies, groups
  | 'TIME'                    // Specific times, dates
  | 'OBJECT'                  // Named objects, tools
  | 'OTHER';

export type EntityStatus =
  | 'FULFILLED'               // Introduced and paid off
  | 'ORPHANED'                // Introduced but abandoned
  | 'ATMOSPHERIC'             // Generic, no promise made
  | 'RECURRING';              // Appears multiple times

export interface EntityOccurrence {
  sentenceIndex: number;
  position: number;           // 0-1 in document
  context: string;            // Surrounding text
  role: OccurrenceRole;
}

export type OccurrenceRole =
  | 'INTRODUCTION'            // First mention
  | 'REFERENCE'               // Subsequent mention
  | 'RESOLUTION'              // Appears in conclusion/payoff
  | 'DEVELOPMENT';            // Adds to entity's significance

// ============================================================
// Chekhov Analysis Results
// ============================================================

export interface ChekhovAnalysis {
  entities: TrackedEntity[];

  // Aggregate metrics
  totalEntities: number;
  fulfilledCount: number;
  orphanedCount: number;

  // The key metric
  chekhovRatio: number;       // fulfilled / (fulfilled + orphaned)

  // Classification
  chekhovGrade: ChekhovGrade;

  // Specific issues for transformation
  orphanedEntities: TrackedEntity[];
  suggestions: ChekhovSuggestion[];
}

export type ChekhovGrade =
  | 'HUMAN_LIKE'              // 0.6+ ratio
  | 'MIXED'                   // 0.3-0.6 ratio
  | 'AI_LIKE';                // <0.3 ratio

export interface ChekhovSuggestion {
  entity: TrackedEntity;
  suggestionType: 'DEMOTE' | 'FULFILL' | 'REMOVE';
  rationale: string;
  example?: string;
}

// ============================================================
// Transformation Suggestions
// ============================================================

export interface Transformation {
  type: TransformationType;
  target: string;             // What to change
  location: 'sentence' | 'phrase' | 'word';
  suggestion: string;         // How to change it
  rationale: string;          // Why
  priority: 'high' | 'medium' | 'low';
  automated: boolean;         // Can be done automatically?
}

export type TransformationType =
  | 'VOCABULARY'              // Replace word with less common synonym
  | 'STRUCTURE'               // Change sentence structure
  | 'SPECIFICITY_ADD'         // Add specific detail
  | 'SPECIFICITY_REMOVE'      // Remove orphaned specific
  | 'BURSTINESS'              // Vary sentence length/complexity
  | 'PAYOFF_ADD'              // Add reference to earlier entity
  | 'DELETION';               // Remove stock phrase entirely

// ============================================================
// Completeness Analysis (imported from completeness.ts)
// ============================================================

export interface CompletenessInfo {
  classification: 'COMPLETE' | 'EXCERPT' | 'UNCERTAIN';
  confidence: number;
  chekhovWeight: number;  // Dynamic weight based on completeness
}

// ============================================================
// Full Document Analysis
// ============================================================

export interface V3Analysis {
  // Input
  text: string;
  wordCount: number;
  sentenceCount: number;

  // Sentence-level results
  sentences: SentenceAnalysis[];

  // Document-level perplexity
  meanPerplexity: number;
  perplexityVariance: number; // Burstiness at doc level

  // Chekhov analysis
  chekhov: ChekhovAnalysis;

  // Completeness analysis (affects Chekhov weighting)
  completeness: CompletenessInfo;

  // Overall scores
  scores: {
    perplexityScore: number;    // 0-1, higher = more human-like
    burstiessScore: number;     // 0-1, higher = more human-like
    chekhovScore: number;       // 0-1, higher = more human-like
    composite: number;          // Weighted combination
    // Effective weights used (may differ from config if completeness-adjusted)
    effectiveChekhovWeight: number;
  };

  // Classification
  classification: 'LIKELY_HUMAN' | 'UNCERTAIN' | 'LIKELY_AI';
  confidence: number;

  // All transformation suggestions, prioritized
  transformations: Transformation[];

  // Processing metadata
  analyzedAt: string;
  processingTimeMs: number;
}

// ============================================================
// Configuration
// ============================================================

export interface V3Config {
  // Perplexity thresholds
  perplexity: {
    lowThreshold: number;     // Below this = AI signature
    highThreshold: number;    // Above this = human-like
  };

  // Burstiness thresholds
  burstiness: {
    lowThreshold: number;     // Below this = too uniform
    windowSize: number;       // Sentences to compare
  };

  // Chekhov settings
  chekhov: {
    resolutionZone: number;   // Final X% of document
    minMentionsForPayoff: number;
    gradeThresholds: {
      humanLike: number;
      mixed: number;
    };
  };

  // Scoring weights
  weights: {
    perplexity: number;
    burstiness: number;
    chekhov: number;
  };
}

export const DEFAULT_CONFIG: V3Config = {
  perplexity: {
    lowThreshold: 15,
    highThreshold: 50
  },
  burstiness: {
    lowThreshold: 0.3,
    windowSize: 3
  },
  chekhov: {
    resolutionZone: 0.2,      // Final 20%
    minMentionsForPayoff: 2,
    gradeThresholds: {
      humanLike: 0.6,
      mixed: 0.3
    }
  },
  weights: {
    perplexity: 0.35,
    burstiness: 0.25,
    chekhov: 0.40              // Chekhov is our novel signal
  }
};
