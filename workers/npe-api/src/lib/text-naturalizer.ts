// Text Naturalizer - Core transformation functions for Computer Humanizer
// Reduces AI detection by improving burstiness, removing tell-words, and normalizing diversity

import { AI_TELL_WORDS, getAllTellWords } from '../services/ai-detection/tell-words';
import { calculateBurstiness, calculateLexicalDiversity } from '../services/ai-detection/utils';

/**
 * Replace em-dashes and en-dashes with more natural alternatives
 * Em-dashes are a known AI tell - humans typically use commas,
 * parentheses, or separate sentences
 */
export function replaceEmDashes(text: string): string {
  let result = text;

  // Pattern 1: Em-dash between words with spaces: usually can be comma
  // "word — word" → "word, word"
  result = result.replace(/\s—\s/g, ', ');
  result = result.replace(/\s–\s/g, ', ');

  // Pattern 2: Em-dash without spaces (tight): convert to spaced hyphen or comma
  // "word—word" → "word - word"
  result = result.replace(/(\w)—(\w)/g, '$1 - $2');
  result = result.replace(/(\w)–(\w)/g, '$1 - $2');

  // Pattern 3: Em-dash at sentence boundaries: convert to period
  // "...word—And" → "...word. And"
  result = result.replace(/—([A-Z])/g, '. $1');
  result = result.replace(/–([A-Z])/g, '. $1');

  // Pattern 4: Em-dash at end of clause before lowercase: use comma
  // "...word—and" → "...word, and"
  result = result.replace(/—([a-z])/g, ', $1');
  result = result.replace(/–([a-z])/g, ', $1');

  // Clean up any double spaces
  result = result.replace(/\s{2,}/g, ' ');

  // Clean up double punctuation
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/\.\s*,/g, '.');
  result = result.replace(/,\s*\./g, '.');

  return result;
}

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
 *
 * NOTE: This function previously attempted rule-based sentence splitting, which created
 * awkward breaks and unnatural text. Burstiness is now handled by the LLM polish pass
 * with intensity-aware prompts that specifically request varied sentence lengths.
 *
 * This function is kept for API compatibility but now acts as a pass-through.
 * The LLM prompt in computer-humanizer.ts handles sentence variation much better.
 */
export function enhanceBurstiness(text: string, _targetScore: number = 60): string {
  // Burstiness enhancement is now delegated to the LLM polish pass
  // The intensity-aware prompts in computer-humanizer.ts specifically request:
  // - "Mix short punchy sentences with longer ones" (moderate)
  // - "Use short sentences. Then longer ones. Mix it up." (aggressive)
  //
  // This produces much more natural results than rule-based splitting.
  return text;
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
 * Replace tell-words with natural alternatives
 * Intensity: 'light' (30% replacement), 'moderate' (60% replacement), 'aggressive' (90% replacement)
 *
 * IMPORTANT: This function REPLACES tell-words with natural alternatives from TELL_WORD_REPLACEMENTS.
 * It does NOT just remove them, which would create awkward gaps in the text.
 */
export function replaceTellWords(text: string, intensity: 'light' | 'moderate' | 'aggressive' = 'moderate'): string {
  let result = text;
  // Boosted rates for better tell-word elimination (Dec 2025)
  // Previous: { light: 0.3, moderate: 0.6, aggressive: 0.9 }
  const intensityMap = { light: 0.5, moderate: 0.7, aggressive: 0.95 };
  const replacementRate = intensityMap[intensity];

  // Get all tell-words from the replacement dictionary (these have natural alternatives)
  const tellWordsWithReplacements = Object.keys(TELL_WORD_REPLACEMENTS);

  // Sort by length (longest first) to handle phrases before individual words
  // e.g., "it's worth noting" before "worth"
  const sortedTellWords = tellWordsWithReplacements.sort((a, b) => b.length - a.length);

  // Track which tell-words are found and need replacement
  const found: Array<{ phrase: string; index: number }> = [];

  for (const tellWord of sortedTellWords) {
    const regex = new RegExp(`\\b${escapeRegex(tellWord)}\\b`, 'gi');
    let match;
    while ((match = regex.exec(result)) !== null) {
      found.push({ phrase: tellWord, index: match.index });
    }
  }

  // Sort by position (reverse order so we can replace from end to start without affecting indices)
  found.sort((a, b) => b.index - a.index);

  // Determine how many to replace based on intensity
  const numToReplace = Math.ceil(found.length * replacementRate);
  const toReplace = found.slice(0, numToReplace);

  // Replace each tell-word with a natural alternative
  for (const { phrase } of toReplace) {
    const replacements = TELL_WORD_REPLACEMENTS[phrase.toLowerCase()];

    if (replacements && replacements.length > 0) {
      // Filter out empty strings unless that's all we have (intentional removal)
      const validReplacements = replacements.filter(r => r.length > 0);

      if (validReplacements.length > 0) {
        // Pick a random non-empty replacement
        const replacement = validReplacements[Math.floor(Math.random() * validReplacements.length)];

        // Replace with case preservation
        const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i');
        result = result.replace(regex, (match) => {
          // Preserve capitalization
          if (match.charAt(0) === match.charAt(0).toUpperCase()) {
            return replacement.charAt(0).toUpperCase() + replacement.slice(1);
          }
          return replacement;
        });
      } else {
        // All replacements are empty strings - this means intentional removal
        // (e.g., filler phrases like "it goes without saying")
        // Remove carefully, handling surrounding punctuation
        const regex = new RegExp(`\\b${escapeRegex(phrase)}[,]?\\s*`, 'gi');
        result = result.replace(regex, (match, offset) => {
          // If at start of sentence, just remove
          if (offset === 0 || result[offset - 1] === '.' || result[offset - 1] === '\n') {
            return '';
          }
          // Otherwise leave a space
          return ' ';
        });
      }
    }
  }

  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, ' ').trim();

  // Clean up awkward punctuation (but be careful not to break things)
  result = result.replace(/\s+([.,;:!?])/g, '$1');
  result = result.replace(/([.!?])\s*([.!?])/g, '$1');

  // Fix sentences that now start with lowercase (from removal at sentence start)
  result = result.replace(/([.!?]\s+)([a-z])/g, (_, punct, letter) => punct + letter.toUpperCase());

  // Fix start of text if it's now lowercase
  result = result.charAt(0).toUpperCase() + result.slice(1);

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
