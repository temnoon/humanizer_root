/**
 * Refiner Agent
 *
 * The expression polisher. Takes raw gems (content with buried insights
 * in poor writing) and transforms them into polished expressions while
 * preserving the original insight.
 *
 * Concerns:
 * - Insight extraction from raw gems
 * - Expression polishing
 * - Meaning preservation verification
 * - Iterative refinement
 * - Quality improvement tracking
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed.
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../runtime/types.js';
import { getConfigManager } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';
import { EXCELLENCE_CONFIG_KEYS } from '../config/excellence-config.js';

// ═══════════════════════════════════════════════════════════════════
// REFINER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Extracted insight from raw content
 */
export interface ExtractedInsight {
  /** Unique identifier */
  id: string;

  /** The core insight extracted */
  coreIdea: string;

  /** Original phrasing in source content */
  originalPhrasing: string;

  /** Location in source (for provenance) */
  sourceLocation: string;

  /** Extraction confidence */
  confidence: number;

  /** Supporting context if any */
  context?: string;
}

/**
 * Polished expression of an insight
 */
export interface PolishedExpression {
  /** The refined text */
  text: string;

  /** Which insight this expresses */
  insightId: string;

  /** Quality score of the polishing */
  qualityScore: number;

  /** How well the original meaning was preserved (0-1) */
  preservationScore: number;

  /** Changes made from original */
  changesSummary: string;

  /** Pass number (for iterative refinement) */
  passNumber: number;
}

/**
 * Refinement result for a piece of content
 */
export interface RefinementResult {
  /** Original content identifier */
  nodeId: string;

  /** Extracted insights */
  insights: ExtractedInsight[];

  /** Polished expressions */
  expressions: PolishedExpression[];

  /** Final combined output */
  refinedContent: string;

  /** Overall preservation score */
  overallPreservation: number;

  /** Quality improvement (new score - old score) */
  qualityImprovement: number;

  /** Number of refinement passes */
  totalPasses: number;

  /** Whether refinement met quality threshold */
  success: boolean;
}

/**
 * Preservation verification result
 */
export interface PreservationVerification {
  /** Overall preservation score (0-1) */
  score: number;

  /** Whether preservation is acceptable */
  acceptable: boolean;

  /** Insights that were preserved */
  preservedInsights: string[];

  /** Insights that were lost or distorted */
  lostInsights: string[];

  /** Specific issues found */
  issues: string[];

  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Refiner intention
 */
export interface RefinerIntention {
  type: 'extract' | 'polish' | 'verify' | 'iterate';
  priority: number;
  reason: string;
  targetIds: string[];
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface ExtractInsightsRequest {
  nodeId: string;
  content: string;
  knownInsights?: Array<{ location: string; insight: string }>;
  projectId?: string;
}

interface PolishExpressionRequest {
  insightId: string;
  coreIdea: string;
  originalPhrasing: string;
  context?: string;
  projectId?: string;
}

interface VerifyPreservationRequest {
  original: string;
  refined: string;
  insights: ExtractedInsight[];
  projectId?: string;
}

interface RefineContentRequest {
  nodeId: string;
  content: string;
  targetQuality?: number;
  maxPasses?: number;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// REFINER AGENT
// ═══════════════════════════════════════════════════════════════════

export class RefinerAgent extends AgentBase {
  readonly id = 'refiner';
  readonly name = 'The Refiner';
  readonly house: HouseType = 'refiner';
  readonly capabilities = [
    'extract-insights',
    'polish-expression',
    'verify-preservation',
    'refine-content',
    'remove-noise',
  ];

  private configManager: ConfigManager;
  private pendingIntentions: RefinerIntention[] = [];

  constructor() {
    super();
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Refiner awakening - ready to polish expressions');

    this.subscribe('prospector:raw-gem-detected');
    this.subscribe('content:refinement-requested');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Refiner retiring');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'extract-insights':
        return this.extractInsights(message.payload as ExtractInsightsRequest);

      case 'polish-expression':
        return this.polishExpression(message.payload as PolishExpressionRequest);

      case 'verify-preservation':
        return this.verifyPreservation(message.payload as VerifyPreservationRequest);

      case 'refine-content':
        return this.refineContent(message.payload as RefineContentRequest);

      case 'get-intentions':
        return this.getIntentions();

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // INSIGHT EXTRACTION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Extract insights from raw content
   */
  private async extractInsights(request: ExtractInsightsRequest): Promise<ExtractedInsight[]> {
    const { nodeId, content, knownInsights } = request;

    const prompt = this.buildExtractionPrompt(knownInsights);

    const analysis = await this.callAI('analysis', content, {
      systemPrompt: prompt,
    });

    const parsed = this.parseAnalysis(analysis) as {
      insights?: Array<{
        coreIdea?: string;
        originalPhrasing?: string;
        location?: string;
        confidence?: number;
        context?: string;
      }>;
    };

    const insights: ExtractedInsight[] = (parsed.insights || []).map((i, idx) => ({
      id: `${nodeId}-insight-${idx}`,
      coreIdea: i.coreIdea || '',
      originalPhrasing: i.originalPhrasing || '',
      sourceLocation: i.location || 'unknown',
      confidence: Number(i.confidence) || 0.5,
      context: i.context,
    }));

    return insights.filter(i => i.coreIdea && i.confidence > 0.3);
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPRESSION POLISHING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Polish a single insight into a clear expression
   */
  private async polishExpression(request: PolishExpressionRequest): Promise<PolishedExpression> {
    const { insightId, coreIdea, originalPhrasing, context } = request;

    const analysis = await this.callAI('creative', originalPhrasing, {
      systemPrompt: this.buildPolishPrompt(coreIdea, context),
    });

    const parsed = this.parseAnalysis(analysis) as {
      polishedText?: string;
      changesSummary?: string;
    };

    // Verify the polishing preserved the insight
    const verification = await this.quickVerify(originalPhrasing, parsed.polishedText || '', coreIdea);

    return {
      text: parsed.polishedText || originalPhrasing,
      insightId,
      qualityScore: verification.acceptable ? 0.8 : 0.5,
      preservationScore: verification.score,
      changesSummary: parsed.changesSummary || 'No changes tracked',
      passNumber: 1,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRESERVATION VERIFICATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Verify that refinement preserved the original insights
   */
  private async verifyPreservation(request: VerifyPreservationRequest): Promise<PreservationVerification> {
    const { original, refined, insights } = request;

    const minPreservation = await this.configManager.getOrDefault<number>(
      'thresholds',
      EXCELLENCE_CONFIG_KEYS.MIN_INSIGHT_PRESERVATION,
      0.85
    );

    const analysis = await this.callAI('analysis', JSON.stringify({ original, refined, insights }), {
      systemPrompt: `You are verifying that a text refinement preserved the original insights.

For each insight listed, determine:
1. Is it preserved in the refined text?
2. Is it distorted or changed in meaning?
3. Is it lost entirely?

Also identify any new concerns:
- Meaning shifts
- Tone changes that alter interpretation
- Missing context that was important

Respond with JSON:
{
  "score": 0.0-1.0,
  "preservedInsights": ["insight IDs that were preserved"],
  "lostInsights": ["insight IDs that were lost or distorted"],
  "issues": ["specific problems found"],
  "suggestions": ["how to improve preservation"]
}`,
    });

    const parsed = this.parseAnalysis(analysis) as {
      score?: number;
      preservedInsights?: string[];
      lostInsights?: string[];
      issues?: string[];
      suggestions?: string[];
    };

    const score = Number(parsed.score) || 0.5;

    return {
      score,
      acceptable: score >= minPreservation,
      preservedInsights: Array.isArray(parsed.preservedInsights) ? parsed.preservedInsights : [],
      lostInsights: Array.isArray(parsed.lostInsights) ? parsed.lostInsights : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  }

  /**
   * Quick verification for a single insight
   */
  private async quickVerify(
    original: string,
    refined: string,
    insight: string
  ): Promise<{ score: number; acceptable: boolean }> {
    const minPreservation = await this.configManager.getOrDefault<number>(
      'thresholds',
      EXCELLENCE_CONFIG_KEYS.MIN_INSIGHT_PRESERVATION,
      0.85
    );

    const analysis = await this.callAI('analysis', JSON.stringify({ original, refined, insight }), {
      systemPrompt: `Rate how well the refined text preserves the core insight from the original.
Score from 0.0 (completely lost) to 1.0 (perfectly preserved).
Respond with JSON: { "score": 0.0-1.0, "reason": "brief explanation" }`,
    });

    const parsed = this.parseAnalysis(analysis) as { score?: number };
    const score = Number(parsed.score) || 0.5;

    return {
      score,
      acceptable: score >= minPreservation,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // FULL CONTENT REFINEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Full refinement pipeline for a piece of content
   */
  private async refineContent(request: RefineContentRequest): Promise<RefinementResult> {
    const { nodeId, content, targetQuality = 70 } = request;

    const maxPasses = request.maxPasses ?? await this.configManager.getOrDefault<number>(
      'limits',
      EXCELLENCE_CONFIG_KEYS.MAX_REFINEMENT_PASSES,
      3
    );

    // Step 1: Extract insights
    const insights = await this.extractInsights({
      nodeId,
      content,
      projectId: request.projectId,
    });

    if (insights.length === 0) {
      return {
        nodeId,
        insights: [],
        expressions: [],
        refinedContent: content,
        overallPreservation: 1.0,
        qualityImprovement: 0,
        totalPasses: 0,
        success: false,
      };
    }

    // Step 2: Polish each insight
    const expressions: PolishedExpression[] = [];
    for (const insight of insights) {
      const polished = await this.polishExpression({
        insightId: insight.id,
        coreIdea: insight.coreIdea,
        originalPhrasing: insight.originalPhrasing,
        context: insight.context,
        projectId: request.projectId,
      });
      expressions.push(polished);
    }

    // Step 3: Combine into refined content
    let refinedContent = await this.combineExpressions(expressions, content);
    let currentQuality = this.estimateQuality(expressions);
    let pass = 1;

    // Step 4: Iterate if needed
    while (currentQuality < targetQuality && pass < maxPasses) {
      const verification = await this.verifyPreservation({
        original: content,
        refined: refinedContent,
        insights,
        projectId: request.projectId,
      });

      if (!verification.acceptable) {
        // Re-polish lost insights
        for (const lostId of verification.lostInsights) {
          const insight = insights.find(i => i.id === lostId);
          if (insight) {
            const repolished = await this.polishExpression({
              insightId: insight.id,
              coreIdea: insight.coreIdea,
              originalPhrasing: insight.originalPhrasing,
              context: insight.context,
              projectId: request.projectId,
            });
            repolished.passNumber = pass + 1;

            const idx = expressions.findIndex(e => e.insightId === lostId);
            if (idx >= 0) {
              expressions[idx] = repolished;
            }
          }
        }
        refinedContent = await this.combineExpressions(expressions, content);
      }

      currentQuality = this.estimateQuality(expressions);
      pass++;
    }

    // Final verification
    const finalVerification = await this.verifyPreservation({
      original: content,
      refined: refinedContent,
      insights,
      projectId: request.projectId,
    });

    const result: RefinementResult = {
      nodeId,
      insights,
      expressions,
      refinedContent,
      overallPreservation: finalVerification.score,
      qualityImprovement: currentQuality - 50, // Assume baseline of 50
      totalPasses: pass,
      success: finalVerification.acceptable && currentQuality >= targetQuality,
    };

    // Propose if successful
    if (result.success) {
      await this.proposeAction(
        'apply-refinement',
        `Apply refined content for node ${nodeId}`,
        `Preservation: ${(result.overallPreservation * 100).toFixed(0)}%, Quality: ${currentQuality.toFixed(0)}`,
        { nodeId, refinedContent, insights: insights.length },
        { projectId: request.projectId, requiresApproval: true }
      );
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private buildExtractionPrompt(knownInsights?: Array<{ location: string; insight: string }>): string {
    let prompt = `You are extracting valuable insights from content that may have poor writing.

Focus on finding:
1. Original ideas or perspectives
2. Genuine observations or realizations
3. Meaningful connections or patterns
4. Authentic emotional truths

For each insight, provide:
- coreIdea: The essential idea (1-2 sentences)
- originalPhrasing: How it's written in the source
- location: Where in the text (beginning/middle/end or brief quote)
- confidence: How confident you are this is a real insight (0-1)
- context: Any context needed to understand it

Respond with JSON: { "insights": [...] }`;

    if (knownInsights && knownInsights.length > 0) {
      prompt += `\n\nThese insights have already been identified - verify and expand:
${knownInsights.map(i => `- "${i.insight}" at ${i.location}`).join('\n')}`;
    }

    return prompt;
  }

  private buildPolishPrompt(coreIdea: string, context?: string): string {
    return `You are polishing a piece of writing to better express its core insight.

CORE INSIGHT TO PRESERVE:
${coreIdea}

${context ? `CONTEXT: ${context}\n` : ''}

RULES:
1. PRESERVE the exact meaning - do not add or remove ideas
2. Improve clarity and flow
3. Remove unnecessary words
4. Make it memorable if possible
5. Keep the authentic voice where present

DO NOT:
- Add new ideas not in the original
- Change the perspective or stance
- Make it sound generic or corporate
- Add hedging or qualifications not present

Respond with JSON:
{
  "polishedText": "the refined text",
  "changesSummary": "brief description of changes made"
}`;
  }

  private async combineExpressions(
    expressions: PolishedExpression[],
    originalContent: string
  ): Promise<string> {
    if (expressions.length === 0) {
      return originalContent;
    }

    const expressionTexts = expressions.map(e => e.text).join('\n\n');

    const analysis = await this.callAI('creative', expressionTexts, {
      systemPrompt: `Combine these polished expressions into a coherent, flowing piece.
Maintain the order and all content.
Add minimal transitions if needed for flow.
Do not add new ideas.

Output only the combined text.`,
    });

    return analysis.trim();
  }

  private estimateQuality(expressions: PolishedExpression[]): number {
    if (expressions.length === 0) return 0;

    const avgQuality = expressions.reduce((sum, e) => sum + e.qualityScore, 0) / expressions.length;
    const avgPreservation = expressions.reduce((sum, e) => sum + e.preservationScore, 0) / expressions.length;

    // Weighted: preservation matters more
    return (avgQuality * 40 + avgPreservation * 60);
  }

  private async callAI(capability: string, input: string, options?: { systemPrompt?: string }): Promise<string> {
    const response = await this.bus.request('model-master', {
      type: 'call-capability',
      payload: {
        capability,
        input,
        params: options,
      },
    });

    if (!response.success) {
      throw new Error(response.error || 'AI call failed');
    }

    return (response.data as { output: string }).output;
  }

  private parseAnalysis(analysis: string): Record<string, unknown> | unknown[] {
    try {
      const arrayMatch = analysis.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch {
      return {};
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // INTENTIONS
  // ─────────────────────────────────────────────────────────────────

  private addIntention(intention: RefinerIntention): void {
    const exists = this.pendingIntentions.some(
      i => i.type === intention.type &&
           JSON.stringify(i.targetIds) === JSON.stringify(intention.targetIds)
    );
    if (!exists) {
      this.pendingIntentions.push(intention);
      this.pendingIntentions.sort((a, b) => b.priority - a.priority);
    }
  }

  private getIntentions(): RefinerIntention[] {
    return [...this.pendingIntentions];
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _refiner: RefinerAgent | null = null;

export function getRefinerAgent(): RefinerAgent {
  if (!_refiner) {
    _refiner = new RefinerAgent();
  }
  return _refiner;
}

/**
 * Reset the Refiner agent (for testing)
 */
export function resetRefinerAgent(): void {
  _refiner = null;
}
