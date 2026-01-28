/**
 * Test DraftingLoopService on Building Humanizer Content
 *
 * Tests the full drafting workflow:
 * 1. Start session with file-path source
 * 2. Gather material from LLM benchmark data
 * 3. Generate initial draft with DEFAULT_NARRATOR_PERSONA
 * 4. Apply feedback (no preachy language, lighter philosophy)
 * 5. Export with HUMANIZER_THEME (system color scheme support)
 *
 * Usage:
 *   npx tsx scripts/test-drafting-service.ts
 */

import * as path from 'path';
import {
  createDraftingMethods,
  DEFAULT_NARRATOR_PERSONA,
  type DraftingMethods,
} from '../src/aui/service/drafting.js';
import { HUMANIZER_THEME } from '../src/aui/service/export-templates.js';
import type { ServiceDependencies } from '../src/aui/service/types.js';
import type { ClusteringMethods } from '../src/aui/service/archive-clustering.js';
import type { BookMethods } from '../src/aui/service/books.js';
import type { DraftSource, DraftingProgress } from '../src/aui/types/drafting-types.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Source data paths
  benchmarkDataPath: '/Users/tem/archive/llm-benchmark-data',
  outputDir: path.join(process.cwd(), 'humanizer-output'),

  // Generation settings
  title: 'Building Humanizer - Drafting Service Test',
  targetWordCount: 1200,

  // Model selection (optional - uses default if not set)
  model: process.env.OLLAMA_MODEL || undefined,
};

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DEPENDENCIES (for standalone testing)
// ═══════════════════════════════════════════════════════════════════════════

function createMockDeps(): ServiceDependencies {
  return {
    getStore: () => null,
    getBooksStore: () => null,
    getArchiveStore: () => null,
    getAgenticSearch: () => null,
    getAgenticLoop: () => null,
    getAdminService: () => null,
    getBqlExecutor: () => null,
    getBufferService: () => ({ createFromText: async () => null, rewriteForPersona: async () => null } as any),
    getBufferManager: () => ({ createBuffer: async () => null } as any),
    getSessionManager: () => ({
      create: async () => ({ id: 'test-session' }),
      get: async () => null,
      touch: async () => {},
    } as any),
    getDefaultEmbeddingModel: () => 'nomic-embed-text:latest',
    getBooks: () => new Map(),
    getHarvestSessions: () => new Map(),
    getSessionCache: () => new Map(),
  };
}

function createMockClusteringMethods(): ClusteringMethods {
  return {
    discoverClusters: async () => ({ clusters: [], stats: { totalPassages: 0, clusteredPassages: 0, noisePassages: 0, durationMs: 0 } }),
    listClusters: async () => [],
    getCluster: async () => null,
    saveCluster: async () => {},
  } as unknown as ClusteringMethods;
}

function createMockBookMethods(): BookMethods {
  return {
    createBookFromCluster: async () => null,
    createBookWithPersona: async () => null,
    harvest: async () => ({ passages: [], query: '', candidatesFound: 0, durationMs: 0 }),
    generateArc: async () => null,
    listBooks: async () => [],
    getBook: async () => null,
  } as unknown as BookMethods;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS CALLBACK
// ═══════════════════════════════════════════════════════════════════════════

function logProgress(progress: DraftingProgress): void {
  const bar = '█'.repeat(Math.round(progress.percentComplete / 5)) + '░'.repeat(20 - Math.round(progress.percentComplete / 5));
  console.log(`  [${bar}] ${progress.percentComplete}% - ${progress.phase}: ${progress.message}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DraftingLoopService Test - Building Humanizer Content');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Create service
  const deps = createMockDeps();
  const clusteringMethods = createMockClusteringMethods();
  const bookMethods = createMockBookMethods();
  const draftingMethods = createDraftingMethods(deps, clusteringMethods, bookMethods);

  console.log('✓ Created DraftingMethods\n');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Start drafting session with file-path source
  // ─────────────────────────────────────────────────────────────────────────

  console.log('STEP 1: Starting drafting session...');

  const sources: DraftSource[] = [
    {
      type: 'file-path',
      path: CONFIG.benchmarkDataPath,
      pattern: '*.md',
      parseMarkdown: false, // Keep files intact as sources
    },
  ];

  const session = await draftingMethods.startDrafting({
    title: CONFIG.title,
    sources,
    // Use default narrator persona
    narratorPersona: DEFAULT_NARRATOR_PERSONA,
    exportConfig: {
      formats: ['markdown', 'html', 'json'],
      htmlTheme: HUMANIZER_THEME,
      generateToc: true,
      includeMetadata: true,
      outputDir: CONFIG.outputDir,
      filenamePrefix: 'drafting-test',
    },
  });

  console.log(`  Session ID: ${session.id}`);
  console.log(`  Title: ${session.title}`);
  console.log(`  Narrator: ${session.narratorPersona?.name}`);
  console.log(`  Sources: ${sources.length}`);
  console.log();

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Gather material
  // ─────────────────────────────────────────────────────────────────────────

  console.log('STEP 2: Gathering material from sources...\n');

  const gatherResult = await draftingMethods.gatherMaterial(session.id, logProgress);

  console.log(`\n  Passages gathered: ${gatherResult.passages.length}`);
  console.log(`  Total duration: ${gatherResult.totalDurationMs}ms`);
  console.log('  Source stats:');
  for (const stat of gatherResult.sourceStats) {
    console.log(`    - ${stat.sourceType}: ${stat.count} passages (${stat.durationMs}ms)`);
    if (stat.errors?.length) {
      console.log(`      Errors: ${stat.errors.join(', ')}`);
    }
  }
  console.log();

  // Show sample passages
  console.log('  Sample passages:');
  for (const passage of gatherResult.passages.slice(0, 3)) {
    console.log(`    [${passage.id}] ${passage.excerpt?.slice(0, 80)}...`);
  }
  console.log();

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Generate initial draft
  // ─────────────────────────────────────────────────────────────────────────

  console.log('STEP 3: Generating initial draft...\n');

  try {
    const draft1 = await draftingMethods.generateDraft(
      session.id,
      {
        targetWordCount: CONFIG.targetWordCount,
        guidance: `Focus on the development journey and the tools being built.
                   Tell the STORY of building software with AI assistance.
                   Draw insights from the benchmark data about what makes writing feel authentic.`,
        model: CONFIG.model,
      },
      logProgress
    );

    console.log(`\n  Draft v${draft1.version} generated`);
    console.log(`  Word count: ${draft1.wordCount}`);
    console.log(`  Generation time: ${draft1.generationMs}ms`);
    console.log();

    // Show draft preview
    console.log('  Draft preview (first 500 chars):');
    console.log('  ─────────────────────────────────────');
    console.log(`  ${draft1.content.slice(0, 500)}...`);
    console.log('  ─────────────────────────────────────');
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Apply feedback (no preachy language, lighter philosophy)
    // ─────────────────────────────────────────────────────────────────────────

    console.log('STEP 4: Applying feedback (no preachy language, lighter philosophy)...\n');

    const draft2 = await draftingMethods.reviseDraft(
      session.id,
      {
        feedback: {
          text: `The draft needs revision to remove preachy or heavy-handed language.
                 The philosophy should be LIGHTER - show through action and observation,
                 not through explicit statements about meaning or importance.

                 Avoid:
                 - "testament to" or "speaks to the power of"
                 - phrases like "liberation", "spiritual", "profound"
                 - academic hedging (furthermore, moreover, thus)
                 - any AI-tell phrases (delve, dive into, rich tapestry)

                 Instead:
                 - Stay grounded in specific, concrete details
                 - Let insights emerge from the narrative, don't announce them
                 - Use dry humor and self-questioning
                 - Keep the confessional tone but don't overdramatize`,
          toneAdjustments: [
            'Lighter philosophical touch',
            'More concrete, less abstract',
            'Dry humor over earnestness',
          ],
          removeContent: [
            'Any explicit "this means" statements',
            'Inspirational or triumphant language',
            'Heavy-handed philosophy',
          ],
        },
        targetWordCount: CONFIG.targetWordCount,
        model: CONFIG.model,
      },
      logProgress
    );

    console.log(`\n  Draft v${draft2.version} generated`);
    console.log(`  Word count: ${draft2.wordCount}`);
    console.log(`  Changes: ${draft2.changesSummary}`);
    console.log();

    // Show revised preview
    console.log('  Revised draft preview (first 500 chars):');
    console.log('  ─────────────────────────────────────');
    console.log(`  ${draft2.content.slice(0, 500)}...`);
    console.log('  ─────────────────────────────────────');
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Compare versions
    // ─────────────────────────────────────────────────────────────────────────

    console.log('STEP 5: Comparing versions...\n');

    const diff = draftingMethods.compareDraftVersions(session.id, 1, 2);
    if (diff) {
      console.log(`  Word count change: ${diff.wordCountDiff >= 0 ? '+' : ''}${diff.wordCountDiff}`);
      console.log(`  Sample additions: ${diff.additions.slice(0, 5).join(', ')}`);
      console.log(`  Sample removals: ${diff.removals.slice(0, 5).join(', ')}`);
    }
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Finalize and export
    // ─────────────────────────────────────────────────────────────────────────

    console.log('STEP 6: Finalizing and exporting...\n');

    const exports = await draftingMethods.finalizeDraft(session.id, undefined, logProgress);

    console.log(`\n  Exported ${exports.length} artifacts:`);
    for (const exp of exports) {
      console.log(`    - ${exp.format}: ${(exp.sizeBytes / 1024).toFixed(1)}KB`);
      if (exp.filePath) {
        console.log(`      → ${exp.filePath}`);
      }
    }
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────

    const finalSession = draftingMethods.getDraftingSession(session.id);
    if (finalSession) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  SESSION SUMMARY');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`  Title: ${finalSession.title}`);
      console.log(`  Status: ${finalSession.status}`);
      console.log(`  Versions: ${finalSession.versions.length}`);
      console.log(`  Current version: ${finalSession.currentVersion}`);
      console.log(`  Total generation time: ${finalSession.metadata.totalGenerationMs}ms`);
      console.log(`  Feedback rounds: ${finalSession.metadata.feedbackRounds}`);
      console.log(`  Exports: ${finalSession.exports.length}`);
      console.log();
    }

    console.log('✓ Test completed successfully!\n');

  } catch (error) {
    console.error('\n✗ Error during draft generation:');
    console.error(error);
    console.log('\nNote: This test requires Ollama running with a model available.');
    console.log('Start Ollama and try: OLLAMA_MODEL=llama3.2:3b npx tsx scripts/test-drafting-service.ts');
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════════

main().catch(console.error);
