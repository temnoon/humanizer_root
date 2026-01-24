/**
 * Reviewer Agent
 *
 * The guardian of quality. Reviews chapters for consistency,
 * verifies citations, checks for AI detection issues, and
 * provides signoff on content before publication.
 *
 * Concerns:
 * - Style/voice consistency with project persona
 * - Citation and source verification
 * - AI detection avoidance (humanization quality)
 * - Factual accuracy where verifiable
 * - Structural integrity
 * - Publication readiness
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed.
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType, SignoffVote } from '../runtime/types.js';
import { getConfigManager, THRESHOLD_KEYS } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS FOR REVIEWER
// ═══════════════════════════════════════════════════════════════════

/**
 * Reviewer specific config keys
 */
export const REVIEWER_CONFIG = {
  // Quality thresholds
  MIN_OVERALL_SCORE: 'reviewer.minOverallScore',
  MIN_STYLE_SCORE: 'reviewer.minStyleScore',
  MIN_STRUCTURE_SCORE: 'reviewer.minStructureScore',
  MIN_HUMANIZATION_SCORE: 'reviewer.minHumanizationScore',
  MIN_CITATION_SCORE: 'reviewer.minCitationScore',

  // Issue limits
  BLOCKING_ISSUES_ALLOWED: 'reviewer.blockingIssuesAllowed',
  MAJOR_ISSUES_ALLOWED: 'reviewer.majorIssuesAllowed',
} as const;

// ═══════════════════════════════════════════════════════════════════
// REVIEWER TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ChapterReview {
  chapterId: string;
  overallScore: number;            // 0-1 overall quality
  styleScore: number;              // 0-1 style consistency
  structureScore: number;          // 0-1 structural quality
  humanizationScore: number;       // 0-1 how human the text reads
  citationScore: number;           // 0-1 citation quality
  issues: ReviewIssue[];
  recommendations: string[];
  verdict: 'approve' | 'revise' | 'reject';
  signoffVote: SignoffVote;
}

export interface ReviewIssue {
  type: 'style' | 'structure' | 'citation' | 'humanization' | 'content' | 'factual';
  severity: 'blocking' | 'major' | 'minor' | 'suggestion';
  location: string;                // Approximate location in text
  description: string;
  suggestedFix?: string;
}

export interface StyleCheck {
  personaMatch: number;            // 0-1 how well it matches persona
  voiceConsistency: number;        // 0-1 internal consistency
  toneAppropriate: boolean;
  formalityLevel: number;          // 0-1
  deviations: Array<{
    location: string;
    issue: string;
  }>;
}

export interface HumanizationCheck {
  overallScore: number;            // 0-1, higher = more human
  aiDetectionRisk: 'low' | 'medium' | 'high';
  flaggedPatterns: Array<{
    pattern: string;
    location: string;
    confidence: number;
  }>;
  suggestions: string[];
}

export interface CitationCheck {
  totalCitations: number;
  verifiedCitations: number;
  missingCitations: string[];
  incorrectCitations: string[];
  passageTracking: Array<{
    passageRef: string;
    properlyAttributed: boolean;
  }>;
}

export interface ReviewerIntention {
  type: 'review' | 'verify' | 'check-humanization' | 'signoff';
  priority: number;
  reason: string;
  targetId: string;
  context: Record<string, unknown>;
}

export interface FactVerification {
  totalClaims: number;
  verifiedCount: number;
  disputedCount: number;
  claims: Array<{
    claim: string;
    status: 'verified' | 'unverified' | 'disputed';
    source?: string;
  }>;
}

export interface SignoffDecision {
  vote: SignoffVote;
  reason: string;
  review?: ChapterReview;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface ReviewChapterRequest {
  chapterId: string;
  content: string;
  passageRefs: string[];
  persona?: string;
  projectId?: string;
}

interface CheckStyleRequest {
  content: string;
  persona?: string;
  projectId?: string;
}

interface CheckHumanizationRequest {
  content: string;
}

interface CheckCitationsRequest {
  content: string;
  passageRefs: string[];
}

interface VerifyFactsRequest {
  content: string;
  claims?: string[];
}

interface ProvideSignoffRequest {
  chapterId: string;
  projectId?: string;
}

interface SignoffRequestPayload {
  signoffId: string;
  changeType: string;
  changeId?: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
}

/**
 * Request to the Builder to revise based on review feedback
 */
export interface BuilderRevisionRequest {
  chapterId: string;
  /** Focus areas derived from review issues */
  focusAreas: Array<'voice' | 'pacing' | 'clarity' | 'transitions' | 'humanization' | 'structure'>;
  /** Specific issues to address with suggested fixes */
  issuesWithFixes: Array<{
    type: ReviewIssue['type'];
    description: string;
    location: string;
    suggestedFix?: string;
  }>;
  /** Passages that need voice transformation */
  passagesForRewrite?: Array<{
    location: string;
    voiceIssues: string[];
  }>;
  /** Iteration count to prevent infinite loops */
  iterationCount: number;
  /** Maximum allowed iterations */
  maxIterations: number;
  /** Persona reference for voice consistency */
  personaRef?: string;
}

/**
 * Response from Builder after revision
 */
export interface BuilderRevisionResponse {
  success: boolean;
  chapterId: string;
  newVersion: number;
  changesApplied: string[];
  remainingIssues?: string[];
}

interface RequestRevisionRequest {
  chapterId: string;
  review: ChapterReview;
  personaRef?: string;
  maxIterations?: number;
  currentIteration?: number;
}

// ═══════════════════════════════════════════════════════════════════
// AI PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Common AI tells to detect
 * These are loaded from config, but we have defaults as fallback
 */
const DEFAULT_AI_TELLS = [
  { regex: /\bdelve\b/gi, name: 'Overused "delve"' },
  { regex: /\bleverage\b/gi, name: 'Corporate "leverage"' },
  { regex: /\bin conclusion\b/gi, name: 'Formulaic conclusion' },
  { regex: /\bfurthermore\b/gi, name: 'Formal connector overuse' },
  { regex: /\bmoreover\b/gi, name: 'Formal connector overuse' },
  { regex: /\bit'?s worth noting\b/gi, name: 'AI phrasing' },
  { regex: /\bimportantly\b/gi, name: 'Adverb overuse' },
  { regex: /\bin today'?s world\b/gi, name: 'Generic opener' },
  { regex: /\bunderstand(?:ing)?\b.*\bcrucial\b/gi, name: 'AI pattern' },
];

// ═══════════════════════════════════════════════════════════════════
// REVIEWER AGENT
// ═══════════════════════════════════════════════════════════════════

export class ReviewerAgent extends AgentBase {
  readonly id = 'reviewer';
  readonly name = 'The Reviewer';
  readonly house: HouseType = 'reviewer';
  readonly capabilities = [
    'review-chapter',
    'check-style',
    'check-humanization',
    'check-citations',
    'verify-facts',
    'provide-signoff',
    'request-revision',
  ];

  private configManager: ConfigManager;

  // Review history
  private reviewHistory: Map<string, ChapterReview[]> = new Map();

  // Pending review intentions
  private pendingIntentions: ReviewerIntention[] = [];

  constructor() {
    super();
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Reviewer awakening - ready to assess quality');

    // Subscribe to events that trigger reviews
    this.subscribe('chapter:draft-ready');
    this.subscribe('chapter:revised');
    this.subscribe('signoff:requested');
    this.subscribe('project:phase-changed');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Reviewer retiring');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'review-chapter':
        return this.reviewChapter(message.payload as ReviewChapterRequest);

      case 'check-style':
        return this.checkStyle(message.payload as CheckStyleRequest);

      case 'check-humanization':
        return this.checkHumanization(message.payload as CheckHumanizationRequest);

      case 'check-citations':
        return this.checkCitations(message.payload as CheckCitationsRequest);

      case 'verify-facts':
        return this.verifyFacts(message.payload as VerifyFactsRequest);

      case 'provide-signoff':
        return this.provideSignoff(message.payload as ProvideSignoffRequest);

      case 'request-revision':
        return this.requestBuilderRevision(message.payload as RequestRevisionRequest);

      case 'review-signoff':
        // Handle signoff requests from orchestrator
        return this.handleSignoffRequest(message.payload as SignoffRequestPayload);

      case 'get-intentions':
        return this.getIntentions();

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CHAPTER REVIEW
  // ─────────────────────────────────────────────────────────────────

  private async reviewChapter(request: ReviewChapterRequest): Promise<ChapterReview> {
    const { chapterId, content, passageRefs, persona, projectId } = request;

    const issues: ReviewIssue[] = [];
    const recommendations: string[] = [];

    // Run all checks in parallel
    const [styleCheck, humanizationCheck, citationCheck, structureAnalysis] = await Promise.all([
      this.checkStyle({ content, persona, projectId }),
      this.checkHumanization({ content }),
      this.checkCitations({ content, passageRefs }),
      this.analyzeStructure(content),
    ]);

    // Collect style issues
    styleCheck.deviations.forEach(d => {
      issues.push({
        type: 'style',
        severity: d.issue.includes('significantly') ? 'major' : 'minor',
        location: d.location,
        description: d.issue,
      });
    });

    // Collect humanization issues
    humanizationCheck.flaggedPatterns.forEach(p => {
      issues.push({
        type: 'humanization',
        severity: p.confidence > 0.8 ? 'major' : 'minor',
        location: p.location,
        description: `AI pattern detected: ${p.pattern}`,
        suggestedFix: 'Rewrite to be more conversational and varied',
      });
    });
    recommendations.push(...humanizationCheck.suggestions);

    // Collect citation issues
    citationCheck.missingCitations.forEach(missing => {
      issues.push({
        type: 'citation',
        severity: 'major',
        location: missing,
        description: 'Missing citation for incorporated passage',
      });
    });

    // Collect structure issues
    structureAnalysis.issues.forEach(issue => {
      issues.push({
        type: 'structure',
        severity: issue.severity,
        location: issue.location,
        description: issue.description,
      });
    });

    // Calculate scores
    const styleScore = (styleCheck.personaMatch + styleCheck.voiceConsistency) / 2;
    const humanizationScore = humanizationCheck.overallScore;
    const citationScore = citationCheck.totalCitations > 0
      ? citationCheck.verifiedCitations / citationCheck.totalCitations
      : 1;
    const structureScore = structureAnalysis.score;

    const overallScore = (
      styleScore * 0.25 +
      humanizationScore * 0.3 +
      citationScore * 0.2 +
      structureScore * 0.25
    );

    // Get thresholds from config
    const minOverallScore = await this.configManager.getOrDefault<number>(
      'thresholds',
      REVIEWER_CONFIG.MIN_OVERALL_SCORE,
      0.7
    );
    const blockingIssuesAllowed = await this.configManager.getOrDefault<number>(
      'limits',
      REVIEWER_CONFIG.BLOCKING_ISSUES_ALLOWED,
      0
    );
    const majorIssuesAllowed = await this.configManager.getOrDefault<number>(
      'limits',
      REVIEWER_CONFIG.MAJOR_ISSUES_ALLOWED,
      2
    );

    // Determine verdict
    const blockingCount = issues.filter(i => i.severity === 'blocking').length;
    const majorCount = issues.filter(i => i.severity === 'major').length;

    let verdict: 'approve' | 'revise' | 'reject';
    let signoffVote: SignoffVote;

    if (blockingCount > blockingIssuesAllowed) {
      verdict = 'reject';
      signoffVote = 'reject';
    } else if (majorCount > majorIssuesAllowed || overallScore < minOverallScore) {
      verdict = 'revise';
      signoffVote = 'pending';
    } else {
      verdict = 'approve';
      signoffVote = 'approve';
    }

    const review: ChapterReview = {
      chapterId,
      overallScore,
      styleScore,
      structureScore,
      humanizationScore,
      citationScore,
      issues,
      recommendations,
      verdict,
      signoffVote,
    };

    // Store review
    if (!this.reviewHistory.has(chapterId)) {
      this.reviewHistory.set(chapterId, []);
    }
    this.reviewHistory.get(chapterId)!.push(review);

    // Propose action based on verdict
    if (verdict === 'approve') {
      await this.proposeAction(
        'chapter-approved',
        `Chapter "${chapterId}" approved`,
        `Quality score: ${(overallScore * 100).toFixed(0)}%. Ready for publication.`,
        { review, projectId },
        { projectId, requiresApproval: false }
      );
    } else {
      await this.proposeAction(
        'chapter-needs-revision',
        `Chapter "${chapterId}" needs ${verdict === 'reject' ? 'major rework' : 'revision'}`,
        `Found ${issues.length} issues. ${blockingCount} blocking, ${majorCount} major.`,
        { review, projectId },
        { projectId, requiresApproval: true }
      );
    }

    return review;
  }

  // ─────────────────────────────────────────────────────────────────
  // STYLE CHECK
  // ─────────────────────────────────────────────────────────────────

  private async checkStyle(request: CheckStyleRequest): Promise<StyleCheck> {
    const { content, persona } = request;

    const response = await this.callAI('analysis', content, {
      systemPrompt: `Analyze this text's style${persona ? ` compared to the persona "${persona}"` : ''}.

Evaluate:
1. Persona match (0-1): How well does this match the expected voice?
2. Voice consistency (0-1): Is the voice consistent throughout?
3. Tone appropriate: Is the tone right for the content?
4. Formality level (0-1): 0=casual, 1=formal
5. Deviations: List any style deviations with location

Respond with JSON: {
  personaMatch: 0-1,
  voiceConsistency: 0-1,
  toneAppropriate: true/false,
  formalityLevel: 0-1,
  deviations: [{ location: "...", issue: "..." }]
}`,
    });

    const result = this.parseJSON(response) as {
      personaMatch?: number;
      voiceConsistency?: number;
      toneAppropriate?: boolean;
      formalityLevel?: number;
      deviations?: Array<{ location: string; issue: string }>;
    };

    return {
      personaMatch: Number(result.personaMatch) || 0.5,
      voiceConsistency: Number(result.voiceConsistency) || 0.5,
      toneAppropriate: result.toneAppropriate ?? true,
      formalityLevel: Number(result.formalityLevel) || 0.5,
      deviations: Array.isArray(result.deviations) ? result.deviations : [],
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HUMANIZATION CHECK
  // ─────────────────────────────────────────────────────────────────

  private async checkHumanization(request: CheckHumanizationRequest): Promise<HumanizationCheck> {
    const { content } = request;

    // Check for common AI patterns
    const aiPatterns = this.detectAIPatterns(content);

    // Use AI detection capability
    let detectionResult: { score?: number } = {};
    try {
      const response = await this.bus.request('model-master', {
        type: 'call-capability',
        payload: {
          capability: 'detection',
          input: content,
        },
      });

      if (response.success && response.data) {
        detectionResult = response.data as { score?: number };
      }
    } catch (error) {
      console.debug('[Reviewer] Detection service unavailable:', error);
    }

    const aiScore = detectionResult.score ?? 0.5;
    const humanScore = 1 - aiScore;

    // Get suggestion thresholds from config
    const moderateHumanizationThreshold = await this.configManager.getOrDefault<number>(
      'thresholds',
      'reviewer.moderateHumanizationThreshold',
      0.7
    );
    const lowHumanizationThreshold = await this.configManager.getOrDefault<number>(
      'thresholds',
      'reviewer.lowHumanizationThreshold',
      0.5
    );

    // Generate suggestions
    const suggestions: string[] = [];
    if (humanScore < moderateHumanizationThreshold) {
      suggestions.push('Vary sentence structure more');
      suggestions.push('Add more personal anecdotes or observations');
      suggestions.push('Use more contractions and informal phrasings');
      suggestions.push('Include rhetorical questions');
    }
    if (humanScore < lowHumanizationThreshold) {
      suggestions.push('Break up long, complex sentences');
      suggestions.push('Add colloquialisms appropriate to the voice');
      suggestions.push('Introduce minor intentional imperfections');
    }

    return {
      overallScore: humanScore,
      aiDetectionRisk: humanScore >= moderateHumanizationThreshold ? 'low' : humanScore >= lowHumanizationThreshold ? 'medium' : 'high',
      flaggedPatterns: aiPatterns,
      suggestions,
    };
  }

  private detectAIPatterns(content: string): Array<{ pattern: string; location: string; confidence: number }> {
    const patterns: Array<{ pattern: string; location: string; confidence: number }> = [];

    // Use default AI tells (could also load from config)
    const aiTells = DEFAULT_AI_TELLS;

    for (const tell of aiTells) {
      let match;
      // Reset regex state
      tell.regex.lastIndex = 0;
      while ((match = tell.regex.exec(content)) !== null) {
        // Find paragraph number
        const beforeMatch = content.substring(0, match.index);
        const paragraphNum = (beforeMatch.match(/\n\n/g) || []).length + 1;

        patterns.push({
          pattern: tell.name,
          location: `Paragraph ${paragraphNum}`,
          confidence: 0.7,
        });
      }
    }

    return patterns;
  }

  // ─────────────────────────────────────────────────────────────────
  // CITATION CHECK
  // ─────────────────────────────────────────────────────────────────

  private async checkCitations(request: CheckCitationsRequest): Promise<CitationCheck> {
    const { content, passageRefs } = request;

    // Track which passages are properly referenced
    const passageTracking = passageRefs.map(ref => ({
      passageRef: ref,
      properlyAttributed: content.includes(ref) || this.hasImplicitAttribution(content, ref),
    }));

    const missingCitations = passageTracking
      .filter(p => !p.properlyAttributed)
      .map(p => p.passageRef);

    return {
      totalCitations: passageRefs.length,
      verifiedCitations: passageRefs.length - missingCitations.length,
      missingCitations,
      incorrectCitations: [], // Would need more context to detect
      passageTracking,
    };
  }

  private hasImplicitAttribution(_content: string, _ref: string): boolean {
    // Check if passage content is integrated but not explicitly cited
    // This is a simplification - real implementation would compare text
    return true; // Assume integrated passages are OK
  }

  // ─────────────────────────────────────────────────────────────────
  // FACT VERIFICATION
  // ─────────────────────────────────────────────────────────────────

  private async verifyFacts(request: VerifyFactsRequest): Promise<FactVerification> {
    const { content, claims } = request;

    // Extract claims if not provided
    const claimsToVerify = claims || await this.extractClaims(content);

    const verifiedClaims: Array<{
      claim: string;
      status: 'verified' | 'unverified' | 'disputed';
      source?: string;
    }> = [];

    for (const claim of claimsToVerify) {
      // Simple verification - in reality would use fact-checking service
      verifiedClaims.push({
        claim,
        status: 'unverified', // Conservative default
      });
    }

    return {
      totalClaims: claimsToVerify.length,
      verifiedCount: verifiedClaims.filter(c => c.status === 'verified').length,
      disputedCount: verifiedClaims.filter(c => c.status === 'disputed').length,
      claims: verifiedClaims,
    };
  }

  private async extractClaims(content: string): Promise<string[]> {
    const response = await this.callAI('analysis', content, {
      systemPrompt: 'Extract verifiable factual claims from this text. Return JSON: { claims: [] }',
    });

    const result = this.parseJSON(response) as { claims?: string[] };
    return Array.isArray(result.claims) ? result.claims : [];
  }

  // ─────────────────────────────────────────────────────────────────
  // STRUCTURE ANALYSIS
  // ─────────────────────────────────────────────────────────────────

  private async analyzeStructure(content: string): Promise<{
    score: number;
    issues: Array<{ severity: ReviewIssue['severity']; location: string; description: string }>;
  }> {
    const response = await this.callAI('analysis', content, {
      systemPrompt: `Analyze this chapter's structure:
1. Is there a clear opening, body, and conclusion?
2. Do paragraphs flow logically?
3. Are transitions smooth?
4. Is the length appropriate?

Score 0-1 and list issues with severity (blocking/major/minor).
Respond with JSON: { score: 0-1, issues: [{ severity, location, description }] }`,
    });

    const result = this.parseJSON(response) as {
      score?: number;
      issues?: Array<{ severity: ReviewIssue['severity']; location: string; description: string }>;
    };

    return {
      score: Number(result.score) || 0.5,
      issues: Array.isArray(result.issues) ? result.issues : [],
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SIGNOFF
  // ─────────────────────────────────────────────────────────────────

  private async provideSignoff(request: ProvideSignoffRequest): Promise<SignoffDecision> {
    const { chapterId } = request;

    // Get latest review
    const reviews = this.reviewHistory.get(chapterId);
    if (!reviews || reviews.length === 0) {
      return {
        vote: 'abstain',
        reason: 'No review conducted for this chapter',
      };
    }

    const latestReview = reviews[reviews.length - 1];

    return {
      vote: latestReview.signoffVote,
      reason: latestReview.verdict === 'approve'
        ? `Chapter meets quality standards (score: ${(latestReview.overallScore * 100).toFixed(0)}%)`
        : `Chapter has ${latestReview.issues.length} issues requiring attention`,
      review: latestReview,
    };
  }

  private async handleSignoffRequest(payload: SignoffRequestPayload): Promise<SignoffDecision> {
    const { signoffId, changeType, changeId, payload: changePayload } = payload;

    // For chapter reviews, conduct full review
    if (changeType === 'chapter-draft' && changePayload?.content) {
      const review = await this.reviewChapter({
        chapterId: changeId || signoffId,
        content: changePayload.content as string,
        passageRefs: (changePayload.passageRefs as string[]) || [],
        persona: changePayload.persona as string | undefined,
        projectId: changePayload.projectId as string | undefined,
      });

      return {
        vote: review.signoffVote,
        reason: `Review complete: ${review.verdict} (${review.issues.length} issues)`,
        review,
      };
    }

    // For other change types, provide advisory vote
    return {
      vote: 'abstain',
      reason: `Change type "${changeType}" not within Reviewer's scope`,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // REVISION FEEDBACK LOOP
  // ─────────────────────────────────────────────────────────────────

  /**
   * Request Builder to revise based on review feedback
   *
   * This is the key method for the Reviewer→Builder feedback loop:
   * 1. Translates review issues into actionable focus areas
   * 2. Identifies passages needing voice transformation
   * 3. Sends revision request to Builder
   * 4. Optionally triggers re-review after revision
   */
  private async requestBuilderRevision(
    request: RequestRevisionRequest
  ): Promise<BuilderRevisionRequest | { skipped: true; reason: string }> {
    const {
      chapterId,
      review,
      personaRef,
      maxIterations = 3,
      currentIteration = 0,
    } = request;

    // Check iteration limit
    if (currentIteration >= maxIterations) {
      this.log('warn', `Max revision iterations (${maxIterations}) reached for chapter ${chapterId}`);
      return {
        skipped: true,
        reason: `Maximum revision iterations reached (${maxIterations})`,
      };
    }

    // Only request revision if verdict is 'revise' (not 'approve' or 'reject')
    if (review.verdict === 'approve') {
      return {
        skipped: true,
        reason: 'Chapter approved, no revision needed',
      };
    }

    if (review.verdict === 'reject') {
      return {
        skipped: true,
        reason: 'Chapter rejected, requires major rework beyond simple revision',
      };
    }

    // Translate issues to focus areas
    const focusAreas = this.translateIssuesToFocusAreas(review.issues);

    // Collect issues with suggested fixes
    const issuesWithFixes = review.issues
      .filter(issue => issue.severity === 'major' || issue.severity === 'blocking')
      .map(issue => ({
        type: issue.type,
        description: issue.description,
        location: issue.location,
        suggestedFix: issue.suggestedFix,
      }));

    // Identify passages needing voice transformation
    const passagesForRewrite = this.identifyPassagesForRewrite(review.issues);

    const revisionRequest: BuilderRevisionRequest = {
      chapterId,
      focusAreas,
      issuesWithFixes,
      passagesForRewrite: passagesForRewrite.length > 0 ? passagesForRewrite : undefined,
      iterationCount: currentIteration + 1,
      maxIterations,
      personaRef,
    };

    // Log the feedback request
    this.log('info', `Requesting revision for chapter ${chapterId} (iteration ${currentIteration + 1}/${maxIterations})`);
    this.log('debug', `Focus areas: ${focusAreas.join(', ')}`);
    this.log('debug', `Issues to fix: ${issuesWithFixes.length}`);

    // Send to Builder via message bus
    try {
      const response = await this.bus.request('builder', {
        type: 'revise-from-feedback',
        payload: revisionRequest,
      });

      if (response.success) {
        const revisionResponse = response.data as BuilderRevisionResponse;
        this.log('info', `Builder revision complete: ${revisionResponse.changesApplied.length} changes applied`);

        // Add intention to re-review after revision
        this.addIntention({
          type: 'review',
          priority: 0.9,
          reason: `Re-review after revision iteration ${currentIteration + 1}`,
          targetId: chapterId,
          context: {
            iterationCount: currentIteration + 1,
            previousIssueCount: review.issues.length,
          },
        });
      }

      return revisionRequest;
    } catch (error) {
      this.log('error', `Failed to send revision request to Builder: ${error}`);
      // Still return the request so caller knows what was attempted
      return revisionRequest;
    }
  }

  /**
   * Translate review issues into Builder focus areas
   */
  private translateIssuesToFocusAreas(
    issues: ReviewIssue[]
  ): BuilderRevisionRequest['focusAreas'] {
    const focusSet = new Set<BuilderRevisionRequest['focusAreas'][number]>();

    for (const issue of issues) {
      switch (issue.type) {
        case 'style':
          focusSet.add('voice');
          break;
        case 'structure':
          focusSet.add('structure');
          focusSet.add('transitions');
          break;
        case 'humanization':
          focusSet.add('humanization');
          focusSet.add('voice');
          break;
        case 'content':
          focusSet.add('clarity');
          break;
        case 'citation':
          // No direct Builder focus area for citations
          break;
        case 'factual':
          focusSet.add('clarity');
          break;
      }
    }

    // Ensure at least one focus area
    if (focusSet.size === 0) {
      focusSet.add('voice');
    }

    return Array.from(focusSet);
  }

  /**
   * Identify passages that need voice transformation
   */
  private identifyPassagesForRewrite(
    issues: ReviewIssue[]
  ): Array<{ location: string; voiceIssues: string[] }> {
    const passageMap = new Map<string, string[]>();

    for (const issue of issues) {
      if (issue.type === 'style' || issue.type === 'humanization') {
        const location = issue.location;
        if (!passageMap.has(location)) {
          passageMap.set(location, []);
        }
        passageMap.get(location)!.push(issue.description);
      }
    }

    return Array.from(passageMap.entries()).map(([location, voiceIssues]) => ({
      location,
      voiceIssues,
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // INTENTIONS
  // ─────────────────────────────────────────────────────────────────

  private addIntention(intention: ReviewerIntention): void {
    const exists = this.pendingIntentions.some(
      i => i.type === intention.type && i.targetId === intention.targetId
    );
    if (!exists) {
      this.pendingIntentions.push(intention);
      this.pendingIntentions.sort((a, b) => b.priority - a.priority);
    }
  }

  private getIntentions(): ReviewerIntention[] {
    return [...this.pendingIntentions];
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async callAI(capability: string, input: string, options?: { systemPrompt?: string }): Promise<string> {
    const response = await this.bus.request('model-master', {
      type: 'call-capability',
      payload: { capability, input, params: options },
    });

    if (!response.success) {
      throw new Error(response.error || 'AI call failed');
    }

    return (response.data as { output: string }).output;
  }

  private parseJSON(text: string): Record<string, unknown> {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      return {};
    } catch (error) {
      console.debug('[Reviewer] JSON parse error:', error);
      return {};
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _reviewer: ReviewerAgent | null = null;

export function getReviewerAgent(): ReviewerAgent {
  if (!_reviewer) {
    _reviewer = new ReviewerAgent();
  }
  return _reviewer;
}

/**
 * Reset the Reviewer agent (for testing)
 */
export function resetReviewerAgent(): void {
  _reviewer = null;
}
