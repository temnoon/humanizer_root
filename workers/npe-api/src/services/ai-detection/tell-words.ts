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
  },
  {
    category: 'Chatbot Phrases',
    weight: 0.9, // High weight - these are strong AI tells in chat context
    words: [
      // Direct acknowledgment patterns
      'absolutely',
      'great question',
      'that\'s a great question',
      'excellent question',
      'i\'d be happy to',
      'i would be happy to',
      'happy to help',
      'i\'m happy to help',
      'glad you asked',
      'thanks for asking',
      'thank you for asking',
      'i appreciate your question',
      // Capability statements
      'i can help you with',
      'i can assist you',
      'let me help you',
      'allow me to',
      'i\'ll walk you through',
      'let me walk you through',
      'let me explain',
      'let me break this down',
      'here\'s what you need to know',
      'here\'s the thing',
      // Hedging/safety patterns
      'i\'m not able to',
      'i cannot',
      'i\'m unable to',
      'as an ai',
      'as a language model',
      'i don\'t have access to',
      'i don\'t have the ability',
      'i\'m designed to',
      'my training',
      'my knowledge cutoff',
      // Closing patterns
      'hope this helps',
      'hope that helps',
      'i hope this helps',
      'let me know if you',
      'let me know if you have',
      'feel free to ask',
      'feel free to',
      'if you have any questions',
      'if you need anything else',
      'is there anything else',
      'anything else i can help',
      // Structure patterns
      'here\'s a breakdown',
      'here are some',
      'here are a few',
      'there are several',
      'there are a few',
      'first and foremost',
      'last but not least',
      'in summary',
      'to summarize',
      'to recap',
      'key takeaways',
      'the key is',
      'the main thing',
      'the bottom line',
      // Emphatic agreement
      'you\'re absolutely right',
      'that\'s correct',
      'exactly right',
      'precisely',
      'spot on',
      'you make a great point',
      'excellent point',
      'great point',
      // Transition markers
      'with that being said',
      'that said',
      'on that note',
      'speaking of which',
      'along those lines',
      'in that regard',
      'on a related note'
    ]
  },
  {
    category: 'Structural Patterns',
    weight: 0.6,
    words: [
      // List introductions
      'the following',
      'as follows',
      'listed below',
      'outlined below',
      'described below',
      // Enumeration
      'firstly',
      'secondly',
      'thirdly',
      'lastly',
      'finally',
      'additionally',
      'in addition',
      // Conclusion markers
      'in conclusion',
      'to conclude',
      'in closing',
      'overall',
      'ultimately',
      'at the end of the day'
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

/**
 * Sentence-level AI analysis
 * Analyzes each sentence for AI patterns and returns suspect sentences
 */
export interface SentenceAnalysis {
  sentence: string;
  index: number;
  aiScore: number; // 0-100
  tellPhrases: Array<{ phrase: string; category: string; weight: number }>;
  patterns: string[]; // detected patterns like 'list_intro', 'chatbot_closer'
}

export function analyzeSentences(text: string): SentenceAnalysis[] {
  // Split into sentences (handling abbreviations, etc.)
  const sentenceRegex = /[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [];

  const results: SentenceAnalysis[] = [];

  sentences.forEach((sentence, index) => {
    const trimmed = sentence.trim();
    if (trimmed.length < 10) return; // Skip very short fragments

    const lowerSentence = trimmed.toLowerCase();
    const tellPhrases: Array<{ phrase: string; category: string; weight: number }> = [];
    const patterns: string[] = [];
    let totalWeight = 0;

    // Check for tell-words/phrases
    for (const category of AI_TELL_WORDS) {
      for (const word of category.words) {
        const regex = new RegExp(`\\b${word.replace(/'/g, "\\'")}\\b`, 'gi');
        if (regex.test(lowerSentence)) {
          tellPhrases.push({
            phrase: word,
            category: category.category,
            weight: category.weight
          });
          totalWeight += category.weight;
        }
      }
    }

    // Check for structural patterns
    if (/^(first|second|third|1\.|2\.|3\.|•|-)\s/i.test(trimmed)) {
      patterns.push('list_item');
      totalWeight += 0.3;
    }

    if (/^(here'?s?|let me|allow me|i'?ll|i will|i can)\s/i.test(trimmed)) {
      patterns.push('chatbot_opener');
      totalWeight += 0.5;
    }

    if (/(hope this helps|let me know|feel free|if you have any questions|anything else)/i.test(trimmed)) {
      patterns.push('chatbot_closer');
      totalWeight += 0.6;
    }

    if (/^(in conclusion|to summarize|overall|ultimately|in summary)/i.test(trimmed)) {
      patterns.push('conclusion_marker');
      totalWeight += 0.4;
    }

    // Check for overly uniform sentence length (AI tends to write similar-length sentences)
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount >= 15 && wordCount <= 25) {
      patterns.push('uniform_length');
      totalWeight += 0.2;
    }

    // Check for exclamation overuse in chatbot-style
    if (trimmed.endsWith('!') && /(great|excellent|perfect|wonderful|amazing)/i.test(trimmed)) {
      patterns.push('enthusiastic_affirmation');
      totalWeight += 0.4;
    }

    // Calculate AI score (0-100)
    // More tell-phrases and patterns = higher score
    const aiScore = Math.min(100, Math.round(totalWeight * 25));

    results.push({
      sentence: trimmed,
      index,
      aiScore,
      tellPhrases,
      patterns
    });
  });

  return results;
}

/**
 * Get suspect sentences (AI score above threshold)
 */
export function getSuspectSentences(text: string, threshold: number = 30): SentenceAnalysis[] {
  return analyzeSentences(text).filter(s => s.aiScore >= threshold);
}
