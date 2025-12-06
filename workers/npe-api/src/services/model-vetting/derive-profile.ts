/**
 * Model Vetting Profile Derivation
 *
 * Tools to test a new model and derive a vetting profile.
 * Run this against a model before adding it to the vetted registry.
 *
 * Usage:
 * 1. Call deriveVettingProfile() with a model runner function
 * 2. Review the detected patterns and test results
 * 3. Add approved profile to profiles.ts with vetted: true
 */

import type { ModelVettingProfile } from './profiles';

export interface VettingTestCase {
  name: string;
  prompt: string;
  // Expected output should start with actual content, not preamble
  contentStartPattern: RegExp;
}

/**
 * Standard test prompts for deriving model behavior
 */
export const VETTING_TEST_CASES: VettingTestCase[] = [
  {
    name: 'formal-rewrite',
    prompt: `Rewrite this text in formal academic style. Return ONLY the rewritten text, nothing else.

"yo what's up, gonna tell you about this cool thing i found"`,
    contentStartPattern: /^[A-Z]/,  // Should start with capital letter, not "Here's"
  },
  {
    name: 'casual-rewrite',
    prompt: `Rewrite this text casually. Return ONLY the rewritten text, nothing else.

"The meeting has been scheduled for tomorrow at 3pm. Please ensure your attendance."`,
    contentStartPattern: /^[A-Za-z"']/,  // Should start with content
  },
  {
    name: 'persona-transform',
    prompt: `Rewrite this as if speaking to a close friend. Return ONLY the rewritten text.

"I would like to inform you that the project has been completed successfully."`,
    contentStartPattern: /^[A-Za-z"']/,
  },
  {
    name: 'namespace-transform',
    prompt: `Rewrite this using cyberpunk terminology. Return ONLY the rewritten text.

"The king sent his knights to protect the village from the dragon."`,
    contentStartPattern: /^[A-Za-z"']/,
  },
  {
    name: 'humanize-ai',
    prompt: `Make this text sound more natural and human. Return ONLY the revised text.

"It is important to note that the implementation of this solution requires careful consideration of various factors."`,
    contentStartPattern: /^[A-Za-z"']/,
  },
];

export interface DerivedPattern {
  pattern: string;
  frequency: number;  // How many test cases showed this pattern
  examples: string[];
}

export interface DerivationResult {
  modelId: string;
  testResults: Array<{
    testCase: string;
    rawOutput: string;
    detectedThinkingTags: string[];
    detectedPreambles: string[];
    detectedClosings: string[];
    passedContentCheck: boolean;
  }>;
  suggestedProfile: Partial<ModelVettingProfile>;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

/**
 * Run model through test cases and derive a vetting profile
 *
 * @param modelId - Identifier for the model being tested
 * @param runModel - Function that takes a prompt and returns model output
 */
export async function deriveVettingProfile(
  modelId: string,
  runModel: (prompt: string) => Promise<string>
): Promise<DerivationResult> {
  const testResults: DerivationResult['testResults'] = [];
  const notes: string[] = [];

  const allThinkingTags = new Set<string>();
  const allPreambles = new Set<string>();
  const allClosings = new Set<string>();

  let xmlTagsDetected = 0;
  let preambleDetected = 0;

  for (const testCase of VETTING_TEST_CASES) {
    try {
      const rawOutput = await runModel(testCase.prompt);

      // Detect XML-style thinking tags
      const thinkingTags = detectThinkingTags(rawOutput);
      thinkingTags.forEach(t => allThinkingTags.add(t));
      if (thinkingTags.length > 0) xmlTagsDetected++;

      // Detect preamble phrases
      const preambles = detectPreambles(rawOutput);
      preambles.forEach(p => allPreambles.add(p));
      if (preambles.length > 0) preambleDetected++;

      // Detect closing phrases
      const closings = detectClosings(rawOutput);
      closings.forEach(c => allClosings.add(c));

      // Check if content starts correctly
      const cleanedOutput = stripDetectedPatterns(rawOutput, thinkingTags, preambles);
      const passedContentCheck = testCase.contentStartPattern.test(cleanedOutput.trim());

      testResults.push({
        testCase: testCase.name,
        rawOutput,
        detectedThinkingTags: thinkingTags,
        detectedPreambles: preambles,
        detectedClosings: closings,
        passedContentCheck,
      });

    } catch (error) {
      notes.push(`Test "${testCase.name}" failed: ${error}`);
      testResults.push({
        testCase: testCase.name,
        rawOutput: `ERROR: ${error}`,
        detectedThinkingTags: [],
        detectedPreambles: [],
        detectedClosings: [],
        passedContentCheck: false,
      });
    }
  }

  // Determine strategy
  let strategy: ModelVettingProfile['strategy'];
  if (xmlTagsDetected >= 3) {
    strategy = 'xml-tags';
    notes.push(`Model uses XML thinking tags in ${xmlTagsDetected}/${VETTING_TEST_CASES.length} tests`);
  } else if (preambleDetected >= 2) {
    strategy = 'heuristic';
    notes.push(`Model uses conversational preambles in ${preambleDetected}/${VETTING_TEST_CASES.length} tests`);
  } else {
    strategy = 'heuristic';
    notes.push('Model has minimal preamble patterns');
  }

  // Calculate confidence
  const passedCount = testResults.filter(r => r.passedContentCheck).length;
  let confidence: DerivationResult['confidence'];
  if (passedCount >= 4) {
    confidence = 'high';
  } else if (passedCount >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
    notes.push('WARNING: Low confidence - model may not be suitable for transformation tasks');
  }

  return {
    modelId,
    testResults,
    suggestedProfile: {
      modelId,
      provider: inferProvider(modelId),
      patterns: {
        thinkingTags: Array.from(allThinkingTags),
        preamblePhrases: Array.from(allPreambles),
        closingPhrases: Array.from(allClosings),
        rolePrefixes: detectRolePrefixes(testResults),
      },
      strategy,
      vetted: false,  // Always false until manually reviewed
    },
    confidence,
    notes,
  };
}

/**
 * Detect XML-style thinking tags in text
 */
function detectThinkingTags(text: string): string[] {
  const tags: string[] = [];
  const knownTags = ['think', 'thinking', 'reasoning', 'thought', 'internal', 'inner_thoughts'];

  for (const tag of knownTags) {
    const openRegex = new RegExp(`<${tag}>`, 'i');
    const closeRegex = new RegExp(`</${tag}>`, 'i');

    if (openRegex.test(text) && closeRegex.test(text)) {
      tags.push(`<${tag}>`);
      tags.push(`</${tag}>`);
    }
  }

  return tags;
}

/**
 * Detect preamble phrases at the start of text
 */
function detectPreambles(text: string): string[] {
  const detected: string[] = [];
  const first200 = text.trim().slice(0, 200);

  const preamblePatterns = [
    /^(Here is|Here's)[^.:\n]+[.:]/i,
    /^(Sure[,!])/i,
    /^(Okay[,!])/i,
    /^(Of course[,!])/i,
    /^(Let me)[^.]+[.]/i,
    /^(I've|I have)[^.]+[.]/i,
    /^(The following is|Below is)[^.]+[.:]/i,
    /^(Based on|Following)[^.]+[.]/i,
  ];

  for (const pattern of preamblePatterns) {
    const match = first200.match(pattern);
    if (match) {
      // Extract just the key phrase
      const keyPhrase = match[1];
      if (keyPhrase && !detected.includes(keyPhrase)) {
        detected.push(keyPhrase);
      }
    }
  }

  return detected;
}

/**
 * Detect closing phrases at the end of text
 */
function detectClosings(text: string): string[] {
  const detected: string[] = [];
  const last300 = text.trim().slice(-300);

  const closingPatterns = [
    /(I hope this)[^.]*[.!]/i,
    /(Let me know)[^.]*[.!?]/i,
    /(Feel free to)[^.]*[.!]/i,
    /(Is there anything)[^.]*[.!?]/i,
    /(Would you like)[^.]*[.!?]/i,
    /(I'm happy to)[^.]*[.!]/i,
  ];

  for (const pattern of closingPatterns) {
    const match = last300.match(pattern);
    if (match) {
      const keyPhrase = match[1];
      if (keyPhrase && !detected.includes(keyPhrase)) {
        detected.push(keyPhrase);
      }
    }
  }

  return detected;
}

/**
 * Detect role prefixes like "[assistant]:"
 */
function detectRolePrefixes(
  results: DerivationResult['testResults']
): string[] {
  const prefixes: string[] = [];

  for (const result of results) {
    const text = result.rawOutput;
    const prefixPatterns = [
      /^\[assistant\]:\s*/i,
      /^assistant:\s*/i,
      /^\[user\]:\s*/i,
    ];

    for (const pattern of prefixPatterns) {
      const match = text.match(pattern);
      if (match && !prefixes.includes(match[0].toLowerCase().trim())) {
        prefixes.push(match[0].toLowerCase().trim());
      }
    }
  }

  return prefixes;
}

/**
 * Strip detected patterns to check content
 */
function stripDetectedPatterns(
  text: string,
  thinkingTags: string[],
  preambles: string[]
): string {
  let result = text;

  // Strip thinking tags
  for (let i = 0; i < thinkingTags.length; i += 2) {
    const open = thinkingTags[i];
    const close = thinkingTags[i + 1];
    if (open && close) {
      const regex = new RegExp(
        `${open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'gi'
      );
      result = result.replace(regex, '');
    }
  }

  // Strip preambles
  for (const preamble of preambles) {
    const regex = new RegExp(`^${preamble.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.:\n]*[.:]?\\s*`, 'i');
    result = result.replace(regex, '');
  }

  return result.trim();
}

/**
 * Infer provider from model ID
 */
function inferProvider(modelId: string): ModelVettingProfile['provider'] {
  if (modelId.startsWith('@cf/')) return 'cloudflare';
  if (modelId.includes('gpt') || modelId.includes('o1')) return 'openai';
  if (modelId.includes('claude')) return 'anthropic';
  return 'ollama';  // Default to Ollama for local models
}

/**
 * Format derivation result for logging/review
 */
export function formatDerivationResult(result: DerivationResult): string {
  const lines: string[] = [
    `# Vetting Profile Derivation: ${result.modelId}`,
    ``,
    `## Summary`,
    `- Confidence: ${result.confidence}`,
    `- Strategy: ${result.suggestedProfile.strategy}`,
    `- Provider: ${result.suggestedProfile.provider}`,
    ``,
    `## Detected Patterns`,
    ``,
    `### Thinking Tags`,
    result.suggestedProfile.patterns?.thinkingTags?.length
      ? result.suggestedProfile.patterns.thinkingTags.map(t => `- \`${t}\``).join('\n')
      : '(none detected)',
    ``,
    `### Preamble Phrases`,
    result.suggestedProfile.patterns?.preamblePhrases?.length
      ? result.suggestedProfile.patterns.preamblePhrases.map(p => `- "${p}"`).join('\n')
      : '(none detected)',
    ``,
    `### Closing Phrases`,
    result.suggestedProfile.patterns?.closingPhrases?.length
      ? result.suggestedProfile.patterns.closingPhrases.map(c => `- "${c}"`).join('\n')
      : '(none detected)',
    ``,
    `## Test Results`,
    ``,
  ];

  for (const test of result.testResults) {
    lines.push(`### ${test.testCase}`);
    lines.push(`- Passed: ${test.passedContentCheck ? '✓' : '✗'}`);
    if (test.detectedThinkingTags.length) {
      lines.push(`- Thinking tags: ${test.detectedThinkingTags.join(', ')}`);
    }
    if (test.detectedPreambles.length) {
      lines.push(`- Preambles: ${test.detectedPreambles.join(', ')}`);
    }
    lines.push(`- Output preview: "${test.rawOutput.slice(0, 100)}..."`);
    lines.push(``);
  }

  if (result.notes.length) {
    lines.push(`## Notes`);
    result.notes.forEach(n => lines.push(`- ${n}`));
  }

  return lines.join('\n');
}
