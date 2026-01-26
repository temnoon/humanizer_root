/**
 * Pattern System Usage Examples
 *
 * Shows how the AUI would use the pattern discovery system for:
 * 1. Autonomous discovery
 * 2. Learning from corrections
 * 3. Pattern composition
 */

import type { Pool } from 'pg';
import { PatternSystem } from './pattern-discovery-system.js';

/**
 * Example: AUI discovers and uses patterns
 */
async function auiPatternWorkflow(pool: Pool, embedFn: (text: string) => Promise<number[]>) {
  const system = new PatternSystem(pool, embedFn);

  // ═══════════════════════════════════════════════════════════════════
  // 1. AUTONOMOUS DISCOVERY
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n=== AUTONOMOUS PATTERN DISCOVERY ===\n');

  // AUI periodically scans for patterns
  const discoveredPatterns = await system.discovery.discover({
    minInstances: 5,
  });

  console.log(`Discovered ${discoveredPatterns.length} patterns:`);
  for (const pattern of discoveredPatterns) {
    console.log(`  [${pattern.status}] ${pattern.observation}`);
    console.log(`    Confidence: ${(pattern.confidence * 100).toFixed(0)}%`);
    console.log(`    Instances: ${pattern.instanceCount}`);
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. USER DESCRIBES A RELATIONSHIP
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n=== USER-GUIDED PATTERN CREATION ===\n');

  // User: "Find OCR transcriptions of handwritten notebook pages"
  const userDescription = `
    Find OCR transcriptions of handwritten notebook pages.
    These are assistant messages with code blocks that follow
    user messages containing uploaded images.
    Custom GPTs like Journal Recognizer produce these.
  `;

  const pattern = await system.describe(userDescription);
  console.log(`Created pattern: ${pattern.name}`);
  console.log(`Tags: ${pattern.tags.join(', ')}`);

  // Execute the pattern
  const results = await system.execute(pattern.name);
  console.log(`Found ${results.length} matches\n`);

  // Show some results to user
  for (const result of results.slice(0, 3)) {
    console.log(`  [${result.id.slice(0, 8)}] ${result.text?.slice(0, 100)}...`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. USER PROVIDES FEEDBACK
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n=== LEARNING FROM FEEDBACK ===\n');

  // User says: "No, that one is a JSON prompt, not a transcript"
  if (results.length > 0) {
    await system.feedback(
      pattern.name,
      results[0].id,
      'incorrect',
      'This is a JSON prompt for image generation, not an OCR transcript'
    );
    console.log('Recorded negative feedback');
  }

  // User confirms a good match
  if (results.length > 1) {
    await system.feedback(
      pattern.name,
      results[1].id,
      'correct',
      'Yes, this is a proper notebook transcription'
    );
    console.log('Recorded positive feedback');
  }

  // After enough feedback, the system learns
  const constraints = system.learner.getConstraints(pattern.id);
  console.log(`Learned ${constraints.length} constraints from feedback`);

  // Next execution will use learned constraints
  const refinedResults = await system.execute(pattern.name);
  console.log(`Refined search found ${refinedResults.length} matches`);

  // ═══════════════════════════════════════════════════════════════════
  // 4. PATTERN COMPOSITION
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n=== PATTERN COMPOSITION ===\n');

  // Combine built-in OCR pattern with custom filter
  const germanFilter = await system.describe(
    'Content in German language with TeX mathematical formulas'
  );

  // Compose: OCR AND German physics
  const germanPhysicsOcr = system.composer.and(
    'german-physics-ocr',
    'OCR transcriptions of German physics texts with TeX formulas',
    'ocr-transcription',
    germanFilter.name
  );

  console.log(`Composed pattern: ${germanPhysicsOcr.name}`);
  console.log(`Description: ${germanPhysicsOcr.description}`);

  // Execute composed pattern
  const composedResults = await system.execute(germanPhysicsOcr.name);
  console.log(`Found ${composedResults.length} German physics transcriptions`);

  // ═══════════════════════════════════════════════════════════════════
  // 5. PATTERN SPECIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n=== PATTERN SPECIALIZATION ===\n');

  // Create hierarchy: OCR → Notebook OCR → Personal Journal OCR
  const notebookOcr = system.composer.refine(
    'notebook-ocr',
    'OCR specifically from handwritten notebooks',
    'ocr-transcription',
    (await system.describe('handwritten notebook pages, personal notes')).name
  );

  const journalOcr = system.composer.refine(
    'journal-ocr',
    'OCR from personal journal entries',
    'notebook-ocr',
    (await system.describe('personal journal, diary, dated entries')).name
  );

  console.log('Pattern hierarchy:');
  console.log('  ocr-transcription');
  console.log('    └── notebook-ocr');
  console.log('        └── journal-ocr');

  // ═══════════════════════════════════════════════════════════════════
  // 6. EXCLUSION PATTERNS
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n=== EXCLUSION PATTERNS ===\n');

  // OCR but NOT code
  const codeBlockPattern = await system.describe('JSON or code snippets');

  const ocrNotCode = system.composer.not(
    'ocr-not-code',
    'OCR transcriptions excluding code/JSON outputs',
    'ocr-transcription',
    codeBlockPattern.name
  );

  console.log(`Created exclusion pattern: ${ocrNotCode.name}`);

  // ═══════════════════════════════════════════════════════════════════
  // 7. LIST ALL PATTERNS
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n=== PATTERN LIBRARY ===\n');

  const allPatterns = system.composer.list();
  console.log(`Total patterns: ${allPatterns.length}`);

  for (const p of allPatterns) {
    const type = p.definition.type === 'atomic' ? 'atomic' : 'composed';
    console.log(`  [${type}] ${p.name}`);
    console.log(`    ${p.description}`);
    if (p.tags.length > 0) {
      console.log(`    Tags: ${p.tags.join(', ')}`);
    }
    console.log();
  }
}

/**
 * Example: How AUI tool would be defined for MCP
 */
const AUI_PATTERN_TOOL_DEFINITION = {
  name: 'content_pattern',
  description: `
    Find and relate content based on pattern descriptions.

    The system can:
    1. Discover patterns autonomously in the archive
    2. Create patterns from natural language descriptions
    3. Learn from your corrections to improve matches
    4. Compose patterns using AND, OR, NOT, SEQUENCE

    Examples:
    - "Find OCR transcriptions of notebook pages"
    - "Show me DALL-E images with their prompts"
    - "Find code reviews where the assistant suggests changes"
  `,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['discover', 'describe', 'execute', 'feedback', 'compose', 'list'],
        description: 'Action to perform',
      },
      description: {
        type: 'string',
        description: 'Natural language description of the pattern (for describe action)',
      },
      patternName: {
        type: 'string',
        description: 'Name of pattern to execute or provide feedback on',
      },
      contentId: {
        type: 'string',
        description: 'Content ID for feedback',
      },
      judgment: {
        type: 'string',
        enum: ['correct', 'incorrect', 'partial'],
        description: 'Your judgment on whether the match was correct',
      },
      explanation: {
        type: 'string',
        description: 'Why this match was correct/incorrect',
      },
      operator: {
        type: 'string',
        enum: ['AND', 'OR', 'NOT', 'SEQUENCE', 'REFINE'],
        description: 'Composition operator',
      },
      operands: {
        type: 'array',
        items: { type: 'string' },
        description: 'Pattern names to compose',
      },
    },
    required: ['action'],
  },
};

export { auiPatternWorkflow, AUI_PATTERN_TOOL_DEFINITION };
