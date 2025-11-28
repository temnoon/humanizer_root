/**
 * Text Reformatter Service
 *
 * Transforms raw Gutenberg text into clean, readable markdown.
 * Uses Llama 70b via Cloudflare Workers AI.
 *
 * Tasks:
 * 1. Remove hard line breaks (join mid-sentence lines)
 * 2. Detect chapter/section structure
 * 3. Add markdown formatting (headers, quotes, emphasis)
 * 4. Clean Gutenberg boilerplate
 */

// Maximum chunk size for AI processing (Llama 70b context ~4k tokens)
const MAX_CHUNK_SIZE = 8000; // characters, roughly 2k tokens
const OVERLAP_SIZE = 200;    // overlap between chunks for continuity

interface ChapterDetection {
  chapterNumber: number;
  title: string;
  startIndex: number;
  endIndex: number;
}

interface ReformattedChapter {
  chapterNumber: number;
  title: string;
  rawContent: string;
  workingContent: string;
  wordCount: number;
  enhancements: {
    headersAdded: number;
    quotesFormatted: number;
    paragraphsJoined: number;
  };
}

interface ReformatterResult {
  success: boolean;
  chapters: ReformattedChapter[];
  metadata: {
    totalChapters: number;
    totalWords: number;
    processingTimeMs: number;
    model: string;
  };
  error?: string;
}

/**
 * Clean Gutenberg boilerplate from start and end of text
 */
function removeGutenbergBoilerplate(text: string): string {
  // Remove Project Gutenberg header
  const headerPatterns = [
    /^\s*The Project Gutenberg [eE]Book[^]*?\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^]*?\*\*\*/i,
    /^\s*\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^]*?\*\*\*/i,
    /^[^]*?Produced by[^\n]*\n\n/i,
  ];

  let cleaned = text;
  for (const pattern of headerPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove Project Gutenberg footer
  const footerPatterns = [
    /\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK[^]*$/i,
    /End of (the )?Project Gutenberg[^]*$/i,
  ];

  for (const pattern of footerPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Detect chapter boundaries in the text
 */
function detectChapters(text: string): ChapterDetection[] {
  const chapters: ChapterDetection[] = [];

  // Common chapter patterns
  const chapterPatterns = [
    /^(CHAPTER|Chapter|BOOK|Book|PART|Part)\s+([IVXLCDM]+|\d+)[.:\s]*([^\n]*)?/gm,
    /^([IVXLCDM]+|\d+)\.\s+([^\n]+)/gm,  // "I. Title" or "1. Title"
    /^(BOOK|PART)\s+([IVXLCDM]+|\d+)[.:\s]*([^\n]*)?/gmi,
  ];

  let matches: { index: number; number: number; title: string }[] = [];

  for (const pattern of chapterPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const numStr = match[2];
      const title = match[3]?.trim() || match[0].trim();

      // Convert roman numerals or parse number
      let num = parseInt(numStr);
      if (isNaN(num)) {
        num = romanToInt(numStr);
      }

      matches.push({
        index: match.index,
        number: num || matches.length + 1,
        title: title
      });
    }
  }

  // Sort by index and deduplicate nearby matches
  matches.sort((a, b) => a.index - b.index);
  matches = matches.filter((m, i) =>
    i === 0 || m.index - matches[i-1].index > 100
  );

  // Create chapter detections with boundaries
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    chapters.push({
      chapterNumber: current.number,
      title: current.title,
      startIndex: current.index,
      endIndex: next ? next.index : text.length
    });
  }

  // If no chapters detected, treat entire text as one chapter
  if (chapters.length === 0) {
    chapters.push({
      chapterNumber: 1,
      title: 'Full Text',
      startIndex: 0,
      endIndex: text.length
    });
  }

  return chapters;
}

/**
 * Convert Roman numerals to integer
 */
function romanToInt(roman: string): number {
  const values: Record<string, number> = {
    'I': 1, 'V': 5, 'X': 10, 'L': 50,
    'C': 100, 'D': 500, 'M': 1000
  };

  let result = 0;
  const upper = roman.toUpperCase();

  for (let i = 0; i < upper.length; i++) {
    const current = values[upper[i]] || 0;
    const next = values[upper[i + 1]] || 0;

    if (current < next) {
      result -= current;
    } else {
      result += current;
    }
  }

  return result;
}

/**
 * Split text into chunks for AI processing
 */
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + MAX_CHUNK_SIZE, text.length);

    // Try to break at paragraph boundary
    if (end < text.length) {
      const lastParagraph = text.lastIndexOf('\n\n', end);
      if (lastParagraph > start + MAX_CHUNK_SIZE / 2) {
        end = lastParagraph + 2;
      }
    }

    chunks.push(text.slice(start, end));
    start = end - OVERLAP_SIZE;
  }

  return chunks;
}

/**
 * Reformat a chunk of text using AI
 */
async function reformatChunk(
  ai: Ai,
  chunk: string,
  isFirstChunk: boolean
): Promise<{ content: string; stats: { paragraphsJoined: number; quotesFormatted: number } }> {

  const systemPrompt = `You are a text reformatter. Your task is to clean up raw text from old books:

1. REMOVE HARD LINE BREAKS: Join lines that are mid-sentence. Keep paragraph breaks (double newlines).
2. FIX SPACING: Ensure proper spacing after punctuation.
3. FORMAT QUOTES: Use proper quotation marks and format dialogue.
4. PRESERVE STRUCTURE: Keep chapter titles, section breaks as they are.

Output ONLY the reformatted text, no explanations.`;

  const userPrompt = `Reformat this text, removing hard line breaks and cleaning up formatting:

${chunk}`;

  try {
    const response = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'user', content: systemPrompt + '\n\n' + userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.1, // Low temperature for consistent formatting
    });

    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);

    // Count approximate changes
    const originalLines = chunk.split('\n').length;
    const newLines = responseText.split('\n').length;
    const paragraphsJoined = Math.max(0, originalLines - newLines);

    const originalQuotes = (chunk.match(/"/g) || []).length;
    const newQuotes = (responseText.match(/[""]/g) || []).length;
    const quotesFormatted = Math.abs(newQuotes - originalQuotes);

    return {
      content: responseText.trim(),
      stats: { paragraphsJoined, quotesFormatted }
    };
  } catch (error) {
    console.error('[TEXT-REFORMATTER] AI error:', error);
    // Return original with basic cleanup if AI fails
    return {
      content: chunk.replace(/([^\n])\n([^\n])/g, '$1 $2').trim(),
      stats: { paragraphsJoined: 0, quotesFormatted: 0 }
    };
  }
}

/**
 * Add markdown enhancements to reformatted text
 */
function addMarkdownEnhancements(text: string, chapterTitle: string, chapterNumber: number): string {
  let enhanced = text;

  // Add chapter header if not present
  if (!enhanced.startsWith('#')) {
    const header = chapterNumber > 0
      ? `# Chapter ${chapterNumber}: ${chapterTitle}\n\n`
      : `# ${chapterTitle}\n\n`;
    enhanced = header + enhanced;
  }

  // Format section breaks
  enhanced = enhanced.replace(/\n\s*\*\s*\*\s*\*\s*\n/g, '\n\n---\n\n');

  // Format obvious quotes/dialogue (lines starting with quote marks)
  enhanced = enhanced.replace(/^"([^"]+)"$/gm, '> "$1"');

  return enhanced;
}

/**
 * Fast non-AI reformatter - simple regex-based cleanup
 * Use this for production to avoid CPU timeouts
 */
export async function reformatGutenbergTextFast(
  rawText: string
): Promise<ReformatterResult> {
  const startTime = Date.now();

  try {
    // Step 1: Remove boilerplate
    const cleanedText = removeGutenbergBoilerplate(rawText);

    // Step 2: Detect chapters
    const chapterDetections = detectChapters(cleanedText);

    const chapters: ReformattedChapter[] = [];

    // Step 3: Process each chapter (no AI)
    for (const detection of chapterDetections) {
      const chapterText = cleanedText.slice(detection.startIndex, detection.endIndex);

      // Simple regex-based cleanup (no AI)
      // Join lines that don't end with sentence terminators
      let cleaned = chapterText.replace(/([^\.\!\?\:\n])\n([^\n])/g, '$1 $2');

      // Normalize whitespace
      cleaned = cleaned.replace(/[ \t]+/g, ' ');
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

      // Add markdown enhancements
      const workingContent = addMarkdownEnhancements(
        cleaned,
        detection.title,
        detection.chapterNumber
      );

      // Count stats
      const headersAdded = (workingContent.match(/^#+\s/gm) || []).length;
      const originalLines = chapterText.split('\n').length;
      const newLines = workingContent.split('\n').length;
      const paragraphsJoined = Math.max(0, originalLines - newLines);

      chapters.push({
        chapterNumber: detection.chapterNumber,
        title: detection.title,
        rawContent: chapterText,
        workingContent,
        wordCount: workingContent.split(/\s+/).length,
        enhancements: {
          headersAdded,
          quotesFormatted: 0,
          paragraphsJoined
        }
      });
    }

    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    return {
      success: true,
      chapters,
      metadata: {
        totalChapters: chapters.length,
        totalWords,
        processingTimeMs: Date.now() - startTime,
        model: 'regex-fast'
      }
    };

  } catch (error) {
    console.error('[TEXT-REFORMATTER] Fast error:', error);
    return {
      success: false,
      chapters: [],
      metadata: {
        totalChapters: 0,
        totalWords: 0,
        processingTimeMs: Date.now() - startTime,
        model: 'regex-fast'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main reformatter function - processes entire text with AI
 * WARNING: May hit CPU timeouts on large books in production
 * Use reformatGutenbergTextFast() instead for production
 */
export async function reformatGutenbergText(
  ai: Ai,
  rawText: string
): Promise<ReformatterResult> {
  const startTime = Date.now();

  try {
    // Step 1: Remove boilerplate
    const cleanedText = removeGutenbergBoilerplate(rawText);

    // Step 2: Detect chapters
    const chapterDetections = detectChapters(cleanedText);

    const chapters: ReformattedChapter[] = [];

    // Step 3: Process each chapter
    for (const detection of chapterDetections) {
      const chapterText = cleanedText.slice(detection.startIndex, detection.endIndex);

      // Split chapter into chunks if needed
      const chunks = splitIntoChunks(chapterText);

      let reformattedContent = '';
      let totalStats = { paragraphsJoined: 0, quotesFormatted: 0 };

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const result = await reformatChunk(ai, chunks[i], i === 0);
        reformattedContent += (i > 0 ? '\n\n' : '') + result.content;
        totalStats.paragraphsJoined += result.stats.paragraphsJoined;
        totalStats.quotesFormatted += result.stats.quotesFormatted;
      }

      // Add markdown enhancements
      const workingContent = addMarkdownEnhancements(
        reformattedContent,
        detection.title,
        detection.chapterNumber
      );

      // Count headers added
      const headersAdded = (workingContent.match(/^#+\s/gm) || []).length;

      chapters.push({
        chapterNumber: detection.chapterNumber,
        title: detection.title,
        rawContent: chapterText,
        workingContent,
        wordCount: workingContent.split(/\s+/).length,
        enhancements: {
          headersAdded,
          quotesFormatted: totalStats.quotesFormatted,
          paragraphsJoined: totalStats.paragraphsJoined
        }
      });
    }

    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    return {
      success: true,
      chapters,
      metadata: {
        totalChapters: chapters.length,
        totalWords,
        processingTimeMs: Date.now() - startTime,
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
      }
    };

  } catch (error) {
    console.error('[TEXT-REFORMATTER] Error:', error);
    return {
      success: false,
      chapters: [],
      metadata: {
        totalChapters: 0,
        totalWords: 0,
        processingTimeMs: Date.now() - startTime,
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Store reformatted chapters in database
 */
export async function storeWorkingTexts(
  db: D1Database,
  nodeId: string,
  chapters: ReformattedChapter[]
): Promise<{ stored: number; errors: string[] }> {
  const errors: string[] = [];
  let stored = 0;
  const now = Date.now();

  for (const chapter of chapters) {
    try {
      const id = crypto.randomUUID();

      await db.prepare(
        `INSERT INTO node_working_texts
         (id, node_id, chapter_number, chapter_title, raw_content, working_content,
          markdown_enhancements, word_count, status, processed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?, ?)`
      ).bind(
        id,
        nodeId,
        chapter.chapterNumber,
        chapter.title,
        chapter.rawContent,
        chapter.workingContent,
        JSON.stringify(chapter.enhancements),
        chapter.wordCount,
        now,
        now,
        now
      ).run();

      stored++;
    } catch (error) {
      errors.push(`Chapter ${chapter.chapterNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { stored, errors };
}

/**
 * Get working texts for a node
 */
export async function getWorkingTexts(
  db: D1Database,
  nodeId: string
): Promise<ReformattedChapter[]> {
  const { results } = await db.prepare(
    `SELECT * FROM node_working_texts
     WHERE node_id = ? AND status = 'complete'
     ORDER BY chapter_number`
  ).bind(nodeId).all();

  return (results || []).map((row: Record<string, unknown>) => ({
    chapterNumber: row.chapter_number as number,
    title: row.chapter_title as string,
    rawContent: row.raw_content as string,
    workingContent: row.working_content as string,
    wordCount: row.word_count as number,
    enhancements: row.markdown_enhancements
      ? JSON.parse(row.markdown_enhancements as string)
      : { headersAdded: 0, quotesFormatted: 0, paragraphsJoined: 0 }
  }));
}
