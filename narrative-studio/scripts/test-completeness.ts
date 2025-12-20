#!/usr/bin/env npx tsx
/**
 * Test script for the completeness classifier
 *
 * Tests whether the classifier correctly identifies:
 * - AI samples as COMPLETE (full stories with arc)
 * - Gutenberg samples as EXCERPT (fragments from novels)
 */

import * as fs from 'fs';
import { analyzeCompleteness, getCompletenessSummary } from '../src/services/detection/v3/completeness.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

async function main() {
  console.log(colorize('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║        Completeness Classifier Test                           ║', 'cyan'));
  console.log(colorize('╚═══════════════════════════════════════════════════════════════╝\n', 'cyan'));

  // Load samples
  const gutenbergRaw = JSON.parse(
    fs.readFileSync('./data/gutenberg-fulltext-samples.json', 'utf-8')
  );
  // Handle both array and {samples: []} format
  const gutenbergData = Array.isArray(gutenbergRaw) ? gutenbergRaw : gutenbergRaw.samples || [];

  const aiRaw = JSON.parse(
    fs.readFileSync('./data/sic-contemporary-opus45-samples.json', 'utf-8')
  );
  // Handle both array and {samples: []} format
  const aiData = Array.isArray(aiRaw) ? aiRaw : aiRaw.samples || [];

  // Test Gutenberg samples (should be EXCERPT)
  console.log(colorize('\n=== GUTENBERG SAMPLES (Expected: EXCERPT) ===\n', 'bold'));

  const narrativeSamples = gutenbergData.filter(
    (s: any) => ['narrative', 'short_story', 'adventure'].includes(s.genre)
  ).slice(0, 6);

  let gutenbergCorrect = 0;
  let gutenbergTotal = 0;

  for (const sample of narrativeSamples) {
    gutenbergTotal++;
    // Handle both 'text' and 'sample' property names
    const sampleText = sample.text || sample.sample;
    const result = analyzeCompleteness(sampleText);
    const isCorrect = result.classification === 'EXCERPT' || result.classification === 'UNCERTAIN';

    if (isCorrect) gutenbergCorrect++;

    const status = result.classification === 'EXCERPT'
      ? colorize('✓ EXCERPT', 'green')
      : result.classification === 'UNCERTAIN'
      ? colorize('~ UNCERTAIN', 'yellow')
      : colorize('✗ COMPLETE', 'red');

    // Handle nested title format
    const title = sample.book?.title || sample.title || sample.id || 'Unknown';
    console.log(`  ${title.slice(0, 35).padEnd(35)} | ${status} (${(result.confidence * 100).toFixed(0)}% conf)`);
    console.log(`    Chekhov weight: ${(result.recommendedChekhovWeight * 100).toFixed(0)}%`);
    console.log(`    Opening: ${result.signals.openingPatterns.length > 0 ? result.signals.openingPatterns.slice(0, 2).join(', ') : 'none'}`);
    console.log(`    Closing: ${result.signals.closingPatterns.length > 0 ? result.signals.closingPatterns.slice(0, 2).join(', ') : 'none'}`);
    console.log(`    Excerpt indicators: ${result.signals.excerptIndicators.length > 0 ? result.signals.excerptIndicators.slice(0, 2).join(', ') : 'none'}`);
    console.log();
  }

  // Test AI samples (should be COMPLETE)
  console.log(colorize('\n=== AI SAMPLES - Opus 4.5 (Expected: COMPLETE) ===\n', 'bold'));

  let aiCorrect = 0;
  let aiTotal = 0;

  for (const sample of aiData.slice(0, 6)) {
    aiTotal++;
    const result = analyzeCompleteness(sample.text);
    const isCorrect = result.classification === 'COMPLETE';

    if (isCorrect) aiCorrect++;

    const status = result.classification === 'COMPLETE'
      ? colorize('✓ COMPLETE', 'green')
      : result.classification === 'UNCERTAIN'
      ? colorize('~ UNCERTAIN', 'yellow')
      : colorize('✗ EXCERPT', 'red');

    console.log(`  ${sample.prompt_id.padEnd(8)} | ${status} (${(result.confidence * 100).toFixed(0)}% conf)`);
    console.log(`    Chekhov weight: ${(result.recommendedChekhovWeight * 100).toFixed(0)}%`);
    console.log(`    Opening: ${result.signals.openingPatterns.length > 0 ? result.signals.openingPatterns.slice(0, 2).join(', ') : 'none'}`);
    console.log(`    Closing: ${result.signals.closingPatterns.length > 0 ? result.signals.closingPatterns.slice(0, 2).join(', ') : 'none'}`);
    console.log(`    Arc markers: ${result.signals.arcMarkers.length > 0 ? result.signals.arcMarkers.slice(0, 2).join(', ') : 'none'}`);
    console.log();
  }

  // Summary
  console.log(colorize('\n═══════════════════════════════════════════════════════════════', 'cyan'));
  console.log(colorize('Summary', 'bold'));
  console.log(colorize('═══════════════════════════════════════════════════════════════\n', 'cyan'));

  console.log(`  Gutenberg (expected EXCERPT/UNCERTAIN): ${gutenbergCorrect}/${gutenbergTotal} correct`);
  console.log(`  AI Samples (expected COMPLETE):         ${aiCorrect}/${aiTotal} correct`);

  const overallAccuracy = (gutenbergCorrect + aiCorrect) / (gutenbergTotal + aiTotal);
  const color = overallAccuracy >= 0.7 ? 'green' : overallAccuracy >= 0.5 ? 'yellow' : 'red';
  console.log(`\n  Overall accuracy: ${colorize((overallAccuracy * 100).toFixed(0) + '%', color)}`);
}

main().catch(console.error);
