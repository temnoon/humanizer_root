/**
 * Gutenberg Parser Service
 *
 * Parses Project Gutenberg texts to extract interesting passages
 * for seeding Node narratives.
 *
 * Features:
 * - Fetch books from Gutenberg's plain text archive
 * - Extract coherent passages (paragraphs, chapters)
 * - Score passages for "interestingness" (density of ideas)
 * - Format for narrative publication
 */

// ===== Types =====

export interface GutenbergAuthor {
  name: string;
  birth_year?: number;
  death_year?: number;
}

export interface GutenbergBook {
  id: number;
  title: string;
  authors: GutenbergAuthor[];
  languages: string[];
  subjects: string[];
  bookshelves: string[];
  download_count: number;
  formats: Record<string, string>;
}

export interface GutenbergResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutenbergBook[];
}

export interface GutenbergCategory {
  id: string;
  name: string;
  icon: string;
  topic?: string;
  bookshelf?: string;
  children?: GutenbergCategory[];
}

// Simple book format for curated lists
export interface SimpleBook {
  id: number;
  title: string;
  author: string;
  language?: string;
  subjects?: string[];
  downloadUrl?: string;
}

export interface ExtractedPassage {
  id: string;
  bookId: number;
  bookTitle: string;
  author: string;
  title: string; // Generated title for the passage
  content: string;
  wordCount: number;
  location: {
    chapter?: string;
    section?: string;
    startLine: number;
    endLine: number;
  };
  themes: string[];
  interestingnessScore: number; // 0-100
}

export interface PassageExtractionOptions {
  minWords?: number;
  maxWords?: number;
  minInterestingness?: number;
  themes?: string[]; // Filter by theme
  maxPassages?: number;
}

// ===== Gutenberg API =====

const GUTENBERG_MIRROR = 'https://www.gutenberg.org';
const GUTENDEX_API = 'https://gutendex.com/books';

/**
 * Search for books in the Gutenberg catalog
 */
export async function searchBooks(query: string, options?: {
  author?: string;
  topic?: string;
  language?: string;
  limit?: number;
}): Promise<SimpleBook[]> {
  const params = new URLSearchParams();
  if (query) params.append('search', query);
  if (options?.author) params.append('author_year_start', options.author);
  if (options?.topic) params.append('topic', options.topic);
  if (options?.language) params.append('languages', options.language || 'en');

  try {
    const response = await fetch(`${GUTENDEX_API}?${params.toString()}`);
    const data = await response.json();

    return (data.results || []).slice(0, options?.limit || 20).map((book: any) => ({
      id: book.id,
      title: book.title,
      author: book.authors?.[0]?.name || 'Unknown',
      language: book.languages?.[0] || 'en',
      subjects: book.subjects || [],
      downloadUrl: book.formats?.['text/plain; charset=utf-8'] ||
                   book.formats?.['text/plain'] ||
                   `${GUTENBERG_MIRROR}/files/${book.id}/${book.id}-0.txt`,
    }));
  } catch (error) {
    console.error('Gutenberg search failed:', error);
    return [];
  }
}

/**
 * Get a specific book by ID (simplified format)
 */
export async function getBook(bookId: number): Promise<SimpleBook | null> {
  try {
    const response = await fetch(`${GUTENDEX_API}/${bookId}`);
    const book = await response.json();

    return {
      id: book.id,
      title: book.title,
      author: book.authors?.[0]?.name || 'Unknown',
      language: book.languages?.[0] || 'en',
      subjects: book.subjects || [],
      downloadUrl: book.formats?.['text/plain; charset=utf-8'] ||
                   book.formats?.['text/plain'] ||
                   `${GUTENBERG_MIRROR}/files/${book.id}/${book.id}-0.txt`,
    };
  } catch (error) {
    console.error('Failed to get book:', error);
    return null;
  }
}

/**
 * Fetch the full text of a book
 */
export async function fetchBookText(book: GutenbergBook | SimpleBook): Promise<string> {
  try {
    // Get download URL based on book type
    const downloadUrl = 'downloadUrl' in book
      ? book.downloadUrl
      : (book.formats?.['text/plain; charset=utf-8'] || book.formats?.['text/plain']);

    // Try multiple URL patterns (Gutenberg's format varies)
    const urls = [
      downloadUrl,
      `${GUTENBERG_MIRROR}/cache/epub/${book.id}/pg${book.id}.txt`,
      `${GUTENBERG_MIRROR}/files/${book.id}/${book.id}-0.txt`,
      `${GUTENBERG_MIRROR}/files/${book.id}/${book.id}.txt`,
    ].filter(Boolean) as string[];

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return await response.text();
        }
      } catch {
        continue;
      }
    }

    throw new Error('All download attempts failed');
  } catch (error) {
    console.error('Failed to fetch book text:', error);
    throw error;
  }
}

// ===== Passage Extraction =====

/**
 * Extract interesting passages from a book's text
 */
export function extractPassages(
  text: string,
  book: GutenbergBook | SimpleBook,
  options: PassageExtractionOptions = {}
): ExtractedPassage[] {
  const {
    minWords = 200,
    maxWords = 2000,
    minInterestingness = 40,
    maxPassages = 50,
  } = options;

  // Remove Gutenberg header/footer
  const cleanText = removeGutenbergBoilerplate(text);

  // Split into paragraphs
  const paragraphs = cleanText.split(/\n\n+/);

  // Group paragraphs into coherent passages
  const passages: ExtractedPassage[] = [];
  let currentPassage: string[] = [];
  let currentWordCount = 0;
  let lineNumber = 0;
  let passageStartLine = 0;
  let currentChapter = '';

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Detect chapter headings
    const chapterMatch = trimmedPara.match(/^(chapter|part|book|section)\s+[\divxlc]+/i) ||
                         trimmedPara.match(/^[IVXLCivxlc]+\.\s/);
    if (chapterMatch) {
      // Save current passage if valid
      if (currentWordCount >= minWords && currentPassage.length > 0) {
        const content = currentPassage.join('\n\n');
        const score = scorePassage(content, book.subjects);
        if (score >= minInterestingness) {
          passages.push(createPassage(
            book,
            content,
            currentChapter,
            passageStartLine,
            lineNumber,
            score
          ));
        }
      }
      currentChapter = trimmedPara;
      currentPassage = [];
      currentWordCount = 0;
      passageStartLine = lineNumber;
      continue;
    }

    const paraWords = trimmedPara.split(/\s+/).length;

    // Start new passage if current one is getting too long
    if (currentWordCount + paraWords > maxWords && currentWordCount >= minWords) {
      const content = currentPassage.join('\n\n');
      const score = scorePassage(content, book.subjects);
      if (score >= minInterestingness) {
        passages.push(createPassage(
          book,
          content,
          currentChapter,
          passageStartLine,
          lineNumber,
          score
        ));
      }
      currentPassage = [];
      currentWordCount = 0;
      passageStartLine = lineNumber;
    }

    currentPassage.push(trimmedPara);
    currentWordCount += paraWords;
    lineNumber++;
  }

  // Don't forget the last passage
  if (currentWordCount >= minWords && currentPassage.length > 0) {
    const content = currentPassage.join('\n\n');
    const score = scorePassage(content, book.subjects);
    if (score >= minInterestingness) {
      passages.push(createPassage(
        book,
        content,
        currentChapter,
        passageStartLine,
        lineNumber,
        score
      ));
    }
  }

  // Sort by interestingness and limit
  return passages
    .sort((a, b) => b.interestingnessScore - a.interestingnessScore)
    .slice(0, maxPassages);
}

/**
 * Remove Gutenberg's boilerplate header and footer
 */
function removeGutenbergBoilerplate(text: string): string {
  // Find start of actual content
  const startMarkers = [
    '*** START OF THIS PROJECT GUTENBERG',
    '*** START OF THE PROJECT GUTENBERG',
    '*END*THE SMALL PRINT',
  ];

  const endMarkers = [
    '*** END OF THIS PROJECT GUTENBERG',
    '*** END OF THE PROJECT GUTENBERG',
    'End of Project Gutenberg',
    'End of the Project Gutenberg',
  ];

  let startIndex = 0;
  for (const marker of startMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      startIndex = text.indexOf('\n', idx) + 1;
      break;
    }
  }

  let endIndex = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      endIndex = idx;
      break;
    }
  }

  return text.slice(startIndex, endIndex).trim();
}

/**
 * Score a passage for "interestingness"
 * Based on: density of ideas, vocabulary richness, philosophical content
 */
function scorePassage(text: string, subjects: string[]): number {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  if (wordCount < 100) return 0;

  // Calculate metrics
  const uniqueWords = new Set(words);
  const vocabularyRichness = uniqueWords.size / wordCount;

  // Count philosophical/abstract terms
  const philosophicalTerms = [
    'truth', 'beauty', 'good', 'evil', 'nature', 'reason', 'soul', 'mind',
    'consciousness', 'existence', 'being', 'essence', 'reality', 'knowledge',
    'wisdom', 'virtue', 'justice', 'freedom', 'liberty', 'meaning', 'purpose',
    'experience', 'perception', 'understanding', 'thought', 'idea', 'concept',
    'principle', 'universal', 'particular', 'absolute', 'relative', 'infinite',
    'eternal', 'temporal', 'cause', 'effect', 'necessity', 'possibility',
    'phenomenon', 'appearance', 'substance', 'form', 'matter', 'spirit',
  ];
  const termDensity = words.filter(w => philosophicalTerms.includes(w)).length / wordCount;

  // Check for quotes and references (indicates dialogue or citation)
  const hasQuotes = /"/.test(text) || /said|replied|answered|asked/.test(text.toLowerCase());

  // Sentence variety (mix of short and long sentences)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const avgSentenceLength = wordCount / (sentences.length || 1);
  const sentenceVariety = avgSentenceLength > 10 && avgSentenceLength < 30 ? 1 : 0.5;

  // Calculate final score
  let score = 0;

  // Vocabulary richness (0-30 points)
  score += Math.min(30, vocabularyRichness * 100);

  // Philosophical density (0-40 points)
  score += Math.min(40, termDensity * 1000);

  // Has dialogue/quotes (0-10 points)
  score += hasQuotes ? 10 : 0;

  // Sentence variety (0-10 points)
  score += sentenceVariety * 10;

  // Subject bonus (0-10 points)
  const subjectStr = subjects.join(' ').toLowerCase();
  if (subjectStr.includes('philosophy') || subjectStr.includes('ethics')) {
    score += 10;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Generate a title for a passage
 */
function generatePassageTitle(content: string, chapter: string): string {
  // Try to use chapter name if meaningful
  if (chapter && !chapter.match(/^(chapter|part)\s+[\divxlc]+$/i)) {
    return chapter.replace(/^(chapter|part|section)\s+[\divxlc]+[:\s]*/i, '').trim();
  }

  // Extract key phrases from first sentence
  const firstSentence = content.split(/[.!?]/)[0]?.trim() || '';
  if (firstSentence.length > 10 && firstSentence.length < 80) {
    return firstSentence.slice(0, 60) + (firstSentence.length > 60 ? '...' : '');
  }

  // Extract key nouns
  const keyWords = content
    .slice(0, 500)
    .match(/\b[A-Z][a-z]+\b/g) || [];
  const uniqueKeys = [...new Set(keyWords)].slice(0, 3);
  if (uniqueKeys.length > 0) {
    return `On ${uniqueKeys.join(' and ')}`;
  }

  return 'Untitled Passage';
}

/**
 * Extract themes from a passage
 */
function extractThemes(content: string, bookSubjects: string[]): string[] {
  const themes: string[] = [];
  const contentLower = content.toLowerCase();

  // Theme detection patterns
  const themePatterns: [string, RegExp][] = [
    ['nature', /nature|natural|wilderness|forest|sea|mountain/],
    ['love', /love|heart|passion|affection|beloved/],
    ['death', /death|die|dying|mortal|grave|funeral/],
    ['time', /time|moment|eternal|past|future|memory/],
    ['justice', /justice|law|right|wrong|fair|judge/],
    ['freedom', /freedom|liberty|free|slave|bound/],
    ['knowledge', /knowledge|wisdom|learn|understand|truth/],
    ['beauty', /beauty|beautiful|sublime|aesthetic/],
    ['power', /power|authority|rule|king|master/],
    ['society', /society|social|civilization|community/],
    ['religion', /god|divine|holy|sacred|prayer|faith/],
    ['philosophy', /philosophy|reason|thought|idea|mind/],
    ['morality', /moral|virtue|vice|good|evil|conscience/],
    ['identity', /self|identity|soul|being|existence/],
  ];

  for (const [theme, pattern] of themePatterns) {
    if (pattern.test(contentLower)) {
      themes.push(theme);
    }
  }

  // Add relevant book subjects
  for (const subject of bookSubjects.slice(0, 3)) {
    const tag = subject.split(' -- ')[0].toLowerCase();
    if (!themes.includes(tag) && tag.length < 20) {
      themes.push(tag);
    }
  }

  return themes.slice(0, 5);
}

/**
 * Create a passage object
 */
function createPassage(
  book: GutenbergBook | SimpleBook,
  content: string,
  chapter: string,
  startLine: number,
  endLine: number,
  score: number
): ExtractedPassage {
  // Handle both GutenbergBook (from API) and SimpleBook (from curated list)
  const authorName = 'authors' in book
    ? book.authors?.[0]?.name || 'Unknown'
    : (book as SimpleBook).author || 'Unknown';

  return {
    id: `${book.id}-${startLine}-${endLine}`,
    bookId: book.id,
    bookTitle: book.title,
    author: authorName,
    title: generatePassageTitle(content, chapter),
    content,
    wordCount: content.split(/\s+/).length,
    location: {
      chapter: chapter || undefined,
      startLine,
      endLine,
    },
    themes: extractThemes(content, book.subjects || []),
    interestingnessScore: score,
  };
}

// ===== Curated Book Lists =====

/**
 * Pre-selected philosophical and literary works for seeding
 */
export const CURATED_BOOKS = {
  philosophy: [
    { id: 1497, title: 'The Republic', author: 'Plato' },
    { id: 5827, title: 'The Problems of Philosophy', author: 'Bertrand Russell' },
    { id: 4363, title: 'Beyond Good and Evil', author: 'Friedrich Nietzsche' },
    { id: 5740, title: 'Discourse on the Method', author: 'Rene Descartes' },
    { id: 10615, title: 'The Ethics', author: 'Baruch Spinoza' },
    { id: 4280, title: 'Critique of Pure Reason', author: 'Immanuel Kant' },
    { id: 1232, title: 'The Prince', author: 'Nicolo Machiavelli' },
    { id: 3207, title: 'Leviathan', author: 'Thomas Hobbes' },
  ],
  literature: [
    { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' },
    { id: 2701, title: 'Moby-Dick', author: 'Herman Melville' },
    { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
    { id: 1661, title: 'Sherlock Holmes', author: 'Arthur Conan Doyle' },
    { id: 1952, title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman' },
    { id: 768, title: 'Wuthering Heights', author: 'Emily Bronte' },
    { id: 345, title: 'Dracula', author: 'Bram Stoker' },
  ],
  essays: [
    { id: 2130, title: 'Essays of Michel de Montaigne', author: 'Michel de Montaigne' },
    { id: 16643, title: 'Walden', author: 'Henry David Thoreau' },
    { id: 7370, title: 'Second Treatise of Government', author: 'John Locke' },
    { id: 100, title: 'Complete Works of Shakespeare', author: 'William Shakespeare' },
    { id: 45, title: 'Anne of Green Gables', author: 'Lucy Maud Montgomery' },
  ],
  science: [
    { id: 2009, title: 'The Origin of Species', author: 'Charles Darwin' },
    { id: 36, title: 'The War of the Worlds', author: 'H.G. Wells' },
    { id: 35, title: 'The Time Machine', author: 'H.G. Wells' },
  ],
};

// ===== Category Tree for Browser =====

export const GUTENBERG_CATEGORIES: GutenbergCategory[] = [
  {
    id: 'philosophy',
    name: 'Philosophy',
    icon: '🏛️',
    children: [
      { id: 'phil-ethics', name: 'Ethics', icon: '⚖️', topic: 'Ethics' },
      { id: 'phil-metaphysics', name: 'Metaphysics', icon: '🔮', topic: 'Metaphysics' },
      { id: 'phil-logic', name: 'Logic', icon: '🧩', topic: 'Logic' },
      { id: 'phil-political', name: 'Political Philosophy', icon: '🏛️', topic: 'Political science' },
      { id: 'phil-ancient', name: 'Ancient Philosophy', icon: '📜', bookshelf: 'Philosophy' },
    ]
  },
  {
    id: 'literature',
    name: 'Literature',
    icon: '📚',
    children: [
      { id: 'lit-fiction', name: 'Fiction', icon: '📖', bookshelf: 'Fiction' },
      { id: 'lit-poetry', name: 'Poetry', icon: '🎭', bookshelf: 'Poetry' },
      { id: 'lit-drama', name: 'Drama', icon: '🎪', bookshelf: 'Drama' },
      { id: 'lit-gothic', name: 'Gothic Fiction', icon: '🦇', bookshelf: 'Gothic Fiction' },
      { id: 'lit-scifi', name: 'Science Fiction', icon: '🚀', bookshelf: 'Science Fiction' },
    ]
  },
  {
    id: 'science',
    name: 'Science',
    icon: '🔬',
    children: [
      { id: 'sci-biology', name: 'Biology', icon: '🧬', topic: 'Biology' },
      { id: 'sci-physics', name: 'Physics', icon: '⚛️', topic: 'Physics' },
      { id: 'sci-astronomy', name: 'Astronomy', icon: '🌟', topic: 'Astronomy' },
      { id: 'sci-nature', name: 'Natural History', icon: '🌿', topic: 'Natural history' },
    ]
  },
  {
    id: 'history',
    name: 'History',
    icon: '📜',
    children: [
      { id: 'hist-ancient', name: 'Ancient History', icon: '🏺', topic: 'Ancient history' },
      { id: 'hist-modern', name: 'Modern History', icon: '⚔️', topic: 'Modern history' },
      { id: 'hist-biography', name: 'Biography', icon: '👤', bookshelf: 'Biography' },
    ]
  },
  {
    id: 'religion',
    name: 'Religion & Spirituality',
    icon: '🕊️',
    children: [
      { id: 'rel-bible', name: 'Bible', icon: '📕', bookshelf: 'Bibles' },
      { id: 'rel-eastern', name: 'Eastern Religion', icon: '☯️', topic: 'Buddhism' },
      { id: 'rel-mythology', name: 'Mythology', icon: '⚡', topic: 'Mythology' },
    ]
  },
  {
    id: 'reference',
    name: 'Reference',
    icon: '📗',
    children: [
      { id: 'ref-encyclopedia', name: 'Encyclopedias', icon: '📚', bookshelf: 'Encyclopedias' },
      { id: 'ref-language', name: 'Language & Grammar', icon: '📝', topic: 'Language and languages' },
    ]
  },
];

// ===== API Functions for Browser Component =====

/**
 * Search Gutenberg catalog (returns paginated response)
 */
export async function search(query: string, page: number = 1): Promise<GutenbergResponse> {
  try {
    const response = await fetch(`${GUTENDEX_API}?search=${encodeURIComponent(query)}&page=${page}`);
    return await response.json();
  } catch (error) {
    console.error('Gutenberg search failed:', error);
    return { count: 0, next: null, previous: null, results: [] };
  }
}

/**
 * Search by topic/bookshelf
 */
export async function searchByTopic(topic: string, page: number = 1): Promise<GutenbergResponse> {
  try {
    // Try topic first, then bookshelf
    const response = await fetch(
      `${GUTENDEX_API}?topic=${encodeURIComponent(topic)}&page=${page}`
    );
    const data = await response.json();

    // If no results, try bookshelf
    if (data.count === 0) {
      const shelfResponse = await fetch(
        `${GUTENDEX_API}?search=${encodeURIComponent(topic)}&page=${page}`
      );
      return await shelfResponse.json();
    }

    return data;
  } catch (error) {
    console.error('Gutenberg topic search failed:', error);
    return { count: 0, next: null, previous: null, results: [] };
  }
}

/**
 * Get text URL for a book
 */
export function getTextUrl(book: GutenbergBook): string | null {
  // Prefer plain text formats
  return book.formats?.['text/plain; charset=utf-8'] ||
         book.formats?.['text/plain'] ||
         book.formats?.['text/html'] ||
         null;
}

/**
 * Get full book with extended info
 */
export async function getBookFull(bookId: number): Promise<GutenbergBook | null> {
  try {
    const response = await fetch(`${GUTENDEX_API}/${bookId}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to get book:', error);
    return null;
  }
}

// ===== Export service =====

export const gutenbergService = {
  // Search functions
  searchBooks,
  search,
  searchByTopic,
  getBook,
  getBookFull,
  getTextUrl,
  // Text processing
  fetchBookText,
  extractPassages,
  // Data
  CURATED_BOOKS,
  GUTENBERG_CATEGORIES,
};
