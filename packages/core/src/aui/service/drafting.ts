/**
 * Unified AUI Service - Drafting Loop
 *
 * Iterative content drafting service that supports:
 * - Multi-source content gathering (AUI archive, file paths, URLs, direct text)
 * - Version-tracked drafts with feedback
 * - Narrator personas for original content generation
 * - Theme-aware HTML export
 *
 * @module @humanizer/core/aui/service/drafting
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  DraftSource,
  AuiArchiveSource,
  AuiClusterSource,
  FilePathSource,
  UrlSource,
  DirectTextSource,
  GatheredPassage,
  GatherResult,
  DraftingSession,
  DraftingStatus,
  DraftVersion,
  UserFeedback,
  NarratorPersona,
  ExportConfig,
  ExportedArtifact,
  ExportFormat,
  StartDraftingOptions,
  GenerateDraftOptions,
  ReviseDraftOptions,
  DraftingProgress,
  DraftingProgressCallback,
} from '../types/drafting-types.js';
import type { ServiceDependencies } from './types.js';
import type { ClusteringMethods } from './archive-clustering.js';
import type { BookMethods } from './books.js';
import {
  generateHtmlDocument,
  generateMarkdownDocument,
  generateJsonDocument,
  HUMANIZER_THEME,
} from './export-templates.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TARGET_WORD_COUNT = 1500;
const MAX_CONTEXT_PASSAGES = 20;
const PASSAGE_EXCERPT_LENGTH = 300;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT NARRATOR PERSONA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default narrator persona for development chronicles.
 * Based on the Tem Noon voice from narrate-chapter.ts.
 */
export const DEFAULT_NARRATOR_PERSONA: NarratorPersona = {
  name: 'Development Chronicle',
  systemPrompt: `You are writing narrative prose about software development. You're creating a memoir-style chapter that tells the story ABOUT the source material—what it means, what the struggle was, what it felt like—not just presenting it.

VOICE CHARACTERISTICS:

1. GROUNDED IN EXPERIENCE
   - Return to what is actually given in experience
   - Mix mundane details with deeper observations
   - Technical specifics grounded in lived reality

2. SELF-QUESTIONING
   - "Is this actually working, or am I just being told it's working?"
   - Wonder at progress, but always with awareness
   - Acknowledge uncertainty without wallowing in it

3. HUMOR - DRY, OBSERVATIONAL
   - Not triumphant, not defeated
   - The absurdity of trying to formalize complex things
   - "And yet here I am, still at it"

4. CONFESSIONAL BUT NOT DRAMATIC
   - Admit struggles without making them heroic
   - The work is the work; you show up and do it
   - No epiphanies, just gradual accumulation

STRUCTURE:

- Start in the middle of things, not with a setup or summary
- Let technical details emerge naturally from the narrative
- Include source material as BLOCK QUOTES when illustrating key moments
- End with reflection, not conclusion—the work continues

NEVER:
- Triumphalism ("We achieved something amazing!")
- AI-tell phrases (delve, dive into, it's important to note, rich tapestry)
- False modesty (the work IS trying to do something real)
- Certainty about outcomes
- Inspirational language ("testament to the power of...")
- Academic hedging (furthermore, moreover, thus, hence)`,
  voiceCharacteristics: [
    'grounded in experience',
    'self-questioning',
    'dry humor',
    'confessional but not dramatic',
    'mixes mundane and profound',
  ],
  avoidPatterns: [
    'delve', 'delve into', 'dive into', 'deep dive',
    'tapestry', 'rich tapestry', 'weave together',
    'it is important to note', 'it is worth noting',
    'at its core', 'at its essence', 'fundamentally',
    'leverage', 'utilize', 'utilization',
    'testament to', 'speaks to the power of',
    'furthermore', 'moreover', 'thus', 'hence', 'consequently',
    'beacon', 'stark', 'paradigm shift',
    'in conclusion', 'to summarize',
  ],
  structureGuidance: {
    opening: 'Start with a specific moment, observation, or question—not a summary or setup.',
    sourceMaterialUsage: 'Embed 2-4 short excerpts from source material as block quotes that illustrate key moments.',
    closing: 'End with reflection or an open question, not a neat conclusion.',
  },
  temperature: 0.8,
  topP: 0.9,
};

// ═══════════════════════════════════════════════════════════════════════════
// DRAFTING METHODS INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface DraftingMethods {
  /**
   * Start a new drafting session.
   */
  startDrafting(options: StartDraftingOptions): Promise<DraftingSession>;

  /**
   * Gather material from configured sources.
   */
  gatherMaterial(
    sessionId: string,
    onProgress?: DraftingProgressCallback
  ): Promise<GatherResult>;

  /**
   * Generate initial draft from gathered material.
   */
  generateDraft(
    sessionId: string,
    options?: GenerateDraftOptions,
    onProgress?: DraftingProgressCallback
  ): Promise<DraftVersion>;

  /**
   * Submit feedback and generate revised draft.
   */
  reviseDraft(
    sessionId: string,
    options: ReviseDraftOptions,
    onProgress?: DraftingProgressCallback
  ): Promise<DraftVersion>;

  /**
   * Finalize and export the draft.
   */
  finalizeDraft(
    sessionId: string,
    config?: ExportConfig,
    onProgress?: DraftingProgressCallback
  ): Promise<ExportedArtifact[]>;

  /**
   * Get a drafting session by ID.
   */
  getDraftingSession(sessionId: string): DraftingSession | undefined;

  /**
   * List all drafting sessions.
   */
  listDraftingSessions(options?: {
    userId?: string;
    status?: DraftingStatus;
    limit?: number;
  }): DraftingSession[];

  /**
   * Delete a drafting session.
   */
  deleteDraftingSession(sessionId: string): boolean;

  /**
   * Get a specific draft version.
   */
  getDraftVersion(sessionId: string, version: number): DraftVersion | undefined;

  /**
   * Compare two draft versions.
   */
  compareDraftVersions(
    sessionId: string,
    fromVersion: number,
    toVersion: number
  ): { additions: string[]; removals: string[]; wordCountDiff: number } | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export function createDraftingMethods(
  deps: ServiceDependencies,
  clusteringMethods: ClusteringMethods,
  bookMethods: BookMethods
): DraftingMethods {
  // In-memory session storage
  const sessions = new Map<string, DraftingSession>();

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Create excerpt from text
  // ─────────────────────────────────────────────────────────────────────────
  function createExcerpt(text: string, maxLength: number = PASSAGE_EXCERPT_LENGTH): string {
    if (text.length <= maxLength) return text;
    // Try to break at a sentence
    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.6) {
      return truncated.slice(0, lastPeriod + 1);
    }
    return truncated.trim() + '...';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Gather from AUI archive
  // ─────────────────────────────────────────────────────────────────────────
  async function gatherFromAuiArchive(source: AuiArchiveSource): Promise<GatheredPassage[]> {
    const result = await bookMethods.harvest({
      query: source.query,
      minRelevance: source.minRelevance ?? 0.5,
      limit: source.limit ?? 30,
      dateRange: source.dateRange,
    });

    return result.passages
      .filter(p => !source.authorRole || p.authorRole === source.authorRole)
      .filter(p => !source.sourceTypes?.length || source.sourceTypes.includes(p.sourceType))
      .map(p => ({
        id: p.id,
        text: p.text,
        sourceType: 'aui-archive' as const,
        sourceMetadata: {
          query: source.query,
          authorRole: p.authorRole,
          originalSourceType: p.sourceType,
          title: p.title,
        },
        relevance: p.relevance,
        sourceDate: p.sourceCreatedAt,
        wordCount: p.wordCount,
        excerpt: createExcerpt(p.text),
      }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Gather from AUI cluster
  // ─────────────────────────────────────────────────────────────────────────
  async function gatherFromAuiCluster(source: AuiClusterSource): Promise<GatheredPassage[]> {
    const cluster = await clusteringMethods.getCluster(source.clusterId);
    if (!cluster) {
      throw new Error(`Cluster "${source.clusterId}" not found`);
    }

    const passages = source.limit ? cluster.passages.slice(0, source.limit) : cluster.passages;

    return passages.map(p => ({
      id: p.id,
      text: p.text,
      sourceType: 'aui-cluster' as const,
      sourceMetadata: {
        clusterId: source.clusterId,
        clusterLabel: cluster.label,
        distanceFromCentroid: p.distanceFromCentroid,
      },
      relevance: 1 - p.distanceFromCentroid,
      sourceDate: p.sourceCreatedAt,
      wordCount: p.wordCount,
      excerpt: createExcerpt(p.text),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Gather from file path
  // ─────────────────────────────────────────────────────────────────────────
  async function gatherFromFilePath(source: FilePathSource): Promise<GatheredPassage[]> {
    const passages: GatheredPassage[] = [];
    const encoding = source.encoding ?? 'utf-8';

    try {
      const stat = await fs.stat(source.path);

      if (stat.isFile()) {
        const content = await fs.readFile(source.path, encoding);
        const text = content.toString();

        if (source.parseMarkdown) {
          // Split by headings for multiple passages
          const sections = text.split(/^##?\s+/m).filter(Boolean);
          for (let i = 0; i < sections.length; i++) {
            const section = sections[i].trim();
            if (section.length > 50) { // Skip very short sections
              passages.push({
                id: `file-${path.basename(source.path)}-${i}`,
                text: section,
                sourceType: 'file-path' as const,
                sourceMetadata: {
                  filePath: source.path,
                  sectionIndex: i,
                },
                wordCount: section.split(/\s+/).filter(Boolean).length,
                excerpt: createExcerpt(section),
              });
            }
          }
        } else {
          passages.push({
            id: `file-${path.basename(source.path)}`,
            text,
            sourceType: 'file-path' as const,
            sourceMetadata: { filePath: source.path },
            wordCount: text.split(/\s+/).filter(Boolean).length,
            excerpt: createExcerpt(text),
          });
        }
      } else if (stat.isDirectory()) {
        const pattern = source.pattern || '*.md';
        const files = await fs.readdir(source.path);
        const matchingFiles = files.filter(f => {
          if (pattern.startsWith('*.')) {
            return f.endsWith(pattern.slice(1));
          }
          return f.includes(pattern.replace('*', ''));
        });

        for (const file of matchingFiles.slice(0, 50)) { // Limit files
          const filePath = path.join(source.path, file);
          const content = await fs.readFile(filePath, encoding);
          const text = content.toString();

          passages.push({
            id: `file-${file}`,
            text,
            sourceType: 'file-path' as const,
            sourceMetadata: { filePath, directory: source.path },
            wordCount: text.split(/\s+/).filter(Boolean).length,
            excerpt: createExcerpt(text),
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to read from path ${source.path}:`, error);
    }

    return passages;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Gather from URL
  // ─────────────────────────────────────────────────────────────────────────
  async function gatherFromUrl(source: UrlSource): Promise<GatheredPassage[]> {
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let text = await response.text();

      // Basic HTML to text conversion if needed
      if (text.includes('<html') || text.includes('<!DOCTYPE')) {
        // Strip HTML tags (very basic)
        text = text
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();
      }

      return [{
        id: `url-${Buffer.from(source.url).toString('base64').slice(0, 16)}`,
        text,
        sourceType: 'url' as const,
        sourceMetadata: {
          url: source.url,
          fetchedAt: new Date().toISOString(),
        },
        wordCount: text.split(/\s+/).filter(Boolean).length,
        excerpt: createExcerpt(text),
      }];
    } catch (error) {
      console.warn(`Failed to fetch URL ${source.url}:`, error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Gather from direct text
  // ─────────────────────────────────────────────────────────────────────────
  function gatherFromDirectText(source: DirectTextSource): GatheredPassage[] {
    return [{
      id: `direct-${randomUUID().slice(0, 8)}`,
      text: source.text,
      sourceType: 'direct-text' as const,
      sourceMetadata: {
        label: source.label,
        attribution: source.attribution,
      },
      wordCount: source.text.split(/\s+/).filter(Boolean).length,
      excerpt: createExcerpt(source.text),
    }];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Call LLM for generation
  // ─────────────────────────────────────────────────────────────────────────
  async function callLlm(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; topP?: number; model?: string }
  ): Promise<string> {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = options?.model || 'llama3.2:3b';

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: userPrompt,
          system: systemPrompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            top_p: options?.topP ?? 0.9,
            num_predict: 4000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const result = await response.json() as { response?: string };
      return result.response?.trim() || '';
    } catch (error) {
      throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Build generation prompt
  // ─────────────────────────────────────────────────────────────────────────
  function buildGenerationPrompt(
    session: DraftingSession,
    passages: GatheredPassage[],
    options?: GenerateDraftOptions
  ): string {
    const targetWords = options?.targetWordCount ?? DEFAULT_TARGET_WORD_COUNT;

    // Select passages for context
    let contextPassages = passages;
    if (options?.focusPassageIds?.length) {
      contextPassages = passages.filter(p => options.focusPassageIds!.includes(p.id));
    }
    contextPassages = contextPassages.slice(0, MAX_CONTEXT_PASSAGES);

    const passageContext = contextPassages
      .map((p, i) => {
        const dateStr = p.sourceDate ? ` (${p.sourceDate.toLocaleDateString()})` : '';
        const relevanceStr = p.relevance ? ` [${(p.relevance * 100).toFixed(0)}% relevant]` : '';
        return `--- SOURCE ${i + 1}${dateStr}${relevanceStr} ---
${p.excerpt}
--- END SOURCE ${i + 1} ---`;
      })
      .join('\n\n');

    let prompt = `Write a narrative chapter titled "${session.title}" (approximately ${targetWords} words).

You have ${contextPassages.length} source passages as material. Your job is to write ABOUT these sources—what they mean, what the patterns are, what insights emerge—not just present them.

SOURCE MATERIAL:

${passageContext}

CHAPTER REQUIREMENTS:
1. Start with a specific moment, observation, or question—not a summary
2. Tell the STORY of this material—the patterns, the struggles, the insights
3. Embed 2-4 SHORT excerpts from the sources as block quotes (use > markdown format)
4. Connect the material to larger themes
5. End with reflection, not conclusion`;

    if (options?.guidance) {
      prompt += `\n\nADDITIONAL GUIDANCE:\n${options.guidance}`;
    }

    prompt += '\n\nWrite the chapter now:';

    return prompt;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Build revision prompt
  // ─────────────────────────────────────────────────────────────────────────
  function buildRevisionPrompt(
    session: DraftingSession,
    currentDraft: DraftVersion,
    feedback: UserFeedback,
    options?: ReviseDraftOptions
  ): string {
    const targetWords = options?.targetWordCount ?? currentDraft.wordCount;

    let prompt = `Revise this draft based on the feedback provided.

CURRENT DRAFT (${currentDraft.wordCount} words):

${currentDraft.content}

FEEDBACK TO ADDRESS:

${feedback.text}`;

    if (feedback.sectionsToRevise?.length) {
      prompt += `\n\nSECTIONS TO REVISE:\n${feedback.sectionsToRevise.map(s => `- ${s}`).join('\n')}`;
    }

    if (feedback.toneAdjustments?.length) {
      prompt += `\n\nTONE ADJUSTMENTS:\n${feedback.toneAdjustments.map(t => `- ${t}`).join('\n')}`;
    }

    if (feedback.addContent?.length) {
      prompt += `\n\nCONTENT TO ADD:\n${feedback.addContent.map(c => `- ${c}`).join('\n')}`;
    }

    if (feedback.removeContent?.length) {
      prompt += `\n\nCONTENT TO REMOVE:\n${feedback.removeContent.map(c => `- ${c}`).join('\n')}`;
    }

    if (feedback.structuralChanges?.length) {
      prompt += `\n\nSTRUCTURAL CHANGES:\n${feedback.structuralChanges.map(s => `- ${s}`).join('\n')}`;
    }

    prompt += `\n\nTarget word count: approximately ${targetWords} words.

Write the revised draft now, incorporating all feedback:`;

    return prompt;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // METHOD IMPLEMENTATIONS
  // ─────────────────────────────────────────────────────────────────────────

  const methods: DraftingMethods = {
    async startDrafting(options: StartDraftingOptions): Promise<DraftingSession> {
      const now = new Date();
      const session: DraftingSession = {
        id: randomUUID(),
        title: options.title,
        status: 'gathering',
        userId: options.userId,
        sources: options.sources,
        versions: [],
        currentVersion: 0,
        narratorPersonaId: options.narratorPersonaId,
        narratorPersona: options.narratorPersona ?? DEFAULT_NARRATOR_PERSONA,
        exportConfig: options.exportConfig,
        exports: [],
        metadata: {
          createdAt: now,
          updatedAt: now,
          totalGenerationMs: 0,
          feedbackRounds: 0,
        },
      };

      sessions.set(session.id, session);
      return session;
    },

    async gatherMaterial(
      sessionId: string,
      onProgress?: DraftingProgressCallback
    ): Promise<GatherResult> {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Drafting session "${sessionId}" not found`);
      }

      const startTime = Date.now();
      const allPassages: GatheredPassage[] = [];
      const sourceStats: GatherResult['sourceStats'] = [];

      session.status = 'gathering';
      session.metadata.updatedAt = new Date();

      const totalSources = session.sources.length;

      for (let i = 0; i < session.sources.length; i++) {
        const source = session.sources[i];
        const sourceStart = Date.now();

        onProgress?.({
          phase: 'gathering',
          step: i + 1,
          totalSteps: totalSources,
          message: `Gathering from ${source.type}...`,
          percentComplete: Math.round((i / totalSources) * 100),
        });

        try {
          let passages: GatheredPassage[] = [];

          switch (source.type) {
            case 'aui-archive':
              passages = await gatherFromAuiArchive(source);
              break;
            case 'aui-cluster':
              passages = await gatherFromAuiCluster(source);
              break;
            case 'file-path':
              passages = await gatherFromFilePath(source);
              break;
            case 'url':
              passages = await gatherFromUrl(source);
              break;
            case 'direct-text':
              passages = gatherFromDirectText(source);
              break;
          }

          allPassages.push(...passages);
          sourceStats.push({
            sourceType: source.type,
            count: passages.length,
            durationMs: Date.now() - sourceStart,
          });
        } catch (error) {
          sourceStats.push({
            sourceType: source.type,
            count: 0,
            durationMs: Date.now() - sourceStart,
            errors: [error instanceof Error ? error.message : String(error)],
          });
        }
      }

      const result: GatherResult = {
        passages: allPassages,
        sourceStats,
        totalDurationMs: Date.now() - startTime,
      };

      session.gatheredMaterial = result;
      session.status = 'drafting';
      session.metadata.updatedAt = new Date();

      onProgress?.({
        phase: 'gathering',
        step: totalSources,
        totalSteps: totalSources,
        message: `Gathered ${allPassages.length} passages from ${totalSources} sources`,
        percentComplete: 100,
      });

      return result;
    },

    async generateDraft(
      sessionId: string,
      options?: GenerateDraftOptions,
      onProgress?: DraftingProgressCallback
    ): Promise<DraftVersion> {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Drafting session "${sessionId}" not found`);
      }

      if (!session.gatheredMaterial || session.gatheredMaterial.passages.length === 0) {
        throw new Error('No material gathered. Call gatherMaterial first.');
      }

      session.status = 'drafting';
      session.metadata.updatedAt = new Date();

      onProgress?.({
        phase: 'drafting',
        step: 1,
        totalSteps: 2,
        message: 'Generating draft...',
        percentComplete: 25,
      });

      const startTime = Date.now();
      const persona = session.narratorPersona ?? DEFAULT_NARRATOR_PERSONA;
      const prompt = buildGenerationPrompt(session, session.gatheredMaterial.passages, options);

      const content = await callLlm(
        persona.systemPrompt,
        prompt,
        {
          temperature: persona.temperature,
          topP: persona.topP,
          model: options?.model,
        }
      );

      const generationMs = Date.now() - startTime;

      const version: DraftVersion = {
        version: session.versions.length + 1,
        content,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        createdAt: new Date(),
        feedbackApplied: null,
        model: options?.model,
        generationMs,
      };

      session.versions.push(version);
      session.currentVersion = version.version;
      session.status = 'awaiting-feedback';
      session.metadata.updatedAt = new Date();
      session.metadata.totalGenerationMs += generationMs;

      onProgress?.({
        phase: 'drafting',
        step: 2,
        totalSteps: 2,
        message: `Generated draft v${version.version} (${version.wordCount} words)`,
        percentComplete: 100,
      });

      return version;
    },

    async reviseDraft(
      sessionId: string,
      options: ReviseDraftOptions,
      onProgress?: DraftingProgressCallback
    ): Promise<DraftVersion> {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Drafting session "${sessionId}" not found`);
      }

      if (session.versions.length === 0) {
        throw new Error('No draft to revise. Call generateDraft first.');
      }

      const currentDraft = session.versions[session.currentVersion - 1];
      const feedback: UserFeedback = {
        ...options.feedback,
        providedAt: new Date(),
      };

      session.status = 'revising';
      session.pendingFeedback = feedback;
      session.metadata.updatedAt = new Date();

      onProgress?.({
        phase: 'revising',
        step: 1,
        totalSteps: 2,
        message: 'Applying feedback...',
        percentComplete: 25,
      });

      const startTime = Date.now();
      const persona = session.narratorPersona ?? DEFAULT_NARRATOR_PERSONA;
      const prompt = buildRevisionPrompt(session, currentDraft, feedback, options);

      const content = await callLlm(
        persona.systemPrompt,
        prompt,
        {
          temperature: (persona.temperature ?? 0.8) * 0.9, // Slightly lower for revisions
          topP: persona.topP,
          model: options.model,
        }
      );

      const generationMs = Date.now() - startTime;

      // Generate changes summary
      const wordCountDiff = content.split(/\s+/).filter(Boolean).length - currentDraft.wordCount;
      const changesSummary = `Revised based on feedback. Word count ${wordCountDiff >= 0 ? '+' : ''}${wordCountDiff}.`;

      const version: DraftVersion = {
        version: session.versions.length + 1,
        content,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        createdAt: new Date(),
        feedbackApplied: feedback,
        changesSummary,
        model: options.model,
        generationMs,
      };

      session.versions.push(version);
      session.currentVersion = version.version;
      session.pendingFeedback = undefined;
      session.status = 'awaiting-feedback';
      session.metadata.updatedAt = new Date();
      session.metadata.totalGenerationMs += generationMs;
      session.metadata.feedbackRounds++;

      onProgress?.({
        phase: 'revising',
        step: 2,
        totalSteps: 2,
        message: `Generated revision v${version.version} (${version.wordCount} words)`,
        percentComplete: 100,
      });

      return version;
    },

    async finalizeDraft(
      sessionId: string,
      config?: ExportConfig,
      onProgress?: DraftingProgressCallback
    ): Promise<ExportedArtifact[]> {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Drafting session "${sessionId}" not found`);
      }

      if (session.versions.length === 0) {
        throw new Error('No draft to finalize.');
      }

      const exportConfig = config ?? session.exportConfig ?? {
        formats: ['markdown', 'html'],
        htmlTheme: HUMANIZER_THEME,
        generateToc: true,
        includeMetadata: true,
      };

      session.status = 'finalizing';
      session.exportConfig = exportConfig;
      session.metadata.updatedAt = new Date();

      const artifacts: ExportedArtifact[] = [];
      const formats = exportConfig.formats;
      const totalSteps = formats.length + (exportConfig.outputDir ? formats.length : 0);
      let step = 0;

      for (const format of formats) {
        step++;
        onProgress?.({
          phase: 'finalizing',
          step,
          totalSteps,
          message: `Generating ${format}...`,
          percentComplete: Math.round((step / totalSteps) * 100),
        });

        let content: string;

        switch (format) {
          case 'markdown':
            content = generateMarkdownDocument(session, exportConfig);
            break;
          case 'html':
            content = generateHtmlDocument(session, exportConfig);
            break;
          case 'json':
            content = generateJsonDocument(session);
            break;
          default:
            continue;
        }

        const artifact: ExportedArtifact = {
          format,
          content,
          sizeBytes: Buffer.byteLength(content, 'utf-8'),
          exportedAt: new Date(),
        };

        // Save to file if output directory specified
        if (exportConfig.outputDir) {
          step++;
          onProgress?.({
            phase: 'finalizing',
            step,
            totalSteps,
            message: `Saving ${format} to file...`,
            percentComplete: Math.round((step / totalSteps) * 100),
          });

          try {
            await fs.mkdir(exportConfig.outputDir, { recursive: true });
            const prefix = exportConfig.filenamePrefix || session.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const ext = format === 'markdown' ? 'md' : format;
            const filename = `${prefix}.${ext}`;
            const filePath = path.join(exportConfig.outputDir, filename);
            await fs.writeFile(filePath, content, 'utf-8');
            artifact.filePath = filePath;
          } catch (error) {
            console.warn(`Failed to save ${format}:`, error);
          }
        }

        artifacts.push(artifact);
      }

      session.exports = artifacts;
      session.status = 'complete';
      session.metadata.updatedAt = new Date();

      onProgress?.({
        phase: 'complete',
        step: totalSteps,
        totalSteps,
        message: `Finalized with ${artifacts.length} exports`,
        percentComplete: 100,
      });

      return artifacts;
    },

    getDraftingSession(sessionId: string): DraftingSession | undefined {
      return sessions.get(sessionId);
    },

    listDraftingSessions(options?: {
      userId?: string;
      status?: DraftingStatus;
      limit?: number;
    }): DraftingSession[] {
      let results = Array.from(sessions.values());

      if (options?.userId) {
        results = results.filter(s => s.userId === options.userId);
      }

      if (options?.status) {
        results = results.filter(s => s.status === options.status);
      }

      // Sort by updated date descending
      results.sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime());

      if (options?.limit) {
        results = results.slice(0, options.limit);
      }

      return results;
    },

    deleteDraftingSession(sessionId: string): boolean {
      return sessions.delete(sessionId);
    },

    getDraftVersion(sessionId: string, version: number): DraftVersion | undefined {
      const session = sessions.get(sessionId);
      if (!session) return undefined;
      return session.versions.find(v => v.version === version);
    },

    compareDraftVersions(
      sessionId: string,
      fromVersion: number,
      toVersion: number
    ): { additions: string[]; removals: string[]; wordCountDiff: number } | undefined {
      const session = sessions.get(sessionId);
      if (!session) return undefined;

      const from = session.versions.find(v => v.version === fromVersion);
      const to = session.versions.find(v => v.version === toVersion);

      if (!from || !to) return undefined;

      // Simple word-based diff (for a real implementation, use a proper diff library)
      const fromWords = new Set(from.content.toLowerCase().split(/\s+/));
      const toWords = new Set(to.content.toLowerCase().split(/\s+/));

      const additions = [...toWords].filter(w => !fromWords.has(w)).slice(0, 20);
      const removals = [...fromWords].filter(w => !toWords.has(w)).slice(0, 20);

      return {
        additions,
        removals,
        wordCountDiff: to.wordCount - from.wordCount,
      };
    },
  };

  return methods;
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON ACCESS
// ═══════════════════════════════════════════════════════════════════════════

let draftingMethodsInstance: DraftingMethods | null = null;

export function setDraftingMethods(methods: DraftingMethods): void {
  draftingMethodsInstance = methods;
}

export function getDraftingMethods(): DraftingMethods | null {
  return draftingMethodsInstance;
}

export function resetDraftingMethods(): void {
  draftingMethodsInstance = null;
}
