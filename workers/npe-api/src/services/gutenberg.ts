/**
 * Gutenberg Service - Fetch and process Project Gutenberg texts
 *
 * Uses gutendex.com API for search and gutenberg.org for text retrieval.
 * Extracts sample passages suitable for persona extraction (8K chars max).
 */

// API endpoints
const GUTENBERG_API = 'https://gutendex.com';
const GUTENBERG_TEXT_BASE = 'https://www.gutenberg.org/cache/epub';

// Types
export interface GutenbergAuthor {
  name: string;
  birth_year?: number;
  death_year?: number;
}

export interface GutenbergBook {
  id: number;
  title: string;
  authors: GutenbergAuthor[];
  translators: GutenbergAuthor[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean;
  media_type: string;
  formats: Record<string, string>;
  download_count: number;
}

export interface GutenbergSearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutenbergBook[];
}

export interface GutenbergBookPreview {
  book: GutenbergBook;
  sampleText: string;
  fullTextLength: number;
}

/**
 * Search Gutenberg books by title or author
 * Uses gutendex.com API
 */
export async function searchBooks(
  query: string,
  page: number = 1,
  languages: string[] = ['en']
): Promise<GutenbergSearchResult> {
  const params = new URLSearchParams({
    search: query,
    page: String(page),
    languages: languages.join(','),
  });

  const response = await fetch(`${GUTENBERG_API}/books?${params}`);

  if (!response.ok) {
    throw new Error(`Gutenberg search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get book metadata by ID
 */
export async function getBookMetadata(bookId: number): Promise<GutenbergBook> {
  const response = await fetch(`${GUTENBERG_API}/books/${bookId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Book ${bookId} not found`);
    }
    throw new Error(`Failed to get book metadata: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch the full text of a book by ID
 * Tries plain text format first, falls back to other formats
 */
export async function fetchBookText(bookId: number): Promise<string> {
  // Try plain text UTF-8 first
  const textUrl = `${GUTENBERG_TEXT_BASE}/${bookId}/pg${bookId}.txt`;

  try {
    const response = await fetch(textUrl);

    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.log(`[Gutenberg] Plain text not available for ${bookId}, trying alternatives...`);
  }

  // Try the .txt.utf-8 variant
  const utf8Url = `${GUTENBERG_TEXT_BASE}/${bookId}/pg${bookId}.txt.utf-8`;

  try {
    const response = await fetch(utf8Url);

    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    // Continue to next fallback
  }

  // Try getting metadata to find text URL
  const metadata = await getBookMetadata(bookId);

  // Look for plain text format in metadata
  const textFormats = [
    'text/plain; charset=utf-8',
    'text/plain',
    'text/plain; charset=us-ascii',
  ];

  for (const format of textFormats) {
    if (metadata.formats[format]) {
      const response = await fetch(metadata.formats[format]);
      if (response.ok) {
        return await response.text();
      }
    }
  }

  throw new Error(`No plain text available for book ${bookId}`);
}

/**
 * Extract sample passage from book text
 * Skips front matter (title, author, license) and extracts first N paragraphs
 */
export function extractSamplePassage(fullText: string, maxChars: number = 8000): string {
  // Common front matter markers to skip
  const frontMatterEndMarkers = [
    '*** START OF THE PROJECT GUTENBERG',
    '*** START OF THIS PROJECT GUTENBERG',
    '*END*THE SMALL PRINT',
    'End of the Project Gutenberg',
  ];

  // Find where the actual content starts
  let contentStart = 0;
  for (const marker of frontMatterEndMarkers) {
    const idx = fullText.indexOf(marker);
    if (idx !== -1) {
      // Find the next paragraph after the marker
      const nextParagraph = fullText.indexOf('\n\n', idx);
      if (nextParagraph !== -1) {
        contentStart = nextParagraph + 2;
        break;
      }
    }
  }

  // Also skip chapter headings at the very start
  let content = fullText.substring(contentStart).trim();

  // Skip if starts with "CHAPTER" or similar (find first paragraph after)
  const chapterMatch = content.match(/^(CHAPTER|BOOK|PART|PROLOGUE|PREFACE|INTRODUCTION)[\s\dIVXLC.:]+\n+/i);
  if (chapterMatch) {
    content = content.substring(chapterMatch[0].length);
  }

  // Find end of Project Gutenberg text
  const backMatterMarkers = [
    '*** END OF THE PROJECT GUTENBERG',
    '*** END OF THIS PROJECT GUTENBERG',
    'End of the Project Gutenberg',
    'End of Project Gutenberg',
  ];

  let contentEnd = content.length;
  for (const marker of backMatterMarkers) {
    const idx = content.indexOf(marker);
    if (idx !== -1 && idx < contentEnd) {
      contentEnd = idx;
    }
  }

  content = content.substring(0, contentEnd).trim();

  // If content is still longer than max, extract from the beginning
  if (content.length > maxChars) {
    // Try to break at a paragraph boundary
    const paragraphBreak = content.lastIndexOf('\n\n', maxChars);
    if (paragraphBreak > maxChars * 0.5) {
      content = content.substring(0, paragraphBreak);
    } else {
      // Break at sentence if no good paragraph break
      const sentenceEnd = content.substring(0, maxChars).lastIndexOf('. ');
      if (sentenceEnd > maxChars * 0.5) {
        content = content.substring(0, sentenceEnd + 1);
      } else {
        content = content.substring(0, maxChars);
      }
    }
  }

  // Clean up excessive whitespace
  content = content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return content;
}

/**
 * Get book with sample text for persona extraction
 */
export async function getBookPreview(bookId: number): Promise<GutenbergBookPreview> {
  // Fetch metadata and text in parallel
  const [metadata, fullText] = await Promise.all([
    getBookMetadata(bookId),
    fetchBookText(bookId),
  ]);

  const sampleText = extractSamplePassage(fullText);

  return {
    book: metadata,
    sampleText,
    fullTextLength: fullText.length,
  };
}

/**
 * Parse Gutenberg URL or ID from user input
 * Accepts:
 * - "1342" (just ID)
 * - "https://www.gutenberg.org/ebooks/1342"
 * - "https://www.gutenberg.org/cache/epub/1342/pg1342.txt"
 * - "gutenberg.org/ebooks/1342"
 */
export function parseGutenbergInput(input: string): number | null {
  const trimmed = input.trim();

  // Try parsing as plain number
  const asNumber = parseInt(trimmed, 10);
  if (!isNaN(asNumber) && asNumber > 0 && String(asNumber) === trimmed) {
    return asNumber;
  }

  // Try extracting from URL patterns
  const patterns = [
    /gutenberg\.org\/ebooks\/(\d+)/i,
    /gutenberg\.org\/cache\/epub\/(\d+)/i,
    /gutenberg\.org\/files\/(\d+)/i,
    /pg(\d+)\.txt/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const id = parseInt(match[1], 10);
      if (!isNaN(id) && id > 0) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Format author name for display
 */
export function formatAuthor(author: GutenbergAuthor): string {
  let name = author.name;

  // Handle "Last, First" format
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
      name = `${parts[1]} ${parts[0]}`;
    }
  }

  // Add life dates if available
  if (author.birth_year || author.death_year) {
    const birth = author.birth_year || '?';
    const death = author.death_year || '?';
    name += ` (${birth}-${death})`;
  }

  return name;
}
