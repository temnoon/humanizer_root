/**
 * Computer Humanizer - Prompts
 * LLM prompt templates and configuration for humanization
 */

import type { HumanizationIntensity } from './types';

/**
 * Intensity-specific prompt templates
 * Each level provides progressively more aggressive humanization instructions
 */
export const INTENSITY_PROMPTS: Record<HumanizationIntensity, {
  instructions: string;
  wordTolerance: string;
  temperature: number;
}> = {
  light: {
    instructions: `Improve this text to sound more natural while keeping the original structure.

GUIDELINES:
- Add contractions where natural (don't, it's, we're, they'll)
- Soften overly formal phrases
- Replace obvious AI tell-words with natural alternatives
- Keep technical terms and specific facts exactly as written
- Minor sentence restructuring is OK if it improves flow
- Add occasional paragraph breaks where natural pauses occur

FORBIDDEN PUNCTUATION:
- NEVER use em-dashes (—) or en-dashes (–)
- Use commas, periods, or parentheses instead
- If you need a pause, use a comma
- If it's a new thought, start a new sentence`,
    wordTolerance: '±8%',
    temperature: 0.6
  },

  moderate: {
    instructions: `Rewrite this to sound like a knowledgeable person explaining something to a colleague.

GUIDELINES:
- Use contractions throughout (don't, can't, it's, they're, we've)
- Vary sentence lengths - mix short punchy sentences (5-10 words) with longer explanatory ones (15-25 words)
- Use simpler words: "use" not "utilize", "help" not "facilitate", "show" not "demonstrate"
- Add occasional conversational phrases like "Here's the thing" or "Think about it this way"
- Break up any sentence longer than 30 words
- Keep all facts, names, and technical accuracy intact`,
    wordTolerance: '±10%',
    temperature: 0.7
  },

  aggressive: {
    instructions: `Completely rewrite this in a casual, conversational tone - like explaining to a friend over coffee.

GUIDELINES:
- Short sentences are good. Really short sometimes. Then mix in longer ones for variety.
- Start some sentences with "But", "And", "So", or "Now" - that's how people actually talk
- Use contractions everywhere - nobody writes "do not" in casual conversation
- Replace all jargon with plain language a teenager would understand
- Add personality: rhetorical questions, emphasis, occasional asides
- It's okay to restructure paragraphs entirely for better flow
- Break up walls of text - add paragraph breaks where natural pauses occur
- Keep the core meaning and all facts, but express them like a human would`,
    wordTolerance: '±15%',
    temperature: 0.8
  }
};

/**
 * AI tell-words to explicitly forbid in output
 * The LLM sometimes reintroduces these if not explicitly told to avoid them
 *
 * SYNCHRONIZED with tell-words.ts detection dictionary (Dec 2025)
 * Categories: Academic/Formal, Transitional, Chatbot, Structural
 */
export const FORBIDDEN_TELL_WORDS = [
  // Academic/Formal (weight 0.8)
  'delve', 'delving', 'tapestry', 'landscape', 'robust', 'leverage', 'leveraging',
  'navigate', 'navigating', 'realm', 'holistic', 'paradigm', 'multifaceted',
  'nuanced', 'pivotal', 'crucial', 'vital', 'comprehensive', 'intricate',
  'meticulously', 'underscores', 'quintessential', 'culminate', 'embark', 'endeavor',

  // Transitional (weight 0.6)
  'furthermore', 'moreover', 'consequently', 'additionally', 'subsequently',
  'nevertheless', 'nonetheless', 'henceforth', 'whereby', 'thereof',
  "it's worth noting", "it is worth noting", "it's important to",
  "it is important to", "in today's", "in the modern", "needless to say",
  "it goes without saying", "in light of", "with that said", "with this in mind",

  // Chatbot Phrases (weight 0.9 - HIGHEST!)
  'absolutely', 'great question', 'excellent question', "i'd be happy to",
  'happy to help', "i'm happy to help", 'let me help you', 'allow me to',
  "i'll walk you through", 'let me walk you through', 'let me explain',
  'let me break this down', "here's what you need to know", "here's the thing",
  'hope this helps', 'hope that helps', 'i hope this helps',
  'let me know if you', 'feel free to ask', 'feel free to',
  'if you have any questions', 'if you need anything else',
  'is there anything else', 'anything else i can help',
  "here's a breakdown", 'here are some', 'there are several',
  'first and foremost', 'last but not least',
  'in summary', 'to summarize', 'to recap', 'key takeaways',
  "you're absolutely right", "that's correct", 'exactly right', 'precisely',
  'spot on', 'excellent point', 'great point',

  // Structural (weight 0.6)
  'the following', 'as follows', 'listed below', 'outlined below',
  'firstly', 'secondly', 'thirdly', 'lastly', 'in conclusion', 'to conclude',
  'in closing', 'at the end of the day',

  // Punctuation (weight 0.7)
  '—',  // em-dash - NEVER use (known AI tell)
  '–'   // en-dash - NEVER use (known AI tell)
];

/**
 * Two-pass LLM configuration
 * Pass 1: Structure (sentence length variation, flow, paragraph breaks)
 * Pass 2: Style (word choice, tell-word elimination, natural voice)
 */
export const TWO_PASS_CONFIG = {
  structure: {
    temperature: 0.6,
    focus: 'sentence structure and flow'
  },
  style: {
    temperature: 0.7,
    focus: 'word choice and natural voice'
  }
};

/**
 * Simple tell-word replacements for post-processing
 */
export const TELL_WORD_REPLACEMENTS: Record<string, string> = {
  'furthermore': 'also',
  'moreover': 'also',
  'consequently': 'so',
  'additionally': 'also',
  'subsequently': 'then',
  'nevertheless': 'still',
  'nonetheless': 'still',
  'comprehensive': 'complete',
  'crucial': 'important',
  'vital': 'important',
  'pivotal': 'key',
  'intricate': 'complex',
  'nuanced': 'subtle',
  'multifaceted': 'complex',
  'holistic': 'complete',
  'paradigm': 'model',
  'robust': 'strong',
  'leverage': 'use',
  'leveraging': 'using',
  'navigate': 'handle',
  'navigating': 'handling',
  'realm': 'area',
  'landscape': 'field',
  'tapestry': 'mix',
  'delve': 'explore'
};
