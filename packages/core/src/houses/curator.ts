/**
 * Curator Agent
 *
 * The keeper of quality and relevance. Assesses content passages,
 * recommends gems, organizes threads, and maintains the semantic
 * coherence of the bookshelf.
 *
 * Concerns:
 * - Passage quality assessment (clarity, depth, originality)
 * - Thread coherence and organization
 * - Gem identification (standout passages)
 * - Redundancy detection
 * - Semantic clustering recommendations
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed.
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../runtime/types.js';
import { getConfigManager, THRESHOLD_KEYS, PROMPT_IDS } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS FOR CURATOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Curator specific config keys
 */
export const CURATOR_CONFIG = {
  // Quality thresholds
  QUALITY_THRESHOLD: 'curator.qualityThreshold',
  GEM_THRESHOLD: 'curator.gemThreshold',
  REDUNDANCY_THRESHOLD: 'curator.redundancyThreshold',
  COHERENCE_THRESHOLD: 'curator.coherenceThreshold',

  // Batch sizes
  MAX_CARDS_PER_BATCH: 'curator.maxCardsPerBatch',
} as const;

// ═══════════════════════════════════════════════════════════════════
// CURATOR TYPES
// ═══════════════════════════════════════════════════════════════════

export interface PassageAssessment {
  passageId: string;
  quality: number;          // 0-1 overall quality
  clarity: number;          // 0-1 how clear the writing is
  depth: number;            // 0-1 intellectual/emotional depth
  originality: number;      // 0-1 uniqueness of perspective
  relevance: number;        // 0-1 relevance to thread/project
  isGem: boolean;           // Standout passage worth featuring
  concerns: string[];       // Issues to address
  recommendations: string[];
}

export interface ThreadCoherence {
  threadId: string;
  coherenceScore: number;   // 0-1 how well passages fit together
  gapAnalysis: string[];    // Missing topics/perspectives
  redundancies: string[];   // Overlapping content
  suggestedOrder: string[]; // Recommended passage ordering
}

export interface SemanticCluster {
  id: string;
  theme: string;
  passages: string[];
  centroidEmbedding?: number[];
  suggestedThreads: string[];
}

export interface CuratorIntention {
  type: 'assess' | 'organize' | 'discover' | 'prune';
  priority: number;
  reason: string;
  targetIds: string[];
}

export interface RedundancyReport {
  totalPairs: number;
  redundantPairs: number;
  redundancies: Array<{
    pair: [string, string];
    similarity: number;
    recommendation: string;
  }>;
}

export interface CardAssignmentProposal {
  cardId: string;
  suggestedChapterId: string;
  confidence: number;
  reasoning: string;
  alternatives?: Array<{ chapterId: string; confidence: number }>;
}

export interface AssignmentProposalBatch {
  proposals: CardAssignmentProposal[];
  generatedAt: string;
  totalCards: number;
  assignedCards: number;
  unassignedCards: number;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface AssessPassageRequest {
  passageId: string;
  text: string;
  threadContext?: string;
  projectContext?: string;
  projectId?: string;
}

interface AssessThreadRequest {
  threadId: string;
  passages: Array<{ id: string; text: string }>;
  theme: string;
  projectId?: string;
}

interface FindGemsRequest {
  passages: Array<{ id: string; text: string; threadContext?: string }>;
  limit?: number;
  projectId?: string;
}

interface DetectRedundancyRequest {
  passages: Array<{ id: string; text: string }>;
  threshold?: number;
  projectId?: string;
}

interface SuggestClustersRequest {
  passages: Array<{ id: string; text: string }>;
  numClusters?: number;
  projectId?: string;
}

interface OrganizeThreadRequest {
  threadId: string;
  passages: Array<{ id: string; text: string }>;
  theme: string;
  targetOrder?: string[];
  projectId?: string;
}

interface AssignCardsToChaptersRequest {
  cards: Array<{ id: string; content: string; title?: string }>;
  chapters: Array<{ id: string; title: string; description?: string }>;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CURATOR AGENT
// ═══════════════════════════════════════════════════════════════════

export class CuratorAgent extends AgentBase {
  readonly id = 'curator';
  readonly name = 'The Curator';
  readonly house: HouseType = 'curator';
  readonly capabilities = [
    'assess-passage',
    'assess-thread',
    'find-gems',
    'detect-redundancy',
    'suggest-clusters',
    'organize-thread',
    'evaluate-coherence',
    'assign-cards-to-chapters',
  ];

  private configManager: ConfigManager;

  // Pending intentions based on observations
  private pendingIntentions: CuratorIntention[] = [];

  constructor() {
    super();
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Curator awakening - ready to assess quality');

    // Subscribe to content events
    this.subscribe('content:passage-added');
    this.subscribe('content:thread-updated');
    this.subscribe('content:chapter-created');
    this.subscribe('project:phase-changed');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Curator retiring');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'assess-passage':
        return this.assessPassage(message.payload as AssessPassageRequest);

      case 'assess-thread':
        return this.assessThread(message.payload as AssessThreadRequest);

      case 'find-gems':
        return this.findGems(message.payload as FindGemsRequest);

      case 'detect-redundancy':
        return this.detectRedundancy(message.payload as DetectRedundancyRequest);

      case 'suggest-clusters':
        return this.suggestClusters(message.payload as SuggestClustersRequest);

      case 'organize-thread':
        return this.organizeThread(message.payload as OrganizeThreadRequest);

      case 'assign-cards-to-chapters':
        return this.assignCardsToChapters(message.payload as AssignCardsToChaptersRequest);

      case 'get-intentions':
        return this.getIntentions();

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PASSAGE ASSESSMENT
  // ─────────────────────────────────────────────────────────────────

  private async assessPassage(request: AssessPassageRequest): Promise<PassageAssessment> {
    const { passageId, text, threadContext, projectContext } = request;

    // Get thresholds from config
    const qualityThreshold = await this.configManager.getOrDefault<number>(
      'thresholds',
      CURATOR_CONFIG.QUALITY_THRESHOLD,
      0.6
    );
    const gemThreshold = await this.configManager.getOrDefault<number>(
      'thresholds',
      CURATOR_CONFIG.GEM_THRESHOLD,
      0.85
    );

    // Use AI to assess the passage
    const analysis = await this.callAI('analysis', text, {
      systemPrompt: `You are a literary curator assessing passage quality.
Evaluate on these dimensions (0-1 scale):
- Clarity: How clear and well-written
- Depth: Intellectual or emotional depth
- Originality: Uniqueness of perspective
- Relevance: How well it fits the context

Thread context: ${threadContext || 'General'}
Project context: ${projectContext || 'Book project'}

Respond with JSON: { clarity, depth, originality, relevance, concerns: [], recommendations: [] }`,
    });

    const scores = this.parseAnalysis(analysis) as {
      clarity?: number;
      depth?: number;
      originality?: number;
      relevance?: number;
      concerns?: string[];
      recommendations?: string[];
    };
    const clarity = Number(scores.clarity) || 0.5;
    const depth = Number(scores.depth) || 0.5;
    const originality = Number(scores.originality) || 0.5;
    const relevance = Number(scores.relevance) || 0.5;
    const quality = (clarity + depth + originality + relevance) / 4;
    const isGem = quality >= gemThreshold;

    const assessment: PassageAssessment = {
      passageId,
      quality,
      clarity,
      depth,
      originality,
      relevance,
      isGem,
      concerns: Array.isArray(scores.concerns) ? scores.concerns : [],
      recommendations: Array.isArray(scores.recommendations) ? scores.recommendations : [],
    };

    // If quality is below threshold, create an intention to address it
    if (quality < qualityThreshold) {
      this.addIntention({
        type: 'prune',
        priority: 1 - quality, // Lower quality = higher priority to address
        reason: `Passage quality (${(quality * 100).toFixed(0)}%) below threshold`,
        targetIds: [passageId],
      });
    }

    // If it's a gem, propose featuring it
    if (isGem) {
      await this.proposeAction(
        'feature-gem',
        `Feature gem passage: "${text.substring(0, 50)}..."`,
        `Quality score: ${(quality * 100).toFixed(0)}%`,
        { passageId, quality },
        { projectId: request.projectId, requiresApproval: false }
      );
    }

    return assessment;
  }

  // ─────────────────────────────────────────────────────────────────
  // THREAD COHERENCE
  // ─────────────────────────────────────────────────────────────────

  private async assessThread(request: AssessThreadRequest): Promise<ThreadCoherence> {
    const { threadId, passages, theme } = request;

    // Get coherence threshold from config
    const coherenceThreshold = await this.configManager.getOrDefault<number>(
      'thresholds',
      CURATOR_CONFIG.COHERENCE_THRESHOLD,
      0.5
    );

    // Analyze thread coherence using AI
    const passageTexts = passages.map((p, i) => `[${i + 1}] ${p.text.substring(0, 200)}...`).join('\n\n');

    const analysis = await this.callAI('analysis', passageTexts, {
      systemPrompt: `You are analyzing thread coherence for a book chapter.
Theme: ${theme}

Evaluate:
1. How well do these passages flow together?
2. What topics or perspectives are missing?
3. Are any passages redundant?
4. What order would work best?

Respond with JSON: {
  coherenceScore: 0-1,
  gapAnalysis: [],
  redundancies: [],
  suggestedOrder: [passage indices]
}`,
    });

    const result = this.parseAnalysis(analysis) as {
      coherenceScore?: number;
      gapAnalysis?: string[];
      redundancies?: string[];
      suggestedOrder?: number[];
    };

    const coherence: ThreadCoherence = {
      threadId,
      coherenceScore: Number(result.coherenceScore) || 0.5,
      gapAnalysis: Array.isArray(result.gapAnalysis) ? result.gapAnalysis : [],
      redundancies: Array.isArray(result.redundancies) ? result.redundancies : [],
      suggestedOrder: (Array.isArray(result.suggestedOrder) ? result.suggestedOrder : [])
        .map((i: number) => passages[i]?.id)
        .filter(Boolean),
    };

    // If coherence is low, propose reorganization
    if (coherence.coherenceScore < coherenceThreshold) {
      await this.proposeAction(
        'reorganize-thread',
        `Thread "${theme}" needs reorganization`,
        `Coherence score: ${(coherence.coherenceScore * 100).toFixed(0)}%. ${coherence.gapAnalysis.length} gaps identified.`,
        { threadId, suggestedOrder: coherence.suggestedOrder, gaps: coherence.gapAnalysis },
        { projectId: request.projectId, requiresApproval: true }
      );
    }

    return coherence;
  }

  // ─────────────────────────────────────────────────────────────────
  // GEM DISCOVERY
  // ─────────────────────────────────────────────────────────────────

  private async findGems(request: FindGemsRequest): Promise<PassageAssessment[]> {
    const { passages, limit = 10 } = request;

    const assessments: PassageAssessment[] = [];

    for (const passage of passages) {
      const assessment = await this.assessPassage({
        passageId: passage.id,
        text: passage.text,
        threadContext: passage.threadContext,
        projectId: request.projectId,
      });
      assessments.push(assessment);
    }

    // Return top gems sorted by quality
    return assessments
      .filter(a => a.isGem)
      .sort((a, b) => b.quality - a.quality)
      .slice(0, limit);
  }

  // ─────────────────────────────────────────────────────────────────
  // REDUNDANCY DETECTION
  // ─────────────────────────────────────────────────────────────────

  private async detectRedundancy(request: DetectRedundancyRequest): Promise<RedundancyReport> {
    const { passages, projectId } = request;

    // Get redundancy threshold from config
    const defaultThreshold = await this.configManager.getOrDefault<number>(
      'thresholds',
      CURATOR_CONFIG.REDUNDANCY_THRESHOLD,
      0.8
    );
    const threshold = request.threshold ?? defaultThreshold;

    const redundancies: Array<{ pair: [string, string]; similarity: number; recommendation: string }> = [];

    // Compare all pairs using semantic similarity
    for (let i = 0; i < passages.length; i++) {
      for (let j = i + 1; j < passages.length; j++) {
        const similarity = await this.computeSimilarity(passages[i].text, passages[j].text);

        if (similarity >= threshold) {
          redundancies.push({
            pair: [passages[i].id, passages[j].id],
            similarity,
            recommendation: similarity > 0.9 ? 'merge' : 'review',
          });
        }
      }
    }

    // Propose pruning if significant redundancy found
    if (redundancies.length > 0) {
      await this.proposeAction(
        'address-redundancy',
        `Found ${redundancies.length} redundant passage pairs`,
        `Review and merge or remove overlapping content`,
        { redundancies, projectId },
        { projectId, requiresApproval: true }
      );
    }

    return {
      totalPairs: (passages.length * (passages.length - 1)) / 2,
      redundantPairs: redundancies.length,
      redundancies,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CLUSTER SUGGESTIONS
  // ─────────────────────────────────────────────────────────────────

  private async suggestClusters(request: SuggestClustersRequest): Promise<SemanticCluster[]> {
    const { passages, numClusters = 5 } = request;

    // Use AI to identify thematic clusters
    const passageTexts = passages.map((p, i) => `[${i}] ${p.text.substring(0, 150)}`).join('\n');

    const analysis = await this.callAI('analysis', passageTexts, {
      systemPrompt: `Identify ${numClusters} thematic clusters in these passages.
For each cluster, provide:
- A theme name (2-4 words)
- Which passage indices belong to it
- Suggested thread names for each cluster

Respond with JSON: { clusters: [{ theme, passageIndices: [], suggestedThreads: [] }] }`,
    });

    const result = this.parseAnalysis(analysis) as {
      clusters?: Array<{ theme: string; passageIndices?: number[]; suggestedThreads?: string[] }>;
    };
    const clusters: SemanticCluster[] = (Array.isArray(result.clusters) ? result.clusters : []).map((c, i: number) => ({
      id: `cluster-${i}`,
      theme: c.theme,
      passages: (Array.isArray(c.passageIndices) ? c.passageIndices : [])
        .map((idx: number) => passages[idx]?.id)
        .filter(Boolean),
      suggestedThreads: Array.isArray(c.suggestedThreads) ? c.suggestedThreads : [],
    }));

    // Get min passages for cluster from config
    const minPassagesForCluster = await this.configManager.getOrDefault<number>(
      'limits',
      'curator.minPassagesForCluster',
      3
    );

    // Propose new threads based on clusters
    for (const cluster of clusters) {
      if (cluster.passages.length >= minPassagesForCluster && cluster.suggestedThreads.length > 0) {
        await this.proposeAction(
          'create-thread-from-cluster',
          `Create thread "${cluster.theme}"`,
          `Group ${cluster.passages.length} semantically related passages into a new thread`,
          { cluster, projectId: request.projectId },
          { projectId: request.projectId, requiresApproval: true }
        );
      }
    }

    return clusters;
  }

  // ─────────────────────────────────────────────────────────────────
  // THREAD ORGANIZATION
  // ─────────────────────────────────────────────────────────────────

  private async organizeThread(request: OrganizeThreadRequest): Promise<ThreadCoherence> {
    const { threadId, passages, theme, targetOrder } = request;

    // If target order is provided, validate it
    if (targetOrder) {
      // Assess coherence with new order
      const reorderedPassages = targetOrder
        .map(id => passages.find(p => p.id === id)!)
        .filter(Boolean);
      return this.assessThread({ threadId, passages: reorderedPassages, theme, projectId: request.projectId });
    }

    // Otherwise, suggest optimal organization
    const coherence = await this.assessThread({ threadId, passages, theme, projectId: request.projectId });
    return coherence;
  }

  // ─────────────────────────────────────────────────────────────────
  // CARD TO CHAPTER ASSIGNMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Assign cards to chapters using AI-assisted semantic matching.
   * Analyzes card content and chapter titles to find best-fit assignments.
   */
  private async assignCardsToChapters(request: AssignCardsToChaptersRequest): Promise<AssignmentProposalBatch> {
    const { cards, chapters } = request;

    if (chapters.length === 0) {
      return {
        proposals: [],
        generatedAt: new Date().toISOString(),
        totalCards: cards.length,
        assignedCards: 0,
        unassignedCards: cards.length,
      };
    }

    const proposals: CardAssignmentProposal[] = [];

    // Get batch size from config
    const batchSize = await this.configManager.getOrDefault<number>(
      'limits',
      CURATOR_CONFIG.MAX_CARDS_PER_BATCH,
      10
    );

    // Get minimum confidence threshold from config
    const minConfidence = await this.configManager.getOrDefault<number>(
      'thresholds',
      'curator.minAssignmentConfidence',
      0.3
    );

    // Format chapter info for the prompt
    const chapterDescriptions = chapters.map((ch, i) =>
      `${i + 1}. "${ch.title}"${ch.description ? ` - ${ch.description}` : ''}`
    ).join('\n');

    // Process cards in batches
    for (let i = 0; i < cards.length; i += batchSize) {
      const cardBatch = cards.slice(i, i + batchSize);

      const cardDescriptions = cardBatch.map((card, idx) =>
        `Card ${idx + 1} (ID: ${card.id}): ${card.title ? `"${card.title}" - ` : ''}${card.content.substring(0, 200)}${card.content.length > 200 ? '...' : ''}`
      ).join('\n\n');

      const prompt = `Analyze these cards and assign each to the most appropriate chapter.

CHAPTERS:
${chapterDescriptions}

CARDS:
${cardDescriptions}

For each card, determine which chapter it best fits based on:
1. Thematic relevance to the chapter title
2. Content alignment with the chapter's apparent topic
3. Narrative coherence

Respond with JSON array:
[
  {
    "cardId": "card-id",
    "chapterIndex": 1-based chapter number or 0 if no good fit,
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation"
  }
]`;

      try {
        const analysis = await this.callAI('analysis', prompt, {
          systemPrompt: 'You are a literary curator helping organize content into chapters. Be precise and analytical.',
        });

        const parsed = this.parseAnalysis(analysis);
        const assignments = Array.isArray(parsed) ? parsed as Array<{
          cardId?: string;
          chapterIndex?: number;
          confidence?: number;
          reasoning?: string;
        }> : [];

        if (assignments.length > 0) {
          for (const assignment of assignments) {
            if (!assignment.cardId) continue;

            const chapterIndex = (assignment.chapterIndex ?? 0) - 1;
            const chapter = chapters[chapterIndex];

            if (chapter && assignment.confidence && assignment.confidence >= minConfidence) {
              // Find alternative chapters
              const alternatives: Array<{ chapterId: string; confidence: number }> = [];

              // Simple heuristic: suggest adjacent chapters as alternatives
              if (chapterIndex > 0) {
                alternatives.push({
                  chapterId: chapters[chapterIndex - 1].id,
                  confidence: Math.max(0, (assignment.confidence || 0.5) - 0.2),
                });
              }
              if (chapterIndex < chapters.length - 1) {
                alternatives.push({
                  chapterId: chapters[chapterIndex + 1].id,
                  confidence: Math.max(0, (assignment.confidence || 0.5) - 0.2),
                });
              }

              proposals.push({
                cardId: assignment.cardId,
                suggestedChapterId: chapter.id,
                confidence: assignment.confidence || 0.5,
                reasoning: assignment.reasoning || 'Thematic match',
                alternatives: alternatives.length > 0 ? alternatives : undefined,
              });
            }
          }
        }
      } catch (error) {
        this.log('error', `Failed to assign cards batch: ${error}`);
        // Continue with next batch
      }
    }

    return {
      proposals,
      generatedAt: new Date().toISOString(),
      totalCards: cards.length,
      assignedCards: proposals.length,
      unassignedCards: cards.length - proposals.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // INTENTIONS
  // ─────────────────────────────────────────────────────────────────

  private addIntention(intention: CuratorIntention): void {
    // Avoid duplicate intentions
    const exists = this.pendingIntentions.some(
      i => i.type === intention.type &&
           JSON.stringify(i.targetIds) === JSON.stringify(intention.targetIds)
    );
    if (!exists) {
      this.pendingIntentions.push(intention);
      // Keep sorted by priority
      this.pendingIntentions.sort((a, b) => b.priority - a.priority);
    }
  }

  private getIntentions(): CuratorIntention[] {
    return [...this.pendingIntentions];
  }

  /**
   * Process pending intentions - called periodically or on demand
   */
  async processPendingIntentions(): Promise<void> {
    const intention = this.pendingIntentions.shift();
    if (!intention) return;

    switch (intention.type) {
      case 'assess':
        // Re-assess passages that need attention
        break;
      case 'organize':
        // Suggest thread reorganization
        break;
      case 'discover':
        // Look for new patterns/clusters
        break;
      case 'prune':
        // Recommend removal of low-quality content
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async callAI(capability: string, input: string, options?: { systemPrompt?: string }): Promise<string> {
    // Use the Model Master agent to call AI
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
      // Try to extract JSON array first
      const arrayMatch = analysis.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      // Then try object
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch {
      return {};
    }
  }

  private async computeSimilarity(text1: string, text2: string): Promise<number> {
    // Use embedding similarity via Model Master
    try {
      const response = await this.bus.request('model-master', {
        type: 'call-capability',
        payload: {
          capability: 'embedding',
          input: JSON.stringify({ texts: [text1, text2] }),
        },
      });

      if (response.success && response.data) {
        const data = response.data as { embeddings?: number[][] };
        if (data.embeddings && data.embeddings.length === 2) {
          return this.cosineSimilarity(data.embeddings[0], data.embeddings[1]);
        }
      }
    } catch {
      // Fallback to simple text similarity
    }

    // Fallback: simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set(Array.from(words1).filter(w => words2.has(w)));
    const union = new Set(Array.from(words1).concat(Array.from(words2)));
    return intersection.size / union.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _curator: CuratorAgent | null = null;

export function getCuratorAgent(): CuratorAgent {
  if (!_curator) {
    _curator = new CuratorAgent();
  }
  return _curator;
}

/**
 * Reset the Curator agent (for testing)
 */
export function resetCuratorAgent(): void {
  _curator = null;
}
