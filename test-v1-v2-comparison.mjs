#!/usr/bin/env node
/**
 * V1 vs V2 API Comparison Test Suite
 *
 * Tests allegorical transformations across:
 * - 5 diverse Project Gutenberg passages
 * - 5 different namespaces
 * - Same attributes for fair comparison
 *
 * Compares:
 * - Output quality
 * - V2 quantum metrics (ρ evolution, POVM measurements)
 * - Performance (execution time)
 * - Cost (LLM + embedding calls)
 */

import fs from 'fs/promises';

const API_BASE = 'https://npe-api.tem-527.workers.dev';
const TEST_EMAIL = 'demo@humanizer.com';
const TEST_PASSWORD = 'testpass123';

let AUTH_TOKEN = process.env.AUTH_TOKEN || null; // Will be set after login

// 5 Diverse namespaces to test
const NAMESPACES = [
  { name: 'mythology', description: 'Greek/Roman gods and heroes' },
  { name: 'quantum', description: 'Quantum physics and consciousness' },
  { name: 'corporate', description: 'Corporate dystopia' },
  { name: 'medieval', description: 'Knights and kingdoms' },
  { name: 'victorian_detection', description: 'Sherlock Holmes style' }
];

// Project Gutenberg passages - diverse genres and styles
const TEST_PASSAGES = [
  {
    title: 'Pride and Prejudice - Opening',
    author: 'Jane Austen',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.'
  },
  {
    title: 'Moby Dick - The Sermon',
    author: 'Herman Melville',
    text: 'And the Lord spake unto the fish, and it vomited out Jonah upon the dry land. The ribs and terrors in the whale, arched over me like a dismal canopy; while all God\'s sun-lit waves rolled by, and lift me deepening down to doom. I saw the opening maw of hell, with endless pains and sorrows there; Which none but they that feel can tell - Oh, I was plunging to despair.'
  },
  {
    title: 'A Tale of Two Cities - Opening',
    author: 'Charles Dickens',
    text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.'
  },
  {
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    text: 'To Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex. It was not that he felt any emotion akin to love for Irene Adler. All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind.'
  },
  {
    title: 'The Origin of Species - Natural Selection',
    author: 'Charles Darwin',
    text: 'Owing to this struggle for life, any variation, however slight and from whatever cause proceeding, if it be in any degree profitable to an individual of any species, will tend to the preservation of that individual, and will generally be inherited by its offspring. The offspring, also, will thus have a better chance of surviving.'
  }
];

// Test configuration
const PERSONA = 'neutral';
const STYLE = 'standard';

/**
 * Login and get auth token
 */
async function login() {
  if (AUTH_TOKEN) return; // Already logged in

  console.log('🔐 Logging in...');

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  AUTH_TOKEN = data.token;
  console.log('✅ Logged in successfully\n');
}

/**
 * Call V1 API
 */
async function callV1(text, namespace) {
  const startTime = Date.now();

  const response = await fetch(`${API_BASE}/transformations/allegorical`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
    },
    body: JSON.stringify({
      text,
      persona: PERSONA,
      namespace,
      style: STYLE
    })
  });

  if (!response.ok) {
    throw new Error(`V1 API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const duration = Date.now() - startTime;

  return {
    version: 'V1',
    duration_ms: duration,
    transformation_id: data.transformation_id,
    final_text: data.final_projection,
    reflection: data.reflection,
    stages: data.stages,
    // V1 doesn't have quantum metrics
    quantum_metrics: null
  };
}

/**
 * Call V2 API
 */
async function callV2(text, namespace) {
  const startTime = Date.now();

  const response = await fetch(`${API_BASE}/v2/allegorical/transform`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
    },
    body: JSON.stringify({
      text,
      persona: PERSONA,
      namespace,
      style: STYLE
    })
  });

  if (!response.ok) {
    throw new Error(`V2 API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const duration = Date.now() - startTime;

  return {
    version: 'V2',
    duration_ms: duration,
    transformation_id: data.transformation_id,
    narrative_id: data.narrative_id,
    final_text: data.final_text,
    stages: data.stages,
    quantum_metrics: {
      initial_purity: data.overall_metrics.initial_purity,
      final_purity: data.overall_metrics.final_purity,
      purity_delta: data.overall_metrics.purity_delta,
      initial_entropy: data.overall_metrics.initial_entropy,
      final_entropy: data.overall_metrics.final_entropy,
      entropy_delta: data.overall_metrics.entropy_delta,
      total_coherence: data.overall_metrics.total_coherence,
      stage_coherences: data.stages
        .filter(s => s.povm_measurement)
        .map(s => s.povm_measurement.coherence)
    }
  };
}

/**
 * Run comparison test
 */
async function runComparison(passage, namespace) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: "${passage.title}" → ${namespace.name.toUpperCase()}`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`Input: "${passage.text.substring(0, 100)}..."\n`);

  try {
    // Run V1
    console.log('🔵 Running V1...');
    const v1Result = await callV1(passage.text, namespace.name);
    console.log(`✅ V1 complete (${v1Result.duration_ms}ms)`);

    // Run V2
    console.log('🟣 Running V2...');
    const v2Result = await callV2(passage.text, namespace.name);
    console.log(`✅ V2 complete (${v2Result.duration_ms}ms)`);

    return {
      passage: passage.title,
      namespace: namespace.name,
      v1: v1Result,
      v2: v2Result,
      comparison: {
        duration_difference_ms: v2Result.duration_ms - v1Result.duration_ms,
        duration_ratio: (v2Result.duration_ms / v1Result.duration_ms).toFixed(2),
        v2_overhead_percent: ((v2Result.duration_ms - v1Result.duration_ms) / v1Result.duration_ms * 100).toFixed(1)
      }
    };
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return {
      passage: passage.title,
      namespace: namespace.name,
      error: error.message
    };
  }
}

/**
 * Generate markdown report
 */
function generateReport(results) {
  let report = '# V1 vs V2 Allegorical Transformation Comparison\n\n';
  report += `**Date**: ${new Date().toLocaleString()}\n`;
  report += `**Total Tests**: ${results.length}\n`;
  report += `**Successful**: ${results.filter(r => !r.error).length}\n`;
  report += `**Failed**: ${results.filter(r => r.error).length}\n\n`;

  report += '---\n\n';

  // Summary statistics
  const successful = results.filter(r => !r.error);
  if (successful.length > 0) {
    const avgV1Duration = successful.reduce((sum, r) => sum + r.v1.duration_ms, 0) / successful.length;
    const avgV2Duration = successful.reduce((sum, r) => sum + r.v2.duration_ms, 0) / successful.length;
    const avgOverhead = successful.reduce((sum, r) => sum + parseFloat(r.comparison.v2_overhead_percent), 0) / successful.length;

    report += '## Performance Summary\n\n';
    report += `- **V1 Average Duration**: ${avgV1Duration.toFixed(0)}ms (${(avgV1Duration/1000).toFixed(1)}s)\n`;
    report += `- **V2 Average Duration**: ${avgV2Duration.toFixed(0)}ms (${(avgV2Duration/1000).toFixed(1)}s)\n`;
    report += `- **Average V2 Overhead**: ${avgOverhead.toFixed(1)}%\n`;
    report += `- **V2/V1 Duration Ratio**: ${(avgV2Duration/avgV1Duration).toFixed(2)}x\n\n`;

    // Quantum metrics summary
    const avgPurityDelta = successful.reduce((sum, r) => sum + r.v2.quantum_metrics.purity_delta, 0) / successful.length;
    const avgEntropyDelta = successful.reduce((sum, r) => sum + r.v2.quantum_metrics.entropy_delta, 0) / successful.length;
    const avgCoherence = successful.reduce((sum, r) => sum + r.v2.quantum_metrics.total_coherence, 0) / successful.length;

    report += '## Quantum Metrics Summary (V2 Only)\n\n';
    report += `- **Average Purity Change**: ${avgPurityDelta.toFixed(4)} (${avgPurityDelta > 0 ? 'increase' : 'decrease'})\n`;
    report += `- **Average Entropy Change**: ${avgEntropyDelta.toFixed(4)} (${avgEntropyDelta > 0 ? 'increase' : 'decrease'})\n`;
    report += `- **Average Coherence**: ${avgCoherence.toFixed(3)}\n\n`;
  }

  report += '---\n\n';

  // Individual results
  for (const result of results) {
    if (result.error) {
      report += `## ❌ ${result.passage} → ${result.namespace}\n\n`;
      report += `**Error**: ${result.error}\n\n`;
      continue;
    }

    report += `## ${result.passage} → ${result.namespace}\n\n`;

    // Performance comparison
    report += '### ⏱️ Performance\n\n';
    report += `| Metric | V1 | V2 | Difference |\n`;
    report += `|--------|----|----|------------|\n`;
    report += `| Duration | ${result.v1.duration_ms}ms | ${result.v2.duration_ms}ms | +${result.comparison.duration_difference_ms}ms (${result.comparison.v2_overhead_percent}%) |\n\n`;

    // Quantum metrics (V2 only)
    report += '### ◈ Quantum Metrics (V2)\n\n';
    const qm = result.v2.quantum_metrics;
    report += `- **Purity**: ${qm.initial_purity.toFixed(4)} → ${qm.final_purity.toFixed(4)} (Δ ${qm.purity_delta.toFixed(4)})\n`;
    report += `- **Entropy**: ${qm.initial_entropy.toFixed(4)} → ${qm.final_entropy.toFixed(4)} (Δ ${qm.entropy_delta.toFixed(4)})\n`;
    report += `- **Overall Coherence**: ${qm.total_coherence.toFixed(3)}\n`;
    report += `- **Stage Coherences**: ${qm.stage_coherences.map(c => c.toFixed(3)).join(', ')}\n\n`;

    // Output comparison
    report += '### 📝 Output Comparison\n\n';
    report += '**V1 Output:**\n```\n';
    report += result.v1.final_text.substring(0, 500);
    if (result.v1.final_text.length > 500) report += '...';
    report += '\n```\n\n';

    report += '**V2 Output:**\n```\n';
    report += result.v2.final_text.substring(0, 500);
    if (result.v2.final_text.length > 500) report += '...';
    report += '\n```\n\n';

    report += '---\n\n';
  }

  return report;
}

/**
 * Main test execution
 */
async function main() {
  console.log('🧪 V1 vs V2 API Comparison Test Suite');
  console.log('=====================================\n');
  console.log(`Testing ${TEST_PASSAGES.length} passages across ${NAMESPACES.length} namespaces`);
  console.log(`Total comparisons: ${TEST_PASSAGES.length * NAMESPACES.length}\n`);

  // Login first
  await login();

  const results = [];

  // Test each passage with each namespace
  for (const passage of TEST_PASSAGES) {
    for (const namespace of NAMESPACES) {
      const result = await runComparison(passage, namespace);
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Generate report
  const report = generateReport(results);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `/tmp/v1-v2-comparison-${timestamp}.json`;
  const reportFile = `/tmp/v1-v2-comparison-${timestamp}.md`;

  await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
  await fs.writeFile(reportFile, report);

  console.log('\n\n✅ Test suite complete!');
  console.log(`\n📊 Results saved to:`);
  console.log(`   JSON: ${resultsFile}`);
  console.log(`   Report: ${reportFile}`);

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  const successful = results.filter(r => !r.error);
  if (successful.length > 0) {
    const avgV1 = successful.reduce((sum, r) => sum + r.v1.duration_ms, 0) / successful.length;
    const avgV2 = successful.reduce((sum, r) => sum + r.v2.duration_ms, 0) / successful.length;
    console.log(`V1 Average: ${(avgV1/1000).toFixed(1)}s`);
    console.log(`V2 Average: ${(avgV2/1000).toFixed(1)}s`);
    console.log(`V2 Overhead: ${((avgV2-avgV1)/avgV1*100).toFixed(1)}%`);
    console.log(`V2/V1 Ratio: ${(avgV2/avgV1).toFixed(2)}x`);
  }
  console.log('='.repeat(80) + '\n');
}

// Run tests
main().catch(console.error);
