/**
 * Gutenberg Preprocessor for npe-api
 *
 * Cleans and structures Project Gutenberg texts:
 * 1. Strip headers/footers
 * 2. Detect chapters, parts, sections
 * 3. Normalize paragraphs (fix hard returns, spacing)
 * 4. Return structured markdown
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
}

export interface StructuralUnit {
  type: 'part' | 'chapter' | 'section' | 'preface' | 'epilogue' | 'prologue';
  number?: number;
  title?: string;
  content: string;
  wordCount: number;
  preview: string;  // First ~200 chars
}

export interface PreprocessedBook {
  metadata: GutenbergMetadata;
  structure: StructuralUnit[];
  fullText: string;  // Clean markdown version
  stats: {
    totalCharacters: number;
    totalWords: number;
    structuralUnits: number;
  };
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

  return {
    gutenbergId,
    title,
    author,
    language,
    releaseDate,
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

  // Common chapter patterns
  const chapterPatterns = [
    /^(CHAPTER|Chapter)\s+([IVXLCDM]+|\d+|[A-Za-z]+)\.?\s*[-—:]?\s*(.*)$/gm,
    /^([IVXLCDM]+)\.\s*(.*)$/gm,
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

  // If no structure found, treat entire text as one section
  if (matches.length === 0) {
    const cleanContent = normalizeText(content);
    units.push({
      type: 'chapter',
      number: 1,
      title: 'Full Text',
      content: cleanContent,
      wordCount: cleanContent.split(/\s+/).length,
      preview: cleanContent.slice(0, 200) + '...',
    });
    return units;
  }

  // Convert matches to units with content
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const contentStart = current.index + current.fullMatch.length;
    const contentEnd = next ? next.index : content.length;
    const rawContent = content.substring(contentStart, contentEnd).trim();
    const cleanContent = normalizeText(rawContent);

    // Skip empty sections
    if (cleanContent.length < 50) continue;

    units.push({
      type: current.type,
      number: current.number,
      title: current.title,
      content: cleanContent,
      wordCount: cleanContent.split(/\s+/).length,
      preview: cleanContent.slice(0, 200).replace(/\n/g, ' ') + '...',
    });
  }

  // Handle content before first structural marker
  if (matches.length > 0 && matches[0].index > 200) {
    const prefaceContent = normalizeText(content.substring(0, matches[0].index).trim());
    if (prefaceContent.length > 200) {
      units.unshift({
        type: 'preface',
        title: 'Opening',
        content: prefaceContent,
        wordCount: prefaceContent.split(/\s+/).length,
        preview: prefaceContent.slice(0, 200).replace(/\n/g, ' ') + '...',
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

  const num = parseInt(str, 10);
  if (!isNaN(num)) return num;

  const romanValues: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
  };

  if (/^[IVXLCDM]+$/.test(str)) {
    let result = 0;
    for (let i = 0; i < str.length; i++) {
      const current = romanValues[str[i]];
      const nextVal = romanValues[str[i + 1]];
      if (nextVal && current < nextVal) {
        result -= current;
      } else {
        result += current;
      }
    }
    return result;
  }

  const wordNumbers: Record<string, number> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
    SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10,
    FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5,
  };

  return wordNumbers[str];
}

// ==========================================
// Text Normalization
// ==========================================

/**
 * Normalize text: fix hard returns, clean paragraphs, produce markdown
 */
export function normalizeText(text: string): string {
  // Step 1: Normalize line endings
  let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 2: Fix Gutenberg's hard-wrapped lines
  // Lines ending without punctuation followed by lowercase are continuations
  result = result.replace(/([a-z,;])\n([a-z])/g, '$1 $2');

  // Step 3: Rejoin hyphenated words at line breaks
  result = result.replace(/(\w)-\n(\w)/g, '$1$2');

  // Step 4: Normalize multiple spaces
  result = result.replace(/  +/g, ' ');

  // Step 5: Normalize quotes
  result = result.replace(/[""]/g, '"').replace(/['']/g, "'");

  // Step 6: Normalize dashes
  result = result.replace(/--/g, '—');

  // Step 7: Ensure paragraph breaks (double newlines)
  // Single newlines after sentence-ending punctuation should become paragraph breaks
  result = result.replace(/([.!?]["']?)\n([A-Z])/g, '$1\n\n$2');

  // Step 8: Clean up excessive newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Step 9: Trim each line
  result = result.split('\n').map(line => line.trim()).join('\n');

  return result.trim();
}

// ==========================================
// Main Preprocessor
// ==========================================

/**
 * Full preprocessing pipeline for a Gutenberg text
 */
export function preprocessGutenbergText(rawText: string, gutenbergId: string): PreprocessedBook {
  // Strip header/footer
  const { metadata, content } = stripGutenbergWrapper(rawText);
  metadata.gutenbergId = gutenbergId;

  // Normalize entire content
  const cleanContent = normalizeText(content);

  // Detect structure
  const structure = detectStructure(content);

  // Calculate stats
  const stats = {
    totalCharacters: cleanContent.length,
    totalWords: cleanContent.split(/\s+/).length,
    structuralUnits: structure.length,
  };

  return {
    metadata,
    structure,
    fullText: cleanContent,
    stats,
  };
}
