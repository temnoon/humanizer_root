/**
 * Book Cache Service
 *
 * Caches downloaded Gutenberg book texts in IndexedDB for offline access
 * and to avoid re-downloading large texts.
 *
 * Storage structure:
 * - Key: book ID (number)
 * - Value: { text, metadata, chapters, fetchedAt }
 */

import type { GutenbergBook, SimpleBook } from './gutenberg';

// Parsed chapter/section structure
export interface BookChapter {
  id: string;
  title: string;
  level: number; // 0 = part, 1 = chapter, 2 = section
  startIndex: number;
  endIndex: number;
  content: string;
  wordCount: number;
  children?: BookChapter[];
}

export interface ParsedBook {
  id: number;
  title: string;
  author: string;
  text: string;
  chapters: BookChapter[];
  totalWords: number;
  fetchedAt: number;
  hasStructure: boolean; // true if chapters detected, false if using passages
}

const DB_NAME = 'gutenberg-cache';
const DB_VERSION = 1;
const STORE_NAME = 'books';

// Open IndexedDB connection
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Get a cached book by ID
 */
export async function getCachedBook(bookId: number): Promise<ParsedBook | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (error) {
    console.error('Failed to get cached book:', error);
    return null;
  }
}

/**
 * Cache a parsed book
 */
export async function cacheBook(book: ParsedBook): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(book);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to cache book:', error);
  }
}

/**
 * Check if a book is cached
 */
export async function isBookCached(bookId: number): Promise<boolean> {
  const book = await getCachedBook(bookId);
  return book !== null;
}

/**
 * Clear all cached books
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; oldestFetch: number | null }> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const books = request.result as ParsedBook[];
        const oldestFetch = books.length > 0
          ? Math.min(...books.map(b => b.fetchedAt))
          : null;
        resolve({ count: books.length, oldestFetch });
      };
    });
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return { count: 0, oldestFetch: null };
  }
}

// ===== Book Parsing =====

/**
 * Parse book text into chapters/sections
 */
export function parseBookStructure(
  text: string,
  book: GutenbergBook | SimpleBook
): { chapters: BookChapter[]; hasStructure: boolean } {
  // Remove Gutenberg boilerplate
  const cleanText = removeBoilerplate(text);

  // Try to detect chapter structure
  const chapters = detectChapters(cleanText);

  if (chapters.length > 1) {
    return { chapters, hasStructure: true };
  }

  // Fall back to passage-based chunking
  const passages = chunkIntoPassages(cleanText);
  return { chapters: passages, hasStructure: false };
}

/**
 * Remove Gutenberg header/footer boilerplate
 */
function removeBoilerplate(text: string): string {
  const startMarkers = [
    '*** START OF THIS PROJECT GUTENBERG',
    '*** START OF THE PROJECT GUTENBERG',
    '*END*THE SMALL PRINT',
    '*** START OF THIS PROJECT',
  ];

  const endMarkers = [
    '*** END OF THIS PROJECT GUTENBERG',
    '*** END OF THE PROJECT GUTENBERG',
    'End of Project Gutenberg',
    'End of the Project Gutenberg',
    '*** END OF THIS PROJECT',
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
 * Detect chapters in text using common patterns
 */
function detectChapters(text: string): BookChapter[] {
  const chapters: BookChapter[] = [];
  const lines = text.split('\n');

  // Patterns for chapter detection
  const chapterPatterns = [
    // "CHAPTER I" or "Chapter 1" or "CHAPTER ONE"
    /^(CHAPTER|Chapter)\s+([IVXLC\d]+|[A-Z][a-z]+)\.?\s*[-:]?\s*(.*)$/,
    // "I." or "I" at start of line (Roman numerals)
    /^([IVXLC]+)\.?\s*$/,
    // "PART ONE" or "Part I"
    /^(PART|Part)\s+([IVXLC\d]+|[A-Z][a-z]+)\.?\s*[-:]?\s*(.*)$/,
    // "BOOK I" or "Book One"
    /^(BOOK|Book)\s+([IVXLC\d]+|[A-Z][a-z]+)\.?\s*[-:]?\s*(.*)$/,
    // Section markers
    /^(SECTION|Section)\s+([IVXLC\d]+)\.?\s*[-:]?\s*(.*)$/,
    // "ACT I" for plays
    /^(ACT|Act)\s+([IVXLC\d]+)\.?\s*[-:]?\s*(.*)$/,
  ];

  interface ChapterMatch {
    lineIndex: number;
    title: string;
    level: number;
    type: string;
  }

  const matches: ChapterMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const pattern of chapterPatterns) {
      const match = line.match(pattern);
      if (match) {
        const type = match[1].toUpperCase();
        const level = type === 'PART' || type === 'BOOK' ? 0 :
                      type === 'ACT' ? 0 :
                      type === 'CHAPTER' ? 1 : 2;

        // Build title
        let title = line;

        // Check if next non-empty line is a subtitle
        let nextLineIdx = i + 1;
        while (nextLineIdx < lines.length && !lines[nextLineIdx].trim()) {
          nextLineIdx++;
        }
        if (nextLineIdx < lines.length) {
          const nextLine = lines[nextLineIdx].trim();
          // If next line is short and doesn't match patterns, it might be a subtitle
          if (nextLine.length < 100 && !chapterPatterns.some(p => p.test(nextLine))) {
            // Check if it looks like a title (capitalized, no period at end)
            if (nextLine.length > 3 && !nextLine.endsWith('.')) {
              title = `${line}: ${nextLine}`;
            }
          }
        }

        matches.push({
          lineIndex: i,
          title: title.slice(0, 100), // Limit title length
          level,
          type,
        });
        break;
      }
    }
  }

  // If we found fewer than 2 chapter markers, structure detection failed
  if (matches.length < 2) {
    return [];
  }

  // Convert matches to chapters with content
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const startLine = current.lineIndex;
    const endLine = next ? next.lineIndex : lines.length;

    const content = lines.slice(startLine, endLine).join('\n').trim();
    const wordCount = content.split(/\s+/).length;

    chapters.push({
      id: `ch-${i}`,
      title: current.title,
      level: current.level,
      startIndex: startLine,
      endIndex: endLine,
      content,
      wordCount,
    });
  }

  return chapters;
}

/**
 * Chunk text into passages when no chapter structure is detected
 */
function chunkIntoPassages(text: string, targetWords: number = 800): BookChapter[] {
  const passages: BookChapter[] = [];
  const paragraphs = text.split(/\n\n+/);

  let currentContent: string[] = [];
  let currentWordCount = 0;
  let passageIndex = 0;
  let startIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;

    const paraWords = para.split(/\s+/).length;

    // If adding this paragraph would exceed target, save current passage
    if (currentWordCount + paraWords > targetWords && currentContent.length > 0) {
      const content = currentContent.join('\n\n');
      passages.push({
        id: `passage-${passageIndex}`,
        title: generatePassageTitle(content, passageIndex + 1),
        level: 1,
        startIndex,
        endIndex: i,
        content,
        wordCount: currentWordCount,
      });

      passageIndex++;
      currentContent = [];
      currentWordCount = 0;
      startIndex = i;
    }

    currentContent.push(para);
    currentWordCount += paraWords;
  }

  // Don't forget the last passage
  if (currentContent.length > 0) {
    const content = currentContent.join('\n\n');
    passages.push({
      id: `passage-${passageIndex}`,
      title: generatePassageTitle(content, passageIndex + 1),
      level: 1,
      startIndex,
      endIndex: paragraphs.length,
      content,
      wordCount: currentWordCount,
    });
  }

  return passages;
}

/**
 * Generate a title for a passage
 */
function generatePassageTitle(content: string, index: number): string {
  // Try to extract first meaningful sentence
  const firstSentence = content.split(/[.!?]/)[0]?.trim();

  if (firstSentence && firstSentence.length > 10 && firstSentence.length < 60) {
    return firstSentence;
  }

  // Extract key words
  const words = content.slice(0, 200).match(/\b[A-Z][a-z]+\b/g) || [];
  const uniqueWords = [...new Set(words)].slice(0, 3);

  if (uniqueWords.length >= 2) {
    return `On ${uniqueWords.join(' and ')}`;
  }

  return `Passage ${index}`;
}

// ===== Main API =====

/**
 * Fetch and parse a book, using cache if available
 */
export async function fetchAndParseBook(
  book: GutenbergBook | SimpleBook,
  onProgress?: (status: string) => void
): Promise<ParsedBook> {
  // Check cache first
  const cached = await getCachedBook(book.id);
  if (cached) {
    onProgress?.('Loaded from cache');
    return cached;
  }

  onProgress?.('Downloading book...');

  // Fetch the book text
  const text = await fetchBookText(book);

  onProgress?.('Parsing structure...');

  // Parse into chapters
  const { chapters, hasStructure } = parseBookStructure(text, book);

  // Get author name
  const author = 'authors' in book
    ? book.authors?.[0]?.name || 'Unknown'
    : (book as SimpleBook).author || 'Unknown';

  const totalWords = text.split(/\s+/).length;

  const parsedBook: ParsedBook = {
    id: book.id,
    title: book.title,
    author,
    text,
    chapters,
    totalWords,
    fetchedAt: Date.now(),
    hasStructure,
  };

  onProgress?.('Caching...');

  // Cache for future use
  await cacheBook(parsedBook);

  onProgress?.('Done');

  return parsedBook;
}

/**
 * Fetch book text from Gutenberg (via CORS proxy)
 */
async function fetchBookText(book: GutenbergBook | SimpleBook): Promise<string> {
  const GUTENBERG_MIRROR = 'https://www.gutenberg.org';
  // Use a CORS proxy for browser fetches
  const CORS_PROXY = 'https://corsproxy.io/?';

  // Get download URL based on book type
  const downloadUrl = 'downloadUrl' in book
    ? book.downloadUrl
    : (book.formats?.['text/plain; charset=utf-8'] || book.formats?.['text/plain']);

  // Try multiple URL patterns
  const urls = [
    downloadUrl,
    `${GUTENBERG_MIRROR}/cache/epub/${book.id}/pg${book.id}.txt`,
    `${GUTENBERG_MIRROR}/files/${book.id}/${book.id}-0.txt`,
    `${GUTENBERG_MIRROR}/files/${book.id}/${book.id}.txt`,
  ].filter(Boolean) as string[];

  for (const url of urls) {
    try {
      // Use CORS proxy
      const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const text = await response.text();
        // Verify we got actual book content (not an error page)
        if (text.length > 1000 && !text.includes('<!DOCTYPE')) {
          return text;
        }
      }
    } catch {
      continue;
    }
  }

  throw new Error('Failed to download book text');
}

export const bookCache = {
  get: getCachedBook,
  cache: cacheBook,
  isCached: isBookCached,
  clear: clearCache,
  stats: getCacheStats,
  fetchAndParse: fetchAndParseBook,
  parseStructure: parseBookStructure,
};
