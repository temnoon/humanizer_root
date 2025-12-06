/**
 * Strip LLM Preambles
 *
 * Removes common LLM thinking/preamble patterns from transformation outputs.
 * LLMs often add phrases like "Here's the rewritten text:" even when instructed not to.
 * This utility strips these patterns to return only the actual transformed content.
 */

/**
 * Common preamble patterns that LLMs add before the actual content
 * Ordered by specificity (most specific first)
 */
const PREAMBLE_PATTERNS: RegExp[] = [
  // Workers AI / Claude prefixes
  /^\[assistant\]:\s*/i,
  /^\[user\]:\s*/i,
  /^assistant:\s*/i,
  /^user:\s*/i,

  // Thinking blocks (Qwen, DeepSeek, etc.)
  /^<think>[\s\S]*?<\/think>\s*/i,
  /^<thinking>[\s\S]*?<\/thinking>\s*/i,
  /^<reasoning>[\s\S]*?<\/reasoning>\s*/i,
  /^<thought>[\s\S]*?<\/thought>\s*/i,
  /^<inner_thoughts>[\s\S]*?<\/inner_thoughts>\s*/i,
  /^<internal>[\s\S]*?<\/internal>\s*/i,

  // Untagged thinking/reasoning (LLM internal monologue)
  // These patterns catch when models dump their reasoning without tags
  /^(?:The user wants me to|I need to|First,? I (?:need|should|will|must)|Let me (?:think|analyze|consider|break))[\s\S]*?(?:\n\n|\n(?=[A-Z]))/i,
  /^(?:My task is to|I am asked to|I've been asked to|The task is to)[\s\S]*?(?:\n\n|\n(?=[A-Z]))/i,
  /^(?:To accomplish this|To do this|For this task|In this case)[\s\S]*?(?:\n\n|\n(?=[A-Z]))/i,

  // Explicit output markers
  /^(?:Here(?:'s| is) (?:the |a )?(?:rewritten|transformed|polished|revised|humanized|converted) (?:text|version|content)[^:]*):?\s*/i,
  /^(?:Here(?:'s| is) (?:the |a )?(?:rewritten|transformed|polished|revised|humanized|converted) version[^:]*):?\s*/i,
  /^(?:Transformed|Polished|Revised|Rewritten|Humanized) (?:text|version|content):?\s*/i,
  /^(?:Output|Result):?\s*/i,

  // Conversational preambles
  /^(?:Sure[,!]?|Okay[,!]?|Alright[,!]?|Of course[,!]?)\s*(?:here(?:'s| is))?[^.]*[.:]?\s*/i,
  /^(?:Let me|I(?:'ll| will)|Allow me to)[^.]+[.]\s*/i,
  /^(?:Based on|Following|As requested|Per your)[^.]+[.]\s*/i,

  // Explanatory preambles (only if followed by clear break)
  /^(?:I've (?:rewritten|transformed|polished|revised)[^.]+[.]\s*)/i,
  /^(?:The following is|Below is)[^.]+[.:]?\s*/i,

  // Numbered/bullet start (when it's not part of the content)
  /^(?:1\.|•|-)\s*(?:Here|The (?:rewritten|transformed))[^\n]+\n+/i,
];

/**
 * Patterns that indicate the start of actual content (stop stripping)
 * Used to avoid over-stripping
 */
const CONTENT_START_PATTERNS: RegExp[] = [
  /^["'`]/,                     // Starts with quote
  /^[A-Z][a-z]+\s+[a-z]/,       // Normal sentence start
  /^(?:The|A|An|In|On|At|For|With|From)\s/i, // Common article/preposition starts
  /^#+ /,                        // Markdown heading
  /^\* /,                        // Markdown list
  /^- /,                         // Markdown list
  /^\d+\. (?![Hh]ere)/,          // Numbered list (not "1. Here's")
];

/**
 * Strip common LLM preambles from text
 *
 * @param text - Raw LLM output
 * @param maxIterations - Maximum stripping passes (prevents infinite loops)
 * @returns Text with preambles removed
 */
export function stripPreambles(text: string, maxIterations: number = 5): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text.trim();
  let iterations = 0;
  let changed = true;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Check if we've reached actual content
    const looksLikeContent = CONTENT_START_PATTERNS.some(pattern => pattern.test(result));
    if (looksLikeContent && iterations > 1) {
      break;
    }

    // Try each preamble pattern
    for (const pattern of PREAMBLE_PATTERNS) {
      if (pattern.test(result)) {
        const newResult = result.replace(pattern, '').trim();
        if (newResult.length > 0 && newResult !== result) {
          result = newResult;
          changed = true;
          break; // Restart from first pattern
        }
      }
    }
  }

  // Final cleanup: remove leading colons or dashes that might remain
  result = result.replace(/^[:–—-]\s*/, '').trim();

  return result;
}

/**
 * Strip preambles and also ensure no trailing meta-commentary
 *
 * @param text - Raw LLM output
 * @returns Clean transformed text
 */
export function stripPreamblesAndTrailing(text: string): string {
  let result = stripPreambles(text);

  // Remove trailing meta-commentary (less common but happens)
  // Pattern: paragraph break followed by short meta sentence
  const trailingPatterns = [
    /\n\n(?:I hope this|Let me know|Is there anything|Would you like)[^.]*\.?\s*$/i,
    /\n\n(?:This version|The above|I've tried)[^.]*\.?\s*$/i,
  ];

  for (const pattern of trailingPatterns) {
    result = result.replace(pattern, '').trim();
  }

  return result;
}

/**
 * Check if text likely contains preambles
 * Use this to decide whether to apply stripping
 */
export function hasPreamble(text: string): boolean {
  if (!text) return false;

  const first200 = text.trim().substring(0, 200).toLowerCase();

  // Quick checks for common preamble indicators
  const indicators = [
    'here\'s the',
    'here is the',
    'let me',
    'i\'ll',
    'i will',
    'sure,',
    'okay,',
    'alright,',
    '[assistant]',
    '<think>',
    '<thinking>',
    'transformed text:',
    'rewritten:',
    'polished:',
    'the user wants me to',
    'i need to',
    'first, i need',
    'first i need',
    'my task is to',
    'i am asked to',
  ];

  return indicators.some(ind => first200.includes(ind));
}
