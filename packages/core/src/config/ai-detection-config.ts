/**
 * AI Detection Configuration
 *
 * Centralizes AI tell patterns and detection thresholds.
 * Part of Phase 3: LLM Prompt Centralization (Council Addition - Reviewer).
 *
 * Patterns are categorized by:
 * - Severity: low, medium, high
 * - Category: vocabulary, phrasing, structure
 *
 * @module config/ai-detection-config
 */

import type { ConfigCategory } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration keys for AI detection settings.
 */
export const AI_DETECTION_CONFIG_KEYS = {
  /** AI tell patterns array */
  PATTERNS: 'aiDetection.patterns',

  /** Detection threshold (0-1) */
  THRESHOLD: 'aiDetection.threshold',

  /** Severity weights for scoring */
  SEVERITY_WEIGHTS: 'aiDetection.severityWeights',

  /** Minimum pattern matches for flagging */
  MIN_MATCHES: 'aiDetection.minMatches',

  /** Enable/disable detection */
  ENABLED: 'aiDetection.enabled',

  /** Categories to check */
  CATEGORIES: 'aiDetection.categories',
} as const;

export type AIDetectionConfigKey = typeof AI_DETECTION_CONFIG_KEYS[keyof typeof AI_DETECTION_CONFIG_KEYS];

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Severity level for AI tells.
 */
export type AITellSeverity = 'low' | 'medium' | 'high';

/**
 * Category of AI tell.
 */
export type AITellCategory = 'vocabulary' | 'phrasing' | 'structure' | 'punctuation';

/**
 * Definition of an AI tell pattern.
 */
export interface AITellPattern {
  /** Regex pattern to match */
  regex: string;

  /** Human-readable name */
  name: string;

  /** Severity level */
  severity: AITellSeverity;

  /** Pattern category */
  category: AITellCategory;

  /** Optional description */
  description?: string;

  /** Whether this pattern is case-insensitive (default: true) */
  caseInsensitive?: boolean;
}

/**
 * Severity weight configuration.
 */
export interface SeverityWeights {
  low: number;
  medium: number;
  high: number;
}

/**
 * AI detection result for a text.
 */
export interface AIDetectionResult {
  /** Overall AI probability (0-1) */
  score: number;

  /** Whether text exceeds threshold */
  flagged: boolean;

  /** Pattern matches found */
  matches: AITellMatch[];

  /** Breakdown by category */
  categoryScores: Record<AITellCategory, number>;

  /** Breakdown by severity */
  severityCounts: Record<AITellSeverity, number>;
}

/**
 * A single pattern match.
 */
export interface AITellMatch {
  /** Pattern that matched */
  pattern: AITellPattern;

  /** Matched text */
  matchedText: string;

  /** Position in text */
  position: number;

  /** Context around match */
  context?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default AI tell patterns.
 * These are common indicators of AI-generated text.
 */
export const DEFAULT_AI_TELLS: AITellPattern[] = [
  // ─────────────────────────────────────────────────────────────────
  // HIGH SEVERITY - Very strong AI indicators
  // ─────────────────────────────────────────────────────────────────
  {
    regex: '\\bdelve into\\b',
    name: 'Overused "delve into"',
    severity: 'high',
    category: 'vocabulary',
    description: 'Extremely common in AI text, rare in human writing',
  },
  {
    regex: '\\bdelve\\b',
    name: 'Overused "delve"',
    severity: 'high',
    category: 'vocabulary',
  },
  {
    regex: '\\brich tapestry\\b',
    name: 'Cliche "rich tapestry"',
    severity: 'high',
    category: 'phrasing',
  },
  {
    regex: "\\bit'?s worth noting that\\b",
    name: 'Hedging "worth noting"',
    severity: 'high',
    category: 'phrasing',
  },
  {
    regex: '\\bin today\'?s (fast-paced|digital|modern) (world|age|era)\\b',
    name: 'Generic opener "in today\'s world"',
    severity: 'high',
    category: 'structure',
  },
  {
    regex: '\\boverall,\\s',
    name: 'Conclusion starter "overall"',
    severity: 'high',
    category: 'structure',
    description: 'Very common AI conclusion opener',
  },

  // ─────────────────────────────────────────────────────────────────
  // MEDIUM SEVERITY - Common AI patterns
  // ─────────────────────────────────────────────────────────────────
  {
    regex: '\\btapestry\\b',
    name: 'Cliche "tapestry"',
    severity: 'medium',
    category: 'vocabulary',
  },
  {
    regex: '\\bleverage\\b',
    name: 'Corporate "leverage"',
    severity: 'medium',
    category: 'vocabulary',
  },
  {
    regex: '\\bsynergy\\b',
    name: 'Corporate "synergy"',
    severity: 'medium',
    category: 'vocabulary',
  },
  {
    regex: '\\bholistic\\b',
    name: 'Buzzword "holistic"',
    severity: 'medium',
    category: 'vocabulary',
  },
  {
    regex: '\\bmultifaceted\\b',
    name: 'Overused "multifaceted"',
    severity: 'medium',
    category: 'vocabulary',
  },
  {
    regex: '\\bparadigm\\b',
    name: 'Buzzword "paradigm"',
    severity: 'medium',
    category: 'vocabulary',
  },
  {
    regex: '\\bseamlessly\\b',
    name: 'Overused "seamlessly"',
    severity: 'medium',
    category: 'vocabulary',
  },
  {
    regex: '\\bthe fact that\\b',
    name: 'Filler "the fact that"',
    severity: 'medium',
    category: 'phrasing',
  },
  {
    regex: '\\bit is (important|crucial|essential) to (note|understand|recognize)\\b',
    name: 'Hedging importance phrase',
    severity: 'medium',
    category: 'phrasing',
  },
  {
    regex: '\\bin conclusion,?\\s',
    name: 'Formulaic "in conclusion"',
    severity: 'medium',
    category: 'structure',
  },
  {
    regex: '\\bto summarize,?\\s',
    name: 'Formulaic "to summarize"',
    severity: 'medium',
    category: 'structure',
  },
  {
    regex: '\\bfirstly,.*secondly,.*thirdly\\b',
    name: 'Numbered list pattern',
    severity: 'medium',
    category: 'structure',
  },

  // ─────────────────────────────────────────────────────────────────
  // LOW SEVERITY - Weak indicators (need multiple)
  // ─────────────────────────────────────────────────────────────────
  {
    regex: '\\butilize\\b',
    name: 'Pretentious "utilize"',
    severity: 'low',
    category: 'vocabulary',
    description: 'Often "use" is better',
  },
  {
    regex: '\\bfacilitate\\b',
    name: 'Corporate "facilitate"',
    severity: 'low',
    category: 'vocabulary',
  },
  {
    regex: '\\boptimize\\b',
    name: 'Tech buzzword "optimize"',
    severity: 'low',
    category: 'vocabulary',
  },
  {
    regex: '\\bmoreover,\\s',
    name: 'Academic "moreover"',
    severity: 'low',
    category: 'vocabulary',
  },
  {
    regex: '\\bfurthermore,\\s',
    name: 'Academic "furthermore"',
    severity: 'low',
    category: 'vocabulary',
  },
  {
    regex: '\\bnevertheless,\\s',
    name: 'Formal "nevertheless"',
    severity: 'low',
    category: 'vocabulary',
  },
  {
    regex: '\\bnotwithstanding\\b',
    name: 'Legal "notwithstanding"',
    severity: 'low',
    category: 'vocabulary',
  },
  {
    regex: '\\bhowever,\\s',
    name: 'Common transition "however"',
    severity: 'low',
    category: 'structure',
    description: 'Very common, only weak signal',
  },
  {
    regex: '!\\s*$',
    name: 'Excessive exclamation',
    severity: 'low',
    category: 'punctuation',
    description: 'AI often uses more exclamation marks',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default severity weights for scoring.
 */
export const DEFAULT_SEVERITY_WEIGHTS: SeverityWeights = {
  low: 0.1,
  medium: 0.3,
  high: 0.6,
};

/**
 * Default detection threshold (0-1).
 * Text scoring above this is flagged.
 */
export const DEFAULT_DETECTION_THRESHOLD = 0.5;

/**
 * Default minimum matches before flagging.
 */
export const DEFAULT_MIN_MATCHES = 2;

/**
 * Default config values.
 */
export const AI_DETECTION_DEFAULTS: Record<AIDetectionConfigKey, unknown> = {
  [AI_DETECTION_CONFIG_KEYS.PATTERNS]: DEFAULT_AI_TELLS,
  [AI_DETECTION_CONFIG_KEYS.THRESHOLD]: DEFAULT_DETECTION_THRESHOLD,
  [AI_DETECTION_CONFIG_KEYS.SEVERITY_WEIGHTS]: DEFAULT_SEVERITY_WEIGHTS,
  [AI_DETECTION_CONFIG_KEYS.MIN_MATCHES]: DEFAULT_MIN_MATCHES,
  [AI_DETECTION_CONFIG_KEYS.ENABLED]: true,
  [AI_DETECTION_CONFIG_KEYS.CATEGORIES]: ['vocabulary', 'phrasing', 'structure', 'punctuation'],
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps AI detection config keys to ConfigManager categories.
 */
export const AI_DETECTION_CONFIG_CATEGORIES: Record<AIDetectionConfigKey, ConfigCategory> = {
  [AI_DETECTION_CONFIG_KEYS.PATTERNS]: 'limits',
  [AI_DETECTION_CONFIG_KEYS.THRESHOLD]: 'thresholds',
  [AI_DETECTION_CONFIG_KEYS.SEVERITY_WEIGHTS]: 'thresholds',
  [AI_DETECTION_CONFIG_KEYS.MIN_MATCHES]: 'limits',
  [AI_DETECTION_CONFIG_KEYS.ENABLED]: 'features',
  [AI_DETECTION_CONFIG_KEYS.CATEGORIES]: 'limits',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compile a pattern to a RegExp.
 */
export function compilePattern(pattern: AITellPattern): RegExp {
  const flags = pattern.caseInsensitive !== false ? 'gi' : 'g';
  return new RegExp(pattern.regex, flags);
}

/**
 * Check if text contains a pattern.
 */
export function matchPattern(text: string, pattern: AITellPattern): AITellMatch[] {
  const regex = compilePattern(pattern);
  const matches: AITellMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const contextStart = Math.max(0, match.index - 30);
    const contextEnd = Math.min(text.length, match.index + match[0].length + 30);

    matches.push({
      pattern,
      matchedText: match[0],
      position: match.index,
      context: text.slice(contextStart, contextEnd),
    });
  }

  return matches;
}

/**
 * Detect AI patterns in text.
 */
export function detectAIPatterns(
  text: string,
  options?: {
    patterns?: AITellPattern[];
    threshold?: number;
    severityWeights?: SeverityWeights;
    minMatches?: number;
    categories?: AITellCategory[];
  }
): AIDetectionResult {
  const patterns = options?.patterns ?? DEFAULT_AI_TELLS;
  const threshold = options?.threshold ?? DEFAULT_DETECTION_THRESHOLD;
  const weights = options?.severityWeights ?? DEFAULT_SEVERITY_WEIGHTS;
  const minMatches = options?.minMatches ?? DEFAULT_MIN_MATCHES;
  const categories = options?.categories;

  const allMatches: AITellMatch[] = [];
  const categoryScores: Record<AITellCategory, number> = {
    vocabulary: 0,
    phrasing: 0,
    structure: 0,
    punctuation: 0,
  };
  const severityCounts: Record<AITellSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
  };

  // Filter patterns by category if specified
  const activePatterns = categories
    ? patterns.filter((p) => categories.includes(p.category))
    : patterns;

  // Check each pattern
  for (const pattern of activePatterns) {
    const matches = matchPattern(text, pattern);
    allMatches.push(...matches);

    for (const _match of matches) {
      severityCounts[pattern.severity]++;
      categoryScores[pattern.category] += weights[pattern.severity];
    }
  }

  // Calculate overall score (normalized)
  const maxPossibleScore = activePatterns.length * weights.high;
  const rawScore =
    severityCounts.low * weights.low +
    severityCounts.medium * weights.medium +
    severityCounts.high * weights.high;

  // Normalize to 0-1, but cap at 1
  const score = Math.min(1, rawScore / Math.max(1, maxPossibleScore * 0.3));

  // Flag if above threshold AND meets minimum matches
  const flagged = score >= threshold && allMatches.length >= minMatches;

  return {
    score,
    flagged,
    matches: allMatches,
    categoryScores,
    severityCounts,
  };
}

/**
 * Get patterns by severity.
 */
export function getPatternsBySeverity(
  severity: AITellSeverity,
  patterns: AITellPattern[] = DEFAULT_AI_TELLS
): AITellPattern[] {
  return patterns.filter((p) => p.severity === severity);
}

/**
 * Get patterns by category.
 */
export function getPatternsByCategory(
  category: AITellCategory,
  patterns: AITellPattern[] = DEFAULT_AI_TELLS
): AITellPattern[] {
  return patterns.filter((p) => p.category === category);
}

/**
 * Add a custom pattern.
 */
export function createPattern(
  regex: string,
  name: string,
  severity: AITellSeverity,
  category: AITellCategory,
  description?: string
): AITellPattern {
  return {
    regex,
    name,
    severity,
    category,
    description,
    caseInsensitive: true,
  };
}
