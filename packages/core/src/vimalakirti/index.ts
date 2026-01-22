/**
 * Vimalakirti Boundary System
 *
 * Ethical guardrails based on the Vimalakirti Sutra's "skillful means" principle:
 * - Meet users where they stand
 * - Maintain professional distance
 * - Acknowledge shadow, never glorify
 *
 * All prompts are stored in ConfigManager, not hardcoded here.
 */

import { getConfigManager } from '../config/index.js';
import { PROMPT_IDS } from '../config/types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Level of inquiry being made
 */
export type InquiryLevel = 'information' | 'meaning' | 'existential';

/**
 * Result of inquiry level assessment
 */
export interface InquiryLevelResult {
  level: InquiryLevel;
  confidence: number;
  reasoning: string;
}

/**
 * Severity of professional distance concern
 */
export type DistanceSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Result of professional distance check
 */
export interface ProfessionalDistanceResult {
  needsRedirect: boolean;
  reason?: string;
  severity: DistanceSeverity;
  suggestedResource?: string;
}

/**
 * Result of shadow pattern detection
 */
export interface ShadowCheckResult {
  hasShadowPatterns: boolean;
  patterns: string[];
  intervention: string;
  shouldProceed: boolean;
  redirectMessage?: string;
}

/**
 * Combined boundary check result
 */
export interface BoundaryCheckResult {
  /** Should we proceed with the request? */
  shouldProceed: boolean;

  /** Inquiry level assessment */
  inquiryLevel: InquiryLevelResult;

  /** Professional distance assessment */
  professionalDistance: ProfessionalDistanceResult;

  /** Shadow pattern assessment */
  shadowCheck: ShadowCheckResult;

  /** Overall intervention message if not proceeding */
  interventionMessage?: string;

  /** Adjustments to make if proceeding */
  adjustments?: BoundaryAdjustments;
}

/**
 * Adjustments to apply when proceeding with caution
 */
export interface BoundaryAdjustments {
  /** Add disclaimer to response */
  addDisclaimer?: string;

  /** Suggest resources */
  suggestResources?: string[];

  /** Modify tone */
  toneAdjustment?: 'more-formal' | 'more-gentle' | 'more-direct';

  /** Limit scope */
  scopeLimit?: string;
}

// ═══════════════════════════════════════════════════════════════════
// LLM PROVIDER INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * Minimal LLM interface for boundary checks
 *
 * The actual implementation is provided by the consuming application,
 * allowing flexibility in which LLM provider is used.
 */
export interface BoundaryLLMProvider {
  /**
   * Generate a completion for the given prompt
   */
  complete(prompt: string): Promise<string>;
}

// ═══════════════════════════════════════════════════════════════════
// VIMALAKIRTI BOUNDARY
// ═══════════════════════════════════════════════════════════════════

/**
 * Vimalakirti Boundary System
 *
 * Provides ethical guardrails for agent interactions based on the
 * principle of "skillful means" - meeting users where they stand
 * while maintaining appropriate boundaries.
 */
export class VimalakirtiBoundary {
  private llm: BoundaryLLMProvider;

  constructor(llmProvider: BoundaryLLMProvider) {
    this.llm = llmProvider;
  }

  /**
   * Assess the level of inquiry
   *
   * Determines whether a request is:
   * - INFORMATION: Seeking facts, data, practical answers
   * - MEANING: Seeking understanding, interpretation
   * - EXISTENTIAL: Seeking guidance on identity, purpose
   */
  async assessInquiryLevel(request: string): Promise<InquiryLevelResult> {
    const configManager = getConfigManager();
    const compiled = await configManager.compilePrompt(
      PROMPT_IDS.VIMALAKIRTI_INQUIRY_LEVEL,
      { userRequest: request }
    );

    const response = await this.llm.complete(compiled.text);
    
    try {
      const parsed = JSON.parse(this.extractJSON(response));
      return {
        level: this.normalizeLevel(parsed.level),
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || '',
      };
    } catch {
      // Default to information-seeking if parsing fails
      return {
        level: 'information',
        confidence: 0.5,
        reasoning: 'Could not assess inquiry level',
      };
    }
  }

  /**
   * Check if professional distance should be maintained
   *
   * Detects requests that should be redirected to professional resources
   * rather than handled by AI.
   */
  async checkProfessionalDistance(request: string): Promise<ProfessionalDistanceResult> {
    const configManager = getConfigManager();
    const compiled = await configManager.compilePrompt(
      PROMPT_IDS.VIMALAKIRTI_PROFESSIONAL_DISTANCE,
      { userRequest: request }
    );

    const response = await this.llm.complete(compiled.text);

    try {
      const parsed = JSON.parse(this.extractJSON(response));
      return {
        needsRedirect: parsed.needsRedirect === true,
        reason: parsed.reason,
        severity: this.normalizeSeverity(parsed.severity),
        suggestedResource: parsed.suggestedResource,
      };
    } catch {
      // Default to no redirect if parsing fails
      return {
        needsRedirect: false,
        severity: 'low',
      };
    }
  }

  /**
   * Check for shadow patterns
   *
   * Detects content that should be acknowledged but not glorified:
   * - Violence
   * - Self-harm ideation
   * - Harmful applications
   */
  async checkShadowPatterns(request: string): Promise<ShadowCheckResult> {
    const configManager = getConfigManager();
    const compiled = await configManager.compilePrompt(
      PROMPT_IDS.VIMALAKIRTI_SHADOW_CHECK,
      { userRequest: request }
    );

    const response = await this.llm.complete(compiled.text);

    try {
      const parsed = JSON.parse(this.extractJSON(response));
      return {
        hasShadowPatterns: parsed.hasShadowPatterns === true,
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
        intervention: parsed.intervention || '',
        shouldProceed: parsed.shouldProceed !== false,
        redirectMessage: parsed.redirectMessage,
      };
    } catch {
      // Default to no shadow patterns if parsing fails
      return {
        hasShadowPatterns: false,
        patterns: [],
        intervention: '',
        shouldProceed: true,
      };
    }
  }

  /**
   * Perform a complete boundary check
   *
   * Runs all three checks and synthesizes a combined result.
   */
  async checkBoundaries(request: string): Promise<BoundaryCheckResult> {
    // Run all checks in parallel
    const [inquiryLevel, professionalDistance, shadowCheck] = await Promise.all([
      this.assessInquiryLevel(request),
      this.checkProfessionalDistance(request),
      this.checkShadowPatterns(request),
    ]);

    // Determine if we should proceed
    let shouldProceed = true;
    let interventionMessage: string | undefined;
    const adjustments: BoundaryAdjustments = {};

    // Check for hard blocks
    if (professionalDistance.severity === 'critical') {
      shouldProceed = false;
      interventionMessage = professionalDistance.reason ||
        'This request requires professional support beyond what AI can provide.';
    }

    if (!shadowCheck.shouldProceed) {
      shouldProceed = false;
      interventionMessage = shadowCheck.redirectMessage ||
        'I cannot assist with this request as stated.';
    }

    // Check for soft adjustments
    if (shouldProceed) {
      if (professionalDistance.needsRedirect) {
        adjustments.suggestResources = [
          professionalDistance.suggestedResource || 'appropriate professional support'
        ];
        adjustments.addDisclaimer =
          'While I can provide information, you may benefit from speaking with a professional.';
      }

      if (shadowCheck.hasShadowPatterns) {
        adjustments.addDisclaimer = adjustments.addDisclaimer
          ? `${adjustments.addDisclaimer} ${shadowCheck.intervention}`
          : shadowCheck.intervention;
      }

      if (inquiryLevel.level === 'existential') {
        adjustments.toneAdjustment = 'more-gentle';
        adjustments.scopeLimit = 'Focus on information and perspective rather than definitive answers.';
      }
    }

    return {
      shouldProceed,
      inquiryLevel,
      professionalDistance,
      shadowCheck,
      interventionMessage,
      adjustments: Object.keys(adjustments).length > 0 ? adjustments : undefined,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Extract JSON from a response that may contain other text
   */
  private extractJSON(response: string): string {
    // Try to find JSON object in response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    return response;
  }

  /**
   * Normalize inquiry level to valid enum
   */
  private normalizeLevel(level: string): InquiryLevel {
    const normalized = (level || '').toLowerCase();
    if (normalized === 'meaning') return 'meaning';
    if (normalized === 'existential') return 'existential';
    return 'information';
  }

  /**
   * Normalize severity to valid enum
   */
  private normalizeSeverity(severity: string): DistanceSeverity {
    const normalized = (severity || '').toLowerCase();
    if (normalized === 'medium') return 'medium';
    if (normalized === 'high') return 'high';
    if (normalized === 'critical') return 'critical';
    return 'low';
  }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════

let _boundary: VimalakirtiBoundary | null = null;

/**
 * Create or get the Vimalakirti boundary instance
 */
export function getVimalakirtiBoundary(llmProvider?: BoundaryLLMProvider): VimalakirtiBoundary {
  if (!_boundary && !llmProvider) {
    throw new Error('VimalakirtiBoundary requires an LLM provider on first initialization');
  }
  if (llmProvider) {
    _boundary = new VimalakirtiBoundary(llmProvider);
  }
  return _boundary!;
}

/**
 * Reset the boundary instance (for testing)
 */
export function resetVimalakirtiBoundary(): void {
  _boundary = null;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Quick check if a request likely needs boundary consideration
 *
 * This is a fast heuristic check that doesn't require LLM calls.
 * Use for pre-filtering before running full boundary checks.
 */
export function quickBoundaryHeuristic(request: string): {
  likelyNeedsBoundaryCheck: boolean;
  signals: string[];
} {
  const signals: string[] = [];
  const lowerRequest = request.toLowerCase();

  // Existential signals
  const existentialKeywords = [
    'meaning of life', 'purpose', 'why am i', 'who am i',
    'should i exist', 'point of living', 'my identity'
  ];
  for (const keyword of existentialKeywords) {
    if (lowerRequest.includes(keyword)) {
      signals.push(`existential: "${keyword}"`);
    }
  }

  // Distress signals
  const distressKeywords = [
    'depressed', 'suicidal', 'self-harm', 'end it all',
    'nobody cares', 'want to die', 'hopeless'
  ];
  for (const keyword of distressKeywords) {
    if (lowerRequest.includes(keyword)) {
      signals.push(`distress: "${keyword}"`);
    }
  }

  // Shadow signals
  const shadowKeywords = [
    'hurt someone', 'revenge', 'make them pay',
    'how to harm', 'weapon', 'poison'
  ];
  for (const keyword of shadowKeywords) {
    if (lowerRequest.includes(keyword)) {
      signals.push(`shadow: "${keyword}"`);
    }
  }

  return {
    likelyNeedsBoundaryCheck: signals.length > 0,
    signals,
  };
}
