#!/usr/bin/env node
/**
 * Test script for Lite AI Detector endpoint
 */

const BASE_URL = 'https://npe-api.tem-527.workers.dev';

// Test samples
const HUMAN_TEXT = `The old house stood on the hill like a sentinel, weathered but unbowed. Sarah remembered summers there—long afternoons when time seemed to stretch endlessly, punctuated only by the distant call of mourning doves. Her grandmother's hands, gnarled and strong, had tended the garden with a devotion that bordered on reverence. The roses still bloomed there, wild now, their perfume carrying memories on the evening breeze.`;

const AI_TEXT = `Artificial intelligence represents a transformative technology that is reshaping various aspects of modern society. It is important to note that AI systems leverage complex algorithms to process vast amounts of data. In today's fast-paced world, organizations are increasingly adopting AI solutions to enhance their operational efficiency. However, it's worth noting that there are both benefits and challenges associated with this technology. Looking ahead, the future of AI holds immense potential for innovation across multiple domains.`;

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function testLiteDetection(text, label, useLLMJudge = false) {
  console.log(`\n${BLUE}Testing ${label} (LLM Judge: ${useLLMJudge ? 'ON' : 'OFF'})${RESET}`);
  console.log(`Text preview: "${text.substring(0, 80)}..."`);
  console.log('─'.repeat(80));

  try {
    const response = await fetch(`${BASE_URL}/ai-detection/lite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        useLLMJudge
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log(`${RED}✗ Request failed (${response.status}):${RESET}`, errorData);
      return null;
    }

    const result = await response.json();

    // Display results
    console.log(`${GREEN}✓ Detection completed${RESET}`);
    console.log(`\nDetector Type: ${result.detector_type}`);
    console.log(`AI Likelihood: ${(result.ai_likelihood * 100).toFixed(1)}%`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Label: ${result.label}`);
    console.log(`Processing Time: ${result.processingTimeMs}ms`);

    // Metrics
    console.log(`\n${YELLOW}Metrics:${RESET}`);
    console.log(`  Burstiness: ${result.metrics.burstiness.toFixed(2)} (higher = more human)`);
    console.log(`  Avg Sentence Length: ${result.metrics.avgSentenceLength.toFixed(1)} words`);
    console.log(`  Type-Token Ratio: ${result.metrics.typeTokenRatio.toFixed(3)} (higher = more diverse)`);
    console.log(`  Repeated N-grams: ${result.metrics.repeatedNgrams}`);

    // Scores
    console.log(`\n${YELLOW}Scores:${RESET}`);
    console.log(`  Heuristic Score: ${(result.heuristicScore * 100).toFixed(1)}%`);
    if (result.llmScore !== undefined) {
      console.log(`  LLM Score: ${(result.llmScore * 100).toFixed(1)}%`);
    }

    // Phrase hits
    if (result.phraseHits.length > 0) {
      console.log(`\n${YELLOW}Top AI Phrases Found (${result.phraseHits.length} total):${RESET}`);
      result.phraseHits.slice(0, 5).forEach(hit => {
        console.log(`  - "${hit.phrase}" (${hit.category}, weight: ${hit.weight}, count: ${hit.count})`);
      });
    } else {
      console.log(`\n${GREEN}No AI tell-phrases detected${RESET}`);
    }

    // Highlights
    if (result.highlights.length > 0) {
      console.log(`\n${YELLOW}Suspicious Sections (${result.highlights.length} total):${RESET}`);
      result.highlights.slice(0, 3).forEach(hl => {
        const snippet = text.substring(hl.start, Math.min(hl.end, hl.start + 60));
        console.log(`  - "${snippet}..."`);
        console.log(`    Score: ${hl.score.toFixed(2)}, Reason: ${hl.reason}`);
      });
    }

    return result;

  } catch (error) {
    console.log(`${RED}✗ Error:${RESET}`, error.message);
    return null;
  }
}

async function runTests() {
  console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  Lite AI Detector Test Suite${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`Target: ${BASE_URL}/ai-detection/lite`);

  // Test 1: Human text without LLM judge
  const result1 = await testLiteDetection(HUMAN_TEXT, 'Human Text (Heuristic Only)', false);

  // Test 2: AI text without LLM judge
  const result2 = await testLiteDetection(AI_TEXT, 'AI Text (Heuristic Only)', false);

  // Test 3: Human text WITH LLM judge
  const result3 = await testLiteDetection(HUMAN_TEXT, 'Human Text (WITH LLM Judge)', true);

  // Test 4: AI text WITH LLM judge
  const result4 = await testLiteDetection(AI_TEXT, 'AI Text (WITH LLM Judge)', true);

  // Summary
  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  Test Summary${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);

  if (result1 && result2 && result3 && result4) {
    console.log(`${GREEN}✓ All 4 tests passed${RESET}\n`);

    console.log('Heuristic-only Results:');
    console.log(`  Human: ${(result1.ai_likelihood * 100).toFixed(1)}% AI (${result1.label})`);
    console.log(`  AI: ${(result2.ai_likelihood * 100).toFixed(1)}% AI (${result2.label})`);

    console.log('\nWith LLM Meta-Judge:');
    console.log(`  Human: ${(result3.ai_likelihood * 100).toFixed(1)}% AI (${result3.label})`);
    console.log(`  AI: ${(result4.ai_likelihood * 100).toFixed(1)}% AI (${result4.label})`);

    // Check if LLM judge improved accuracy
    const heuristicGap = Math.abs(result2.ai_likelihood - result1.ai_likelihood);
    const llmGap = Math.abs(result4.ai_likelihood - result3.ai_likelihood);

    console.log(`\nSeparation:`);
    console.log(`  Heuristic-only: ${(heuristicGap * 100).toFixed(1)}% gap`);
    console.log(`  With LLM Judge: ${(llmGap * 100).toFixed(1)}% gap`);

    if (llmGap > heuristicGap) {
      console.log(`${GREEN}✓ LLM meta-judge improved separation!${RESET}`);
    }
  } else {
    console.log(`${RED}✗ Some tests failed${RESET}`);
  }

  console.log();
}

// Run tests
runTests().catch(console.error);
