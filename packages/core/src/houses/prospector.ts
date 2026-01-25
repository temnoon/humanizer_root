/**
 * Prospector Agent
 *
 * The excellence detector. Scans content for greatness, scores multiple
 * quality dimensions, identifies raw gems (buried insights in poor writing),
 * and maintains quality-based clustering.
 *
 * Concerns:
 * - Multi-dimensional excellence scoring
 * - Raw gem detection (high insight, low writing quality)
 * - Quality-based content clustering
 * - Excellence trend analysis
 * - Standout quote extraction
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed.
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../runtime/types.js';
import { getConfigManager } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';
import {
  EXCELLENCE_CONFIG_KEYS,
  type ExcellenceTier,
  getExcellenceTier,
} from '../config/excellence-config.js';

// ═══════════════════════════════════════════════════════════════════
// PROSPECTOR TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Multi-dimensional excellence score
 */
export interface ExcellenceScore {
  /** Composite score 0-100 */
  compositeScore: number;

  /** Individual dimension scores */
  dimensions: {
    /** Novel ideas per paragraph */
    insightDensity: number;
    /** Clarity and memorability */
    expressivePower: number;
    /** Reader connection */
    emotionalResonance: number;
    /** Flow and pacing */
    structuralElegance: number;
    /** Distinct, genuine voice */
    voiceAuthenticity: number;
  };

  /** Classified tier */
  tier: ExcellenceTier;

  /** Notable quotes worth preserving */
  standoutQuotes: string[];

  /** Brief explanation of scoring */
  reasoning?: string;
}

/**
 * Raw gem detection report
 */
export interface RawGemReport {
  /** Node/passage identifier */
  nodeId: string;

  /** Probability this is a raw gem (0-1) */
  gemProbability: number;

  /** Writing quality score (0-1) */
  writingQualityScore: number;

  /** Insight quality score (0-1) */
  insightQualityScore: number;

  /** Gap between insight and writing quality */
  qualityGap: number;

  /** Extractable insights found */
  extractableInsights: Array<{
    /** Location in content */
    location: string;
    /** The insight itself */
    insight: string;
    /** How it was originally written */
    originalPhrasing: string;
    /** Confidence in extraction */
    confidence: number;
  }>;

  /** Noise to remove during refinement */
  noiseToRemove: string[];
}

/**
 * Quality-based cluster
 */
export interface QualityCluster {
  id: string;
  tier: ExcellenceTier;
  theme: string;
  nodeIds: string[];
  avgScore: number;
  topQuotes: string[];
}

/**
 * Prospector intention
 */
export interface ProspectorIntention {
  type: 'prospect' | 'detect-gem' | 'cluster' | 'trend';
  priority: number;
  reason: string;
  targetIds: string[];
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface ScoreExcellenceRequest {
  nodeId: string;
  content: string;
  context?: string;
  projectId?: string;
}

interface BatchScoreRequest {
  nodes: Array<{ id: string; content: string }>;
  context?: string;
  projectId?: string;
}

interface DetectRawGemsRequest {
  nodes: Array<{ id: string; content: string }>;
  minGemProbability?: number;
  projectId?: string;
}

interface ClusterByQualityRequest {
  nodes: Array<{ id: string; content: string; score?: number }>;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// PROSPECTOR AGENT
// ═══════════════════════════════════════════════════════════════════

export class ProspectorAgent extends AgentBase {
  readonly id = 'prospector';
  readonly name = 'The Prospector';
  readonly house: HouseType = 'prospector';
  readonly capabilities = [
    'score-excellence',
    'batch-score',
    'detect-raw-gems',
    'cluster-by-quality',
    'find-standout-quotes',
    'analyze-quality-trends',
  ];

  private configManager: ConfigManager;
  private pendingIntentions: ProspectorIntention[] = [];

  constructor() {
    super();
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Prospector awakening - ready to find excellence');

    // Subscribe to content events
    this.subscribe('content:node-added');
    this.subscribe('content:batch-imported');
    this.subscribe('project:archive-connected');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Prospector retiring');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'score-excellence':
        return this.scoreExcellence(message.payload as ScoreExcellenceRequest);

      case 'batch-score':
        return this.batchScore(message.payload as BatchScoreRequest);

      case 'detect-raw-gems':
        return this.detectRawGems(message.payload as DetectRawGemsRequest);

      case 'cluster-by-quality':
        return this.clusterByQuality(message.payload as ClusterByQualityRequest);

      case 'get-intentions':
        return this.getIntentions();

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // EXCELLENCE SCORING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Score a single piece of content for excellence
   */
  private async scoreExcellence(request: ScoreExcellenceRequest): Promise<ExcellenceScore> {
    const { nodeId, content, context } = request;

    // Validate content length
    const minLength = await this.configManager.getOrDefault<number>(
      'limits',
      EXCELLENCE_CONFIG_KEYS.MIN_CONTENT_LENGTH,
      100
    );

    if (content.length < minLength) {
      return this.createLowScore(nodeId, 'Content too short for meaningful analysis');
    }

    // Get scoring weights
    const weights = await this.getScoringWeights();

    // Call AI for multi-dimensional scoring
    const analysis = await this.callAI('analysis', content, {
      systemPrompt: this.buildExcellencePrompt(context),
    });

    const scores = this.parseExcellenceAnalysis(analysis);

    // Calculate composite score using weighted average
    const compositeScore = this.calculateCompositeScore(scores, weights);

    // Get thresholds for tier calculation
    const thresholds = await this.getTierThresholds();

    // Detect if this might be a raw gem
    const qualityGap = scores.insightDensity - scores.expressivePower;

    const tier = getExcellenceTier(compositeScore, qualityGap, thresholds);

    const result: ExcellenceScore = {
      compositeScore,
      dimensions: scores,
      tier,
      standoutQuotes: this.extractStandoutQuotes(analysis),
      reasoning: this.extractReasoning(analysis),
    };

    // If excellent, propose featuring
    if (tier === 'excellence') {
      await this.proposeAction(
        'feature-excellence',
        `Feature excellent content: "${content.substring(0, 50)}..."`,
        `Excellence score: ${compositeScore.toFixed(0)}`,
        { nodeId, score: compositeScore, tier },
        { projectId: request.projectId, requiresApproval: false }
      );
    }

    // If raw gem, propose refinement
    if (tier === 'raw_gem') {
      await this.proposeAction(
        'refine-raw-gem',
        `Raw gem detected - has buried insights`,
        `Insight score: ${(scores.insightDensity * 100).toFixed(0)}%, Writing: ${(scores.expressivePower * 100).toFixed(0)}%`,
        { nodeId, qualityGap, insightScore: scores.insightDensity },
        { projectId: request.projectId, requiresApproval: true }
      );
    }

    return result;
  }

  /**
   * Batch score multiple nodes
   */
  private async batchScore(request: BatchScoreRequest): Promise<ExcellenceScore[]> {
    const { nodes, context } = request;
    const batchSize = await this.configManager.getOrDefault<number>(
      'limits',
      EXCELLENCE_CONFIG_KEYS.PROSPECTOR_BATCH_SIZE,
      10
    );

    const results: ExcellenceScore[] = [];

    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(node =>
          this.scoreExcellence({
            nodeId: node.id,
            content: node.content,
            context,
            projectId: request.projectId,
          })
        )
      );
      results.push(...batchResults);
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────
  // RAW GEM DETECTION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Detect raw gems - content with high insight but poor writing
   */
  private async detectRawGems(request: DetectRawGemsRequest): Promise<RawGemReport[]> {
    const { nodes, minGemProbability = 0.5 } = request;

    const reports: RawGemReport[] = [];

    const rawGemGap = await this.configManager.getOrDefault<number>(
      'thresholds',
      EXCELLENCE_CONFIG_KEYS.RAW_GEM_QUALITY_GAP,
      0.3
    );

    for (const node of nodes) {
      // First, score for excellence
      const score = await this.scoreExcellence({
        nodeId: node.id,
        content: node.content,
        projectId: request.projectId,
      });

      const writingQuality = score.dimensions.expressivePower;
      const insightQuality = score.dimensions.insightDensity;
      const qualityGap = insightQuality - writingQuality;

      // Is this a raw gem?
      if (qualityGap >= rawGemGap) {
        // Analyze for extractable insights
        const gemAnalysis = await this.analyzeRawGem(node.id, node.content);

        const gemProbability = Math.min(1, qualityGap / 0.5); // Scale to 0-1

        if (gemProbability >= minGemProbability) {
          reports.push({
            nodeId: node.id,
            gemProbability,
            writingQualityScore: writingQuality,
            insightQualityScore: insightQuality,
            qualityGap,
            extractableInsights: gemAnalysis.insights,
            noiseToRemove: gemAnalysis.noise,
          });
        }
      }
    }

    return reports;
  }

  /**
   * Analyze a potential raw gem for extractable insights
   */
  private async analyzeRawGem(
    nodeId: string,
    content: string
  ): Promise<{ insights: RawGemReport['extractableInsights']; noise: string[] }> {
    const analysis = await this.callAI('analysis', content, {
      systemPrompt: `You are analyzing content that has valuable insights buried in poor writing.

Identify:
1. EXTRACTABLE INSIGHTS: Valuable ideas that deserve better expression
   - Location in text (beginning/middle/end or quote)
   - The insight itself (what's being said)
   - How it's currently written
   - Your confidence this is a real insight (0-1)

2. NOISE TO REMOVE: Elements that obscure the insights
   - Redundant phrases
   - Unclear transitions
   - Off-topic tangents
   - Filler content

Respond with JSON:
{
  "insights": [
    {
      "location": "string",
      "insight": "string",
      "originalPhrasing": "string",
      "confidence": 0.0-1.0
    }
  ],
  "noise": ["string"]
}`,
    });

    const parsed = this.parseAnalysis(analysis) as {
      insights?: RawGemReport['extractableInsights'];
      noise?: string[];
    };

    return {
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      noise: Array.isArray(parsed.noise) ? parsed.noise : [],
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // QUALITY CLUSTERING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Cluster content by quality tier
   */
  private async clusterByQuality(request: ClusterByQualityRequest): Promise<QualityCluster[]> {
    const { nodes } = request;

    // Score all nodes that don't have scores
    const scoredNodes: Array<{ id: string; content: string; score: ExcellenceScore }> = [];

    for (const node of nodes) {
      if (node.score !== undefined) {
        // Already has a score, create minimal score object
        const tier = getExcellenceTier(node.score, undefined, await this.getTierThresholds());
        scoredNodes.push({
          id: node.id,
          content: node.content,
          score: {
            compositeScore: node.score,
            dimensions: {
              insightDensity: 0,
              expressivePower: 0,
              emotionalResonance: 0,
              structuralElegance: 0,
              voiceAuthenticity: 0,
            },
            tier,
            standoutQuotes: [],
          },
        });
      } else {
        const score = await this.scoreExcellence({
          nodeId: node.id,
          content: node.content,
          projectId: request.projectId,
        });
        scoredNodes.push({ id: node.id, content: node.content, score });
      }
    }

    // Group by tier
    const tiers: ExcellenceTier[] = ['excellence', 'polished', 'needs_refinement', 'raw_gem', 'noise'];
    const clusters: QualityCluster[] = [];

    for (const tier of tiers) {
      const tierNodes = scoredNodes.filter(n => n.score.tier === tier);
      if (tierNodes.length === 0) continue;

      const avgScore = tierNodes.reduce((sum, n) => sum + n.score.compositeScore, 0) / tierNodes.length;
      const topQuotes = tierNodes
        .flatMap(n => n.score.standoutQuotes)
        .slice(0, 5);

      // Get theme for this cluster
      const themeContent = tierNodes.slice(0, 5).map(n => n.content.substring(0, 200)).join('\n\n');
      const themeAnalysis = await this.callAI('analysis', themeContent, {
        systemPrompt: 'Identify the main theme of these passages in 3-5 words. Output only the theme.',
      });

      clusters.push({
        id: `quality-${tier}`,
        tier,
        theme: themeAnalysis.trim() || tier,
        nodeIds: tierNodes.map(n => n.id),
        avgScore,
        topQuotes,
      });
    }

    return clusters;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async getScoringWeights(): Promise<Record<string, number>> {
    return {
      insightDensity: await this.configManager.getOrDefault<number>(
        'agents',
        EXCELLENCE_CONFIG_KEYS.INSIGHT_DENSITY_WEIGHT,
        0.25
      ),
      expressivePower: await this.configManager.getOrDefault<number>(
        'agents',
        EXCELLENCE_CONFIG_KEYS.EXPRESSION_POWER_WEIGHT,
        0.20
      ),
      emotionalResonance: await this.configManager.getOrDefault<number>(
        'agents',
        EXCELLENCE_CONFIG_KEYS.RESONANCE_WEIGHT,
        0.20
      ),
      structuralElegance: await this.configManager.getOrDefault<number>(
        'agents',
        EXCELLENCE_CONFIG_KEYS.ELEGANCE_WEIGHT,
        0.15
      ),
      voiceAuthenticity: await this.configManager.getOrDefault<number>(
        'agents',
        EXCELLENCE_CONFIG_KEYS.AUTHENTICITY_WEIGHT,
        0.20
      ),
    };
  }

  private async getTierThresholds(): Promise<{
    excellenceThreshold: number;
    polishedThreshold: number;
    refinementThreshold: number;
    rawGemQualityGap: number;
  }> {
    return {
      excellenceThreshold: await this.configManager.getOrDefault<number>(
        'thresholds',
        EXCELLENCE_CONFIG_KEYS.EXCELLENCE_THRESHOLD,
        80
      ),
      polishedThreshold: await this.configManager.getOrDefault<number>(
        'thresholds',
        EXCELLENCE_CONFIG_KEYS.POLISHED_THRESHOLD,
        60
      ),
      refinementThreshold: await this.configManager.getOrDefault<number>(
        'thresholds',
        EXCELLENCE_CONFIG_KEYS.REFINEMENT_THRESHOLD,
        40
      ),
      rawGemQualityGap: await this.configManager.getOrDefault<number>(
        'thresholds',
        EXCELLENCE_CONFIG_KEYS.RAW_GEM_QUALITY_GAP,
        0.3
      ),
    };
  }

  private buildExcellencePrompt(context?: string): string {
    return `You are an excellence assessor evaluating content quality across five dimensions.

${context ? `Context: ${context}\n` : ''}

Score each dimension from 0.0 to 1.0:

1. INSIGHT DENSITY (Novel ideas per paragraph)
   - Are there original thoughts or perspectives?
   - Is there intellectual substance worth preserving?

2. EXPRESSIVE POWER (Clarity and memorability)
   - Is the writing clear and easy to follow?
   - Are there memorable phrases or images?

3. EMOTIONAL RESONANCE (Reader connection)
   - Does the content evoke genuine feeling?
   - Would a reader feel moved or connected?

4. STRUCTURAL ELEGANCE (Flow and pacing)
   - Does the content flow naturally?
   - Is the pacing appropriate for the content?

5. VOICE AUTHENTICITY (Distinct, genuine)
   - Does this sound like a real person?
   - Is there a distinct perspective or voice?

Also extract up to 3 STANDOUT QUOTES - phrases worth preserving.

Respond with JSON:
{
  "insightDensity": 0.0-1.0,
  "expressivePower": 0.0-1.0,
  "emotionalResonance": 0.0-1.0,
  "structuralElegance": 0.0-1.0,
  "voiceAuthenticity": 0.0-1.0,
  "standoutQuotes": ["quote1", "quote2"],
  "reasoning": "Brief explanation"
}`;
  }

  private parseExcellenceAnalysis(analysis: string): ExcellenceScore['dimensions'] {
    const parsed = this.parseAnalysis(analysis) as {
      insightDensity?: number;
      expressivePower?: number;
      emotionalResonance?: number;
      structuralElegance?: number;
      voiceAuthenticity?: number;
    };

    return {
      insightDensity: Number(parsed.insightDensity) || 0.5,
      expressivePower: Number(parsed.expressivePower) || 0.5,
      emotionalResonance: Number(parsed.emotionalResonance) || 0.5,
      structuralElegance: Number(parsed.structuralElegance) || 0.5,
      voiceAuthenticity: Number(parsed.voiceAuthenticity) || 0.5,
    };
  }

  private calculateCompositeScore(
    dimensions: ExcellenceScore['dimensions'],
    weights: Record<string, number>
  ): number {
    const weighted =
      dimensions.insightDensity * weights.insightDensity +
      dimensions.expressivePower * weights.expressivePower +
      dimensions.emotionalResonance * weights.emotionalResonance +
      dimensions.structuralElegance * weights.structuralElegance +
      dimensions.voiceAuthenticity * weights.voiceAuthenticity;

    return Math.round(weighted * 100);
  }

  private extractStandoutQuotes(analysis: string): string[] {
    const parsed = this.parseAnalysis(analysis) as { standoutQuotes?: string[] };
    return Array.isArray(parsed.standoutQuotes) ? parsed.standoutQuotes : [];
  }

  private extractReasoning(analysis: string): string | undefined {
    const parsed = this.parseAnalysis(analysis) as { reasoning?: string };
    return typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined;
  }

  private createLowScore(nodeId: string, reason: string): ExcellenceScore {
    return {
      compositeScore: 0,
      dimensions: {
        insightDensity: 0,
        expressivePower: 0,
        emotionalResonance: 0,
        structuralElegance: 0,
        voiceAuthenticity: 0,
      },
      tier: 'noise',
      standoutQuotes: [],
      reasoning: reason,
    };
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

  private addIntention(intention: ProspectorIntention): void {
    const exists = this.pendingIntentions.some(
      i => i.type === intention.type &&
           JSON.stringify(i.targetIds) === JSON.stringify(intention.targetIds)
    );
    if (!exists) {
      this.pendingIntentions.push(intention);
      this.pendingIntentions.sort((a, b) => b.priority - a.priority);
    }
  }

  private getIntentions(): ProspectorIntention[] {
    return [...this.pendingIntentions];
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _prospector: ProspectorAgent | null = null;

export function getProspectorAgent(): ProspectorAgent {
  if (!_prospector) {
    _prospector = new ProspectorAgent();
  }
  return _prospector;
}

/**
 * Reset the Prospector agent (for testing)
 */
export function resetProspectorAgent(): void {
  _prospector = null;
}
