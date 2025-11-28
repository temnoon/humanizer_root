/**
 * Gutenberg Preprocessor
 *
 * Prepares Project Gutenberg texts for the curator pyramid:
 * 1. Fetch text from gutenberg.org
 * 2. Strip standard headers/footers
 * 3. Detect and parse structure (parts, chapters)
 * 4. Normalize paragraphs for clean chunking
 *
 * Gutenberg Text Format:
 * - Header: "The Project Gutenberg eBook of [Title]"
 * - START marker: "*** START OF THE PROJECT GUTENBERG EBOOK [TITLE] ***"
 * - END marker: "*** END OF THE PROJECT GUTENBERG EBOOK [TITLE] ***"
 * - Footer: License text, donation info
 */

// ==========================================
// Types
// ==========================================

export interface GutenbergMetadata {
  gutenbergId: string;
  title: string;
  author: string;
  language: string;
  releaseDate?: string;
  credits?: string;
}

export interface StructuralUnit {
  type: 'part' | 'chapter' | 'section' | 'preface' | 'epilogue' | 'prologue';
  number?: number;
  title?: string;
  content: string;
  charStart: number;
  charEnd: number;
}

export interface PreprocessedText {
  metadata: GutenbergMetadata;
  rawContent: string;
  cleanContent: string;
  structure: StructuralUnit[];
  paragraphs: Paragraph[];
  stats: {
    totalCharacters: number;
    totalWords: number;
    totalParagraphs: number;
    structuralUnits: number;
  };
}

export interface Paragraph {
  content: string;
  charStart: number;
  charEnd: number;
  structuralUnit?: number;  // Index into structure array
  isDialogue: boolean;
}

// ==========================================
// Fetching
// ==========================================

/**
 * Fetch plain text from Project Gutenberg
 * @param gutenbergId - The Gutenberg book ID (e.g., "2701" for Moby Dick)
 */
export async function fetchGutenbergText(gutenbergId: string): Promise<string> {
  // Gutenberg plain text URL pattern
  // Primary: https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt
  // Fallback: https://www.gutenberg.org/files/{id}/{id}-0.txt

  const urls = [
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}.txt`,
  ];

  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PostSocial-Curator/1.0 (Literary Node System)',
        },
      });

      if (response.ok) {
        const text = await response.text();
        // Verify it's actually text content
        if (text.includes('Project Gutenberg') || text.length > 1000) {
          return text;
        }
      }
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw new Error(`Failed to fetch Gutenberg text ${gutenbergId}: ${lastError?.message || 'All URLs failed'}`);
}

// ==========================================
// Header/Footer Stripping
// ==========================================

/**
 * Strip Gutenberg header and footer, extract metadata
 */
export function stripGutenbergWrapper(rawText: string): {
  metadata: GutenbergMetadata;
  content: string;
} {
  // Find START marker
  const startPatterns = [
    /\*\*\* START OF THE PROJECT GUTENBERG EBOOK .+? \*\*\*/i,
    /\*\*\* START OF THIS PROJECT GUTENBERG EBOOK .+? \*\*\*/i,
    /\*\*\*START OF THE PROJECT GUTENBERG EBOOK/i,
  ];

  let startIndex = -1;
  for (const pattern of startPatterns) {
    const match = rawText.match(pattern);
    if (match) {
      startIndex = match.index! + match[0].length;
      break;
    }
  }

  // Find END marker
  const endPatterns = [
    /\*\*\* END OF THE PROJECT GUTENBERG EBOOK .+? \*\*\*/i,
    /\*\*\* END OF THIS PROJECT GUTENBERG EBOOK .+? \*\*\*/i,
    /\*\*\*END OF THE PROJECT GUTENBERG EBOOK/i,
    /End of the Project Gutenberg EBook/i,
    /End of Project Gutenberg/i,
  ];

  let endIndex = rawText.length;
  for (const pattern of endPatterns) {
    const match = rawText.match(pattern);
    if (match) {
      endIndex = match.index!;
      break;
    }
  }

  // Extract header for metadata
  const header = startIndex > 0 ? rawText.substring(0, startIndex) : rawText.substring(0, 2000);
  const metadata = extractMetadata(header, rawText);

  // Extract content
  const content = startIndex > 0
    ? rawText.substring(startIndex, endIndex).trim()
    : rawText.substring(0, endIndex).trim();

  return { metadata, content };
}

/**
 * Extract metadata from Gutenberg header
 */
function extractMetadata(header: string, fullText: string): GutenbergMetadata {
  // Title: "The Project Gutenberg eBook of [Title], by [Author]"
  // Or: "Title: [Title]"
  let title = 'Unknown';
  let author = 'Unknown';

  // Try "eBook of X, by Y" pattern
  const ebookMatch = header.match(/eBook of (.+?),?\s+by\s+(.+?)[\r\n]/i);
  if (ebookMatch) {
    title = ebookMatch[1].trim();
    author = ebookMatch[2].trim();
  } else {
    // Try "Title: X" and "Author: Y" patterns
    const titleMatch = header.match(/Title:\s*(.+?)[\r\n]/i);
    if (titleMatch) title = titleMatch[1].trim();

    const authorMatch = header.match(/Author:\s*(.+?)[\r\n]/i);
    if (authorMatch) author = authorMatch[1].trim();
  }

  // Gutenberg ID from URL or text
  let gutenbergId = '';
  const idMatch = fullText.match(/gutenberg\.org\/ebooks\/(\d+)/i) ||
                  header.match(/EBook #(\d+)/i) ||
                  header.match(/\[(?:EBook|eBook) #?(\d+)\]/i);
  if (idMatch) gutenbergId = idMatch[1];

  // Language
  let language = 'en';
  const langMatch = header.match(/Language:\s*(.+?)[\r\n]/i);
  if (langMatch) {
    const lang = langMatch[1].trim().toLowerCase();
    if (lang.includes('english')) language = 'en';
    else if (lang.includes('french')) language = 'fr';
    else if (lang.includes('german')) language = 'de';
    else if (lang.includes('spanish')) language = 'es';
    else language = lang.substring(0, 2);
  }

  // Release date
  let releaseDate: string | undefined;
  const dateMatch = header.match(/Release Date:\s*(.+?)[\r\n]/i) ||
                   header.match(/Posting Date:\s*(.+?)[\r\n]/i);
  if (dateMatch) releaseDate = dateMatch[1].trim();

  // Credits (transcriber, etc.)
  let credits: string | undefined;
  const creditsMatch = header.match(/Produced by\s+(.+?)(?:[\r\n]{2}|$)/is);
  if (creditsMatch) credits = creditsMatch[1].trim().replace(/\s+/g, ' ');

  return {
    gutenbergId,
    title,
    author,
    language,
    releaseDate,
    credits,
  };
}

// ==========================================
// Structure Detection
// ==========================================

/**
 * Detect parts, chapters, and other structural divisions
 */
export function detectStructure(content: string): StructuralUnit[] {
  const units: StructuralUnit[] = [];

  // Common chapter patterns (case insensitive)
  const chapterPatterns = [
    // "Chapter I" "Chapter 1" "Chapter One"
    /^(CHAPTER|Chapter)\s+([IVXLCDM]+|\d+|[A-Za-z]+)\.?\s*[-—:]?\s*(.*)$/gm,
    // "I." "II." at start of line (Roman numerals as chapters)
    /^([IVXLCDM]+)\.\s*(.*)$/gm,
    // "CHAPTER I." style
    /^(CHAPTER)\s+([IVXLCDM]+|\d+)\.?\s*$/gmi,
  ];

  // Part patterns
  const partPatterns = [
    /^(PART|Part)\s+([IVXLCDM]+|\d+|[A-Za-z]+)\.?\s*[-—:]?\s*(.*)$/gm,
    /^(BOOK|Book)\s+([IVXLCDM]+|\d+|[A-Za-z]+)\.?\s*[-—:]?\s*(.*)$/gm,
    /^(VOLUME|Volume)\s+([IVXLCDM]+|\d+)\.?\s*[-—:]?\s*(.*)$/gm,
  ];

  // Special sections
  const specialPatterns = [
    /^(PREFACE|Preface)\.?\s*(.*)$/gm,
    /^(PROLOGUE|Prologue)\.?\s*(.*)$/gm,
    /^(EPILOGUE|Epilogue)\.?\s*(.*)$/gm,
    /^(INTRODUCTION|Introduction)\.?\s*(.*)$/gm,
    /^(CONCLUSION|Conclusion)\.?\s*(.*)$/gm,
  ];

  // Collect all matches with positions
  interface Match {
    type: StructuralUnit['type'];
    number?: number;
    title?: string;
    index: number;
    fullMatch: string;
  }

  const matches: Match[] = [];

  // Find parts
  for (const pattern of partPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      matches.push({
        type: 'part',
        number: parseNumber(match[2]),
        title: match[3]?.trim() || undefined,
        index: match.index,
        fullMatch: match[0],
      });
    }
  }

  // Find chapters
  for (const pattern of chapterPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Skip if it's just a reference to a chapter in text
      const before = content.substring(Math.max(0, match.index - 50), match.index);
      if (before.match(/in\s*$/i) || before.match(/see\s*$/i)) continue;

      matches.push({
        type: 'chapter',
        number: parseNumber(match[2] || match[1]),
        title: (match[3] || match[2] || '').trim() || undefined,
        index: match.index,
        fullMatch: match[0],
      });
    }
  }

  // Find special sections
  for (const pattern of specialPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const typeName = match[1].toLowerCase();
      let type: StructuralUnit['type'] = 'section';
      if (typeName === 'preface' || typeName === 'introduction') type = 'preface';
      else if (typeName === 'prologue') type = 'prologue';
      else if (typeName === 'epilogue' || typeName === 'conclusion') type = 'epilogue';

      matches.push({
        type,
        title: match[2]?.trim() || match[1],
        index: match.index,
        fullMatch: match[0],
      });
    }
  }

  // Sort by position
  matches.sort((a, b) => a.index - b.index);

  // If no structure found, treat entire text as one chapter
  if (matches.length === 0) {
    units.push({
      type: 'chapter',
      number: 1,
      content: content.trim(),
      charStart: 0,
      charEnd: content.length,
    });
    return units;
  }

  // Convert matches to units with content
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const contentStart = current.index + current.fullMatch.length;
    const contentEnd = next ? next.index : content.length;

    units.push({
      type: current.type,
      number: current.number,
      title: current.title,
      content: content.substring(contentStart, contentEnd).trim(),
      charStart: current.index,
      charEnd: contentEnd,
    });
  }

  // Handle content before first structural marker
  if (matches.length > 0 && matches[0].index > 100) {
    const prefaceContent = content.substring(0, matches[0].index).trim();
    if (prefaceContent.length > 200) {
      units.unshift({
        type: 'preface',
        title: 'Opening',
        content: prefaceContent,
        charStart: 0,
        charEnd: matches[0].index,
      });
    }
  }

  return units;
}

/**
 * Parse Roman numeral or numeric string to number
 */
function parseNumber(str: string): number | undefined {
  if (!str) return undefined;
  str = str.trim().toUpperCase();

  // Try parsing as number first
  const num = parseInt(str, 10);
  if (!isNaN(num)) return num;

  // Roman numerals
  const romanValues: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
  };

  if (/^[IVXLCDM]+$/.test(str)) {
    let result = 0;
    for (let i = 0; i < str.length; i++) {
      const current = romanValues[str[i]];
      const next = romanValues[str[i + 1]];
      if (next && current < next) {
        result -= current;
      } else {
        result += current;
      }
    }
    return result;
  }

  // Word numbers
  const wordNumbers: Record<string, number> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
    SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10,
    ELEVEN: 11, TWELVE: 12, THIRTEEN: 13, FOURTEEN: 14, FIFTEEN: 15,
    SIXTEEN: 16, SEVENTEEN: 17, EIGHTEEN: 18, NINETEEN: 19, TWENTY: 20,
    FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5,
    LAST: -1, FINAL: -1,
  };

  return wordNumbers[str];
}

// ==========================================
// Paragraph Processing
// ==========================================

/**
 * Split content into paragraphs, preserving position info
 */
export function extractParagraphs(content: string, structure: StructuralUnit[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Split on double newlines (standard paragraph separator)
  const paragraphPattern = /\n\s*\n/g;
  let lastIndex = 0;
  let match;

  while ((match = paragraphPattern.exec(content)) !== null) {
    const paragraphText = content.substring(lastIndex, match.index).trim();

    if (paragraphText.length > 0) {
      paragraphs.push({
        content: normalizeParagraph(paragraphText),
        charStart: lastIndex,
        charEnd: match.index,
        structuralUnit: findStructuralUnit(lastIndex, structure),
        isDialogue: detectDialogue(paragraphText),
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Don't forget the last paragraph
  if (lastIndex < content.length) {
    const paragraphText = content.substring(lastIndex).trim();
    if (paragraphText.length > 0) {
      paragraphs.push({
        content: normalizeParagraph(paragraphText),
        charStart: lastIndex,
        charEnd: content.length,
        structuralUnit: findStructuralUnit(lastIndex, structure),
        isDialogue: detectDialogue(paragraphText),
      });
    }
  }

  return paragraphs;
}

/**
 * Find which structural unit a position belongs to
 */
function findStructuralUnit(position: number, structure: StructuralUnit[]): number | undefined {
  for (let i = 0; i < structure.length; i++) {
    if (position >= structure[i].charStart && position < structure[i].charEnd) {
      return i;
    }
  }
  return undefined;
}

/**
 * Normalize a paragraph: fix spacing, remove artifacts
 */
function normalizeParagraph(text: string): string {
  return text
    // Remove multiple spaces
    .replace(/  +/g, ' ')
    // Fix common OCR artifacts
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')  // Rejoin hyphenated words
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Normalize dashes
    .replace(/--/g, '—')
    // Remove leading/trailing whitespace
    .trim();
}

/**
 * Detect if paragraph contains dialogue
 */
function detectDialogue(text: string): boolean {
  // Count quote marks
  const quoteMatches = text.match(/["']/g);
  if (!quoteMatches) return false;

  // More than 2 quotes suggests dialogue
  if (quoteMatches.length >= 2) {
    // Check for dialogue tags
    if (text.match(/(said|asked|replied|answered|shouted|whispered|cried|exclaimed)/i)) {
      return true;
    }
    // Check for speech pattern: "text"
    if (text.match(/"[^"]{5,}"/)) {
      return true;
    }
  }

  return false;
}

// ==========================================
// Main Preprocessor
// ==========================================

/**
 * Full preprocessing pipeline for a Gutenberg text
 */
export async function preprocessGutenbergText(
  gutenbergId: string
): Promise<PreprocessedText> {
  // Fetch the text
  const rawText = await fetchGutenbergText(gutenbergId);

  // Strip header/footer
  const { metadata, content } = stripGutenbergWrapper(rawText);
  metadata.gutenbergId = gutenbergId;

  // Detect structure
  const structure = detectStructure(content);

  // Extract paragraphs
  const paragraphs = extractParagraphs(content, structure);

  // Calculate stats
  const stats = {
    totalCharacters: content.length,
    totalWords: content.split(/\s+/).length,
    totalParagraphs: paragraphs.length,
    structuralUnits: structure.length,
  };

  return {
    metadata,
    rawContent: rawText,
    cleanContent: content,
    structure,
    paragraphs,
    stats,
  };
}

/**
 * Preprocess from raw text (when already fetched)
 */
export function preprocessRawText(
  rawText: string,
  gutenbergId?: string
): PreprocessedText {
  // Strip header/footer
  const { metadata, content } = stripGutenbergWrapper(rawText);
  if (gutenbergId) metadata.gutenbergId = gutenbergId;

  // Detect structure
  const structure = detectStructure(content);

  // Extract paragraphs
  const paragraphs = extractParagraphs(content, structure);

  // Calculate stats
  const stats = {
    totalCharacters: content.length,
    totalWords: content.split(/\s+/).length,
    totalParagraphs: paragraphs.length,
    structuralUnits: structure.length,
  };

  return {
    metadata,
    rawContent: rawText,
    cleanContent: content,
    structure,
    paragraphs,
    stats,
  };
}

// ==========================================
// Well-Known Gutenberg IDs
// ==========================================

export const WELL_KNOWN_BOOKS = {
  // Short works (< 50k words) - fast to build
  'metamorphosis': '5200',              // ~22k words
  'picture-of-dorian-gray': '174',      // ~78k words
  'frankenstein': '84',                 // ~75k words
  'apology': '1656',                    // Plato - ~15k words
  'crito': '1657',                      // Plato - ~8k words
  'symposium': '1600',                  // Plato - ~25k words
  'phaedo': '1658',                     // Plato - ~35k words

  // Medium works (50-150k words)
  'pride-and-prejudice': '1342',
  'dracula': '345',
  'jane-eyre': '1260',
  'wuthering-heights': '768',
  'crime-and-punishment': '2554',
  'tale-of-two-cities': '98',
  'great-gatsby': '64317',

  // Long works (150k+ words) - may timeout
  'moby-dick': '2701',
  'war-and-peace': '2600',
  'odyssey': '1727',
  'iliad': '6130',
  'divine-comedy': '8800',
  'don-quixote': '996',
  'brothers-karamazov': '28054',
  'anna-karenina': '1399',
  'les-miserables': '135',
  'count-of-monte-cristo': '1184',
  'republic': '1497',                   // Plato - ~120k words

  // Science & Philosophy
  'principia': '28233',                 // Newton - ~200k words (may timeout)
} as const;
