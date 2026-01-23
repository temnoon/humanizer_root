#!/usr/bin/env npx tsx
/**
 * Interactive transform test script
 *
 * Run with: npx tsx scripts/test-transforms.ts
 */

import { TransformerService } from '../src/transformations/transformer.js';
import { BUILTIN_PERSONAS, BUILTIN_STYLES } from '../src/transformations/types.js';
import type { LlmAdapter } from '../src/llm/types.js';

// Test text - casual modern writing
const TEST_TEXT = `My boss sent me an email yesterday about the quarterly review.
She said the numbers look good but we need to improve our customer retention.
I think she's right - we've been losing too many users after the first month.
The team meeting is tomorrow and I'm honestly not sure what to propose.`;

// Mock adapter that echoes the prompt for inspection
function createInspectionAdapter(): LlmAdapter & { lastPrompt: string } {
  const adapter = {
    name: 'inspection',
    defaultModel: 'mock',
    lastPrompt: '',
    async complete(system: string, user: string): Promise<string> {
      adapter.lastPrompt = user;

      // Return a simple transformation for testing
      // In production this would be an actual LLM call
      return `[MOCK TRANSFORMED]
The manager communicated via electronic correspondence regarding the quarterly assessment.
She indicated the metrics appear favorable though customer retention warrants improvement.
I concur - we have experienced elevated user attrition within the initial month.
The team assembly convenes tomorrow; I remain uncertain regarding my recommendations.`;
    },
  };
  return adapter;
}

async function testPersonaTransform() {
  console.log('\n' + '='.repeat(80));
  console.log('PERSONA TRANSFORMATION TEST');
  console.log('='.repeat(80));

  const adapter = createInspectionAdapter();
  const transformer = new TransformerService(adapter);

  console.log('\nInput text:');
  console.log('-'.repeat(40));
  console.log(TEST_TEXT);

  console.log('\n\nUsing persona: STOIC');
  console.log('-'.repeat(40));

  const result = await transformer.transformPersona(TEST_TEXT, BUILTIN_PERSONAS.stoic);

  console.log('\nPrompt sent to LLM (excerpt):');
  console.log('-'.repeat(40));
  // Show first 1500 chars of prompt
  console.log(adapter.lastPrompt.slice(0, 1500) + '...\n');

  console.log('\nOutput:');
  console.log('-'.repeat(40));
  console.log(result.text);

  console.log('\nMetrics:');
  console.log(`  Input words: ${result.inputWordCount}`);
  console.log(`  Output words: ${result.outputWordCount}`);
  console.log(`  Duration: ${result.durationMs}ms`);
}

async function testStyleTransform() {
  console.log('\n' + '='.repeat(80));
  console.log('STYLE TRANSFORMATION TEST');
  console.log('='.repeat(80));

  const adapter = createInspectionAdapter();
  const transformer = new TransformerService(adapter);

  console.log('\nInput text:');
  console.log('-'.repeat(40));
  console.log(TEST_TEXT);

  console.log('\n\nUsing style: LITERARY');
  console.log('-'.repeat(40));

  const result = await transformer.transformStyle(TEST_TEXT, BUILTIN_STYLES.literary);

  console.log('\nPrompt sent to LLM (excerpt):');
  console.log('-'.repeat(40));
  console.log(adapter.lastPrompt.slice(0, 1500) + '...\n');

  console.log('\nOutput:');
  console.log('-'.repeat(40));
  console.log(result.text);

  console.log('\nMetrics:');
  console.log(`  Input words: ${result.inputWordCount}`);
  console.log(`  Output words: ${result.outputWordCount}`);
  console.log(`  Duration: ${result.durationMs}ms`);
}

async function analyzePrompts() {
  console.log('\n' + '='.repeat(80));
  console.log('PROMPT ANALYSIS');
  console.log('='.repeat(80));

  const adapter = createInspectionAdapter();
  const transformer = new TransformerService(adapter);

  // Get persona prompt
  await transformer.transformPersona(TEST_TEXT, BUILTIN_PERSONAS.empiricist);
  const personaPrompt = adapter.lastPrompt;

  // Get style prompt
  await transformer.transformStyle(TEST_TEXT, BUILTIN_STYLES.academic);
  const stylePrompt = adapter.lastPrompt;

  // Analysis
  console.log('\nPERSONA PROMPT ANALYSIS:');
  console.log('-'.repeat(40));
  console.log(`Length: ${personaPrompt.length} chars`);
  console.log(`Has "INVARIANTS": ${personaPrompt.includes('INVARIANTS')}`);
  console.log(`Has "PROHIBITIONS": ${personaPrompt.includes('PROHIBITIONS')}`);
  console.log(`Has "VOCABULARY": ${personaPrompt.includes('VOCABULARY')}`);
  console.log(`Has 5-layer stack: ${personaPrompt.includes('ONTOLOGICAL') || personaPrompt.includes('Ontological')}`);

  console.log('\nSTYLE PROMPT ANALYSIS:');
  console.log('-'.repeat(40));
  console.log(`Length: ${stylePrompt.length} chars`);
  console.log(`Has "INVARIANTS": ${stylePrompt.includes('INVARIANTS')}`);
  console.log(`Has "PROHIBITIONS": ${stylePrompt.includes('PROHIBITIONS')}`);
  console.log(`Has "VOCABULARY": ${stylePrompt.includes('VOCABULARY')}`);
  console.log(`Has viewpoint detection: ${stylePrompt.includes('person') || stylePrompt.includes('perspective')}`);

  console.log('\n' + '='.repeat(80));
  console.log('MISSING FEATURES (compared to production npe-api):');
  console.log('='.repeat(80));

  const missing = [];
  if (!personaPrompt.includes('VOCABULARY')) {
    missing.push('❌ VOCABULARY preservation rules');
  }
  if (!personaPrompt.includes('5-layer') && !personaPrompt.includes('ONTOLOGICAL')) {
    missing.push('❌ 5-layer persona stack (ontology, epistemics, attention, values, reader)');
  }
  if (!personaPrompt.includes('sanitize')) {
    missing.push('❌ sanitizePersonaOutput() post-filter (in code, not prompt)');
  }

  if (missing.length === 0) {
    console.log('✅ All production features present');
  } else {
    missing.forEach(m => console.log(m));
  }
}

// Run tests
async function main() {
  console.log('Transform Test Script');
  console.log('=====================\n');
  console.log('Testing current packages/npe transformation implementation...\n');

  await testPersonaTransform();
  await testStyleTransform();
  await analyzePrompts();

  console.log('\n');
}

main().catch(console.error);
