/**
 * Unified Output Filter
 *
 * Single entry point for filtering LLM output based on model vetting profiles.
 * UNVETTED models will ERROR - no fallback, no silent failure.
 *
 * Philosophy: Errors are preferable to low quality output.
 */

import { getVettingProfile, type ModelVettingProfile } from './profiles';

export interface FilterResult {
  content: string;
  hadPreamble: boolean;
  hadClosing: boolean;
  hadThinkingTags: boolean;
  strategy: 'xml-tags' | 'heuristic' | 'structured' | 'none' | 'unvetted-error';
  modelVetted: boolean;
  modelId: string;
  // For structured models, include reasoning if available
  reasoning?: string;
}

export class UnvettedModelError extends Error {
  constructor(modelId: string) {
    super(`Model "${modelId}" is not vetted. Cannot filter output reliably. Add vetting profile or use a vetted model.`);
    this.name = 'UnvettedModelError';
  }
}

/**
 * Filter model output using the appropriate strategy for the model
 *
 * @param rawOutput - Raw LLM output text
 * @param modelId - Model identifier (e.g., '@cf/meta/llama-3.1-70b-instruct')
 * @throws UnvettedModelError if model is not in vetting registry
 */
export function filterModelOutput(
  rawOutput: string,
  modelId: string
): FilterResult {
  const profile = getVettingProfile(modelId);

  if (!profile || !profile.vetted) {
    throw new UnvettedModelError(modelId);
  }

  // Apply model-specific strategy
  switch (profile.strategy) {
    case 'xml-tags':
      return filterXmlTags(rawOutput, profile);

    case 'heuristic':
      return filterHeuristic(rawOutput, profile);

    case 'structured':
      // For structured models (GPT-OSS), the rawOutput should already be
      // the clean output text extracted during the API call.
      // If it's still a JSON structure, parse and extract.
      return filterStructured(rawOutput, profile);

    case 'none':
      return {
        content: rawOutput.trim(),
        hadPreamble: false,
        hadClosing: false,
        hadThinkingTags: false,
        strategy: 'none',
        modelVetted: true,
        modelId,
      };

    default:
      // Should never happen with typed profiles
      throw new Error(`Unknown strategy: ${profile.strategy}`);
  }
}

/**
 * XML Tags Strategy
 *
 * For models that use <think>, <reasoning>, etc. tags.
 * Simply remove the tags and their contents.
 */
function filterXmlTags(
  text: string,
  profile: ModelVettingProfile
): FilterResult {
  let content = text;
  let hadThinkingTags = false;

  // Build patterns from profile's thinking tags
  const tagPairs: Array<{ open: string; close: string }> = [];

  for (const tag of profile.patterns.thinkingTags) {
    if (tag.startsWith('</')) continue; // Skip close tags, we handle them with open tags

    const openTag = tag;
    const closeTag = tag.replace('<', '</');

    // Check if we have the close tag in the list
    if (profile.patterns.thinkingTags.includes(closeTag)) {
      tagPairs.push({ open: openTag, close: closeTag });
    }
  }

  // Remove each tag pair and its contents
  for (const { open, close } of tagPairs) {
    const regex = new RegExp(
      `${escapeRegex(open)}[\\s\\S]*?${escapeRegex(close)}`,
      'gi'
    );
    if (regex.test(content)) {
      hadThinkingTags = true;
    }
    content = content.replace(regex, '');
  }

  // Clean up any remaining whitespace
  content = content.trim();
  content = content.replace(/^\n+/, '').replace(/\n+$/, '');

  return {
    content,
    hadPreamble: false,
    hadClosing: false,
    hadThinkingTags,
    strategy: 'xml-tags',
    modelVetted: true,
    modelId: profile.modelId,
  };
}

/**
 * Heuristic Strategy
 *
 * For models that use conversational preambles/closings.
 * Remove known phrases at start and end.
 */
function filterHeuristic(
  text: string,
  profile: ModelVettingProfile
): FilterResult {
  let content = text.trim();
  let hadPreamble = false;
  let hadClosing = false;

  // Step 1: Remove role prefixes (e.g., "[assistant]:")
  for (const prefix of profile.patterns.rolePrefixes) {
    const regex = new RegExp(`^${escapeRegex(prefix)}\\s*`, 'i');
    if (regex.test(content)) {
      content = content.replace(regex, '');
      hadPreamble = true;
    }
  }

  // Step 2: Remove preamble phrases at start
  // Check if first line/sentence matches a preamble pattern
  const preambleRemoved = removePreamble(content, profile.patterns.preamblePhrases);
  if (preambleRemoved.removed) {
    content = preambleRemoved.content;
    hadPreamble = true;
  }

  // Step 3: Remove closing phrases at end
  const closingRemoved = removeClosing(content, profile.patterns.closingPhrases);
  if (closingRemoved.removed) {
    content = closingRemoved.content;
    hadClosing = true;
  }

  // Step 4: Clean up leading colons or dashes that might remain
  content = content.replace(/^[:–—-]\s*/, '').trim();

  return {
    content,
    hadPreamble,
    hadClosing,
    hadThinkingTags: false,
    strategy: 'heuristic',
    modelVetted: true,
    modelId: profile.modelId,
  };
}

/**
 * Remove preamble phrases from the start of text
 */
function removePreamble(
  text: string,
  phrases: string[]
): { content: string; removed: boolean } {
  if (phrases.length === 0) {
    return { content: text, removed: false };
  }

  const lowerText = text.toLowerCase();

  for (const phrase of phrases) {
    const lowerPhrase = phrase.toLowerCase();

    if (lowerText.startsWith(lowerPhrase)) {
      // Find the end of the preamble sentence/clause
      // Look for: colon, newline, or period followed by newline
      const afterPhrase = text.slice(phrase.length);

      // Pattern 1: "Here's the rewritten text:\n\n" - remove up to double newline
      const colonNewline = afterPhrase.match(/^[^:]*:\s*\n/);
      if (colonNewline) {
        const removed = phrase + colonNewline[0];
        return {
          content: text.slice(removed.length).trim(),
          removed: true,
        };
      }

      // Pattern 2: "Here is the text:\n" - remove up to single newline after colon
      const colonMatch = afterPhrase.match(/^[^:\n]*:/);
      if (colonMatch) {
        const removed = phrase + colonMatch[0];
        let rest = text.slice(removed.length).trim();
        return {
          content: rest,
          removed: true,
        };
      }

      // Pattern 3: "Sure, " followed by content - remove up to comma/space
      const commaMatch = afterPhrase.match(/^[,!]?\s*/);
      if (commaMatch && commaMatch[0].length > 0) {
        const removed = phrase + commaMatch[0];
        return {
          content: text.slice(removed.length).trim(),
          removed: true,
        };
      }

      // Pattern 4: First paragraph is preamble
      const firstPara = text.indexOf('\n\n');
      if (firstPara > 0 && firstPara < 300) {
        return {
          content: text.slice(firstPara + 2).trim(),
          removed: true,
        };
      }
    }
  }

  return { content: text, removed: false };
}

/**
 * Remove closing phrases from the end of text
 */
function removeClosing(
  text: string,
  phrases: string[]
): { content: string; removed: boolean } {
  if (phrases.length === 0) {
    return { content: text, removed: false };
  }

  const lowerText = text.toLowerCase();

  for (const phrase of phrases) {
    const lowerPhrase = phrase.toLowerCase();
    const idx = lowerText.lastIndexOf(lowerPhrase);

    // Only remove if in last 20% of text
    if (idx > 0 && idx > text.length * 0.8) {
      // Find paragraph break before the closing
      const beforeClosing = text.slice(0, idx);
      const lastParaBreak = beforeClosing.lastIndexOf('\n\n');

      if (lastParaBreak > 0 && lastParaBreak > text.length * 0.7) {
        // Remove from paragraph break
        return {
          content: text.slice(0, lastParaBreak).trim(),
          removed: true,
        };
      } else {
        // Remove from phrase start
        return {
          content: text.slice(0, idx).trim(),
          removed: true,
        };
      }
    }
  }

  return { content: text, removed: false };
}

/**
 * Structured Strategy
 *
 * For models like GPT-OSS that return structured responses with explicit
 * output/reasoning blocks. The response format is:
 * { output: [{ type: "reasoning", content: [...] }, { type: "message", content: [...] }] }
 *
 * By the time this filter runs, the output should already be extracted as a string.
 * This function handles the case where raw JSON might still be passed.
 */
function filterStructured(
  text: string,
  profile: ModelVettingProfile
): FilterResult {
  let content = text;
  let reasoning: string | undefined;

  // Check if this is still a JSON structure that needs parsing
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);

      // Handle { output: [...] } format
      const outputArray = Array.isArray(parsed.output) ? parsed.output :
                          (Array.isArray(parsed) ? parsed : null);

      if (outputArray) {
        for (const block of outputArray) {
          if (block.type === 'reasoning' && Array.isArray(block.content)) {
            reasoning = block.content
              .filter((c: any) => c.type === 'reasoning_text')
              .map((c: any) => c.text)
              .join('\n');
          } else if (block.type === 'message' && Array.isArray(block.content)) {
            content = block.content
              .filter((c: any) => c.type === 'output_text')
              .map((c: any) => c.text)
              .join('\n');
          }
        }
      }
    } catch {
      // Not valid JSON, treat as plain text
    }
  }

  return {
    content: content.trim(),
    hadPreamble: false,
    hadClosing: false,
    hadThinkingTags: reasoning !== undefined && reasoning.length > 0,
    strategy: 'structured',
    modelVetted: true,
    modelId: profile.modelId,
    reasoning,
  };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if output likely needs filtering (quick check)
 * Use this to skip filtering for obviously clean output
 */
export function likelyNeedsFiltering(text: string, modelId: string): boolean {
  const profile = getVettingProfile(modelId);
  if (!profile) return true;  // Unknown model, assume needs filtering

  const first300 = text.trim().slice(0, 300).toLowerCase();
  const last200 = text.trim().slice(-200).toLowerCase();

  // Check for thinking tags
  for (const tag of profile.patterns.thinkingTags) {
    if (first300.includes(tag.toLowerCase())) return true;
  }

  // Check for preambles
  for (const phrase of profile.patterns.preamblePhrases) {
    if (first300.startsWith(phrase.toLowerCase())) return true;
  }

  // Check for closings
  for (const phrase of profile.patterns.closingPhrases) {
    if (last200.includes(phrase.toLowerCase())) return true;
  }

  return false;
}
