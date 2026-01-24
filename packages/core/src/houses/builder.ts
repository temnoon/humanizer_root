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
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../runtime/types.js';
import { getConfigManager, THRESHOLD_KEYS } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS FOR BUILDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Builder specific config keys
 */
export const BUILDER_CONFIG = {
  // Chapter length limits
  MIN_CHAPTER_WORDS: 'builder.minChapterWords',
  MAX_CHAPTER_WORDS: 'builder.maxChapterWords',

  // Quality thresholds
  TARGET_PACING_SCORE: 'builder.targetPacingScore',
  VOICE_CONSISTENCY_THRESHOLD: 'builder.voiceConsistencyThreshold',

  // Bridge/transition limits
  MAX_BRIDGE_LENGTH: 'builder.maxBridgeLength',
} as const;

// ═══════════════════════════════════════════════════════════════════
// BUILDER TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ChapterDraft {
  id: string;
  title: string;
  content: string;
  passageRefs: string[];           // IDs of source passages
  wordCount: number;
  structure: ChapterStructure;
  styleAnalysis: StyleAnalysis;
  version: number;
}

export interface ChapterStructure {
  sections: Array<{
    type: 'opening' | 'body' | 'transition' | 'conclusion';
    passageRefs: string[];
    bridgeText?: string;           // AI-generated connecting text
    wordCount: number;
  }>;
  narrativeArc: 'building' | 'peak' | 'resolution' | 'flat';
  pacingScore: number;             // 0-1, how well-paced
}

export interface StyleAnalysis {
  voiceConsistency: number;        // 0-1 match with persona
  formalityLevel: number;          // 0-1, informal to formal
  emotionalTone: string;           // e.g., "reflective", "urgent"
  readabilityScore: number;        // 0-1
  concerns: string[];
}

export interface CompositionPlan {
  chapterId: string;
  title: string;
  theme: string;
  passages: PassageForComposition[];
  targetLength: number;
  styleGuidelines: string;
  personaRef?: string;
}

export interface PassageForComposition {
  id: string;
  text: string;
  role: 'anchor' | 'supporting' | 'contrast' | 'evidence';
  suggestedPosition: number;       // 0-1, where in chapter
}

export interface BuilderIntention {
  type: 'compose' | 'revise' | 'restructure' | 'bridge';
  priority: number;
  reason: string;
  targetChapterId?: string;
  context: Record<string, unknown>;
}

export interface ChapterOutline {
  theme: string;
  sections: Array<{
    type: 'opening' | 'body' | 'transition' | 'conclusion';
    passageIds: string[];
    purpose: string;
  }>;
  suggestedTitle: string;
  estimatedLength: number;
}

export interface TransitionResult {
  fromSectionIndex: number;
  toSectionIndex: number;
  bridgeText: string;
}

export interface StructureAnalysis {
  narrativeArc: 'building' | 'peak' | 'resolution' | 'flat';
  pacingScore: number;
  issues: string[];
  suggestions: string[];
}

export interface ImprovementSuggestion {
  type: string;
  location: string;
  issue: string;
  fix: string;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface CreateOutlineRequest {
  passages: PassageForComposition[];
  theme: string;
  targetLength: number;
}

interface WriteTransitionsRequest {
  sections: Array<{
    endingPassageId: string;
    openingText: string;
  }>;
  theme: string;
}

interface AnalyzeStructureRequest {
  content: string;
  passageRefs: string[];
}

interface ReviseDraftRequest {
  chapterId: string;
  focusAreas: Array<'voice' | 'pacing' | 'clarity' | 'transitions' | string>;
  preservePassageRefs?: boolean;
}

interface SuggestImprovementsRequest {
  chapterId: string;
  content: string;
}

interface RewriteForPersonaRequest {
  /** Text to rewrite */
  text: string;
  /** Persona profile with voice traits and style guide */
  persona: PersonaProfileForRewrite;
  /** Original source type for context */
  sourceType?: string;
  /** Detected voice issues to address */
  voiceIssues?: string[];
}

/**
 * Minimal persona profile for rewriting
 * Can be full PersonaProfile or subset for efficiency
 */
interface PersonaProfileForRewrite {
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
}

interface RewriteResult {
  original: string;
  rewritten: string;
  changesApplied: string[];
  confidenceScore: number;
  remainingIssues?: string[];
}

interface BatchRewriteRequest {
  passages: Array<{
    id: string;
    text: string;
    sourceType?: string;
    voiceIssues?: string[];
  }>;
  persona: PersonaProfileForRewrite;
}

/**
 * Revision request from Reviewer feedback loop
 */
interface ReviseFromFeedbackRequest {
  chapterId: string;
  focusAreas: Array<'voice' | 'pacing' | 'clarity' | 'transitions' | 'humanization' | 'structure'>;
  issuesWithFixes: Array<{
    type: string;
    description: string;
    location: string;
    suggestedFix?: string;
  }>;
  passagesForRewrite?: Array<{
    location: string;
    voiceIssues: string[];
  }>;
  iterationCount: number;
  maxIterations: number;
  personaRef?: string;
}

interface RevisionResponse {
  success: boolean;
  chapterId: string;
  newVersion: number;
  changesApplied: string[];
  remainingIssues?: string[];
}

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
    const narrativeArc = this.detectNarrativeArc(sections);
    const pacingScore = this.calculatePacingScore(sections);

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

  private async composeSectionContent(request: {
    type: 'opening' | 'body' | 'transition' | 'conclusion';
    passages: PassageForComposition[];
    theme: string;
    styleGuidelines: string;
    personaRef?: string;
    isFirst: boolean;
    isLast: boolean;
  }): Promise<string> {
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

    // Build the system prompt with persona details
    const systemPrompt = this.buildPersonaSystemPrompt(persona);

    // Build the user prompt
    const userPrompt = this.buildRewritePrompt(text, persona, sourceType, voiceIssues);

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
    const changesApplied = this.detectChanges(text, rewritten, persona);

    // Check for remaining issues
    const remainingIssues = this.checkForbiddenPhrases(rewritten, persona.styleGuide.forbiddenPhrases);

    // Calculate confidence based on changes and remaining issues
    const confidenceScore = this.calculateRewriteConfidence(changesApplied, remainingIssues);

    return {
      original: text,
      rewritten: rewritten.trim(),
      changesApplied,
      confidenceScore,
      remainingIssues: remainingIssues.length > 0 ? remainingIssues : undefined,
    };
  }

  /**
   * Batch rewrite multiple passages for persona consistency
   *
   * More efficient than individual calls for large passage sets.
   * Maintains consistent voice across all passages.
   */
  private async batchRewriteForPersona(
    request: BatchRewriteRequest
  ): Promise<Map<string, RewriteResult>> {
    const { passages, persona } = request;
    const results = new Map<string, RewriteResult>();

    // Process passages in parallel with limited concurrency
    const BATCH_SIZE = 5;
    for (let i = 0; i < passages.length; i += BATCH_SIZE) {
      const batch = passages.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (passage) => {
          const result = await this.rewriteForPersona({
            text: passage.text,
            persona,
            sourceType: passage.sourceType,
            voiceIssues: passage.voiceIssues,
          });
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

  /**
   * Build system prompt that embodies the persona
   */
  private buildPersonaSystemPrompt(persona: PersonaProfileForRewrite): string {
    const parts: string[] = [
      `You are a skilled writer who transforms text to match a specific voice and persona.`,
      ``,
      `TARGET PERSONA: ${persona.name}`,
    ];

    if (persona.description) {
      parts.push(persona.description);
    }

    parts.push(``);
    parts.push(`VOICE TRAITS: ${persona.voiceTraits.join(', ')}`);
    parts.push(`TONE: ${persona.toneMarkers.join(', ')}`);
    parts.push(`FORMALITY: ${persona.formalityRange[0]} to ${persona.formalityRange[1]} (0=casual, 1=formal)`);
    parts.push(``);
    parts.push(`STYLE REQUIREMENTS:`);
    parts.push(`- Use contractions: ${persona.styleGuide.useContractions ? 'Yes' : 'No'}`);
    parts.push(`- Use rhetorical questions: ${persona.styleGuide.useRhetoricalQuestions ? 'Yes' : 'No'}`);
    parts.push(``);

    if (persona.styleGuide.forbiddenPhrases.length > 0) {
      parts.push(`FORBIDDEN PHRASES (NEVER use these):`);
      for (const phrase of persona.styleGuide.forbiddenPhrases.slice(0, 15)) {
        parts.push(`- "${phrase}"`);
      }
      parts.push(``);
    }

    if (persona.styleGuide.preferredPatterns.length > 0) {
      parts.push(`PREFERRED PATTERNS (use these naturally when appropriate):`);
      for (const pattern of persona.styleGuide.preferredPatterns.slice(0, 10)) {
        parts.push(`- "${pattern}"`);
      }
      parts.push(``);
    }

    if (persona.referenceExamples && persona.referenceExamples.length > 0) {
      parts.push(`REFERENCE EXAMPLES of the target voice:`);
      for (let i = 0; i < Math.min(3, persona.referenceExamples.length); i++) {
        parts.push(`Example ${i + 1}: "${persona.referenceExamples[i]}"`);
        parts.push(``);
      }
    }

    parts.push(`YOUR TASK:`);
    parts.push(`Rewrite the given text to match this persona's voice while preserving the core meaning.`);
    parts.push(`Make it sound like the same person who wrote the reference examples.`);
    parts.push(`DO NOT add new ideas - only transform the voice and style.`);
    parts.push(`Output ONLY the rewritten text, nothing else.`);

    return parts.join('\n');
  }

  /**
   * Build the user prompt for rewriting
   */
  private buildRewritePrompt(
    text: string,
    persona: PersonaProfileForRewrite,
    sourceType?: string,
    voiceIssues?: string[]
  ): string {
    const parts: string[] = [`Original passage to rewrite:`];
    parts.push(``);
    parts.push(`"${text}"`);

    if (sourceType) {
      parts.push(``);
      parts.push(`Source: ${sourceType}`);
    }

    if (voiceIssues && voiceIssues.length > 0) {
      parts.push(``);
      parts.push(`DETECTED ISSUES TO FIX:`);
      for (const issue of voiceIssues) {
        parts.push(`- ${issue}`);
      }
    }

    parts.push(``);
    parts.push(`Rewrite this in the ${persona.name} voice:`);

    return parts.join('\n');
  }

  /**
   * Detect what changes were made during rewriting
   */
  private detectChanges(
    original: string,
    rewritten: string,
    persona: PersonaProfileForRewrite
  ): string[] {
    const changes: string[] = [];
    const originalLower = original.toLowerCase();
    const rewrittenLower = rewritten.toLowerCase();

    // Check forbidden phrases removed
    for (const phrase of persona.styleGuide.forbiddenPhrases) {
      if (originalLower.includes(phrase.toLowerCase()) &&
          !rewrittenLower.includes(phrase.toLowerCase())) {
        changes.push(`Removed: "${phrase}"`);
      }
    }

    // Check preferred patterns added
    for (const pattern of persona.styleGuide.preferredPatterns) {
      const basePattern = pattern.replace('...', '').toLowerCase().trim();
      if (!originalLower.includes(basePattern) &&
          rewrittenLower.includes(basePattern)) {
        changes.push(`Added pattern: "${pattern}"`);
      }
    }

    // Check contractions
    if (persona.styleGuide.useContractions) {
      const contractionPairs = [
        ["i am", "i'm"], ["you are", "you're"], ["we are", "we're"],
        ["they are", "they're"], ["it is", "it's"], ["do not", "don't"],
        ["does not", "doesn't"], ["cannot", "can't"], ["will not", "won't"],
      ];
      for (const [expanded, contracted] of contractionPairs) {
        if (originalLower.includes(expanded) && rewrittenLower.includes(contracted)) {
          changes.push(`Added contraction: "${contracted}"`);
          break; // Just note one
        }
      }
    }

    // Check rhetorical questions
    if (persona.styleGuide.useRhetoricalQuestions) {
      const originalQuestions = (original.match(/\?/g) || []).length;
      const rewrittenQuestions = (rewritten.match(/\?/g) || []).length;
      if (rewrittenQuestions > originalQuestions) {
        changes.push(`Added rhetorical question`);
      }
    }

    return changes;
  }

  /**
   * Check for forbidden phrases that remain in text
   */
  private checkForbiddenPhrases(text: string, forbiddenPhrases: string[]): string[] {
    const textLower = text.toLowerCase();
    const remaining: string[] = [];

    for (const phrase of forbiddenPhrases) {
      if (textLower.includes(phrase.toLowerCase())) {
        remaining.push(phrase);
      }
    }

    return remaining;
  }

  /**
   * Calculate confidence score for rewrite quality
   */
  private calculateRewriteConfidence(
    changesApplied: string[],
    remainingIssues: string[]
  ): number {
    // Base score
    let score = 0.5;

    // Bonus for changes applied
    score += Math.min(0.3, changesApplied.length * 0.05);

    // Penalty for remaining issues
    score -= Math.min(0.3, remainingIssues.length * 0.1);

    return Math.max(0, Math.min(1, score));
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
          const passageText = this.extractTextAtLocation(revisedContent, passage.location);
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
        systemPrompt: this.buildFocusedRevisionPrompt(focusAreas, issuesWithFixes, personaRef),
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
    return {
      name: personaRef,
      voiceTraits: ['consistent', 'clear'],
      toneMarkers: ['appropriate'],
      formalityRange: [0.3, 0.7],
      styleGuide: {
        forbiddenPhrases: [
          'delve into',
          'leverage',
          'utilize',
          'in conclusion',
          'it is important to note',
        ],
        preferredPatterns: [],
        useContractions: true,
        useRhetoricalQuestions: false,
      },
    };
  }

  /**
   * Extract text at a specified location
   */
  private extractTextAtLocation(content: string, location: string): string | null {
    // Parse location like "Paragraph 3" or "Section 2"
    const paragraphMatch = location.match(/paragraph\s*(\d+)/i);
    if (paragraphMatch) {
      const paragraphNum = parseInt(paragraphMatch[1], 10);
      const paragraphs = content.split(/\n\n+/);
      if (paragraphNum > 0 && paragraphNum <= paragraphs.length) {
        return paragraphs[paragraphNum - 1];
      }
    }

    // Fallback: return first substantial paragraph
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50);
    return paragraphs[0] || null;
  }

  /**
   * Build revision prompt based on focus areas
   */
  private buildFocusedRevisionPrompt(
    focusAreas: ReviseFromFeedbackRequest['focusAreas'],
    issues: ReviseFromFeedbackRequest['issuesWithFixes'],
    personaRef?: string
  ): string {
    const parts: string[] = [`Revise this chapter text. Focus specifically on:`];

    for (const area of focusAreas) {
      switch (area) {
        case 'voice':
          parts.push('- Voice: Ensure consistent, authentic voice throughout');
          break;
        case 'pacing':
          parts.push('- Pacing: Improve rhythm and flow between sections');
          break;
        case 'clarity':
          parts.push('- Clarity: Make ideas clearer and more accessible');
          break;
        case 'transitions':
          parts.push('- Transitions: Smooth connections between paragraphs and sections');
          break;
        case 'humanization':
          parts.push('- Humanization: Remove AI-like patterns, add natural variation');
          break;
        case 'structure':
          parts.push('- Structure: Improve organization and logical flow');
          break;
      }
    }

    if (issues.length > 0) {
      parts.push('');
      parts.push('Specific issues to address:');
      for (const issue of issues.slice(0, 5)) {
        parts.push(`- ${issue.description}`);
        if (issue.suggestedFix) {
          parts.push(`  Fix: ${issue.suggestedFix}`);
        }
      }
    }

    if (personaRef) {
      parts.push('');
      parts.push(`Maintain the voice of: ${personaRef}`);
    }

    parts.push('');
    parts.push('Output only the revised chapter text. Preserve core meaning and structure.');

    return parts.join('\n');
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

  private detectNarrativeArc(sections: ChapterStructure['sections']): ChapterStructure['narrativeArc'] {
    // Simple heuristic based on section types and word distribution
    const hasOpening = sections.some(s => s.type === 'opening');
    const hasConclusion = sections.some(s => s.type === 'conclusion');

    if (hasOpening && hasConclusion) return 'resolution';
    if (hasOpening && !hasConclusion) return 'building';
    return 'flat';
  }

  private calculatePacingScore(sections: ChapterStructure['sections']): number {
    if (sections.length === 0) return 0;

    // Ideal pacing has varied section lengths
    const wordCounts = sections.map(s => s.wordCount);
    const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    const variance = wordCounts.reduce((sum, wc) => sum + Math.pow(wc - avg, 2), 0) / wordCounts.length;

    // Some variance is good (0.3-0.5 of avg), too much or too little is bad
    const idealVariance = avg * 0.4;
    const varianceScore = 1 - Math.min(1, Math.abs(variance - idealVariance) / idealVariance);

    return varianceScore;
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
