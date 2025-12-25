/**
 * Craft Metrics
 *
 * Measures how well the writing does what it does:
 * - Compression: economy of expression
 * - Surprise: statistical unexpectedness
 * - Specificity: concreteness and grounding
 * - Tension: unresolved narrative energy
 * - Velocity: semantic distance covered
 */

import type { CraftMetrics, SentenceVector, SemanticPosition } from '../types/vector.js';
import { positionDistance } from './position.js';

/**
 * Compute all craft metrics for a passage
 */
export function computeCraftMetrics(
  text: string,
  sentences: string[],
  vectors: SentenceVector[]
): CraftMetrics {
  return {
    compression: computeCompression(text, sentences),
    surprise: computeSurprise(text, sentences),
    specificity: computeSpecificity(text, sentences),
    tension: computeTension(text, sentences),
    velocity: computeVelocity(vectors),
  };
}

/**
 * Compression: Words per idea, absence of filler
 */
function computeCompression(text: string, sentences: string[]): CraftMetrics['compression'] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const wordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Filler phrases that add no meaning
  const fillerPatterns = [
    /\bit is (important|worth|essential) to (note|mention|remember) that\b/gi,
    /\b(basically|essentially|actually|literally|honestly|frankly)\b/gi,
    /\b(in order to|due to the fact that|for the purpose of)\b/gi,
    /\b(it goes without saying|needless to say|as you know)\b/gi,
    /\b(at the end of the day|when all is said and done)\b/gi,
    /\b(first and foremost|last but not least)\b/gi,
    /\b(I would like to|let me just|I just want to)\b/gi,
    /\b(kind of|sort of|type of|more or less)\b/gi,
    /\b(very|really|quite|rather|extremely|incredibly)\b/gi,
    /\b(in terms of|with respect to|with regard to)\b/gi,
  ];

  let fillerCount = 0;
  for (const pattern of fillerPatterns) {
    const matches = text.match(pattern);
    if (matches) fillerCount += matches.length;
  }

  const fillerRatio = fillerCount / Math.max(sentenceCount, 1);

  // Content words vs function words
  const functionWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'he', 'she', 'him', 'her', 'his', 'we', 'us', 'our', 'you', 'your',
    'i', 'me', 'my', 'which', 'who', 'whom', 'whose', 'what', 'where',
    'when', 'why', 'how', 'if', 'then', 'than', 'so', 'such', 'only',
    'also', 'just', 'even', 'still', 'yet', 'too', 'very', 'more', 'most',
    'some', 'any', 'no', 'not', 'all', 'each', 'every', 'both', 'few',
    'many', 'much', 'other', 'another', 'same', 'different',
  ]);

  const contentWords = words.filter(w =>
    !functionWords.has(w.toLowerCase().replace(/[^a-z]/g, ''))
  );
  const contentWordRatio = contentWords.length / Math.max(wordCount, 1);

  // Score: high content ratio, low filler, reasonable sentence length
  // Optimal sentence length ~12-18 words
  const lengthPenalty = Math.abs(wordsPerSentence - 15) / 30;
  const score = Math.max(0, Math.min(1,
    contentWordRatio * 0.4 +
    (1 - fillerRatio) * 0.4 +
    (1 - lengthPenalty) * 0.2
  ));

  return {
    score,
    wordsPerSentence,
    fillerRatio,
    contentWordRatio,
  };
}

/**
 * Surprise: Pattern-breaking, unexpected transitions
 */
function computeSurprise(text: string, sentences: string[]): CraftMetrics['surprise'] {
  // Unexpected transition markers
  const surpriseTransitions = [
    /\bbut then\b/gi,
    /\bexcept\b/gi,
    /\bunless\b/gi,
    /\buntil (suddenly|I realized)\b/gi,
    /\band yet\b/gi,
    /\bstill,?\s*(I|we|it|he|she|they)\b/gi,
    /\b(instead|rather),?\s/gi,
  ];

  // Pattern-breaking punctuation
  const patternBreaks = [
    /—/g,  // Em-dash interruption
    /\.\.\./g,  // Ellipsis
    /\?\s+[A-Z]/g,  // Question followed by assertion
    /!\s+[a-z]/g,  // Exclamation into lowercase continuation
  ];

  // Unusual collocations (words that rarely appear together)
  // This is heuristic without access to co-occurrence statistics
  const unusualPatterns = [
    /\b(spreadsheet|algorithm|database)\s+\w*\s*(wept|laughed|dreamed|ached)\b/gi,
    /\b(silence|darkness|void)\s+\w*\s*(calculated|computed|optimized)\b/gi,
    /\b(tenderness|grief|joy)\s+\w*\s*(architecture|infrastructure|protocol)\b/gi,
    /\babstract\s+\w*\s*(flesh|blood|bone|skin)\b/gi,
  ];

  let unusualTransitions = 0;
  let patternBreakCount = 0;
  let unexpectedCollocations = 0;

  for (const p of surpriseTransitions) {
    const matches = text.match(p);
    if (matches) unusualTransitions += matches.length;
  }

  for (const p of patternBreaks) {
    const matches = text.match(p);
    if (matches) patternBreakCount += matches.length;
  }

  for (const p of unusualPatterns) {
    const matches = text.match(p);
    if (matches) unexpectedCollocations += matches.length;
  }

  // Sentence-initial word variety (not starting with "The", "It", "This" repeatedly)
  const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase() || '');
  const uniqueStarters = new Set(starters).size;
  const starterVariety = uniqueStarters / Math.max(starters.length, 1);

  const score = Math.min(1,
    (unusualTransitions / Math.max(sentences.length, 1)) * 0.3 +
    (patternBreakCount / Math.max(sentences.length, 1)) * 0.2 +
    unexpectedCollocations * 0.3 +
    starterVariety * 0.2
  );

  return {
    score,
    unusualTransitions,
    patternBreaks: patternBreakCount,
    unexpectedCollocations,
  };
}

/**
 * Specificity: Concreteness, named things, sensory grounding
 */
function computeSpecificity(text: string, sentences: string[]): CraftMetrics['specificity'] {
  // Named entities (capitalized words not at sentence start)
  const namedEntityPattern = /(?<![.!?]\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;
  const namedMatches = text.match(namedEntityPattern) || [];
  const namedEntities = namedMatches.length;

  // Concrete nouns (things you can touch, see, hear)
  const concretePatterns = [
    /\b(table|chair|door|window|wall|floor|ceiling|roof|car|phone|book|cup|glass|plate|knife|fork|key|bag|box|bottle)\b/gi,
    /\b(hand|face|eye|mouth|arm|leg|foot|head|finger|hair|skin)\b/gi,
    /\b(tree|flower|grass|rock|river|mountain|ocean|sky|sun|moon|star|rain|snow|wind)\b/gi,
    /\b(dog|cat|bird|fish|horse|mouse|cow|pig|sheep|chicken)\b/gi,
    /\b(house|room|kitchen|bedroom|bathroom|office|street|road|building|bridge)\b/gi,
  ];

  let concreteNouns = 0;
  for (const p of concretePatterns) {
    const matches = text.match(p);
    if (matches) concreteNouns += matches.length;
  }

  // Numerical precision (specific numbers, dates, times)
  const numericalPatterns = [
    /\b\d{1,2}:\d{2}\s*(am|pm|AM|PM)?\b/g,  // Times
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/gi,
    /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,  // Dates
    /\$\d+(\.\d{2})?\b/g,  // Money
    /\b\d+\s*(percent|%|dollars|miles|feet|inches|pounds|kilograms|meters|hours|minutes|seconds|years|months|weeks|days)\b/gi,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(times|people|things|days|hours)\b/gi,
  ];

  let numericalPrecision = 0;
  for (const p of numericalPatterns) {
    const matches = text.match(p);
    if (matches) numericalPrecision += matches.length;
  }

  // Sensory details
  const sensoryPatterns = [
    /\b(red|blue|green|yellow|orange|purple|black|white|gray|brown|pink)\b/gi,
    /\b(loud|quiet|silent|noisy|soft|harsh|shrill|muffled)\b/gi,
    /\b(sweet|sour|bitter|salty|spicy|bland|savory|rotten)\b/gi,
    /\b(rough|smooth|soft|hard|wet|dry|cold|hot|warm|cool|sticky|slippery)\b/gi,
    /\b(bright|dark|dim|glowing|shimmering|sparkling|dull|vivid|faded)\b/gi,
  ];

  let sensoryDetails = 0;
  for (const p of sensoryPatterns) {
    const matches = text.match(p);
    if (matches) sensoryDetails += matches.length;
  }

  const wordCount = text.split(/\s+/).length;
  const density = (namedEntities + concreteNouns + numericalPrecision + sensoryDetails) / Math.max(wordCount / 20, 1);

  const score = Math.min(1, density * 0.15);

  return {
    score,
    namedEntities,
    concreteNouns,
    numericalPrecision,
    sensoryDetails,
  };
}

/**
 * Tension: Unresolved narrative energy
 */
function computeTension(text: string, sentences: string[]): CraftMetrics['tension'] {
  // Open questions (questions without clear answers in surrounding text)
  const questionSentences = sentences.filter(s => s.trim().endsWith('?'));
  const openQuestions = questionSentences.length;

  // Unresolved contrasts ("but" without "however, it worked out")
  const contrastPatterns = [
    /\bbut\b/gi,
    /\bhowever\b/gi,
    /\balthough\b/gi,
    /\bdespite\b/gi,
    /\byet\b/gi,
    /\bstill\b/gi,
  ];

  let contrasts = 0;
  for (const p of contrastPatterns) {
    const matches = text.match(p);
    if (matches) contrasts += matches.length;
  }

  // Resolution phrases (these reduce tension)
  const resolutionPatterns = [
    /\b(worked out|turned out (fine|okay|well))\b/gi,
    /\bin the end\b/gi,
    /\b(finally|ultimately|eventually).{0,30}(resolved|fixed|solved|understood)\b/gi,
    /\bproblem solved\b/gi,
    /\beverything (is|was) (fine|okay|alright)\b/gi,
  ];

  let resolutions = 0;
  for (const p of resolutionPatterns) {
    const matches = text.match(p);
    if (matches) resolutions += matches.length;
  }

  const unresolvedContrasts = Math.max(0, contrasts - resolutions);

  // Anticipation markers (promise of what's to come)
  const anticipationPatterns = [
    /\bwhat (happens|happened) next\b/gi,
    /\blittle did (I|we|they) know\b/gi,
    /\bif only\b/gi,
    /\b(soon|later|eventually|one day)\b/gi,
    /\b(waiting|hoping|dreading|expecting)\s+(for|to)\b/gi,
    /\.\.\.\s*$/gm,  // Trailing ellipsis
  ];

  let anticipationMarkers = 0;
  for (const p of anticipationPatterns) {
    const matches = text.match(p);
    if (matches) anticipationMarkers += matches.length;
  }

  const sentenceCount = sentences.length;
  const tensionDensity = (openQuestions + unresolvedContrasts + anticipationMarkers) / Math.max(sentenceCount, 1);

  const score = Math.min(1, tensionDensity * 0.5);

  return {
    score,
    openQuestions,
    unresolvedContrasts,
    anticipationMarkers,
  };
}

/**
 * Velocity: Semantic distance traveled through the passage
 */
function computeVelocity(vectors: SentenceVector[]): CraftMetrics['velocity'] {
  if (vectors.length < 2) {
    return {
      score: 0,
      averageDistance: 0,
      totalDistance: 0,
      stationaryRatio: 1,
    };
  }

  let totalDistance = 0;
  let stationaryCount = 0;
  const movementThreshold = 0.3;

  for (let i = 1; i < vectors.length; i++) {
    const dist = positionDistance(vectors[i - 1].position, vectors[i].position);
    totalDistance += dist;
    if (dist < movementThreshold) {
      stationaryCount++;
    }
  }

  const transitions = vectors.length - 1;
  const averageDistance = totalDistance / transitions;
  const stationaryRatio = stationaryCount / transitions;

  // Max possible distance in 5D space from -1 to +1 is sqrt(5 * 4) ≈ 4.47
  const normalizedAverage = averageDistance / 4.47;

  const score = Math.min(1,
    normalizedAverage * 0.5 +
    (1 - stationaryRatio) * 0.5
  );

  return {
    score,
    averageDistance,
    totalDistance,
    stationaryRatio,
  };
}
