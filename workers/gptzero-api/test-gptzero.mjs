/**
 * Test script for GPTZero API worker
 *
 * Tests both human-written and AI-generated text samples
 */

const WORKER_URL = 'https://gptzero-api.tem-527.workers.dev'; // Update after deployment
const LOCAL_URL = 'http://localhost:8787';

// Use local URL for testing during development
const BASE_URL = LOCAL_URL;

// Test samples
const HUMAN_TEXT = `The old house stood on the hill like a sentinel, its weathered boards gray with age.
I remember the creaking porch swing where my grandmother used to sit, shelling peas into a worn metal bowl.
The smell of honeysuckle would drift through the screen door on summer evenings, mixing with the aroma of her
cornbread baking in the oven. She never measured anything - just a handful of this, a pinch of that,
all from memory and feel.`;

const AI_TEXT = `Artificial intelligence represents a transformative technology that has the potential to
revolutionize various industries. In today's rapidly evolving technological landscape, it is important to
note that AI systems are becoming increasingly sophisticated. Furthermore, the integration of machine learning
algorithms enables these systems to process vast amounts of data efficiently. Additionally, it should be
emphasized that the implications of AI adoption extend beyond mere automation. In conclusion, organizations
must carefully consider the ethical dimensions of AI implementation.`;

async function testDetection(text, label, userId = 'test-user-001') {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${label}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/gptzero/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        userId,
        userTier: 'pro',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: HTTP ${response.status}`);
      console.error(errorText);
      return;
    }

    const result = await response.json();

    console.log(`✅ Detection completed successfully!\n`);
    console.log(`Detector Type: ${result.detector_type}`);
    console.log(`AI Likelihood: ${(result.ai_likelihood * 100).toFixed(1)}%`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Label: ${result.label}`);
    console.log(`\nMetrics:`);
    console.log(`  - Average Generated Prob: ${(result.metrics.averageGeneratedProb * 100).toFixed(1)}%`);
    console.log(`  - Completely Generated Prob: ${(result.metrics.completelyGeneratedProb * 100).toFixed(1)}%`);
    console.log(`  - Overall Burstiness: ${result.metrics.overallBurstiness.toFixed(2)}`);
    console.log(`\nQuota:`);
    console.log(`  - Used: ${result.quota.used} words`);
    console.log(`  - Limit: ${result.quota.limit} words`);
    console.log(`  - Remaining: ${result.quota.remaining} words`);
    console.log(`  - Percent Used: ${result.quota.percentUsed.toFixed(1)}%`);
    console.log(`  - Reset Date: ${result.quota.resetDate}`);

    if (result.highlights.length > 0) {
      console.log(`\n🔍 Highlighted Sentences (${result.highlights.length}):`);
      result.highlights.slice(0, 3).forEach((h, i) => {
        console.log(`  ${i + 1}. [${(h.score * 100).toFixed(0)}%] "${h.sentence.substring(0, 80)}..."`);
        console.log(`     ${h.reason}`);
      });
    }

    return result;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
  }
}

async function testQuotaEndpoint(userId = 'test-user-001') {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: Quota Endpoint`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/gptzero/quota/${userId}?tier=pro`);

    if (!response.ok) {
      console.error(`❌ Error: HTTP ${response.status}`);
      return;
    }

    const quota = await response.json();

    console.log(`✅ Quota retrieved successfully!\n`);
    console.log(`Used: ${quota.used} words`);
    console.log(`Limit: ${quota.limit} words`);
    console.log(`Remaining: ${quota.remaining} words`);
    console.log(`Percent Used: ${quota.percentUsed.toFixed(1)}%`);
    console.log(`Reset Date: ${quota.resetDate}`);

    return quota;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
  }
}

async function testHealthEndpoint() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: Health Endpoint`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch(`${BASE_URL}/health`);

    if (!response.ok) {
      console.error(`❌ Error: HTTP ${response.status}`);
      return;
    }

    const health = await response.json();

    console.log(`✅ Health check passed!\n`);
    console.log(JSON.stringify(health, null, 2));

    return health;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
  }
}

async function runAllTests() {
  console.log('\n🚀 Starting GPTZero API Worker Tests\n');

  // Test 1: Health check
  await testHealthEndpoint();

  // Test 2: Human-written text
  await testDetection(HUMAN_TEXT, 'Human-Written Text (Grandmother Story)');

  // Test 3: AI-generated text
  await testDetection(AI_TEXT, 'AI-Generated Text (Corporate Language)');

  // Test 4: Quota endpoint
  await testQuotaEndpoint('test-user-001');

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ All tests completed!`);
  console.log(`${'='.repeat(80)}\n`);
}

// Run tests
runAllTests().catch(console.error);
