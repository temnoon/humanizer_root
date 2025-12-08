// AI Tell-Word Dictionary
// Based on research: common words/phrases frequently used by AI models

export interface TellWordCategory {
  category: string;
  words: string[];
  weight: number; // Impact on AI probability score
}

/**
 * Curated list of AI "tell" words and phrases
 * Sources: Academic research (2025), community observations, GPT model patterns
 */
export const AI_TELL_WORDS: TellWordCategory[] = [
  {
    category: 'Overused Academic/Formal',
    weight: 0.8,
    words: [
      'delve',
      'delving',
      'tapestry',
      'landscape', // abstract usage: "the landscape of..."
      'robust',
      'leverage',
      'leveraging',
      'navigate',
      'navigating',
      'realm',
      'intricate',
      'intricacies',
      'comprehensive',
      'holistic',
      'paradigm',
      'multifaceted',
      'nuanced',
      'meticulously',
      'underscores',
      'underscore',
      'pivotal',
      'crucial',
      'vital',
      'quintessential',
      'culminate',
      'culminating',
      'embark',
      'embarking',
      'endeavor',
      'endeavors'
    ]
  },
  {
    category: 'Transitional Phrases',
    weight: 0.6,
    words: [
      'it\'s worth noting',
      'it is worth noting',
      'it\'s important to understand',
      'it is important to understand',
      'in today\'s landscape',
      'in the modern landscape',
      'in conclusion',
      'moreover',
      'furthermore',
      'notably',
      'in essence',
      'fundamentally',
      'it\'s crucial to',
      'it is crucial to',
      'one must consider',
      'when it comes to',
      'in the world of',
      'at the end of the day',
      'it goes without saying',
      'needless to say',
      'as we delve into',
      'as we navigate',
      'in light of',
      'with that said',
      'with this in mind'
    ]
  },
  {
    category: 'Hedging/Qualifiers',
    weight: 0.4,
    words: [
      'typically',
      'generally',
      'often',
      'usually',
      'frequently',
      'commonly',
      'in many cases',
      'to a certain extent',
      'to some degree',
      'arguably',
      'potentially',
      'conceivably',
      'ostensibly',
      'purportedly'
    ]
  },
  {
    category: 'Metadiscourse',
    weight: 0.5,
    words: [
      'as mentioned',
      'as noted',
      'as discussed',
      'as we\'ve seen',
      'as we have seen',
      'as outlined',
      'as illustrated',
      'as demonstrated',
      'it should be noted',
      'it must be emphasized',
      'it is evident that',
      'clearly',
      'obviously',
      'undoubtedly',
      'certainly',
      'indeed'
    ]
  },
  {
    category: 'Sentence Starters',
    weight: 0.7,
    words: [
      'in recent years',
      'in today\'s world',
      'in today\'s society',
      'in the digital age',
      'in an era where',
      'as technology advances',
      'as we move forward',
      'looking ahead',
      'moving forward',
      'going forward',
      'as such',
      'that being said',
      'having said that',
      'all things considered'
    ]
  },
  {
    category: 'Punctuation Patterns',
    weight: 0.7,
    words: [
      '—',  // em-dash (U+2014) - known AI tell
      '–'   // en-dash (U+2013) - known AI tell
    ]
  }
];

/**
 * Calculate tell-word frequency score for given text
 * Returns score 0-100 (higher = more AI-like)
 */
export function calculateTellWordScore(text: string): {
  score: number;
  detectedWords: Array<{ word: string; category: string; count: number }>;
  totalMatches: number;
} {
  const lowerText = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  if (wordCount === 0) {
    return { score: 0, detectedWords: [], totalMatches: 0 };
  }

  const detectedWords: Map<string, { word: string; category: string; count: number; weight: number }> = new Map();
  let weightedMatchCount = 0;

  // Scan for each tell-word category
  for (const category of AI_TELL_WORDS) {
    for (const word of category.words) {
      // Use word boundaries for whole-word matching
      const regex = new RegExp(`\\b${word.replace(/'/g, "\\'")}\\b`, 'gi');
      const matches = lowerText.match(regex);

      if (matches && matches.length > 0) {
        const existing = detectedWords.get(word);
        if (existing) {
          existing.count += matches.length;
        } else {
          detectedWords.set(word, {
            word,
            category: category.category,
            count: matches.length,
            weight: category.weight
          });
        }

        // Weight the match count by category importance
        weightedMatchCount += matches.length * category.weight;
      }
    }
  }

  // Calculate score: weighted matches per 100 words
  // Normalize to 0-100 scale (assume 5+ weighted matches per 100 words = 100% AI)
  const matchesPer100Words = (weightedMatchCount / wordCount) * 100;
  const score = Math.min(100, (matchesPer100Words / 5) * 100);

  const detectedArray = Array.from(detectedWords.values())
    .sort((a, b) => b.count - a.count); // Sort by frequency

  return {
    score,
    detectedWords: detectedArray,
    totalMatches: detectedArray.reduce((sum, w) => sum + w.count, 0)
  };
}

/**
 * Get specific tell-word by name (for highlighting)
 */
export function getAllTellWords(): string[] {
  return AI_TELL_WORDS.flatMap(category => category.words);
}
