/**
 * Model Vetting Test Routes
 *
 * Test endpoints for deriving and validating model vetting profiles.
 * These routes are for development/testing only.
 */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { VETTING_TEST_CASES, formatDerivationResult, type DerivationResult } from '../services/model-vetting/derive-profile';
import { filterModelOutput, getVettingProfile, UnvettedModelError } from '../services/model-vetting';

const app = new Hono<{ Bindings: Env }>();

/**
 * Parse GPT-OSS structured response
 * GPT-OSS returns: [{ type: "reasoning", ... }, { type: "message", ... }]
 */
function parseGptOssResponse(response: unknown): {
  reasoning: string | null;
  output: string;
  hasReasoningBlock: boolean;
} {
  // GPT-OSS returns: { output: [{ type: "reasoning" }, { type: "message" }], ... }
  if (typeof response === 'object' && response !== null) {
    const r = response as Record<string, any>;

    // The output array is in response.output
    const outputArray = Array.isArray(r.output) ? r.output : (Array.isArray(response) ? response : null);

    if (outputArray) {
      let reasoning: string | null = null;
      let outputText = '';

      for (const block of outputArray) {
        if (block.type === 'reasoning' && Array.isArray(block.content)) {
          // Extract reasoning text
          reasoning = block.content
            .filter((c: any) => c.type === 'reasoning_text')
            .map((c: any) => c.text)
            .join('\n');
        } else if (block.type === 'message' && Array.isArray(block.content)) {
          // Extract output text
          outputText = block.content
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('\n');
        }
      }

      return {
        reasoning,
        output: outputText || JSON.stringify(response),
        hasReasoningBlock: reasoning !== null && reasoning.length > 0
      };
    }

    // Fallback for other object formats
    return {
      reasoning: null,
      output: r.response || r.text || r.content || JSON.stringify(response),
      hasReasoningBlock: false
    };
  }

  // Handle string format
  if (typeof response === 'string') {
    return {
      reasoning: null,
      output: response,
      hasReasoningBlock: false
    };
  }

  return {
    reasoning: null,
    output: JSON.stringify(response),
    hasReasoningBlock: false
  };
}

/**
 * Test a single prompt against a model
 * POST /api/model-vetting/test-prompt
 */
app.post('/test-prompt', async (c) => {
  const { modelId, prompt, instructions } = await c.req.json();

  if (!modelId || !prompt) {
    return c.json({ error: 'modelId and prompt required' }, 400);
  }

  try {
    const startTime = Date.now();
    let rawOutput: string;

    // GPT-OSS models use different API format
    if (modelId.includes('gpt-oss')) {
      const response = await c.env.AI.run(modelId as any, {
        instructions: instructions || 'You are a helpful assistant. Follow instructions exactly.',
        input: prompt,
        // Use low reasoning effort for faster testing
        reasoning: {
          effort: 'low',
          summary: 'detailed'  // To see reasoning traces
        }
      });

      // Log full response structure for debugging
      console.log('[GPT-OSS Response]', JSON.stringify(response, null, 2));

      // GPT-OSS 120b returns structured response with separate reasoning/output blocks
      const parsed = parseGptOssResponse(response);
      // Return just the output text for consistency with other models
      rawOutput = parsed.output;
    } else {
      // Standard Llama-style models
      const response = await c.env.AI.run(modelId as any, {
        messages: [
          { role: 'system', content: instructions || 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });
      rawOutput = (response as any).response || JSON.stringify(response);
    }

    const durationMs = Date.now() - startTime;

    return c.json({
      modelId,
      prompt: prompt.slice(0, 100) + '...',
      rawOutput,
      rawOutputLength: rawOutput.length,
      durationMs,
      // Analysis
      analysis: analyzeOutput(rawOutput)
    });

  } catch (error: any) {
    return c.json({
      error: error.message,
      modelId
    }, 500);
  }
});

/**
 * Run full vetting derivation for a model
 * POST /api/model-vetting/derive
 */
app.post('/derive', async (c) => {
  const { modelId, instructions } = await c.req.json();

  if (!modelId) {
    return c.json({ error: 'modelId required' }, 400);
  }

  const testResults: Array<{
    testCase: string;
    prompt: string;
    rawOutput: string;
    analysis: ReturnType<typeof analyzeOutput>;
    durationMs: number;
  }> = [];

  for (const testCase of VETTING_TEST_CASES) {
    try {
      const startTime = Date.now();
      let rawOutput: string;

      if (modelId.includes('gpt-oss')) {
        const response = await c.env.AI.run(modelId as any, {
          instructions: instructions || 'Follow instructions exactly. Output ONLY what is requested.',
          input: testCase.prompt,
          reasoning: {
            effort: 'low',
            summary: 'detailed'
          }
        });

        // Handle GPT-OSS response structure
        const parsed = parseGptOssResponse(response);
        rawOutput = parsed.output;
      } else {
        const response = await c.env.AI.run(modelId as any, {
          messages: [
            { role: 'system', content: instructions || 'Follow instructions exactly.' },
            { role: 'user', content: testCase.prompt }
          ],
          max_tokens: 2000,
          temperature: 0.7
        });
        rawOutput = (response as any).response || JSON.stringify(response);
      }

      testResults.push({
        testCase: testCase.name,
        prompt: testCase.prompt,
        rawOutput,
        analysis: analyzeOutput(rawOutput),
        durationMs: Date.now() - startTime
      });

    } catch (error: any) {
      testResults.push({
        testCase: testCase.name,
        prompt: testCase.prompt,
        rawOutput: `ERROR: ${error.message}`,
        analysis: analyzeOutput(''),
        durationMs: 0
      });
    }
  }

  // Aggregate analysis
  const aggregateAnalysis = aggregateResults(testResults);

  return c.json({
    modelId,
    testCount: testResults.length,
    testResults,
    aggregateAnalysis,
    suggestedProfile: generateSuggestedProfile(modelId, aggregateAnalysis)
  });
});

/**
 * Test the output filter against a specific model's output
 * POST /api/model-vetting/test-filter
 */
app.post('/test-filter', async (c) => {
  const { modelId, rawOutput } = await c.req.json();

  if (!modelId || !rawOutput) {
    return c.json({ error: 'modelId and rawOutput required' }, 400);
  }

  const profile = getVettingProfile(modelId);

  if (!profile) {
    return c.json({
      error: 'Model not vetted',
      modelId,
      suggestion: 'Add profile to MODEL_VETTING_PROFILES in profiles.ts',
      rawAnalysis: analyzeOutput(rawOutput)
    }, 400);
  }

  try {
    const result = filterModelOutput(rawOutput, modelId);
    return c.json({
      modelId,
      profile: {
        strategy: profile.strategy,
        vetted: profile.vetted
      },
      filterResult: result,
      before: rawOutput,
      after: result.content,
      reduction: `${((rawOutput.length - result.content.length) / rawOutput.length * 100).toFixed(1)}%`
    });
  } catch (error: any) {
    if (error instanceof UnvettedModelError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

/**
 * Analyze raw output for patterns
 */
function analyzeOutput(text: string): {
  hasThinkingTags: boolean;
  thinkingTagsFound: string[];
  hasPreamble: boolean;
  preambleType: string | null;
  hasClosing: boolean;
  closingType: string | null;
  contentStartsClean: boolean;
  firstLine: string;
  lastLine: string;
} {
  if (!text) {
    return {
      hasThinkingTags: false,
      thinkingTagsFound: [],
      hasPreamble: false,
      preambleType: null,
      hasClosing: false,
      closingType: null,
      contentStartsClean: false,
      firstLine: '',
      lastLine: ''
    };
  }

  const lines = text.trim().split('\n');
  const firstLine = lines[0] || '';
  const lastLine = lines[lines.length - 1] || '';

  // Check for thinking tags
  const thinkingTags = ['<think>', '<thinking>', '<reasoning>', '<thought>', '<internal>', '<summary>'];
  const foundTags = thinkingTags.filter(tag =>
    text.toLowerCase().includes(tag) || text.toLowerCase().includes(tag.replace('<', '</'))
  );

  // Check for preamble patterns
  const preamblePatterns: [RegExp, string][] = [
    [/^here('s| is)/i, 'Here is/Here\'s'],
    [/^sure[,!]/i, 'Sure,'],
    [/^okay[,!]/i, 'Okay,'],
    [/^of course/i, 'Of course'],
    [/^let me/i, 'Let me'],
    [/^i('ve| have)/i, 'I\'ve/I have'],
    [/^the following/i, 'The following'],
    [/^below is/i, 'Below is'],
    [/^\*\*[A-Z]/i, 'Markdown bold header'],
    [/^#{1,3} /i, 'Markdown heading'],
  ];

  let preambleType: string | null = null;
  for (const [pattern, name] of preamblePatterns) {
    if (pattern.test(firstLine)) {
      preambleType = name;
      break;
    }
  }

  // Check for closing patterns
  const closingPatterns: [RegExp, string][] = [
    [/i hope this/i, 'I hope this'],
    [/let me know/i, 'Let me know'],
    [/feel free/i, 'Feel free'],
    [/is there anything/i, 'Is there anything'],
    [/would you like/i, 'Would you like'],
  ];

  let closingType: string | null = null;
  const last200 = text.slice(-200);
  for (const [pattern, name] of closingPatterns) {
    if (pattern.test(last200)) {
      closingType = name;
      break;
    }
  }

  // Check if content starts clean (with actual content, not meta)
  const contentStartsClean = /^[A-Z"][a-z]|^"[A-Z]/.test(firstLine) && !preambleType;

  return {
    hasThinkingTags: foundTags.length > 0,
    thinkingTagsFound: foundTags,
    hasPreamble: preambleType !== null,
    preambleType,
    hasClosing: closingType !== null,
    closingType,
    contentStartsClean,
    firstLine: firstLine.slice(0, 100),
    lastLine: lastLine.slice(0, 100)
  };
}

/**
 * Aggregate results from multiple tests
 */
function aggregateResults(results: Array<{ analysis: ReturnType<typeof analyzeOutput> }>) {
  const total = results.length;
  const withThinkingTags = results.filter(r => r.analysis.hasThinkingTags).length;
  const withPreamble = results.filter(r => r.analysis.hasPreamble).length;
  const withClosing = results.filter(r => r.analysis.hasClosing).length;
  const cleanStarts = results.filter(r => r.analysis.contentStartsClean).length;

  // Collect all unique patterns found
  const allThinkingTags = new Set<string>();
  const allPreambleTypes = new Set<string>();
  const allClosingTypes = new Set<string>();

  for (const r of results) {
    r.analysis.thinkingTagsFound.forEach(t => allThinkingTags.add(t));
    if (r.analysis.preambleType) allPreambleTypes.add(r.analysis.preambleType);
    if (r.analysis.closingType) allClosingTypes.add(r.analysis.closingType);
  }

  return {
    total,
    withThinkingTags,
    withThinkingTagsPercent: `${(withThinkingTags / total * 100).toFixed(0)}%`,
    withPreamble,
    withPreamblePercent: `${(withPreamble / total * 100).toFixed(0)}%`,
    withClosing,
    withClosingPercent: `${(withClosing / total * 100).toFixed(0)}%`,
    cleanStarts,
    cleanStartsPercent: `${(cleanStarts / total * 100).toFixed(0)}%`,
    uniqueThinkingTags: Array.from(allThinkingTags),
    uniquePreambleTypes: Array.from(allPreambleTypes),
    uniqueClosingTypes: Array.from(allClosingTypes),
    suggestedStrategy: withThinkingTags >= total * 0.5 ? 'xml-tags' : 'heuristic'
  };
}

/**
 * Generate suggested profile from analysis
 */
function generateSuggestedProfile(modelId: string, analysis: ReturnType<typeof aggregateResults>) {
  const provider = modelId.startsWith('@cf/') ? 'cloudflare' : 'ollama';

  // Map preamble types to phrases
  const preamblePhraseMap: Record<string, string> = {
    'Here is/Here\'s': 'Here',
    'Sure,': 'Sure',
    'Okay,': 'Okay',
    'Of course': 'Of course',
    'Let me': 'Let me',
    'I\'ve/I have': 'I\'ve',
    'The following': 'The following',
    'Below is': 'Below is',
  };

  const closingPhraseMap: Record<string, string> = {
    'I hope this': 'I hope this',
    'Let me know': 'Let me know',
    'Feel free': 'Feel free',
    'Is there anything': 'Is there anything',
    'Would you like': 'Would you like',
  };

  return {
    modelId,
    displayName: modelId.split('/').pop() || modelId,
    provider,
    patterns: {
      thinkingTags: analysis.uniqueThinkingTags.flatMap(t => [t, t.replace('<', '</')]),
      preamblePhrases: analysis.uniquePreambleTypes
        .map(t => preamblePhraseMap[t])
        .filter(Boolean),
      closingPhrases: analysis.uniqueClosingTypes
        .map(t => closingPhraseMap[t])
        .filter(Boolean),
      rolePrefixes: []
    },
    strategy: analysis.suggestedStrategy,
    vetted: false,
    notes: `Auto-derived. ${analysis.withThinkingTags}/${analysis.total} had thinking tags, ${analysis.withPreamble}/${analysis.total} had preambles.`
  };
}

export default app;
