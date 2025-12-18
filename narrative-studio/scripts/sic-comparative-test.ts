/**
 * SIC vs Traditional AI Detection Comparative Test
 *
 * Compares:
 * - SIC (Subjective Intentional Constraint) analysis
 * - Lite detector (heuristic-based)
 * - GPTZero (if API available)
 *
 * Test corpus:
 * - Known AI texts: ChatGPT assistant responses from archive
 * - Known human texts: User messages from archive (pre-AI era: 2022)
 */

const ARCHIVE_URL = 'http://localhost:3002';
const CLOUD_API_URL = 'https://npe-api.tem-527.workers.dev';

interface TestResult {
  id: string;
  source: 'ai' | 'human';
  textLength: number;
  wordCount: number;

  // SIC results
  sic?: {
    sicScore: number;
    aiProbability: number;
    genre: string;
    features: Record<string, number>;
    processingTimeMs: number;
    error?: string;
  };

  // Lite detector results
  lite?: {
    ai_likelihood: number;
    confidence: string;
    label: string;
    processingTimeMs: number;
    error?: string;
  };

  // Classification accuracy
  sicCorrect?: boolean;
  liteCorrect?: boolean;
}

interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  timestamp?: number;
}

async function fetchConversations(limit: number): Promise<any[]> {
  const response = await fetch(`${ARCHIVE_URL}/api/conversations?limit=${limit}`);
  const data = await response.json();
  return data.conversations || [];
}

async function fetchConversationMessages(folder: string): Promise<ConversationMessage[]> {
  // URL-encode the folder name to handle special characters
  const encodedFolder = encodeURIComponent(folder);
  const response = await fetch(`${ARCHIVE_URL}/api/conversations/${encodedFolder}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.messages || [];
}

async function runSicAnalysis(text: string): Promise<any> {
  try {
    const response = await fetch(`${CLOUD_API_URL}/ai-detection/sic/sic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { error: `SIC API error: ${response.status} - ${error}` };
    }

    return await response.json();
  } catch (error) {
    return { error: `SIC fetch error: ${error}` };
  }
}

async function runLiteAnalysis(text: string): Promise<any> {
  try {
    const response = await fetch(`${CLOUD_API_URL}/ai-detection/lite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, useLLMJudge: true }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { error: `Lite API error: ${response.status} - ${error}` };
    }

    return await response.json();
  } catch (error) {
    return { error: `Lite fetch error: ${error}` };
  }
}

function extractTextSamples(messages: ConversationMessage[], source: 'ai' | 'human'): Array<{ id: string; text: string }> {
  const role = source === 'ai' ? 'assistant' : 'user';
  const samples: Array<{ id: string; text: string }> = [];

  for (const msg of messages) {
    if (msg.role !== role) continue;
    if (!msg.content || typeof msg.content !== 'string') continue;

    const text = msg.content.trim();
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    // Skip very short texts (need at least 50 words for meaningful analysis)
    if (wordCount < 50) continue;

    // Skip very long texts (truncate to ~2000 words for efficiency)
    const words = text.split(/\s+/);
    const truncatedText = words.length > 2000 ? words.slice(0, 2000).join(' ') : text;

    samples.push({
      id: msg.id,
      text: truncatedText,
    });
  }

  return samples;
}

async function collectTestCorpus(targetCount: number): Promise<{
  aiTexts: Array<{ id: string; text: string }>;
  humanTexts: Array<{ id: string; text: string }>;
}> {
  console.log(`\nCollecting test corpus (target: ${targetCount} each)...`);

  const aiTexts: Array<{ id: string; text: string }> = [];
  const humanTexts: Array<{ id: string; text: string }> = [];

  // Fetch conversations in batches
  const conversations = await fetchConversations(200);
  console.log(`Found ${conversations.length} conversations`);

  // Sort by date to get older (more likely human-authored) first
  conversations.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

  for (const conv of conversations) {
    if (aiTexts.length >= targetCount && humanTexts.length >= targetCount) break;

    // Skip conversations without a folder
    if (!conv.folder) continue;

    try {
      const messages = await fetchConversationMessages(conv.folder);

      // Extract AI texts (assistant messages)
      if (aiTexts.length < targetCount) {
        const aiSamples = extractTextSamples(messages, 'ai');
        for (const sample of aiSamples) {
          if (aiTexts.length >= targetCount) break;
          aiTexts.push(sample);
        }
      }

      // Extract human texts (user messages)
      if (humanTexts.length < targetCount) {
        const humanSamples = extractTextSamples(messages, 'human');
        for (const sample of humanSamples) {
          if (humanTexts.length >= targetCount) break;
          humanTexts.push(sample);
        }
      }

      // Progress indicator
      process.stdout.write(`\rAI: ${aiTexts.length}/${targetCount}, Human: ${humanTexts.length}/${targetCount}`);

    } catch (error) {
      console.error(`\nError fetching conversation ${conv.id}:`, error);
    }
  }

  console.log('\n');
  return { aiTexts, humanTexts };
}

async function runTest(sample: { id: string; text: string }, source: 'ai' | 'human'): Promise<TestResult> {
  const wordCount = sample.text.split(/\s+/).filter(w => w.length > 0).length;

  const result: TestResult = {
    id: sample.id,
    source,
    textLength: sample.text.length,
    wordCount,
  };

  // Run SIC analysis
  const sicResult = await runSicAnalysis(sample.text);
  if (sicResult.error) {
    result.sic = {
      sicScore: 0,
      aiProbability: 0,
      genre: 'unknown',
      features: {},
      processingTimeMs: 0,
      error: sicResult.error
    };
  } else {
    result.sic = {
      sicScore: sicResult.sicScore,
      aiProbability: sicResult.aiProbability,
      genre: sicResult.genre,
      features: Object.fromEntries(
        Object.entries(sicResult.features || {}).map(([k, v]: [string, any]) => [k, v.score])
      ),
      processingTimeMs: sicResult.processingTimeMs,
    };

    // SIC is correct if:
    // - AI text has aiProbability >= 0.5
    // - Human text has aiProbability < 0.5
    result.sicCorrect = source === 'ai'
      ? sicResult.aiProbability >= 0.5
      : sicResult.aiProbability < 0.5;
  }

  // Run Lite analysis
  const liteResult = await runLiteAnalysis(sample.text);
  if (liteResult.error) {
    result.lite = {
      ai_likelihood: 0,
      confidence: 'unknown',
      label: 'error',
      processingTimeMs: 0,
      error: liteResult.error,
    };
  } else {
    result.lite = {
      ai_likelihood: liteResult.ai_likelihood,
      confidence: liteResult.confidence,
      label: liteResult.label,
      processingTimeMs: liteResult.processingTimeMs,
    };

    // Lite is correct if:
    // - AI text has label 'likely_ai' or ai_likelihood >= 0.5
    // - Human text has label 'likely_human' or ai_likelihood < 0.5
    result.liteCorrect = source === 'ai'
      ? liteResult.ai_likelihood >= 0.5 || liteResult.label === 'likely_ai'
      : liteResult.ai_likelihood < 0.5 || liteResult.label === 'likely_human';
  }

  return result;
}

async function main() {
  console.log('='.repeat(60));
  console.log('SIC vs Traditional AI Detection - Comparative Test');
  console.log('='.repeat(60));

  const TARGET_COUNT = 50;

  // Collect test corpus
  const { aiTexts, humanTexts } = await collectTestCorpus(TARGET_COUNT);

  console.log(`Collected ${aiTexts.length} AI texts, ${humanTexts.length} human texts`);

  if (aiTexts.length < 10 || humanTexts.length < 10) {
    console.error('Not enough samples collected. Need at least 10 each.');
    process.exit(1);
  }

  // Run tests
  const results: TestResult[] = [];
  const total = aiTexts.length + humanTexts.length;
  let processed = 0;

  console.log('\nRunning AI detection tests...\n');

  // Test AI texts
  for (const sample of aiTexts) {
    const result = await runTest(sample, 'ai');
    results.push(result);
    processed++;

    const sicStatus = result.sicCorrect ? '✓' : '✗';
    const liteStatus = result.liteCorrect ? '✓' : '✗';
    console.log(
      `[${processed}/${total}] AI text: SIC ${sicStatus} (${(result.sic?.aiProbability || 0).toFixed(2)}) | ` +
      `Lite ${liteStatus} (${(result.lite?.ai_likelihood || 0).toFixed(2)})`
    );

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test human texts
  for (const sample of humanTexts) {
    const result = await runTest(sample, 'human');
    results.push(result);
    processed++;

    const sicStatus = result.sicCorrect ? '✓' : '✗';
    const liteStatus = result.liteCorrect ? '✓' : '✗';
    console.log(
      `[${processed}/${total}] Human text: SIC ${sicStatus} (${(result.sic?.aiProbability || 0).toFixed(2)}) | ` +
      `Lite ${liteStatus} (${(result.lite?.ai_likelihood || 0).toFixed(2)})`
    );

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Calculate statistics
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));

  const aiResults = results.filter(r => r.source === 'ai');
  const humanResults = results.filter(r => r.source === 'human');

  // SIC accuracy
  const sicAiCorrect = aiResults.filter(r => r.sicCorrect).length;
  const sicHumanCorrect = humanResults.filter(r => r.sicCorrect).length;
  const sicTotal = sicAiCorrect + sicHumanCorrect;
  const sicAccuracy = sicTotal / results.length;

  // Lite accuracy
  const liteAiCorrect = aiResults.filter(r => r.liteCorrect).length;
  const liteHumanCorrect = humanResults.filter(r => r.liteCorrect).length;
  const liteTotal = liteAiCorrect + liteHumanCorrect;
  const liteAccuracy = liteTotal / results.length;

  console.log('\nSIC Analysis:');
  console.log(`  AI texts correctly identified:    ${sicAiCorrect}/${aiResults.length} (${(sicAiCorrect/aiResults.length*100).toFixed(1)}%)`);
  console.log(`  Human texts correctly identified: ${sicHumanCorrect}/${humanResults.length} (${(sicHumanCorrect/humanResults.length*100).toFixed(1)}%)`);
  console.log(`  Overall accuracy:                 ${sicTotal}/${results.length} (${(sicAccuracy*100).toFixed(1)}%)`);

  console.log('\nLite Detector:');
  console.log(`  AI texts correctly identified:    ${liteAiCorrect}/${aiResults.length} (${(liteAiCorrect/aiResults.length*100).toFixed(1)}%)`);
  console.log(`  Human texts correctly identified: ${liteHumanCorrect}/${humanResults.length} (${(liteHumanCorrect/humanResults.length*100).toFixed(1)}%)`);
  console.log(`  Overall accuracy:                 ${liteTotal}/${results.length} (${(liteAccuracy*100).toFixed(1)}%)`);

  // Feature analysis for SIC
  console.log('\nSIC Feature Scores (average):');
  const features = [
    'commitment_irreversibility',
    'epistemic_risk_uncertainty',
    'time_pressure_tradeoffs',
    'situatedness_body_social',
    'scar_tissue_specificity',
    'bounded_viewpoint',
    'anti_smoothing',
    'meta_contamination'
  ];

  for (const feature of features) {
    const aiAvg = aiResults.reduce((sum, r) => sum + (r.sic?.features?.[feature] || 0), 0) / aiResults.length;
    const humanAvg = humanResults.reduce((sum, r) => sum + (r.sic?.features?.[feature] || 0), 0) / humanResults.length;
    const diff = humanAvg - aiAvg;
    const indicator = diff > 0.1 ? '↑' : diff < -0.1 ? '↓' : '=';
    console.log(`  ${feature.padEnd(30)} AI: ${aiAvg.toFixed(2)} | Human: ${humanAvg.toFixed(2)} ${indicator}`);
  }

  // Processing time comparison
  const sicAvgTime = results.reduce((sum, r) => sum + (r.sic?.processingTimeMs || 0), 0) / results.length;
  const liteAvgTime = results.reduce((sum, r) => sum + (r.lite?.processingTimeMs || 0), 0) / results.length;

  console.log('\nProcessing Time (average):');
  console.log(`  SIC:  ${sicAvgTime.toFixed(0)}ms`);
  console.log(`  Lite: ${liteAvgTime.toFixed(0)}ms`);

  // Save detailed results
  const outputPath = '/tmp/sic-comparative-results.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      sic: {
        aiCorrect: sicAiCorrect,
        humanCorrect: sicHumanCorrect,
        total: sicTotal,
        accuracy: sicAccuracy,
      },
      lite: {
        aiCorrect: liteAiCorrect,
        humanCorrect: liteHumanCorrect,
        total: liteTotal,
        accuracy: liteAccuracy,
      },
    },
    results,
  }, null, 2));

  console.log(`\nDetailed results saved to: ${outputPath}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
