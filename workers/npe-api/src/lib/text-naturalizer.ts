// Text Naturalizer - Core transformation functions for Computer Humanizer
// Reduces AI detection by improving burstiness, removing tell-words, and normalizing diversity

import { AI_TELL_WORDS, getAllTellWords } from '../services/ai-detection/tell-words';
import { calculateBurstiness, calculateLexicalDiversity } from '../services/ai-detection/utils';

/**
 * Tell-word replacement dictionary
 * Maps AI tell-words to more natural alternatives
 */
const TELL_WORD_REPLACEMENTS: Record<string, string[]> = {
  // Overused Academic/Formal
  'delve': ['examine', 'explore', 'look at', 'study', 'investigate'],
  'delving': ['examining', 'exploring', 'looking at', 'studying'],
  'tapestry': ['mix', 'combination', 'blend', 'variety', 'collection'],
  'landscape': ['field', 'area', 'domain', 'space', 'world'],
  'robust': ['strong', 'solid', 'effective', 'reliable', 'thorough'],
  'leverage': ['use', 'apply', 'utilize', 'employ', 'harness'],
  'leveraging': ['using', 'applying', 'utilizing', 'employing'],
  'navigate': ['handle', 'manage', 'deal with', 'work through', 'address'],
  'navigating': ['handling', 'managing', 'dealing with', 'working through'],
  'realm': ['field', 'area', 'domain', 'world', 'sphere'],
  'intricate': ['complex', 'detailed', 'complicated', 'involved'],
  'intricacies': ['details', 'complexities', 'nuances', 'subtleties'],
  'comprehensive': ['complete', 'thorough', 'detailed', 'full', 'extensive'],
  'holistic': ['complete', 'integrated', 'unified', 'whole', 'comprehensive'],
  'paradigm': ['model', 'framework', 'approach', 'system', 'pattern'],
  'multifaceted': ['complex', 'varied', 'diverse', 'many-sided'],
  'nuanced': ['subtle', 'complex', 'sophisticated', 'refined'],
  'meticulously': ['carefully', 'precisely', 'thoroughly', 'painstakingly'],
  'underscores': ['highlights', 'emphasizes', 'shows', 'demonstrates', 'illustrates'],
  'underscore': ['highlight', 'emphasize', 'show', 'demonstrate'],
  'pivotal': ['key', 'crucial', 'important', 'critical', 'essential'],
  'crucial': ['important', 'key', 'critical', 'essential', 'vital'],
  'vital': ['important', 'key', 'essential', 'critical', 'necessary'],
  'quintessential': ['typical', 'classic', 'definitive', 'perfect', 'ideal'],
  'culminate': ['end', 'finish', 'conclude', 'result', 'lead to'],
  'culminating': ['ending', 'finishing', 'concluding', 'resulting'],
  'embark': ['start', 'begin', 'undertake', 'launch', 'initiate'],
  'embarking': ['starting', 'beginning', 'undertaking', 'launching'],
  'endeavor': ['effort', 'attempt', 'project', 'undertaking', 'venture'],
  'endeavors': ['efforts', 'attempts', 'projects', 'undertakings'],

  // Transitional Phrases (often better to remove entirely)
  "it's worth noting": ['note that', 'notably', '', 'importantly'],
  "it is worth noting": ['note that', 'notably', '', 'importantly'],
  "it's important to understand": ['understand that', '', 'importantly'],
  "it is important to understand": ['understand that', '', 'importantly'],
  "in today's landscape": ['today', 'currently', 'now', ''],
  "in the modern landscape": ['today', 'currently', 'now', 'in modern times'],
  'in conclusion': ['finally', 'to sum up', 'ultimately', ''],
  'moreover': ['also', 'additionally', 'furthermore', 'plus'],
  'furthermore': ['also', 'additionally', 'moreover', 'plus'],
  'notably': ['especially', 'particularly', 'importantly', ''],
  'in essence': ['essentially', 'basically', 'fundamentally', ''],
  'fundamentally': ['basically', 'essentially', 'at its core', ''],
  "it's crucial to": ['you must', 'you should', 'it matters to', ''],
  "it is crucial to": ['you must', 'you should', 'it matters to', ''],
  'one must consider': ['consider', 'think about', 'remember', ''],
  'when it comes to': ['for', 'regarding', 'about', 'with'],
  'in the world of': ['in', 'for', 'regarding', ''],
  'at the end of the day': ['ultimately', 'finally', 'in the end', ''],
  'it goes without saying': ['obviously', 'clearly', '', ''],
  'needless to say': ['obviously', 'clearly', '', ''],
  'as we delve into': ['as we examine', 'looking at', 'examining', ''],
  'as we navigate': ['as we handle', 'working through', 'dealing with', ''],
  'in light of': ['given', 'considering', 'because of', ''],
  'with that said': ['however', 'but', 'still', ''],
  'with this in mind': ['so', 'therefore', 'thus', ''],

  // Hedging/Qualifiers (often can be removed)
  'typically': ['usually', 'often', 'generally', ''],
  'generally': ['usually', 'often', 'typically', ''],
  'often': ['frequently', 'commonly', 'usually', ''],
  'usually': ['often', 'typically', 'generally', ''],
  'frequently': ['often', 'commonly', 'regularly', ''],
  'commonly': ['often', 'usually', 'frequently', ''],
  'in many cases': ['often', 'sometimes', 'frequently', ''],
  'to a certain extent': ['somewhat', 'partly', 'to some degree', ''],
  'to some degree': ['somewhat', 'partly', 'to a certain extent', ''],
  'arguably': ['possibly', 'perhaps', 'maybe', ''],
  'potentially': ['possibly', 'perhaps', 'maybe', ''],
  'conceivably': ['possibly', 'perhaps', 'maybe', ''],
  'ostensibly': ['apparently', 'seemingly', 'supposedly', ''],
  'purportedly': ['supposedly', 'allegedly', 'reportedly', ''],

  // Metadiscourse (often better to remove)
  'as mentioned': ['', 'previously', 'earlier'],
  'as noted': ['', 'previously', 'earlier'],
  'as discussed': ['', 'previously', 'earlier'],
  "as we've seen": ['', 'previously', 'as shown'],
  "as we have seen": ['', 'previously', 'as shown'],
  'as outlined': ['', 'previously', 'as shown'],
  'as illustrated': ['', 'as shown', 'for example'],
  'as demonstrated': ['', 'as shown', 'for example'],
  'it should be noted': ['note that', '', 'importantly'],
  'it must be emphasized': ['importantly', 'crucially', ''],
  'it is evident that': ['clearly', 'obviously', ''],
  'clearly': ['', 'obviously', 'evidently'],
  'obviously': ['', 'clearly', 'evidently'],
  'undoubtedly': ['', 'certainly', 'definitely'],
  'certainly': ['', 'definitely', 'surely'],
  'indeed': ['', 'in fact', 'actually'],

  // Sentence Starters
  'in recent years': ['recently', 'lately', 'over time', ''],
  "in today's world": ['today', 'now', 'currently', ''],
  "in today's society": ['today', 'now', 'currently', ''],
  'in the digital age': ['today', 'now', 'in modern times', ''],
  'in an era where': ['when', 'as', 'while', ''],
  'as technology advances': ['as technology improves', 'with new technology', ''],
  'as we move forward': ['going forward', 'in the future', 'ahead', ''],
  'looking ahead': ['in the future', 'going forward', 'ahead', ''],
  'moving forward': ['going forward', 'in the future', 'ahead', ''],
  'going forward': ['moving forward', 'in the future', 'ahead', ''],
  'as such': ['therefore', 'so', 'thus', ''],
  'that being said': ['however', 'but', 'still', ''],
  'having said that': ['however', 'but', 'still', ''],
  'all things considered': ['overall', 'on balance', 'ultimately', '']
};

/**
 * Enhance burstiness by varying sentence lengths
 * Target: 50-70/100 (human-like variation)
 * Strategy: Mix short (8-12 word) and long (20-30 word) sentences
 * PRESERVES: Paragraph breaks, markdown formatting
 * NOTE: This is a PLACEHOLDER - should be replaced with LLM-based approach for production
 */
export function enhanceBurstiness(text: string, targetScore: number = 60): string {
  const currentScore = calculateBurstiness(text);

  // If already good, return as-is
  if (currentScore >= targetScore - 5) {
    return text;
  }

  // SIMPLIFIED: Just vary sentence lengths using rule-based splitting
  // For production, this should use LLM to rewrite with varied sentence lengths
  // (local working version uses Ollama with prompt to mix short and long sentences)

  // Split into paragraphs first (preserve paragraph breaks)
  const paragraphs = text.split(/\n\n+/);
  const transformedParagraphs: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;

    // Split paragraph into sentences
    const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
    const transformed: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const words = sentence.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;

      // Split very long sentences (>30 words)
      if (wordCount > 30) {
        const splitResult = splitLongSentence(sentence);
        transformed.push(...splitResult);
      }
      // Split moderately long sentences (>25 words) occasionally
      else if (wordCount > 25 && Math.random() > 0.6) {
        const splitResult = splitLongSentence(sentence);
        transformed.push(...splitResult);
      }
      // Add short emphatic sentence after some sentences (5% probability)
      else if (wordCount > 15 && Math.random() > 0.95) {
        transformed.push(sentence);
        const emphatic = createEmphaticSentence(sentence);
        if (emphatic) {
          transformed.push(emphatic);
        }
      }
      // Keep as-is
      else {
        transformed.push(sentence);
      }
    }

    transformedParagraphs.push(transformed.join(' '));
  }

  // Rejoin paragraphs with double newlines
  return transformedParagraphs.join('\n\n');
}

/**
 * Split a long sentence into 2-3 shorter sentences
 */
function splitLongSentence(sentence: string): string[] {
  const words = sentence.split(/\s+/);

  // Find natural split points (conjunctions, semicolons, commas after clauses)
  const splitWords = ['and', 'but', 'or', 'yet', 'so', 'because', 'while', 'although', 'though', 'whereas'];

  // Try to split at conjunction
  for (let i = Math.floor(words.length * 0.4); i < Math.floor(words.length * 0.7); i++) {
    const word = words[i].toLowerCase().replace(/[^a-z]/g, '');
    if (splitWords.includes(word)) {
      const part1 = words.slice(0, i).join(' ').trim();
      const part2 = words.slice(i).join(' ').trim();

      // Ensure part2 starts with capital letter
      const part2Capitalized = part2.charAt(0).toUpperCase() + part2.slice(1);

      return [
        part1 + (part1.match(/[.!?]$/) ? '' : '.'),
        part2Capitalized
      ];
    }
  }

  // If no conjunction, split at midpoint after comma
  const midpoint = Math.floor(words.length / 2);
  for (let i = midpoint - 3; i <= midpoint + 3; i++) {
    if (i > 0 && i < words.length && words[i].includes(',')) {
      const part1 = words.slice(0, i + 1).join(' ').replace(/,$/, '.').trim();
      const part2 = words.slice(i + 1).join(' ').trim();
      const part2Capitalized = part2.charAt(0).toUpperCase() + part2.slice(1);

      return [part1, part2Capitalized];
    }
  }

  // Last resort: split at midpoint
  const part1 = words.slice(0, midpoint).join(' ').trim() + '.';
  const part2 = words.slice(midpoint).join(' ').trim();
  const part2Capitalized = part2.charAt(0).toUpperCase() + part2.slice(1);

  return [part1, part2Capitalized];
}

/**
 * Create a short emphatic sentence related to the previous sentence
 */
function createEmphaticSentence(sentence: string): string | null {
  const emphaticTemplates = [
    'This matters.',
    'Consider that.',
    'Think about it.',
    'Worth noting.',
    'Important point.',
    'Key insight.',
    'Simple as that.',
    'No doubt.',
    'That\'s the reality.',
    'Fair enough.'
  ];

  // 50% chance to add emphatic sentence
  if (Math.random() > 0.5) {
    return emphaticTemplates[Math.floor(Math.random() * emphaticTemplates.length)];
  }

  return null;
}

/**
 * Remove tell-words from text (SIMPLIFIED - matches local working version)
 * Intensity: 'light' (30% removal), 'moderate' (60% removal), 'aggressive' (90% removal)
 */
export function replaceTellWords(text: string, intensity: 'light' | 'moderate' | 'aggressive' = 'moderate'): string {
  let result = text;
  const intensityMap = { light: 0.3, moderate: 0.6, aggressive: 0.9 };
  const removalRate = intensityMap[intensity];

  // Get all tell-words
  const allTellWords = getAllTellWords();

  // Sort by length (longest first) to handle phrases before individual words
  const sortedTellWords = allTellWords.sort((a, b) => b.length - a.length);

  // Detect which tell-words are present
  const found: string[] = [];
  for (const tellWord of sortedTellWords) {
    const regex = new RegExp(`\\b${escapeRegex(tellWord)}\\b`, 'gi');
    if (regex.test(result)) {
      found.push(tellWord);
    }
  }

  // Remove tell-words based on intensity
  const toRemove = found.slice(0, Math.ceil(found.length * removalRate));

  toRemove.forEach(phrase => {
    // Remove the phrase and clean up extra spaces/punctuation
    const regex = new RegExp(`\\b${escapeRegex(phrase)}[,.]?\\s*`, 'gi');
    result = result.replace(regex, ' ');
  });

  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, ' ').trim();

  // Clean up awkward punctuation
  result = result.replace(/\s+([.,;:!?])/g, '$1');
  result = result.replace(/([.!?])\s*([.!?])/g, '$1');

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize lexical diversity to human range (55-65%)
 * Modern AI has TOO MUCH diversity (70%+), need to reduce it
 */
export function normalizeLexicalDiversity(text: string, targetTTR: number = 60): string {
  const currentTTR = calculateLexicalDiversity(text);

  // If already in target range, return as-is
  if (currentTTR >= targetTTR - 5 && currentTTR <= targetTTR + 5) {
    return text;
  }

  // If too high (AI-like over-diversity), reduce it
  if (currentTTR > targetTTR + 5) {
    return reduceVocabularyDiversity(text);
  }

  // If too low (repetitive), increase it (though this is rare for AI text)
  return text; // Don't increase - this is rare for modern AI
}

/**
 * Reduce vocabulary diversity by replacing rare words with common synonyms
 */
function reduceVocabularyDiversity(text: string): string {
  // Common word substitutions (rare → common)
  const simplifications: Record<string, string> = {
    'utilize': 'use',
    'commence': 'start',
    'terminate': 'end',
    'facilitate': 'help',
    'implement': 'do',
    'acquire': 'get',
    'demonstrate': 'show',
    'construct': 'build',
    'indicate': 'show',
    'establish': 'set up',
    'maintain': 'keep',
    'subsequent': 'next',
    'prior': 'before',
    'currently': 'now',
    'approximately': 'about',
    'sufficient': 'enough',
    'numerous': 'many',
    'substantial': 'large',
    'similar': 'like',
    'different': 'other',
    'various': 'different',
    'particular': 'specific',
    'individual': 'single',
    'additional': 'more',
    'provide': 'give',
    'require': 'need',
    'obtain': 'get',
    'produce': 'make',
    'receive': 'get',
    'generate': 'create',
    'perform': 'do',
    'conduct': 'do',
    'achieve': 'reach',
    'attain': 'reach'
  };

  let result = text;

  for (const [rare, common] of Object.entries(simplifications)) {
    const regex = new RegExp(`\\b${rare}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // 40% replacement rate to avoid over-simplification
      if (Math.random() > 0.4) {
        return match;
      }

      // Preserve case
      if (match.charAt(0) === match.charAt(0).toUpperCase()) {
        return common.charAt(0).toUpperCase() + common.slice(1);
      }
      return common;
    });
  }

  return result;
}

/**
 * Add conversational elements to make text more human-like
 * - Contractions (can't, won't, it's)
 * - Occasional questions
 * - Informal transitions
 */
export function addConversationalElements(text: string): string {
  let result = text;

  // Add contractions (30% conversion rate)
  const contractions: Record<string, string> = {
    'cannot': "can't",
    'will not': "won't",
    'do not': "don't",
    'does not': "doesn't",
    'did not': "didn't",
    'is not': "isn't",
    'are not': "aren't",
    'was not': "wasn't",
    'were not': "weren't",
    'have not': "haven't",
    'has not': "hasn't",
    'had not': "hadn't",
    'would not': "wouldn't",
    'could not': "couldn't",
    'should not': "shouldn't",
    'it is': "it's",
    'that is': "that's",
    'what is': "what's",
    'there is': "there's",
    'here is': "here's",
    'who is': "who's",
    'where is': "where's",
    'they are': "they're",
    'we are': "we're",
    'you are': "you're"
  };

  for (const [formal, informal] of Object.entries(contractions)) {
    const regex = new RegExp(`\\b${escapeRegex(formal)}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // 30% conversion rate
      if (Math.random() > 0.3) {
        return match;
      }

      // Preserve case for first word
      if (match.charAt(0) === match.charAt(0).toUpperCase()) {
        return informal.charAt(0).toUpperCase() + informal.slice(1);
      }
      return informal;
    });
  }

  // Occasionally add rhetorical questions (5% of sentences)
  const sentences = result.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length > 3) {
    const numQuestions = Math.min(2, Math.floor(sentences.length * 0.05));

    for (let i = 0; i < numQuestions; i++) {
      const idx = Math.floor(Math.random() * sentences.length);
      const sentence = sentences[idx].trim();

      // Only convert declarative sentences, not already questions
      if (!sentence.includes('?')) {
        const question = convertToQuestion(sentence);
        if (question) {
          sentences[idx] = question;
        }
      }
    }

    result = sentences.join(' ');
  }

  return result;
}

/**
 * Convert a declarative sentence to a rhetorical question
 */
function convertToQuestion(sentence: string): string | null {
  const lowerSentence = sentence.toLowerCase();

  // Pattern: "This is X" → "But is this really X?"
  if (lowerSentence.includes(' is ') || lowerSentence.includes(' are ')) {
    return 'But ' + sentence.replace(/[.!]$/, '?');
  }

  // Pattern: "X shows Y" → "Does X really show Y?"
  if (lowerSentence.includes(' shows ') || lowerSentence.includes(' demonstrates ')) {
    return sentence
      .replace(/^(\w+) shows/, 'Does $1 really show')
      .replace(/^(\w+) demonstrates/, 'Does $1 really demonstrate')
      .replace(/[.!]$/, '?');
  }

  return null;
}
