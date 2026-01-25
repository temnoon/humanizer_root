/**
 * Builder Agent
 *
 * The composer of chapters. Takes curated passages and weaves them
 * into coherent narrative chapters, maintaining voice consistency
 * and structural integrity.
 *
 * Concerns:
 * - Chapter structure and flow
 * - Voice/style consistency with persona
 * - Passage integration (transitions, bridges)
 * - Narrative arc within chapters
 * - Length and pacing
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed.
 *
 * Implementation files:
 * - ./types.ts - Type definitions
 * - ./config.ts - Configuration keys
 * - ./persona-utils.ts - Persona/style merging and prompt building
 * - ./rewriting-utils.ts - Change detection and validation
 * - ./revision-utils.ts - Revision helpers
 *
 * @module @humanizer/core/houses/builder
 */

import { AgentBase } from '../../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../../runtime/types.js';
import { getConfigManager } from '../../config/index.js';
import type { ConfigManager } from '../../config/types.js';

// Import from modular files
import { BUILDER_CONFIG } from './config.js';
import {
  buildPersonaSystemPrompt,
  buildRewritePrompt,
  buildFocusedRevisionPrompt,
} from './persona-utils.js';
import {
  detectChanges,
  checkForbiddenPhrases,
  calculateRewriteConfidence,
  detectLeakedPhrases,
} from './rewriting-utils.js';
import {
  extractTextAtLocation,
  detectNarrativeArc,
  calculatePacingScore,
  createFallbackPersona,
} from './revision-utils.js';

// Re-export types and utilities
export * from './types.js';
export * from './config.js';
export { mergePersonaWithStyle } from './persona-utils.js';

// Import types for internal use
import type {
  ChapterDraft,
  ChapterStructure,
  StyleAnalysis,
  CompositionPlan,
  PassageForComposition,
  BuilderIntention,
  ChapterOutline,
  TransitionResult,
  StructureAnalysis,
  ImprovementSuggestion,
  CreateOutlineRequest,
  WriteTransitionsRequest,
  AnalyzeStructureRequest,
  ReviseDraftRequest,
  SuggestImprovementsRequest,
  RewriteForPersonaRequest,
  PersonaProfileForRewrite,
  RewriteResult,
  MultiPassRewriteOptions,
  BatchRewriteRequest,
  ReviseFromFeedbackRequest,
  RevisionResponse,
  ComposeSectionRequest,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// BUILDER AGENT
// ═══════════════════════════════════════════════════════════════════

export class BuilderAgent extends AgentBase {
  readonly id = 'builder';
  readonly name = 'The Builder';
  readonly house: HouseType = 'builder';
  readonly capabilities = [
    'compose-chapter',
    'create-outline',
    'write-transitions',
    'analyze-structure',
    'revise-draft',
    'suggest-improvements',
    'rewrite-for-persona',
    'batch-rewrite-for-persona',
    'revise-from-feedback',
  ];

  private configManager: ConfigManager;

  // Draft history for revision
  private draftHistory: Map<string, ChapterDraft[]> = new Map();

  // Pending building intentions
  private pendingIntentions: BuilderIntention[] = [];

  constructor() {
    super();
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Builder awakening - ready to compose');

    // Subscribe to relevant events
    this.subscribe('content:thread-updated');
    this.subscribe('content:passage-curated');
    this.subscribe('project:phase-changed');
    this.subscribe('chapter:review-complete');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Builder retiring');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'compose-chapter':
        return this.composeChapter(message.payload as CompositionPlan);

      case 'create-outline':
        return this.createOutline(message.payload as CreateOutlineRequest);

      case 'write-transitions':
        return this.writeTransitions(message.payload as WriteTransitionsRequest);

      case 'analyze-structure':
        return this.analyzeStructure(message.payload as AnalyzeStructureRequest);

      case 'revise-draft':
        return this.reviseDraft(message.payload as ReviseDraftRequest);

      case 'suggest-improvements':
        return this.suggestImprovements(message.payload as SuggestImprovementsRequest);

      case 'rewrite-for-persona':
        return this.rewriteForPersona(message.payload as RewriteForPersonaRequest);

      case 'batch-rewrite-for-persona':
        return this.batchRewriteForPersona(message.payload as BatchRewriteRequest);

      case 'revise-from-feedback':
        return this.reviseFromFeedback(message.payload as ReviseFromFeedbackRequest);

      case 'get-intentions':
        return this.getIntentions();

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CHAPTER COMPOSITION
  // ─────────────────────────────────────────────────────────────────

  private async composeChapter(plan: CompositionPlan): Promise<ChapterDraft> {
    const { chapterId, title, theme, passages, targetLength, styleGuidelines, personaRef } = plan;

    // Step 1: Create outline
    const outline = await this.createOutline({
      passages,
      theme,
      targetLength,
    });

    // Step 2: Compose each section
    const sections: ChapterStructure['sections'] = [];
    let fullContent = '';

    for (let i = 0; i < outline.sections.length; i++) {
      const section = outline.sections[i];
      const sectionPassages = section.passageIds.map(id =>
        passages.find(p => p.id === id)!
      ).filter(Boolean);

      // Generate the section content
      const sectionContent = await this.composeSectionContent({
        type: section.type,
        passages: sectionPassages,
        theme,
        styleGuidelines,
        personaRef,
        isFirst: i === 0,
        isLast: i === outline.sections.length - 1,
      });

      // Write transition if not the first section
      let bridgeText: string | undefined;
      if (i > 0) {
        bridgeText = await this.generateTransition(
          sections[sections.length - 1],
          sectionContent,
          theme
        );
        fullContent += '\n\n' + bridgeText + '\n\n';
      }

      fullContent += sectionContent;

      sections.push({
        type: section.type,
        passageRefs: section.passageIds,
        bridgeText,
        wordCount: sectionContent.split(/\s+/).length,
      });
    }

    // Step 3: Analyze the result
    const styleAnalysis = await this.analyzeStyle(fullContent, personaRef);
    const narrativeArc = detectNarrativeArc(sections);
    const pacingScore = calculatePacingScore(sections);

    const draft: ChapterDraft = {
      id: chapterId,
      title,
      content: fullContent,
      passageRefs: passages.map(p => p.id),
      wordCount: fullContent.split(/\s+/).length,
      structure: {
        sections,
        narrativeArc,
        pacingScore,
      },
      styleAnalysis,
      version: 1,
    };

    // Store in history
    if (!this.draftHistory.has(chapterId)) {
      this.draftHistory.set(chapterId, []);
    }
    this.draftHistory.get(chapterId)!.push(draft);

    // Get thresholds from config
    const voiceConsistencyThreshold = await this.configManager.getOrDefault<number>(
      'thresholds',
      BUILDER_CONFIG.VOICE_CONSISTENCY_THRESHOLD,
      0.6
    );
    const targetPacingScore = await this.configManager.getOrDefault<number>(
      'thresholds',
      BUILDER_CONFIG.TARGET_PACING_SCORE,
      0.7
    );

    // Check if draft needs improvement
    if (styleAnalysis.voiceConsistency < voiceConsistencyThreshold) {
      this.addIntention({
        type: 'revise',
        priority: 0.8,
        reason: `Voice consistency (${(styleAnalysis.voiceConsistency * 100).toFixed(0)}%) below threshold`,
        targetChapterId: chapterId,
        context: { styleAnalysis },
      });
    }

    if (pacingScore < targetPacingScore) {
      this.addIntention({
        type: 'restructure',
        priority: 0.6,
        reason: `Pacing score (${(pacingScore * 100).toFixed(0)}%) could be improved`,
        targetChapterId: chapterId,
        context: { sections },
      });
    }

    // Propose the draft for review
    const projectId = plan.chapterId.split('-')[0];
    await this.proposeAction(
      'chapter-draft-ready',
      `Chapter "${title}" draft complete`,
      `${draft.wordCount} words composed from ${passages.length} passages. Ready for review.`,
      { draft, projectId },
      { projectId, requiresApproval: true }
    );

    return draft;
  }

  // ─────────────────────────────────────────────────────────────────
  // OUTLINE CREATION
  // ─────────────────────────────────────────────────────────────────

  private async createOutline(request: CreateOutlineRequest): Promise<ChapterOutline> {
    const { passages, theme, targetLength } = request;

    // Use AI to create optimal structure
    const passageInfo = passages.map((p, i) =>
      `[${i}:${p.id}] (${p.role}) ${p.text.substring(0, 150)}...`
    ).join('\n');

    const response = await this.callAI('analysis', passageInfo, {
      systemPrompt: `You are structuring a book chapter about "${theme}".
Given these passages with their roles (anchor=main point, supporting=evidence, contrast=counterpoint, evidence=data),
create an optimal chapter outline.

Target length: ~${targetLength} words

Respond with JSON: {
  sections: [
    { type: "opening"|"body"|"transition"|"conclusion", passageIds: [], purpose: "brief description" }
  ],
  suggestedTitle: "chapter title"
}

Ensure logical flow and narrative arc.`,
    });

    const result = this.parseJSON(response) as {
      sections?: Array<{ type: string; passageIds?: string[]; purpose?: string }>;
      suggestedTitle?: string;
    };
    const sections = (Array.isArray(result.sections) ? result.sections : []).map((s) => ({
      type: s.type as 'opening' | 'body' | 'transition' | 'conclusion',
      passageIds: Array.isArray(s.passageIds) ? s.passageIds : [],
      purpose: s.purpose || '',
    }));

    return {
      theme,
      sections,
      suggestedTitle: String(result.suggestedTitle || theme),
      estimatedLength: targetLength,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SECTION COMPOSITION
  // ─────────────────────────────────────────────────────────────────

  private async composeSectionContent(request: ComposeSectionRequest): Promise<string> {
    const { type, passages, theme, styleGuidelines, personaRef, isFirst, isLast } = request;

    if (passages.length === 0) {
      return '';
    }

    // Combine passage texts with integration guidance
    const passageTexts = passages.map(p => p.text).join('\n\n---\n\n');

    let prompt: string;
    switch (type) {
      case 'opening':
        prompt = `Write an engaging opening that introduces the theme "${theme}" using these passages as source material. Draw the reader in.`;
        break;
      case 'body':
        prompt = `Weave these passages into coherent body paragraphs about "${theme}". Maintain flow and integrate smoothly.`;
        break;
      case 'transition':
        prompt = `Create a transitional section that bridges ideas about "${theme}". Use these passages to shift focus naturally.`;
        break;
      case 'conclusion':
        prompt = `Write a satisfying conclusion for the chapter about "${theme}". Synthesize key insights from these passages.`;
        break;
    }

    const systemPrompt = `You are a skilled writer composing a book chapter.
${styleGuidelines ? `Style guidelines: ${styleGuidelines}` : ''}
${personaRef ? `Writing as: ${personaRef}` : ''}
${isFirst ? 'This is the chapter opening - make it compelling.' : ''}
${isLast ? 'This is the chapter ending - provide closure.' : ''}

Integrate the source passages naturally. Preserve their core ideas but improve flow.
Write in a consistent voice. Output only the composed text, no meta-commentary.`;

    const response = await this.callAI('creative', `${prompt}\n\nSource passages:\n${passageTexts}`, {
      systemPrompt,
    });

    return response;
  }

  // ─────────────────────────────────────────────────────────────────
  // TRANSITIONS
  // ─────────────────────────────────────────────────────────────────

  private async writeTransitions(request: WriteTransitionsRequest): Promise<TransitionResult[]> {
    const { sections, theme } = request;
    const transitions: TransitionResult[] = [];

    for (let i = 0; i < sections.length - 1; i++) {
      const from = sections[i];
      const to = sections[i + 1];

      const bridge = await this.generateTransition(
        { passageRefs: [from.endingPassageId], type: 'body', wordCount: 0 },
        to.openingText,
        theme
      );

      transitions.push({
        fromSectionIndex: i,
        toSectionIndex: i + 1,
        bridgeText: bridge,
      });
    }

    return transitions;
  }

  private async generateTransition(
    _fromSection: ChapterStructure['sections'][0],
    toContent: string,
    theme: string
  ): Promise<string> {
    // Get max bridge length from config
    const maxBridgeLength = await this.configManager.getOrDefault<number>(
      'limits',
      BUILDER_CONFIG.MAX_BRIDGE_LENGTH,
      200
    );

    const prompt = `Write a brief transition (1-2 sentences) that bridges from one section to the next in a chapter about "${theme}".
The transition should feel natural and maintain flow.

Transitioning to: "${toContent.substring(0, 200)}..."

Output only the transition text.`;

    const response = await this.callAI('creative', prompt, {
      systemPrompt: 'You write seamless transitions between chapter sections. Be concise.',
    });

    // Limit length
    const words = response.split(/\s+/);
    if (words.length > maxBridgeLength) {
      return words.slice(0, maxBridgeLength).join(' ') + '...';
    }

    return response;
  }

  // ─────────────────────────────────────────────────────────────────
  // STRUCTURE ANALYSIS
  // ─────────────────────────────────────────────────────────────────

  private async analyzeStructure(_request: AnalyzeStructureRequest): Promise<StructureAnalysis> {
    const { content } = _request;

    const response = await this.callAI('analysis', content, {
      systemPrompt: `Analyze this chapter's structure:
1. Identify the narrative arc (building/peak/resolution/flat)
2. Evaluate pacing (0-1 scale)
3. Find structural issues (weak transitions, abrupt shifts, imbalanced sections)
4. Suggest improvements

Respond with JSON: {
  narrativeArc: "building"|"peak"|"resolution"|"flat",
  pacingScore: 0-1,
  issues: [],
  suggestions: []
}`,
    });

    const result = this.parseJSON(response) as {
      narrativeArc?: string;
      pacingScore?: number;
      issues?: string[];
      suggestions?: string[];
    };

    return {
      narrativeArc: (result.narrativeArc as 'building' | 'peak' | 'resolution' | 'flat') || 'flat',
      pacingScore: Number(result.pacingScore) || 0.5,
      issues: Array.isArray(result.issues) ? result.issues : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // REVISION
  // ─────────────────────────────────────────────────────────────────

  private async reviseDraft(request: ReviseDraftRequest): Promise<ChapterDraft> {
    const { chapterId, focusAreas } = request;

    // Get current draft
    const history = this.draftHistory.get(chapterId);
    if (!history || history.length === 0) {
      throw new Error(`No draft found for chapter ${chapterId}`);
    }

    const currentDraft = history[history.length - 1];

    // Create revision prompt based on focus areas
    const focusPrompt = focusAreas.map(area => {
      switch (area) {
        case 'voice': return 'Improve voice consistency';
        case 'pacing': return 'Improve pacing and flow';
        case 'clarity': return 'Improve clarity and readability';
        case 'transitions': return 'Smooth out transitions';
        default: return area;
      }
    }).join(', ');

    const response = await this.callAI('creative', currentDraft.content, {
      systemPrompt: `Revise this chapter draft. Focus on: ${focusPrompt}
Preserve the core ideas and passage content. Improve the specified areas.
Output the revised chapter text only.`,
    });

    const revisedDraft: ChapterDraft = {
      ...currentDraft,
      content: response,
      wordCount: response.split(/\s+/).length,
      version: currentDraft.version + 1,
      styleAnalysis: await this.analyzeStyle(response),
    };

    history.push(revisedDraft);

    return revisedDraft;
  }

  // ─────────────────────────────────────────────────────────────────
  // SUGGESTIONS
  // ─────────────────────────────────────────────────────────────────

  private async suggestImprovements(_request: SuggestImprovementsRequest): Promise<ImprovementSuggestion[]> {
    const { content } = _request;

    const response = await this.callAI('analysis', content, {
      systemPrompt: `Analyze this chapter and suggest specific improvements.
For each suggestion, provide:
- Type: structure, voice, pacing, clarity, content
- Location: approximate position in chapter
- Current issue
- Suggested fix

Respond with JSON: { suggestions: [{ type, location, issue, fix }] }`,
    });

    const result = this.parseJSON(response) as {
      suggestions?: Array<{ type: string; location: string; issue: string; fix: string }>;
    };
    return (Array.isArray(result.suggestions) ? result.suggestions : []).map((s) => ({
      type: s.type,
      location: s.location,
      issue: s.issue,
      fix: s.fix,
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // PERSONA-CONSISTENT REWRITING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Rewrite text to match a persona's voice and style
   *
   * This is the key method for persona-consistent book creation:
   * - Removes forbidden phrases
   * - Applies preferred patterns naturally
   * - Matches formality level
   * - Preserves core meaning and insights
   */
  private async rewriteForPersona(request: RewriteForPersonaRequest): Promise<RewriteResult> {
    const { text, persona, sourceType, voiceIssues } = request;

    // Determine if voiceIssues contains leaked forbidden phrases (for stronger enforcement)
    const leakedPhrases = detectLeakedPhrases(voiceIssues, persona.styleGuide.forbiddenPhrases);

    // Build the system prompt with persona details (pass leaked phrases for stronger enforcement)
    const systemPrompt = buildPersonaSystemPrompt(
      persona,
      leakedPhrases.length > 0 ? leakedPhrases : undefined
    );

    // Build the user prompt
    const userPrompt = buildRewritePrompt(text, persona, sourceType, voiceIssues);

    // Call AI with 'humanizer' capability if available, otherwise 'creative'
    let rewritten: string;
    try {
      rewritten = await this.callAI('humanizer', userPrompt, { systemPrompt });
    } catch (error) {
      // Fallback to 'creative' capability if 'humanizer' not available
      this.log('debug', 'Humanizer capability not available, using creative');
      rewritten = await this.callAI('creative', userPrompt, { systemPrompt });
    }

    // Analyze what changes were applied
    const changesApplied = detectChanges(text, rewritten, persona);

    // Check for remaining issues
    const remainingIssues = checkForbiddenPhrases(rewritten, persona.styleGuide.forbiddenPhrases);

    // Calculate confidence based on changes and remaining issues
    const confidenceScore = calculateRewriteConfidence(changesApplied, remainingIssues);

    return {
      original: text,
      rewritten: rewritten.trim(),
      changesApplied,
      confidenceScore,
      remainingIssues: remainingIssues.length > 0 ? remainingIssues : undefined,
    };
  }

  /**
   * Multi-pass rewrite that iterates until forbidden phrases are eliminated
   *
   * This wraps rewriteForPersona with retry logic:
   * - If first pass has remaining issues (leaked phrases), retry
   * - Each subsequent pass explicitly targets the leaked phrases
   * - Stops when clean or max passes reached
   *
   * @public - Used by UnifiedAuiService for book chapter rewriting
   */
  async rewriteForPersonaWithRetry(
    request: RewriteForPersonaRequest,
    options?: MultiPassRewriteOptions
  ): Promise<RewriteResult> {
    const maxPasses = options?.maxPasses ?? 3;
    const stopOnClean = options?.stopOnClean ?? true;

    let currentText = request.text;
    let allChangesApplied: string[] = [];
    let passCount = 0;
    let leakedPhrases: string[] = request.voiceIssues ?? [];
    let lastResult: RewriteResult | null = null;

    while (passCount < maxPasses) {
      passCount++;

      // On subsequent passes, explicitly target leaked phrases
      const passRequest: RewriteForPersonaRequest = {
        ...request,
        text: currentText,
        voiceIssues: passCount > 1 ? leakedPhrases : request.voiceIssues,
      };

      const result = await this.rewriteForPersona(passRequest);
      lastResult = result;

      // Accumulate changes
      allChangesApplied.push(...result.changesApplied);

      // Check for remaining issues
      if (!result.remainingIssues?.length) {
        // Clean - no leaks!
        this.log('debug', `Multi-pass rewrite complete after ${passCount} pass(es) - all phrases removed`);
        return {
          ...result,
          changesApplied: allChangesApplied,
          passCount,
        };
      }

      // Still have leaks - prepare for next pass
      leakedPhrases = result.remainingIssues;
      currentText = result.rewritten;

      this.log('debug', `Pass ${passCount}: ${leakedPhrases.length} forbidden phrases remain: ${leakedPhrases.join(', ')}`);

      if (stopOnClean && leakedPhrases.length === 0) {
        break;
      }
    }

    // Max passes reached - return best result with warning
    this.log('warn', `Multi-pass rewrite: max ${maxPasses} passes reached with ${leakedPhrases.length} phrases remaining`);

    return {
      original: request.text,
      rewritten: lastResult?.rewritten ?? currentText,
      changesApplied: allChangesApplied,
      confidenceScore: lastResult?.confidenceScore ?? 0.3,
      remainingIssues: leakedPhrases.length > 0 ? leakedPhrases : undefined,
      passCount,
    };
  }

  /**
   * Batch rewrite multiple passages for persona consistency
   *
   * Uses multi-pass rewriting to ensure forbidden phrases are eliminated.
   * More efficient than individual calls for large passage sets.
   * Maintains consistent voice across all passages.
   */
  private async batchRewriteForPersona(
    request: BatchRewriteRequest,
    retryOptions?: MultiPassRewriteOptions
  ): Promise<Map<string, RewriteResult>> {
    const { passages, persona } = request;
    const results = new Map<string, RewriteResult>();

    // Process passages in parallel with limited concurrency
    const BATCH_SIZE = 5;
    for (let i = 0; i < passages.length; i += BATCH_SIZE) {
      const batch = passages.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (passage) => {
          // Use multi-pass rewriting to eliminate forbidden phrases
          const result = await this.rewriteForPersonaWithRetry({
            text: passage.text,
            persona,
            sourceType: passage.sourceType,
            voiceIssues: passage.voiceIssues,
          }, retryOptions);
          return { id: passage.id, result };
        })
      );

      for (const { id, result } of batchResults) {
        results.set(id, result);
      }

      // Small delay between batches to avoid overwhelming the model
      if (i + BATCH_SIZE < passages.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────
  // REVISION FROM REVIEWER FEEDBACK
  // ─────────────────────────────────────────────────────────────────

  /**
   * Revise a chapter based on Reviewer feedback
   *
   * This is the Builder's response in the feedback loop:
   * 1. Receives specific issues to address
   * 2. Applies focused revisions based on focus areas
   * 3. Uses rewriteForPersona for voice/humanization issues
   * 4. Reports back what was changed
   */
  private async reviseFromFeedback(request: ReviseFromFeedbackRequest): Promise<RevisionResponse> {
    const {
      chapterId,
      focusAreas,
      issuesWithFixes,
      passagesForRewrite,
      iterationCount,
      maxIterations,
      personaRef,
    } = request;

    this.log('info', `Revising chapter ${chapterId} from Reviewer feedback (iteration ${iterationCount}/${maxIterations})`);
    this.log('debug', `Focus areas: ${focusAreas.join(', ')}`);
    this.log('debug', `Issues to address: ${issuesWithFixes.length}`);

    // Get current draft
    const history = this.draftHistory.get(chapterId);
    if (!history || history.length === 0) {
      return {
        success: false,
        chapterId,
        newVersion: 0,
        changesApplied: [],
        remainingIssues: ['No draft found for chapter'],
      };
    }

    const currentDraft = history[history.length - 1];
    const changesApplied: string[] = [];
    let revisedContent = currentDraft.content;

    // Step 1: Address specific issues with suggested fixes
    for (const issue of issuesWithFixes) {
      if (issue.suggestedFix) {
        // Try to apply the suggested fix
        const fixApplied = await this.applyIssueFix(
          revisedContent,
          issue.location,
          issue.description,
          issue.suggestedFix
        );
        if (fixApplied.modified) {
          revisedContent = fixApplied.content;
          changesApplied.push(`Fixed: ${issue.description.substring(0, 50)}...`);
        }
      }
    }

    // Step 2: Handle passages needing voice transformation
    if (passagesForRewrite && passagesForRewrite.length > 0 && personaRef) {
      // Build a minimal persona for rewriting
      const minimalPersona = await this.buildMinimalPersonaFromRef(personaRef);

      if (minimalPersona) {
        for (const passage of passagesForRewrite) {
          // Extract the passage text at the location
          const passageText = extractTextAtLocation(revisedContent, passage.location);
          if (passageText) {
            const rewriteResult = await this.rewriteForPersona({
              text: passageText,
              persona: minimalPersona,
              voiceIssues: passage.voiceIssues,
            });

            if (rewriteResult.confidenceScore > 0.5) {
              revisedContent = revisedContent.replace(passageText, rewriteResult.rewritten);
              changesApplied.push(...rewriteResult.changesApplied);
            }
          }
        }
      }
    }

    // Step 3: General revision based on focus areas
    if (focusAreas.length > 0) {
      const generalRevision = await this.callAI('creative', revisedContent, {
        systemPrompt: buildFocusedRevisionPrompt(focusAreas, issuesWithFixes, personaRef),
      });

      // Only use the revision if it's substantially different and not empty
      if (generalRevision.trim().length > revisedContent.length * 0.5) {
        revisedContent = generalRevision;
        changesApplied.push(`General revision focusing on: ${focusAreas.join(', ')}`);
      }
    }

    // Create the revised draft
    const revisedDraft: ChapterDraft = {
      ...currentDraft,
      content: revisedContent,
      wordCount: revisedContent.split(/\s+/).length,
      version: currentDraft.version + 1,
      styleAnalysis: await this.analyzeStyle(revisedContent, personaRef),
    };

    history.push(revisedDraft);

    // Check for remaining issues (simple check)
    const remainingIssues: string[] = [];
    for (const issue of issuesWithFixes) {
      // Very basic check - see if the issue description keywords are still present
      const keywords = issue.description.toLowerCase().split(/\s+/).slice(0, 3);
      const stillPresent = keywords.some(kw =>
        revisedContent.toLowerCase().includes(kw) && kw.length > 4
      );
      if (stillPresent) {
        remainingIssues.push(`May not be fully resolved: ${issue.description.substring(0, 50)}...`);
      }
    }

    this.log('info', `Revision complete: ${changesApplied.length} changes, ${remainingIssues.length} potentially remaining`);

    return {
      success: true,
      chapterId,
      newVersion: revisedDraft.version,
      changesApplied,
      remainingIssues: remainingIssues.length > 0 ? remainingIssues : undefined,
    };
  }

  /**
   * Apply a specific fix to content at a location
   */
  private async applyIssueFix(
    content: string,
    location: string,
    description: string,
    suggestedFix: string
  ): Promise<{ modified: boolean; content: string }> {
    // Use AI to apply the fix contextually
    const prompt = `You need to fix an issue in this text.

ISSUE: ${description}
LOCATION: ${location}
SUGGESTED FIX: ${suggestedFix}

TEXT TO FIX:
${content}

Apply the fix and output the entire corrected text. Make minimal changes - only fix the specific issue.`;

    try {
      const fixed = await this.callAI('creative', prompt, {
        systemPrompt: 'You make precise, minimal edits to fix specific issues. Output only the corrected text.',
      });

      // Verify the fix is reasonable (not empty, not too different)
      if (fixed.trim().length > content.length * 0.5 && fixed.trim().length < content.length * 1.5) {
        return { modified: true, content: fixed };
      }
    } catch (error) {
      this.log('debug', `Failed to apply fix: ${error}`);
    }

    return { modified: false, content };
  }

  /**
   * Build a minimal persona from a persona reference
   */
  private async buildMinimalPersonaFromRef(personaRef: string): Promise<PersonaProfileForRewrite | null> {
    // Try to get persona from store via bus
    try {
      const response = await this.bus.request('aui-service', {
        type: 'get-persona-profile',
        payload: { name: personaRef },
      });

      if (response.success && response.data) {
        const profile = response.data as {
          name: string;
          description?: string;
          voiceTraits: string[];
          toneMarkers: string[];
          formalityRange: [number, number];
          styleGuide: {
            forbiddenPhrases: string[];
            preferredPatterns: string[];
            useContractions: boolean;
            useRhetoricalQuestions: boolean;
          };
          referenceExamples?: string[];
        };
        return profile;
      }
    } catch (error) {
      this.log('debug', `Could not fetch persona profile: ${error}`);
    }

    // Fallback: create a basic persona from the reference
    return createFallbackPersona(personaRef);
  }

  // ─────────────────────────────────────────────────────────────────
  // STYLE ANALYSIS
  // ─────────────────────────────────────────────────────────────────

  private async analyzeStyle(content: string, personaRef?: string): Promise<StyleAnalysis> {
    const prompt = personaRef
      ? `Analyze this text's style compared to the persona "${personaRef}"`
      : 'Analyze this text\'s writing style';

    const response = await this.callAI('analysis', content, {
      systemPrompt: `${prompt}

Evaluate:
- Voice consistency (0-1): How consistent is the voice throughout?
- Formality level (0-1): 0=very informal, 1=very formal
- Emotional tone: One word describing the dominant emotion
- Readability (0-1): How easy to read
- Concerns: List any style issues

Respond with JSON: { voiceConsistency, formalityLevel, emotionalTone, readabilityScore, concerns: [] }`,
    });

    const result = this.parseJSON(response) as {
      voiceConsistency?: number;
      formalityLevel?: number;
      emotionalTone?: string;
      readabilityScore?: number;
      concerns?: string[];
    };

    return {
      voiceConsistency: Number(result.voiceConsistency) || 0.5,
      formalityLevel: Number(result.formalityLevel) || 0.5,
      emotionalTone: String(result.emotionalTone || 'neutral'),
      readabilityScore: Number(result.readabilityScore) || 0.5,
      concerns: Array.isArray(result.concerns) ? result.concerns : [],
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // INTENTIONS
  // ─────────────────────────────────────────────────────────────────

  private addIntention(intention: BuilderIntention): void {
    const exists = this.pendingIntentions.some(
      i => i.type === intention.type && i.targetChapterId === intention.targetChapterId
    );
    if (!exists) {
      this.pendingIntentions.push(intention);
      this.pendingIntentions.sort((a, b) => b.priority - a.priority);
    }
  }

  private getIntentions(): BuilderIntention[] {
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
      console.debug('[Builder] JSON parse error:', error);
      return {};
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _builder: BuilderAgent | null = null;

export function getBuilderAgent(): BuilderAgent {
  if (!_builder) {
    _builder = new BuilderAgent();
  }
  return _builder;
}

/**
 * Reset the Builder agent (for testing)
 */
export function resetBuilderAgent(): void {
  _builder = null;
}
