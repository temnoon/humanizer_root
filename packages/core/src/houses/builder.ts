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
    } catch {
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
