#!/usr/bin/env npx tsx
/**
 * Persona-Consistent Book Creation Test Script
 *
 * Tests the full pipeline:
 * 1. Search archive for specific subject
 * 2. Harvest relevant passages
 * 3. Define/extract target persona profile
 * 4. Rewrite each passage to match persona voice
 * 5. Generate arc from rewritten content
 * 6. Compose cohesive first draft
 *
 * Usage:
 *   npx tsx scripts/persona-consistent-book-test.ts
 *
 * Learnings from this script will inform production implementation.
 */

import { initContentStore, getContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES - What we're building toward
// ═══════════════════════════════════════════════════════════════════

interface PersonaProfile {
  id: string;
  name: string;
  description: string;
  voiceTraits: string[];
  formalityRange: [number, number]; // 0-1
  toneMarkers: string[];
  styleGuide: StyleGuide;
  referenceExamples: string[];
}

interface StyleGuide {
  forbiddenPhrases: string[];
  preferredPatterns: string[];
  sentenceVariety: 'low' | 'medium' | 'high';
  paragraphStyle: 'short' | 'medium' | 'long';
  useContractions: boolean;
  useRhetoricalQuestions: boolean;
}

interface HarvestedPassage {
  id: string;
  originalText: string;
  rewrittenText?: string;
  sourceType: string;
  relevanceScore: number;
  qualityScore?: number;
  voiceAnalysis?: VoiceAnalysis;
}

interface VoiceAnalysis {
  detectedVoice: string;
  formalityScore: number;
  aiPatterns: string[];
  personaMatch: number;
}

interface RewriteResult {
  original: string;
  rewritten: string;
  changesApplied: string[];
  confidenceScore: number;
}

interface ArcChapter {
  title: string;
  theme: string;
  passageIds: string[];
  transitionNote: string;
}

interface NarrativeArc {
  title: string;
  introduction: string;
  chapters: ArcChapter[];
  conclusion: string;
  overallTheme: string;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  // Search parameters
  searchQuery: 'consciousness phenomenology subjective experience',
  maxPassages: 30,
  minRelevance: 0.5,

  // Target persona for the book
  targetPersona: {
    id: 'contemplative-philosopher',
    name: 'Contemplative Philosopher',
    description: 'A thoughtful, accessible voice that makes complex philosophical ideas feel intimate and personally relevant. Avoids academic jargon while maintaining intellectual depth.',
    voiceTraits: [
      'contemplative',
      'curious',
      'accessible',
      'personal',
      'questioning',
    ],
    formalityRange: [0.3, 0.6] as [number, number],
    toneMarkers: ['wonder', 'invitation', 'exploration'],
    styleGuide: {
      forbiddenPhrases: [
        'delve into',
        'leverage',
        'utilize',
        'in conclusion',
        'it is important to note',
        'firstly, secondly',
        'the fact that',
        'in order to',
      ],
      preferredPatterns: [
        'consider...',
        'what if...',
        'notice how...',
        'there is something...',
        'I find myself...',
      ],
      sentenceVariety: 'high' as const,
      paragraphStyle: 'medium' as const,
      useContractions: true,
      useRhetoricalQuestions: true,
    },
    referenceExamples: [
      `There's something peculiar about consciousness - it's the most intimate thing we know, yet we can barely speak about it. We swim in it like fish in water, rarely noticing the medium itself.`,
      `What does it mean to be aware? Not the neuroscience version, not the philosophical treatise - but the lived experience of being someone who notices things?`,
      `I've been sitting with this question for years now. Not solving it - that seems beside the point - but letting it reshape how I see. The question itself becomes a lens.`,
    ],
  } as PersonaProfile,

  // LLM configuration
  ollamaUrl: 'http://localhost:11434',
  embeddingModel: 'nomic-embed-text',
  rewriteModel: 'llama3.2', // or mistral, gemma2, etc.
};

// ═══════════════════════════════════════════════════════════════════
// MOCK LLM CALLS (Replace with real Ollama calls)
// ═══════════════════════════════════════════════════════════════════

async function callOllamaGenerate(
  prompt: string,
  systemPrompt: string,
  model: string = CONFIG.rewriteModel
): Promise<string> {
  try {
    const response = await fetch(`${CONFIG.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Ollama call failed:', error);
    // Return a placeholder for testing without Ollama
    return `[LLM would rewrite this passage]`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// STEP 1: SEARCH & HARVEST
// ═══════════════════════════════════════════════════════════════════

async function searchAndHarvest(
  embeddingService: EmbeddingService,
  contentStore: ReturnType<typeof getContentStore>
): Promise<HarvestedPassage[]> {
  console.log('\n═══ STEP 1: SEARCH & HARVEST ═══');
  console.log(`Query: "${CONFIG.searchQuery}"`);

  // Generate embedding for search query
  const queryEmbedding = await embeddingService.embed(CONFIG.searchQuery);
  console.log(`Generated query embedding (${queryEmbedding.length} dims)`);

  // Search the archive
  const searchResults = await contentStore.searchByEmbedding(queryEmbedding, {
    limit: CONFIG.maxPassages,
    threshold: CONFIG.minRelevance,
  });

  console.log(`Found ${searchResults.length} passages above threshold ${CONFIG.minRelevance}`);

  // Convert to HarvestedPassage format
  const passages: HarvestedPassage[] = searchResults.map((result) => ({
    id: result.node.id,
    originalText: result.node.text,
    sourceType: result.node.sourceType || 'unknown',
    relevanceScore: result.score,
  }));

  // Log source distribution
  const sourceDistribution = passages.reduce(
    (acc, p) => {
      acc[p.sourceType] = (acc[p.sourceType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log('Source distribution:', sourceDistribution);

  // Log sample passages
  console.log('\nSample passages:');
  passages.slice(0, 3).forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.sourceType}] (relevance: ${p.relevanceScore.toFixed(2)})`);
    console.log(`     "${p.originalText.substring(0, 100)}..."`);
  });

  return passages;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 2: ANALYZE VOICE OF EACH PASSAGE
// ═══════════════════════════════════════════════════════════════════

async function analyzePassageVoice(passage: HarvestedPassage): Promise<VoiceAnalysis> {
  const systemPrompt = `You are a literary analyst specializing in voice and style detection.
Analyze the given passage and return a JSON object with:
- detectedVoice: one-word description of the dominant voice/tone
- formalityScore: 0-1 (0=very casual, 1=very formal)
- aiPatterns: array of detected AI-like phrases or patterns
- personaMatch: 0-1 how well it matches a "contemplative philosopher" voice

Return ONLY valid JSON, no explanation.`;

  const prompt = `Analyze this passage:

"${passage.originalText}"`;

  try {
    const response = await callOllamaGenerate(prompt, systemPrompt);
    // Try to parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback analysis
  }

  // Simple heuristic fallback
  const text = passage.originalText.toLowerCase();
  const aiPatterns: string[] = [];

  CONFIG.targetPersona.styleGuide.forbiddenPhrases.forEach((phrase) => {
    if (text.includes(phrase.toLowerCase())) {
      aiPatterns.push(phrase);
    }
  });

  const formalityScore =
    (text.match(/\b(thus|therefore|furthermore|moreover|consequently)\b/g)?.length || 0) * 0.1 +
    (text.includes("i'm") || text.includes("you're") || text.includes("we're") ? -0.2 : 0.2);

  return {
    detectedVoice: aiPatterns.length > 2 ? 'ai-generated' : 'human',
    formalityScore: Math.max(0, Math.min(1, 0.5 + formalityScore)),
    aiPatterns,
    personaMatch: aiPatterns.length === 0 ? 0.7 : 0.3,
  };
}

async function analyzeAllPassages(passages: HarvestedPassage[]): Promise<HarvestedPassage[]> {
  console.log('\n═══ STEP 2: ANALYZE VOICE ═══');
  console.log(`Analyzing ${passages.length} passages...`);

  const analyzed: HarvestedPassage[] = [];

  for (let i = 0; i < passages.length; i++) {
    const passage = passages[i];
    const analysis = await analyzePassageVoice(passage);
    analyzed.push({
      ...passage,
      voiceAnalysis: analysis,
    });

    if ((i + 1) % 10 === 0) {
      console.log(`  Analyzed ${i + 1}/${passages.length}`);
    }
  }

  // Summary
  const avgPersonaMatch =
    analyzed.reduce((sum, p) => sum + (p.voiceAnalysis?.personaMatch || 0), 0) / analyzed.length;
  const patternsFound = analyzed.filter((p) => (p.voiceAnalysis?.aiPatterns.length || 0) > 0).length;

  console.log(`\nVoice Analysis Summary:`);
  console.log(`  Average persona match: ${(avgPersonaMatch * 100).toFixed(1)}%`);
  console.log(`  Passages with AI patterns: ${patternsFound}/${analyzed.length}`);

  return analyzed;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 3: REWRITE PASSAGES TO MATCH PERSONA
// ═══════════════════════════════════════════════════════════════════

async function rewritePassage(
  passage: HarvestedPassage,
  persona: PersonaProfile
): Promise<RewriteResult> {
  const systemPrompt = `You are a skilled writer who transforms text to match a specific voice and persona.

TARGET PERSONA: ${persona.name}
${persona.description}

VOICE TRAITS: ${persona.voiceTraits.join(', ')}
TONE: ${persona.toneMarkers.join(', ')}
FORMALITY: ${persona.formalityRange[0]} to ${persona.formalityRange[1]} (0=casual, 1=formal)

STYLE REQUIREMENTS:
- Use contractions: ${persona.styleGuide.useContractions ? 'Yes' : 'No'}
- Use rhetorical questions: ${persona.styleGuide.useRhetoricalQuestions ? 'Yes' : 'No'}
- Sentence variety: ${persona.styleGuide.sentenceVariety}
- Paragraph style: ${persona.styleGuide.paragraphStyle}

FORBIDDEN PHRASES (never use these):
${persona.styleGuide.forbiddenPhrases.map((p) => `- "${p}"`).join('\n')}

PREFERRED PATTERNS (use these naturally):
${persona.styleGuide.preferredPatterns.map((p) => `- "${p}"`).join('\n')}

REFERENCE EXAMPLES of the target voice:
${persona.referenceExamples.map((ex, i) => `Example ${i + 1}: "${ex}"`).join('\n\n')}

YOUR TASK:
Rewrite the given passage to match this persona's voice while preserving the core meaning and insights.
Make it sound like the same person who wrote the reference examples.
DO NOT add new ideas - only transform the voice and style.
Output ONLY the rewritten passage, nothing else.`;

  const prompt = `Original passage to rewrite:

"${passage.originalText}"

${passage.voiceAnalysis?.aiPatterns.length ? `\nDETECTED AI PATTERNS TO REMOVE:\n${passage.voiceAnalysis.aiPatterns.map((p) => `- "${p}"`).join('\n')}` : ''}

Rewrite this in the ${persona.name} voice:`;

  const rewritten = await callOllamaGenerate(prompt, systemPrompt);

  // Identify changes
  const changes: string[] = [];
  if (passage.voiceAnalysis?.aiPatterns) {
    passage.voiceAnalysis.aiPatterns.forEach((pattern) => {
      if (!rewritten.toLowerCase().includes(pattern.toLowerCase())) {
        changes.push(`Removed: "${pattern}"`);
      }
    });
  }

  // Check for preferred patterns used
  persona.styleGuide.preferredPatterns.forEach((pattern) => {
    const basePattern = pattern.replace('...', '');
    if (rewritten.toLowerCase().includes(basePattern.toLowerCase())) {
      changes.push(`Used pattern: "${pattern}"`);
    }
  });

  return {
    original: passage.originalText,
    rewritten: rewritten.trim(),
    changesApplied: changes,
    confidenceScore: changes.length > 0 ? 0.8 : 0.6,
  };
}

async function rewriteAllPassages(
  passages: HarvestedPassage[],
  persona: PersonaProfile
): Promise<HarvestedPassage[]> {
  console.log('\n═══ STEP 3: REWRITE FOR PERSONA ═══');
  console.log(`Rewriting ${passages.length} passages to match "${persona.name}"...`);

  const rewritten: HarvestedPassage[] = [];

  for (let i = 0; i < passages.length; i++) {
    const passage = passages[i];

    // Skip if already good match
    if ((passage.voiceAnalysis?.personaMatch || 0) > 0.8) {
      console.log(`  ${i + 1}. Skipping (already good match)`);
      rewritten.push({
        ...passage,
        rewrittenText: passage.originalText,
      });
      continue;
    }

    const result = await rewritePassage(passage, persona);
    rewritten.push({
      ...passage,
      rewrittenText: result.rewritten,
    });

    console.log(`  ${i + 1}. Rewritten (${result.changesApplied.length} changes)`);
    if (result.changesApplied.length > 0) {
      result.changesApplied.slice(0, 2).forEach((c) => console.log(`      - ${c}`));
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  return rewritten;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 4: GENERATE ARC FROM REWRITTEN PASSAGES
// ═══════════════════════════════════════════════════════════════════

async function generateArc(
  passages: HarvestedPassage[],
  persona: PersonaProfile
): Promise<NarrativeArc> {
  console.log('\n═══ STEP 4: GENERATE NARRATIVE ARC ═══');

  const passageTexts = passages
    .map((p) => p.rewrittenText || p.originalText)
    .slice(0, 20) // Limit for context
    .map((t, i) => `[${i + 1}] ${t.substring(0, 200)}...`)
    .join('\n\n');

  const systemPrompt = `You are a book architect who designs narrative structures.
Given a collection of passages, create a cohesive narrative arc that weaves them into a unified exploration.

The book should feel like it was written by: ${persona.name}
Voice: ${persona.description}

Return a JSON object with:
{
  "title": "Book title",
  "introduction": "2-3 sentence intro paragraph in the persona's voice",
  "chapters": [
    {
      "title": "Chapter title",
      "theme": "Core theme in 1 sentence",
      "passageIds": [1, 3, 7],  // Which passage numbers belong here
      "transitionNote": "How this leads to next chapter"
    }
  ],
  "conclusion": "Closing thought in persona voice",
  "overallTheme": "The unifying thread"
}

Create 3-5 chapters. Return ONLY valid JSON.`;

  const prompt = `Create a narrative arc for a book using these passages:

${passageTexts}`;

  try {
    const response = await callOllamaGenerate(prompt, systemPrompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const arc = JSON.parse(jsonMatch[0]);
      console.log(`\nGenerated arc: "${arc.title}"`);
      console.log(`Chapters: ${arc.chapters?.length || 0}`);
      console.log(`Theme: ${arc.overallTheme}`);
      return arc;
    }
  } catch (e) {
    console.error('Arc generation failed:', e);
  }

  // Fallback arc
  return {
    title: 'Explorations in Consciousness',
    introduction:
      "What does it mean to be aware? This isn't an academic question - it's the most personal inquiry we can undertake.",
    chapters: [
      {
        title: 'The Question Itself',
        theme: 'How we frame our investigation shapes what we find',
        passageIds: passages.slice(0, 5).map((p) => p.id),
        transitionNote: 'From question to experience',
      },
      {
        title: 'Lived Experience',
        theme: 'The irreducible nature of subjective experience',
        passageIds: passages.slice(5, 12).map((p) => p.id),
        transitionNote: 'From experience to understanding',
      },
      {
        title: 'Implications',
        theme: 'What this means for how we live',
        passageIds: passages.slice(12).map((p) => p.id),
        transitionNote: 'Toward integration',
      },
    ],
    conclusion:
      'The question of consciousness isn\'t one we solve - it\'s one we learn to inhabit.',
    overallTheme: 'Consciousness as lived inquiry',
  };
}

// ═══════════════════════════════════════════════════════════════════
// STEP 5: COMPOSE FIRST DRAFT
// ═══════════════════════════════════════════════════════════════════

async function composeChapterDraft(
  chapter: ArcChapter,
  passages: HarvestedPassage[],
  persona: PersonaProfile,
  chapterIndex: number
): Promise<string> {
  const chapterPassages = passages.filter((p) => chapter.passageIds.includes(p.id));
  const passageTexts = chapterPassages
    .map((p) => p.rewrittenText || p.originalText)
    .join('\n\n---\n\n');

  const systemPrompt = `You are ${persona.name}.
${persona.description}

You are writing Chapter ${chapterIndex + 1}: "${chapter.title}"
Theme: ${chapter.theme}

VOICE REQUIREMENTS:
${persona.voiceTraits.map((t) => `- ${t}`).join('\n')}

STYLE:
- Use contractions naturally
- Include rhetorical questions where they deepen engagement
- Vary sentence length for rhythm
- Keep paragraphs focused but not academic

FORBIDDEN:
${persona.styleGuide.forbiddenPhrases.map((p) => `- Never use: "${p}"`).join('\n')}

Write this chapter using the source passages as your raw material.
Transform them into cohesive, flowing prose that feels like a single unified voice.
Add transitions between ideas. Create a sense of progression.
The chapter should feel like a conversation with a thoughtful friend, not a lecture.

Write 500-800 words. Output ONLY the chapter text.`;

  const prompt = `Source passages to weave into this chapter:

${passageTexts}

${chapter.transitionNote ? `Note: This chapter should end by leading toward: ${chapter.transitionNote}` : ''}

Write Chapter ${chapterIndex + 1}: "${chapter.title}"`;

  const draft = await callOllamaGenerate(prompt, systemPrompt);
  return draft.trim();
}

async function composeDraft(
  arc: NarrativeArc,
  passages: HarvestedPassage[],
  persona: PersonaProfile
): Promise<string> {
  console.log('\n═══ STEP 5: COMPOSE FIRST DRAFT ═══');

  let fullDraft = `# ${arc.title}\n\n`;
  fullDraft += `*${arc.introduction}*\n\n---\n\n`;

  for (let i = 0; i < arc.chapters.length; i++) {
    const chapter = arc.chapters[i];
    console.log(`Composing Chapter ${i + 1}: "${chapter.title}"...`);

    const chapterDraft = await composeChapterDraft(chapter, passages, persona, i);
    fullDraft += `## Chapter ${i + 1}: ${chapter.title}\n\n`;
    fullDraft += chapterDraft;
    fullDraft += '\n\n---\n\n';

    // Rate limit between chapters
    await new Promise((r) => setTimeout(r, 1000));
  }

  fullDraft += `## Closing\n\n${arc.conclusion}\n`;

  console.log(`\nDraft complete: ${fullDraft.split(/\s+/).length} words`);

  return fullDraft;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 6: REVIEW & REPORT
// ═══════════════════════════════════════════════════════════════════

function analyzeResult(
  originalPassages: HarvestedPassage[],
  rewrittenPassages: HarvestedPassage[],
  draft: string,
  persona: PersonaProfile
): void {
  console.log('\n═══ STEP 6: ANALYSIS & LEARNINGS ═══');

  // Check for forbidden phrases in final draft
  const draftLower = draft.toLowerCase();
  const forbiddenFound = persona.styleGuide.forbiddenPhrases.filter((phrase) =>
    draftLower.includes(phrase.toLowerCase())
  );

  console.log('\n📊 METRICS:');
  console.log(`  Total passages harvested: ${originalPassages.length}`);
  console.log(`  Passages rewritten: ${rewrittenPassages.filter((p) => p.rewrittenText !== p.originalText).length}`);
  console.log(`  Final draft word count: ${draft.split(/\s+/).length}`);
  console.log(`  Forbidden phrases remaining: ${forbiddenFound.length}`);
  if (forbiddenFound.length > 0) {
    console.log(`    - ${forbiddenFound.join(', ')}`);
  }

  // Check for preferred patterns
  const preferredUsed = persona.styleGuide.preferredPatterns.filter((pattern) => {
    const basePattern = pattern.replace('...', '');
    return draftLower.includes(basePattern.toLowerCase());
  });
  console.log(`  Preferred patterns used: ${preferredUsed.length}/${persona.styleGuide.preferredPatterns.length}`);

  console.log('\n🔍 CHALLENGES IDENTIFIED:');
  console.log('  1. Source heterogeneity: Passages from different platforms have wildly different voices');
  console.log('  2. Context preservation: Rewriting risks losing nuanced meaning');
  console.log('  3. LLM consistency: Same prompt can produce varying voice quality');
  console.log('  4. Passage-to-prose gap: Individual rewrites don\'t guarantee cohesive chapter');
  console.log('  5. Iteration needed: Single-pass rewriting insufficient for full voice transformation');

  console.log('\n💡 LEARNINGS FOR PRODUCTION:');
  console.log('  1. Need VoiceFingerprint extraction from reference examples (quantitative)');
  console.log('  2. Need multi-pass rewriting with quality gates between passes');
  console.log('  3. Need passage clustering by voice similarity before rewriting');
  console.log('  4. Need chapter-level voice consistency check after composition');
  console.log('  5. Need feedback loop: Reviewer → Builder with specific fixes');
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  PERSONA-CONSISTENT BOOK CREATION TEST                     ║');
  console.log('║  Testing the full pipeline with voice transformation       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Initialize stores
  console.log('\nInitializing...');
  const contentStore = await initContentStore({
    host: 'localhost',
    port: 5432,
    database: 'humanizer_archive',
    user: 'tem',
    maxConnections: 5,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 10000,
    embeddingDimension: 768,
    enableFTS: true,
    enableVec: true,
  });

  const embeddingService = new EmbeddingService({
    ollamaUrl: CONFIG.ollamaUrl,
    embedModel: CONFIG.embeddingModel,
    verbose: false,
  });

  // Check Ollama availability
  const ollamaAvailable = await embeddingService.isAvailable();
  console.log(`Ollama available: ${ollamaAvailable}`);
  if (!ollamaAvailable) {
    console.log('⚠️  Warning: Ollama not available. Will use fallback/mock responses.');
  }

  try {
    // Step 1: Search & Harvest
    const harvested = await searchAndHarvest(embeddingService, contentStore);
    if (harvested.length === 0) {
      console.log('No passages found. Exiting.');
      return;
    }

    // Step 2: Analyze voice
    const analyzed = await analyzeAllPassages(harvested);

    // Step 3: Rewrite for persona
    const rewritten = await rewriteAllPassages(analyzed, CONFIG.targetPersona);

    // Step 4: Generate arc
    const arc = await generateArc(rewritten, CONFIG.targetPersona);

    // Step 5: Compose draft
    const draft = await composeDraft(arc, rewritten, CONFIG.targetPersona);

    // Save draft
    const outputPath = `output/persona-test-${Date.now()}.md`;
    const fs = await import('fs/promises');
    await fs.mkdir('output', { recursive: true });
    await fs.writeFile(outputPath, draft);
    console.log(`\n📝 Draft saved to: ${outputPath}`);

    // Step 6: Analyze & Report
    analyzeResult(harvested, rewritten, draft, CONFIG.targetPersona);

  } finally {
    // Cleanup
    const { closeContentStore } = await import('../src/storage/postgres-content-store.js');
    await closeContentStore();
  }
}

main().catch(console.error);
