/**
 * Project Gutenberg SIC Baseline Survey
 *
 * Analyzes curated passages from classic literature to establish
 * human writing baselines for SIC features by genre.
 *
 * Usage:
 *   HUMANIZER_AUTH_TOKEN=xxx npx tsx scripts/gutenberg-sic-survey.ts
 *
 * Options:
 *   --resume     Resume from checkpoint
 *   --dry-run    Fetch passages but don't run SIC analysis
 *   --limit=N    Process only N samples
 */

import { SURVEY_BOOKS, getAllSamples, type BookDefinition, type LiteraryContext } from './gutenberg-sample-list';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Configuration
// ============================================================

const AUTH_TOKEN = process.env.HUMANIZER_AUTH_TOKEN;
const API_URL = 'https://npe-api.tem-527.workers.dev';
const OUTPUT_DIR = path.join(process.cwd(), 'data');
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'gutenberg-survey-checkpoint.json');
const RESULTS_FILE = path.join(OUTPUT_DIR, 'gutenberg-sic-survey.json');

const RATE_LIMIT_MS = 1000; // 1 second between SIC calls
const MIN_WORDS = 200;
const MAX_WORDS = 1500;

// ============================================================
// Types
// ============================================================

interface SicFeatureScore {
  score: number;
  notes: string;
  evidence?: Array<{ quote: string; relevance: string }>;
}

interface SicResult {
  version: string;
  sicScore: number;
  aiProbability: number;
  genre: string;
  features: Record<string, SicFeatureScore>;
  constraintGaps: string[];
  notes: string;
  processingTimeMs: number;
}

interface SurveyResult {
  sampleId: string;
  timestamp: string;

  // Book metadata
  book: {
    gutenbergId: number;
    title: string;
    author: string;
    publicationYear: number;
    genre: string;
    literaryPeriod: string;
  };

  // Passage metadata
  passage: {
    chapterIndex: number;
    chapterTitle: string;
    wordCount: number;
    charCount: number;
    textPreview: string; // First 200 chars
  };

  // Literary context
  literaryContext: LiteraryContext;

  // SIC results
  sic: SicResult | { error: string };

  // Comparison
  expectedVsActual?: {
    feature: string;
    expected: 'high' | 'medium' | 'low';
    actual: number;
    match: boolean;
  }[];
}

interface CheckpointData {
  completedSampleIds: string[];
  results: SurveyResult[];
  lastUpdated: string;
}

// ============================================================
// API Functions
// ============================================================

function getAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
  };
}

async function fetchBookStructure(gutenbergId: number): Promise<any> {
  const response = await fetch(`${API_URL}/gutenberg/book/${gutenbergId}/structure`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch book structure: ${response.status}`);
  }

  return response.json();
}

async function fetchSection(gutenbergId: number, sectionIndex: number): Promise<string> {
  const response = await fetch(`${API_URL}/gutenberg/book/${gutenbergId}/section/${sectionIndex}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch section: ${response.status}`);
  }

  const data = await response.json();
  return data.content || '';
}

async function runSicAnalysis(text: string): Promise<SicResult> {
  const response = await fetch(`${API_URL}/ai-detection/sic/sic`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SIC analysis failed: ${response.status} - ${error}`);
  }

  return response.json();
}

// ============================================================
// Text Processing
// ============================================================

function extractPassage(fullText: string, targetWords: number = 800): string {
  // Split into paragraphs
  const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 50);

  if (paragraphs.length === 0) {
    return fullText.slice(0, 5000);
  }

  // Accumulate paragraphs until we reach target
  let passage = '';
  let wordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;

    if (wordCount + paraWords > MAX_WORDS && wordCount >= MIN_WORDS) {
      break;
    }

    passage += para + '\n\n';
    wordCount += paraWords;

    if (wordCount >= targetWords) {
      break;
    }
  }

  return passage.trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// ============================================================
// Checkpoint Management
// ============================================================

function loadCheckpoint(): CheckpointData | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveCheckpoint(data: CheckpointData): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function saveResults(results: SurveyResult[]): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalSamples: results.length,
    books: [...new Set(results.map(r => r.book.title))],
    results,
  }, null, 2));
}

// ============================================================
// Analysis Helpers
// ============================================================

function compareExpectedVsActual(
  context: LiteraryContext,
  sicResult: SicResult
): SurveyResult['expectedVsActual'] {
  return context.expectedFeatures.map(expected => {
    const featureKey = expected.feature.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
    const actualScore = sicResult.features[featureKey]?.score ||
                        sicResult.features[expected.feature]?.score || 0;

    let match = false;
    if (expected.expectation === 'high' && actualScore >= 60) match = true;
    if (expected.expectation === 'medium' && actualScore >= 30 && actualScore < 70) match = true;
    if (expected.expectation === 'low' && actualScore < 40) match = true;

    return {
      feature: expected.feature,
      expected: expected.expectation,
      actual: actualScore,
      match,
    };
  });
}

// ============================================================
// Main Survey
// ============================================================

async function runSurvey(options: {
  resume?: boolean;
  dryRun?: boolean;
  limit?: number;
}) {
  console.log('='.repeat(60));
  console.log('Project Gutenberg SIC Baseline Survey');
  console.log('='.repeat(60));

  if (!AUTH_TOKEN) {
    console.error('\nError: HUMANIZER_AUTH_TOKEN environment variable required');
    console.error('Get token from browser: localStorage.getItem("narrative-studio-auth-token")');
    process.exit(1);
  }

  console.log(`\nAPI: ${API_URL}`);
  console.log(`Auth: ${AUTH_TOKEN.substring(0, 20)}...`);

  // Load checkpoint if resuming
  let checkpoint = options.resume ? loadCheckpoint() : null;
  const completedIds = new Set(checkpoint?.completedSampleIds || []);
  const results: SurveyResult[] = checkpoint?.results || [];

  if (checkpoint) {
    console.log(`\nResuming from checkpoint: ${completedIds.size} samples completed`);
  }

  // Get all samples
  let samples = getAllSamples();

  if (options.limit) {
    samples = samples.slice(0, options.limit);
  }

  console.log(`\nTotal samples to process: ${samples.length}`);
  console.log(`Already completed: ${completedIds.size}`);
  console.log(`Remaining: ${samples.length - completedIds.size}`);

  // Cache book structures
  const bookStructures = new Map<number, any>();

  // Process each sample
  let processed = 0;
  for (const sample of samples) {
    const { book, chapter, sampleId } = sample;

    // Skip if already completed
    if (completedIds.has(sampleId)) {
      continue;
    }

    processed++;
    console.log(`\n[${processed}/${samples.length - completedIds.size}] ${book.title} - ${chapter.chapterTitle}`);

    try {
      // Fetch book structure if not cached
      if (!bookStructures.has(book.gutenbergId)) {
        console.log(`  Fetching book structure...`);
        const structure = await fetchBookStructure(book.gutenbergId);
        bookStructures.set(book.gutenbergId, structure);
      }

      const structure = bookStructures.get(book.gutenbergId);

      // Find the section
      if (!structure.sections || structure.sections.length <= chapter.chapterIndex) {
        console.log(`  Warning: Chapter index ${chapter.chapterIndex} not found, skipping`);
        continue;
      }

      // Fetch section content
      console.log(`  Fetching chapter content...`);
      const fullContent = await fetchSection(book.gutenbergId, chapter.chapterIndex);

      // Extract passage
      const passage = extractPassage(fullContent);
      const wordCount = countWords(passage);
      console.log(`  Extracted ${wordCount} words`);

      if (wordCount < MIN_WORDS) {
        console.log(`  Warning: Passage too short (${wordCount} words), skipping`);
        continue;
      }

      // Create result object
      const result: SurveyResult = {
        sampleId,
        timestamp: new Date().toISOString(),
        book: {
          gutenbergId: book.gutenbergId,
          title: book.title,
          author: book.author,
          publicationYear: book.publicationYear,
          genre: book.genre,
          literaryPeriod: book.literaryPeriod,
        },
        passage: {
          chapterIndex: chapter.chapterIndex,
          chapterTitle: chapter.chapterTitle,
          wordCount,
          charCount: passage.length,
          textPreview: passage.substring(0, 200) + '...',
        },
        literaryContext: chapter.context,
        sic: { error: 'Not run (dry-run mode)' },
      };

      // Run SIC analysis unless dry-run
      if (!options.dryRun) {
        console.log(`  Running SIC analysis...`);
        try {
          const sicResult = await runSicAnalysis(passage);
          result.sic = sicResult;
          result.expectedVsActual = compareExpectedVsActual(chapter.context, sicResult);

          console.log(`  SIC Score: ${sicResult.sicScore}, AI Prob: ${sicResult.aiProbability.toFixed(2)}`);

          // Show expected vs actual
          const matches = result.expectedVsActual.filter(e => e.match).length;
          const total = result.expectedVsActual.length;
          console.log(`  Expected features match: ${matches}/${total}`);

        } catch (sicError) {
          console.log(`  SIC Error: ${sicError}`);
          result.sic = { error: String(sicError) };
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
      }

      // Save result
      results.push(result);
      completedIds.add(sampleId);

      // Checkpoint every 5 samples
      if (processed % 5 === 0) {
        console.log(`  Saving checkpoint...`);
        saveCheckpoint({
          completedSampleIds: [...completedIds],
          results,
          lastUpdated: new Date().toISOString(),
        });
      }

    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }

  // Save final results
  console.log('\n' + '='.repeat(60));
  console.log('Survey Complete');
  console.log('='.repeat(60));

  saveResults(results);
  console.log(`\nResults saved to: ${RESULTS_FILE}`);

  // Generate summary
  generateSummary(results);
}

// ============================================================
// Summary Generation
// ============================================================

function generateSummary(results: SurveyResult[]) {
  const successfulResults = results.filter(r => !('error' in r.sic));

  console.log(`\nSuccessful analyses: ${successfulResults.length}/${results.length}`);

  if (successfulResults.length === 0) return;

  // Group by genre
  const byGenre = new Map<string, SurveyResult[]>();
  for (const r of successfulResults) {
    const genre = r.book.genre;
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre)!.push(r);
  }

  console.log('\nBaseline Summary by Genre:');
  console.log('-'.repeat(60));

  for (const [genre, genreResults] of byGenre) {
    console.log(`\n${genre.toUpperCase()} (${genreResults.length} samples):`);

    // Calculate feature averages
    const features = [
      'commitment_irreversibility',
      'epistemic_risk_uncertainty',
      'time_pressure_tradeoffs',
      'situatedness_body_social',
      'scar_tissue_specificity',
      'bounded_viewpoint',
      'anti_smoothing',
      'meta_contamination',
    ];

    for (const feature of features) {
      const scores = genreResults
        .map(r => (r.sic as SicResult).features?.[feature]?.score)
        .filter(s => s !== undefined) as number[];

      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        console.log(`  ${feature.padEnd(30)} avg: ${avg.toFixed(1).padStart(5)} (${min}-${max})`);
      }
    }

    // SIC score and AI probability
    const sicScores = genreResults.map(r => (r.sic as SicResult).sicScore);
    const aiProbs = genreResults.map(r => (r.sic as SicResult).aiProbability);

    const avgSic = sicScores.reduce((a, b) => a + b, 0) / sicScores.length;
    const avgAi = aiProbs.reduce((a, b) => a + b, 0) / aiProbs.length;

    console.log(`  ${'SIC Score'.padEnd(30)} avg: ${avgSic.toFixed(1).padStart(5)}`);
    console.log(`  ${'AI Probability'.padEnd(30)} avg: ${avgAi.toFixed(3).padStart(5)}`);
  }

  // Expected vs Actual accuracy
  const allComparisons = successfulResults.flatMap(r => r.expectedVsActual || []);
  const matches = allComparisons.filter(c => c.match).length;
  console.log(`\nExpected vs Actual Feature Match: ${matches}/${allComparisons.length} (${(matches/allComparisons.length*100).toFixed(1)}%)`);
}

// ============================================================
// CLI
// ============================================================

const args = process.argv.slice(2);
const options = {
  resume: args.includes('--resume'),
  dryRun: args.includes('--dry-run'),
  limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || undefined,
};

runSurvey(options).catch(console.error);
