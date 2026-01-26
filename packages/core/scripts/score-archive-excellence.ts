/**
 * Score Archive Excellence
 *
 * Scores all archive content for excellence using a heuristic scorer.
 * This runs much faster than LLM-based scoring while still providing
 * meaningful quality assessment.
 *
 * Scoring Dimensions:
 * - Insight Density: Novel ideas per paragraph
 * - Expressive Power: Clarity and memorability
 * - Emotional Resonance: Reader connection potential
 * - Structural Elegance: Flow and pacing quality
 * - Voice Authenticity: Distinctiveness of voice
 *
 * Usage:
 *   npx tsx scripts/score-archive-excellence.ts [--limit N] [--batch N] [--verbose]
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import type { ExcellenceScore, ExcellenceTier, ExcellenceStats } from '../src/pipelines/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

interface Config {
  batchSize: number;
  limit: number;
  verbose: boolean;
  updateMetadata: boolean;
  sourceTypes: string[];
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    batchSize: 500,
    limit: 0, // 0 = no limit
    verbose: false,
    updateMetadata: true,
    sourceTypes: ['chatgpt-message', 'facebook-message', 'archive-message'],
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch' && args[i + 1]) {
      config.batchSize = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--verbose') {
      config.verbose = true;
    } else if (args[i] === '--no-update') {
      config.updateMetadata = false;
    }
  }

  return config;
}

// ═══════════════════════════════════════════════════════════════════
// HEURISTIC EXCELLENCE SCORER
// ═══════════════════════════════════════════════════════════════════

/**
 * Heuristic-based excellence scorer
 * Uses text analysis features to estimate content quality
 */
function scoreExcellence(text: string, authorRole?: string): ExcellenceScore {
  if (!text || text.trim().length === 0) {
    return createEmptyScore();
  }

  // Basic text analysis
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 10);

  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const paragraphCount = Math.max(paragraphs.length, 1);

  const avgSentenceLength = wordCount / sentenceCount;
  const avgParagraphLength = wordCount / paragraphCount;

  // Text feature detection
  const hasStructure = /^#+\s|\*\*|^\d+\.\s|^-\s/m.test(text);
  const hasCodeBlocks = /```[\s\S]*?```|`[^`]+`/.test(text);
  const hasQuotes = /"[^"]{20,}"/.test(text);
  const hasQuestions = /\?/.test(text);
  const hasExclamations = /!/.test(text);
  const hasLists = /^[-*•]\s/m.test(text) || /^\d+\.\s/m.test(text);
  const hasLinks = /\[.*?\]\(.*?\)|https?:\/\//.test(text);

  // Vocabulary richness (unique words / total words)
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));
  const vocabularyRichness = uniqueWords.size / Math.max(wordCount, 1);

  // Sentence variety (std dev of sentence lengths)
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  const avgSentLen = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const sentenceVariety = Math.sqrt(
    sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgSentLen, 2), 0) / sentenceLengths.length
  ) / Math.max(avgSentLen, 1);

  // Long-form content indicator
  const isLongForm = wordCount > 200;
  const isVeryLong = wordCount > 500;

  // ─────────────────────────────────────────────────────────────────
  // CALCULATE DIMENSION SCORES
  // ─────────────────────────────────────────────────────────────────

  // Insight Density: Ideas per paragraph, structure, depth indicators
  let insightDensity = 0.3; // Base
  if (isLongForm) insightDensity += 0.1;
  if (isVeryLong) insightDensity += 0.1;
  if (hasStructure) insightDensity += 0.15;
  if (hasCodeBlocks) insightDensity += 0.1;
  if (paragraphCount >= 3) insightDensity += 0.1;
  if (hasLists) insightDensity += 0.05;
  if (vocabularyRichness > 0.5) insightDensity += 0.1;
  insightDensity = Math.min(1, insightDensity);

  // Expressive Power: Clarity, variety, memorable phrasing
  let expressivePower = 0.3;
  if (avgSentenceLength >= 10 && avgSentenceLength <= 25) expressivePower += 0.15;
  if (sentenceVariety > 0.3 && sentenceVariety < 0.8) expressivePower += 0.15;
  if (vocabularyRichness > 0.4) expressivePower += 0.1;
  if (hasQuotes) expressivePower += 0.1;
  if (!hasCodeBlocks || wordCount > 300) expressivePower += 0.1;
  if (isLongForm) expressivePower += 0.1;
  expressivePower = Math.min(1, expressivePower);

  // Emotional Resonance: Questions, exclamations, personal pronouns
  let emotionalResonance = 0.25;
  if (hasQuestions) emotionalResonance += 0.1;
  if (hasExclamations) emotionalResonance += 0.05;
  if (/\b(I|me|my|we|our|you|your)\b/i.test(text)) emotionalResonance += 0.15;
  if (/\b(feel|think|believe|wonder|love|hate|hope|fear)\b/i.test(text)) emotionalResonance += 0.15;
  if (authorRole === 'user') emotionalResonance += 0.1; // User content often more personal
  if (isLongForm) emotionalResonance += 0.1;
  emotionalResonance = Math.min(1, emotionalResonance);

  // Structural Elegance: Organization, flow, formatting
  let structuralElegance = 0.3;
  if (hasStructure) structuralElegance += 0.2;
  if (paragraphCount >= 2) structuralElegance += 0.1;
  if (hasLists) structuralElegance += 0.1;
  if (avgParagraphLength >= 30 && avgParagraphLength <= 150) structuralElegance += 0.1;
  if (sentenceVariety > 0.2) structuralElegance += 0.1;
  if (hasLinks) structuralElegance += 0.05;
  structuralElegance = Math.min(1, structuralElegance);

  // Voice Authenticity: Distinctiveness, personal style
  let voiceAuthenticity = 0.35;
  if (authorRole === 'user') voiceAuthenticity += 0.2; // User voice more authentic
  if (/\b(I|me|my)\b/i.test(text)) voiceAuthenticity += 0.1;
  if (vocabularyRichness > 0.5) voiceAuthenticity += 0.1;
  if (sentenceVariety > 0.4) voiceAuthenticity += 0.1;
  if (!hasCodeBlocks) voiceAuthenticity += 0.05; // Code often templated
  voiceAuthenticity = Math.min(1, voiceAuthenticity);

  // ─────────────────────────────────────────────────────────────────
  // CALCULATE COMPOSITE SCORE
  // ─────────────────────────────────────────────────────────────────

  const compositeScore = Math.round(
    insightDensity * 25 +
    expressivePower * 20 +
    emotionalResonance * 20 +
    structuralElegance * 15 +
    voiceAuthenticity * 20
  );

  // ─────────────────────────────────────────────────────────────────
  // DETERMINE TIER
  // ─────────────────────────────────────────────────────────────────

  let tier: ExcellenceTier;

  // Check for raw gem: high insight but lower expression
  const qualityGap = insightDensity - expressivePower;
  if (qualityGap > 0.25 && insightDensity > 0.6) {
    tier = 'raw_gem';
  } else if (compositeScore >= 75) {
    tier = 'excellence';
  } else if (compositeScore >= 55) {
    tier = 'polished';
  } else if (compositeScore >= 35) {
    tier = 'needs_refinement';
  } else {
    tier = 'noise';
  }

  // ─────────────────────────────────────────────────────────────────
  // EXTRACT STANDOUT QUOTES
  // ─────────────────────────────────────────────────────────────────

  const standoutQuotes: string[] = [];

  // Find sentences with good characteristics
  for (const sentence of sentences.slice(0, 10)) {
    const trimmed = sentence.trim();
    if (trimmed.length >= 50 && trimmed.length <= 300) {
      // Check for interesting characteristics
      const hasInsightWords = /\b(realize|discover|understand|learn|insight|key|important|essential)\b/i.test(trimmed);
      const hasEmotionWords = /\b(feel|believe|wonder|amazing|fascinating|interesting)\b/i.test(trimmed);
      const isQuestion = trimmed.includes('?');

      if (hasInsightWords || hasEmotionWords || isQuestion) {
        standoutQuotes.push(trimmed);
        if (standoutQuotes.length >= 3) break;
      }
    }
  }

  // If no standout quotes, take first good sentence
  if (standoutQuotes.length === 0 && sentences.length > 0) {
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length >= 30 && trimmed.length <= 200) {
        standoutQuotes.push(trimmed);
        break;
      }
    }
  }

  return {
    compositeScore,
    dimensions: {
      insightDensity,
      expressivePower,
      emotionalResonance,
      structuralElegance,
      voiceAuthenticity,
    },
    tier,
    standoutQuotes,
    confidence: 0.7 + (isLongForm ? 0.1 : 0) + (wordCount > 100 ? 0.1 : 0),
  };
}

function createEmptyScore(): ExcellenceScore {
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
    confidence: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════

async function scoreArchiveExcellence() {
  const config = parseArgs();
  const startTime = Date.now();

  console.log('═'.repeat(70));
  console.log(' ARCHIVE EXCELLENCE SCORING');
  console.log('═'.repeat(70));
  console.log(`\n  Batch size: ${config.batchSize}`);
  console.log(`  Limit: ${config.limit || 'no limit'}`);
  console.log(`  Update metadata: ${config.updateMetadata}`);
  console.log(`  Source types: ${config.sourceTypes.join(', ')}`);

  // Initialize store
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();
  const pool = store.getPool();

  // Get total count
  const countResult = await pool.query(`
    SELECT COUNT(*) as count FROM content_nodes
    WHERE source_type = ANY($1)
  `, [config.sourceTypes]);
  const totalNodes = parseInt(countResult.rows[0].count, 10);
  const nodesToProcess = config.limit > 0 ? Math.min(config.limit, totalNodes) : totalNodes;

  console.log(`\n  Total nodes in archive: ${totalNodes}`);
  console.log(`  Nodes to process: ${nodesToProcess}\n`);

  // Statistics tracking
  const stats: ExcellenceStats = {
    totalScored: 0,
    avgCompositeScore: 0,
    tierCounts: {
      excellence: 0,
      polished: 0,
      needs_refinement: 0,
      raw_gem: 0,
      noise: 0,
    },
    rawGemsDetected: 0,
    avgDimensions: {
      insightDensity: 0,
      expressivePower: 0,
      emotionalResonance: 0,
      structuralElegance: 0,
      voiceAuthenticity: 0,
    },
    topQuotes: [],
  };

  let totalScore = 0;
  const dimensionTotals = {
    insightDensity: 0,
    expressivePower: 0,
    emotionalResonance: 0,
    structuralElegance: 0,
    voiceAuthenticity: 0,
  };
  const allQuotes: Array<{ quote: string; nodeId: string; score: number }> = [];

  // Process in batches
  let offset = 0;
  let processed = 0;

  console.log('┌' + '─'.repeat(68) + '┐');
  console.log('│ SCORING PROGRESS                                                       │');
  console.log('└' + '─'.repeat(68) + '┘');

  while (processed < nodesToProcess) {
    const batchStart = Date.now();
    const batchLimit = Math.min(config.batchSize, nodesToProcess - processed);

    // Query batch
    const batchResult = await pool.query(`
      SELECT id, text, author_role, source_type, source_metadata
      FROM content_nodes
      WHERE source_type = ANY($1)
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [config.sourceTypes, batchLimit, offset]);

    if (batchResult.rows.length === 0) break;

    // Score each node
    const updates: Array<{ id: string; score: ExcellenceScore }> = [];

    for (const row of batchResult.rows) {
      const score = scoreExcellence(row.text, row.author_role);
      updates.push({ id: row.id, score });

      // Update statistics
      stats.totalScored++;
      totalScore += score.compositeScore;
      stats.tierCounts[score.tier]++;

      if (score.tier === 'raw_gem') {
        stats.rawGemsDetected++;
      }

      dimensionTotals.insightDensity += score.dimensions.insightDensity;
      dimensionTotals.expressivePower += score.dimensions.expressivePower;
      dimensionTotals.emotionalResonance += score.dimensions.emotionalResonance;
      dimensionTotals.structuralElegance += score.dimensions.structuralElegance;
      dimensionTotals.voiceAuthenticity += score.dimensions.voiceAuthenticity;

      // Track top quotes
      for (const quote of score.standoutQuotes) {
        allQuotes.push({ quote, nodeId: row.id, score: score.compositeScore });
      }
    }

    // Update metadata in database
    if (config.updateMetadata) {
      for (const { id, score } of updates) {
        await pool.query(`
          UPDATE content_nodes
          SET source_metadata = COALESCE(source_metadata, '{}')::jsonb || $2::jsonb
          WHERE id = $1
        `, [id, JSON.stringify({
          excellenceScore: score.compositeScore,
          excellenceTier: score.tier,
          excellenceDimensions: score.dimensions,
          excellenceConfidence: score.confidence,
        })]);
      }
    }

    processed += batchResult.rows.length;
    offset += batchResult.rows.length;

    const batchDuration = Date.now() - batchStart;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round(processed / ((Date.now() - startTime) / 1000));
    const pct = ((processed / nodesToProcess) * 100).toFixed(1);
    const eta = rate > 0 ? Math.round((nodesToProcess - processed) / rate) : 0;

    process.stdout.write(`\r  [${pct}%] ${processed}/${nodesToProcess} scored | ${rate}/sec | ETA: ${eta}s | Batch: ${batchDuration}ms    `);

    if (config.verbose) {
      console.log();
      for (const { id, score } of updates.slice(0, 3)) {
        console.log(`    ${id.slice(0, 8)}: ${score.compositeScore} (${score.tier})`);
      }
    }
  }

  console.log('\n');

  // Calculate final averages
  stats.avgCompositeScore = stats.totalScored > 0 ? totalScore / stats.totalScored : 0;
  stats.avgDimensions = {
    insightDensity: dimensionTotals.insightDensity / Math.max(stats.totalScored, 1),
    expressivePower: dimensionTotals.expressivePower / Math.max(stats.totalScored, 1),
    emotionalResonance: dimensionTotals.emotionalResonance / Math.max(stats.totalScored, 1),
    structuralElegance: dimensionTotals.structuralElegance / Math.max(stats.totalScored, 1),
    voiceAuthenticity: dimensionTotals.voiceAuthenticity / Math.max(stats.totalScored, 1),
  };

  // Get top quotes
  stats.topQuotes = allQuotes
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // ─────────────────────────────────────────────────────────────────
  // PRINT RESULTS
  // ─────────────────────────────────────────────────────────────────

  const totalDuration = (Date.now() - startTime) / 1000;

  console.log('┌' + '─'.repeat(68) + '┐');
  console.log('│ EXCELLENCE SCORING RESULTS                                             │');
  console.log('└' + '─'.repeat(68) + '┘');

  console.log(`\n  Total scored: ${stats.totalScored}`);
  console.log(`  Duration: ${totalDuration.toFixed(1)}s (${Math.round(stats.totalScored / totalDuration)}/sec)`);
  console.log(`  Average score: ${stats.avgCompositeScore.toFixed(1)}/100`);

  console.log('\n  Tier Distribution:');
  console.log(`    ★ Excellence (75+):     ${stats.tierCounts.excellence.toLocaleString()} (${((stats.tierCounts.excellence / stats.totalScored) * 100).toFixed(1)}%)`);
  console.log(`    ◆ Polished (55-74):     ${stats.tierCounts.polished.toLocaleString()} (${((stats.tierCounts.polished / stats.totalScored) * 100).toFixed(1)}%)`);
  console.log(`    ○ Needs Refinement:     ${stats.tierCounts.needs_refinement.toLocaleString()} (${((stats.tierCounts.needs_refinement / stats.totalScored) * 100).toFixed(1)}%)`);
  console.log(`    ◇ Raw Gems:             ${stats.tierCounts.raw_gem.toLocaleString()} (${((stats.tierCounts.raw_gem / stats.totalScored) * 100).toFixed(1)}%)`);
  console.log(`    · Noise (<35):          ${stats.tierCounts.noise.toLocaleString()} (${((stats.tierCounts.noise / stats.totalScored) * 100).toFixed(1)}%)`);

  console.log('\n  Average Dimensions:');
  console.log(`    Insight Density:     ${(stats.avgDimensions.insightDensity * 100).toFixed(1)}%`);
  console.log(`    Expressive Power:    ${(stats.avgDimensions.expressivePower * 100).toFixed(1)}%`);
  console.log(`    Emotional Resonance: ${(stats.avgDimensions.emotionalResonance * 100).toFixed(1)}%`);
  console.log(`    Structural Elegance: ${(stats.avgDimensions.structuralElegance * 100).toFixed(1)}%`);
  console.log(`    Voice Authenticity:  ${(stats.avgDimensions.voiceAuthenticity * 100).toFixed(1)}%`);

  // Query some examples from each tier
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ SAMPLE CONTENT BY TIER                                                 │');
  console.log('└' + '─'.repeat(68) + '┘');

  for (const tier of ['excellence', 'raw_gem', 'polished'] as ExcellenceTier[]) {
    const samples = await pool.query(`
      SELECT id, text, source_metadata->>'excellenceScore' as score
      FROM content_nodes
      WHERE source_metadata->>'excellenceTier' = $1
      ORDER BY (source_metadata->>'excellenceScore')::int DESC
      LIMIT 3
    `, [tier]);

    if (samples.rows.length > 0) {
      console.log(`\n  ${tier.toUpperCase()}:`);
      for (const row of samples.rows) {
        const preview = (row.text || '').slice(0, 150).replace(/\n/g, ' ').trim();
        console.log(`    [${row.score}] ${preview}...`);
      }
    }
  }

  // Show top quotes
  if (stats.topQuotes.length > 0) {
    console.log('\n┌' + '─'.repeat(68) + '┐');
    console.log('│ TOP STANDOUT QUOTES                                                    │');
    console.log('└' + '─'.repeat(68) + '┘\n');

    for (const { quote, score } of stats.topQuotes.slice(0, 10)) {
      const truncated = quote.length > 100 ? quote.slice(0, 100) + '...' : quote;
      console.log(`  [${score}] "${truncated}"`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(' SCORING COMPLETE');
  console.log('═'.repeat(70) + '\n');

  // Save stats summary
  const summaryPath = '/tmp/excellence-stats.json';
  const fs = await import('fs/promises');
  await fs.writeFile(summaryPath, JSON.stringify(stats, null, 2));
  console.log(`  Stats saved to: ${summaryPath}\n`);

  await store.close();
  return stats;
}

scoreArchiveExcellence()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Scoring failed:', err);
    process.exit(1);
  });
