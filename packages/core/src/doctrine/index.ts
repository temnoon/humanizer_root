/**
 * Doctrine - How the Agent JUDGES
 *
 * The Doctrine defines evaluation criteria, thresholds, and signoff policies:
 * - Evaluation axes (what dimensions to assess)
 * - Thresholds (what scores are acceptable)
 * - Signoff policies (who needs to approve what)
 *
 * Doctrine is consulted during:
 * - Content quality assessment
 * - Signoff decisions
 * - Automated approval logic
 *
 * All threshold values come from ConfigManager, not hardcoded.
 */

import { getConfigManager } from '../config/index.js';
import { THRESHOLD_KEYS } from '../config/types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * An axis for evaluation
 *
 * Axes define dimensions along which content is assessed.
 */
export interface EvaluationAxis {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this axis measures */
  description: string;

  /** Scale range */
  scale: {
    min: number;
    max: number;
    midpoint: number;
  };

  /** Qualitative labels for ranges */
  labels?: Record<string, [number, number]>; // e.g., "excellent": [0.9, 1.0]

  /** Weight in overall scoring (0-1) */
  weight: number;

  /** Is this axis required for all evaluations? */
  required: boolean;

  /** Domains this axis applies to */
  domains?: string[];
}

/**
 * Evaluation thresholds
 *
 * Numeric thresholds for making judgments.
 * All values loaded from ConfigManager.
 */
export interface Thresholds {
  /** Minimum confidence to accept a result */
  confidence: number;

  /** Minimum quality score to include content */
  quality: number;

  /** Similarity threshold for matching */
  similarity: number;

  /** Custom thresholds by domain */
  custom?: Record<string, number>;
}

/**
 * Signoff strictness levels
 */
export type SignoffStrictness =
  | 'none'       // No signoff required
  | 'advisory'   // Suggestions only, user decides
  | 'required'   // Must review before proceeding
  | 'blocking';  // Must approve all changes

/**
 * Signoff policy for a specific action type
 */
export interface SignoffPolicy {
  /** Action type this policy applies to */
  actionType: string;

  /** Required strictness level */
  strictness: SignoffStrictness;

  /** Which agents/houses must sign off */
  requiredSigners?: string[];

  /** Minimum number of approvals needed */
  minApprovals?: number;

  /** Can user override */
  userOverride: boolean;

  /** Time limit for signoff (ms) */
  timeoutMs?: number;

  /** Auto-approve conditions */
  autoApproveConditions?: AutoApproveCondition[];
}

/**
 * Condition for auto-approval
 */
export interface AutoApproveCondition {
  /** Condition type */
  type: 'quality-threshold' | 'confidence-threshold' | 'source-trusted' | 'size-limit';

  /** Threshold value */
  threshold?: number;

  /** Description */
  description: string;
}

/**
 * An evaluation result
 */
export interface EvaluationResult {
  /** Overall score (weighted average) */
  overallScore: number;

  /** Individual axis scores */
  axisScores: Record<string, number>;

  /** Qualitative assessment */
  assessment: 'reject' | 'poor' | 'acceptable' | 'good' | 'excellent';

  /** Detailed feedback */
  feedback: EvaluationFeedback[];

  /** Recommendation */
  recommendation: 'approve' | 'revise' | 'reject';

  /** Suggested improvements */
  improvements?: string[];
}

/**
 * Feedback for a specific axis
 */
export interface EvaluationFeedback {
  /** Which axis this feedback is for */
  axisId: string;

  /** Score on this axis */
  score: number;

  /** Qualitative label */
  label: string;

  /** Detailed comment */
  comment?: string;

  /** Specific issues found */
  issues?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// DOCTRINE INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * The Doctrine - how an agent judges
 */
export interface Doctrine {
  /** Evaluation axes */
  axes: EvaluationAxis[];

  /** Thresholds for judgments */
  thresholds: Thresholds;

  /** Signoff policies by action type */
  signoffPolicies: Map<string, SignoffPolicy>;
}

/**
 * Doctrine provider interface
 */
export interface DoctrineProvider {
  /**
   * Load the full doctrine
   */
  loadDoctrine(): Promise<Doctrine>;

  /**
   * Get evaluation axes for a domain
   */
  getAxes(domain?: string): Promise<EvaluationAxis[]>;

  /**
   * Get current thresholds
   */
  getThresholds(): Promise<Thresholds>;

  /**
   * Get signoff policy for an action type
   */
  getSignoffPolicy(actionType: string): Promise<SignoffPolicy | undefined>;

  /**
   * Evaluate content against doctrine
   */
  evaluate(content: EvaluationInput): Promise<EvaluationResult>;

  /**
   * Check if auto-approval is allowed
   */
  canAutoApprove(actionType: string, context: AutoApproveContext): Promise<boolean>;
}

/**
 * Input for evaluation
 */
export interface EvaluationInput {
  /** Content to evaluate */
  content: string;

  /** Domain for axis selection */
  domain?: string;

  /** Pre-computed scores (if available) */
  precomputedScores?: Record<string, number>;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Context for auto-approve check
 */
export interface AutoApproveContext {
  /** Quality score if known */
  qualityScore?: number;

  /** Confidence score if known */
  confidenceScore?: number;

  /** Source of the content/action */
  source?: string;

  /** Size of the change */
  size?: number;

  /** Additional context */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT AXES
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard evaluation axes
 *
 * These are seed values - actual axes are loaded from config.
 */
export const STANDARD_AXES: EvaluationAxis[] = [
  {
    id: 'authenticity',
    name: 'Authenticity',
    description: 'Does it sound genuine, not AI-generated?',
    scale: { min: 0, max: 1, midpoint: 0.5 },
    labels: {
      'clearly-ai': [0, 0.3],
      'uncertain': [0.3, 0.6],
      'likely-human': [0.6, 0.8],
      'authentic': [0.8, 1.0],
    },
    weight: 0.25,
    required: true,
  },
  {
    id: 'coherence',
    name: 'Coherence',
    description: 'Does it flow logically and make sense?',
    scale: { min: 0, max: 1, midpoint: 0.5 },
    labels: {
      'incoherent': [0, 0.3],
      'choppy': [0.3, 0.6],
      'clear': [0.6, 0.8],
      'excellent': [0.8, 1.0],
    },
    weight: 0.25,
    required: true,
  },
  {
    id: 'voice-consistency',
    name: 'Voice Consistency',
    description: 'Is it consistent with the project persona?',
    scale: { min: 0, max: 1, midpoint: 0.5 },
    labels: {
      'inconsistent': [0, 0.3],
      'mixed': [0.3, 0.6],
      'mostly-consistent': [0.6, 0.8],
      'unified': [0.8, 1.0],
    },
    weight: 0.2,
    required: false,
  },
  {
    id: 'citation',
    name: 'Citation',
    description: 'Are sources properly attributed?',
    scale: { min: 0, max: 1, midpoint: 0.5 },
    labels: {
      'no-citations': [0, 0.3],
      'partial': [0.3, 0.6],
      'adequate': [0.6, 0.8],
      'thorough': [0.8, 1.0],
    },
    weight: 0.15,
    required: false,
    domains: ['academic', 'book'],
  },
  {
    id: 'completeness',
    name: 'Completeness',
    description: 'Does it achieve its stated purpose?',
    scale: { min: 0, max: 1, midpoint: 0.5 },
    labels: {
      'incomplete': [0, 0.3],
      'partial': [0.3, 0.6],
      'adequate': [0.6, 0.8],
      'comprehensive': [0.8, 1.0],
    },
    weight: 0.15,
    required: true,
  },
];

/**
 * Standard signoff policies
 */
export const STANDARD_SIGNOFF_POLICIES: SignoffPolicy[] = [
  {
    actionType: 'passage-harvest',
    strictness: 'advisory',
    userOverride: true,
    autoApproveConditions: [
      { type: 'quality-threshold', threshold: 0.8, description: 'High quality passages' },
    ],
  },
  {
    actionType: 'chapter-draft',
    strictness: 'required',
    requiredSigners: ['reviewer'],
    minApprovals: 1,
    userOverride: true,
    timeoutMs: 3600000, // 1 hour
  },
  {
    actionType: 'publish',
    strictness: 'blocking',
    requiredSigners: ['reviewer', 'curator'],
    minApprovals: 2,
    userOverride: false,
  },
  {
    actionType: 'minor-edit',
    strictness: 'none',
    userOverride: true,
    autoApproveConditions: [
      { type: 'size-limit', threshold: 100, description: 'Small changes under 100 characters' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * In-memory Doctrine provider
 */
export class InMemoryDoctrineProvider implements DoctrineProvider {
  private axes: EvaluationAxis[] = [...STANDARD_AXES];
  private signoffPolicies: Map<string, SignoffPolicy> = new Map();

  constructor() {
    // Initialize with standard policies
    for (const policy of STANDARD_SIGNOFF_POLICIES) {
      this.signoffPolicies.set(policy.actionType, policy);
    }
  }

  async loadDoctrine(): Promise<Doctrine> {
    return {
      axes: this.axes,
      thresholds: await this.getThresholds(),
      signoffPolicies: this.signoffPolicies,
    };
  }

  async getAxes(domain?: string): Promise<EvaluationAxis[]> {
    if (!domain) return this.axes;
    return this.axes.filter(a => !a.domains || a.domains.includes(domain));
  }

  async getThresholds(): Promise<Thresholds> {
    const configManager = getConfigManager();

    return {
      confidence: await configManager.getOrDefault('thresholds', THRESHOLD_KEYS.CONFIDENCE_MIN, 0.6),
      quality: await configManager.getOrDefault('thresholds', THRESHOLD_KEYS.QUALITY_MIN, 0.5),
      similarity: await configManager.getOrDefault('thresholds', THRESHOLD_KEYS.SIMILARITY_MATCH, 0.8),
    };
  }

  async getSignoffPolicy(actionType: string): Promise<SignoffPolicy | undefined> {
    return this.signoffPolicies.get(actionType);
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const axes = await this.getAxes(input.domain);
    const thresholds = await this.getThresholds();

    const axisScores: Record<string, number> = {};
    const feedback: EvaluationFeedback[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    for (const axis of axes) {
      // Use pre-computed score if available, otherwise default to midpoint
      const score = input.precomputedScores?.[axis.id] ?? axis.scale.midpoint;
      axisScores[axis.id] = score;

      totalWeight += axis.weight;
      weightedSum += score * axis.weight;

      // Determine label
      let label = 'unknown';
      if (axis.labels) {
        for (const [labelName, [min, max]] of Object.entries(axis.labels)) {
          if (score >= min && score <= max) {
            label = labelName;
            break;
          }
        }
      }

      feedback.push({
        axisId: axis.id,
        score,
        label,
      });
    }

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Determine assessment
    let assessment: EvaluationResult['assessment'];
    if (overallScore < 0.3) assessment = 'reject';
    else if (overallScore < 0.5) assessment = 'poor';
    else if (overallScore < 0.7) assessment = 'acceptable';
    else if (overallScore < 0.85) assessment = 'good';
    else assessment = 'excellent';

    // Determine recommendation
    let recommendation: EvaluationResult['recommendation'];
    if (overallScore < thresholds.quality) {
      recommendation = 'reject';
    } else if (overallScore < thresholds.confidence) {
      recommendation = 'revise';
    } else {
      recommendation = 'approve';
    }

    return {
      overallScore,
      axisScores,
      assessment,
      feedback,
      recommendation,
    };
  }

  async canAutoApprove(actionType: string, context: AutoApproveContext): Promise<boolean> {
    const policy = await this.getSignoffPolicy(actionType);
    if (!policy) return true; // No policy = auto-approve

    if (policy.strictness === 'blocking') return false;
    if (!policy.autoApproveConditions) return policy.strictness === 'none';

    // Check all auto-approve conditions
    for (const condition of policy.autoApproveConditions) {
      switch (condition.type) {
        case 'quality-threshold':
          if (context.qualityScore !== undefined &&
              context.qualityScore >= (condition.threshold ?? 0.8)) {
            return true;
          }
          break;

        case 'confidence-threshold':
          if (context.confidenceScore !== undefined &&
              context.confidenceScore >= (condition.threshold ?? 0.9)) {
            return true;
          }
          break;

        case 'size-limit':
          if (context.size !== undefined &&
              context.size <= (condition.threshold ?? 100)) {
            return true;
          }
          break;

        case 'source-trusted':
          // Would check against trusted source list
          break;
      }
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add or update an axis
   */
  setAxis(axis: EvaluationAxis): void {
    const index = this.axes.findIndex(a => a.id === axis.id);
    if (index >= 0) {
      this.axes[index] = axis;
    } else {
      this.axes.push(axis);
    }
  }

  /**
   * Add or update a signoff policy
   */
  setSignoffPolicy(policy: SignoffPolicy): void {
    this.signoffPolicies.set(policy.actionType, policy);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _doctrineProvider: DoctrineProvider | null = null;

/**
 * Get the doctrine provider
 */
export function getDoctrineProvider(): DoctrineProvider {
  if (!_doctrineProvider) {
    _doctrineProvider = new InMemoryDoctrineProvider();
  }
  return _doctrineProvider;
}

/**
 * Set a custom doctrine provider
 */
export function setDoctrineProvider(provider: DoctrineProvider): void {
  _doctrineProvider = provider;
}

/**
 * Reset the doctrine provider (for testing)
 */
export function resetDoctrineProvider(): void {
  _doctrineProvider = null;
}
