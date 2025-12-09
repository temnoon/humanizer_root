/**
 * Markdown Structure Preserver
 * Preserves paragraph breaks and list formatting during text transformations
 * Also provides position mapping for AI detection highlight restoration
 */

export interface MarkdownStructure {
  paragraphs: string[];
  listItems: Map<number, ListInfo>; // paragraph index -> list info
}

export interface ListInfo {
  type: 'bullet' | 'numbered';
  marker: string; // Original marker (e.g., "- ", "1. ")
  items: string[]; // Individual list items (without markers)
}

/**
 * Position mapping for tracking character positions across markdown stripping
 * Maps positions in stripped text back to original markdown text
 */
export interface PositionMapping {
  // Position in stripped (plain) text
  strippedPos: number;
  // Corresponding position in original markdown text
  originalPos: number;
  // Length of markdown syntax removed at this position (e.g., 2 for **)
  markdownLength: number;
  // Type of markdown syntax removed
  type: 'bold' | 'italic' | 'code' | 'link' | 'none';
}

/**
 * Highlight range to be applied
 */
export interface HighlightRange {
  start: number;  // Position in stripped text
  end: number;    // Position in stripped text
  reason: string; // Reason for highlighting
}

/**
 * Extract markdown structure from text
 * Preserves:
 * - Paragraph breaks (\n\n)
 * - Bullet lists (-, *, +)
 * - Numbered lists (1., 2., etc.)
 */
export function extractStructure(text: string): MarkdownStructure {
  // Split into paragraphs (preserving double newlines)
  const paragraphs = text.split(/\n\n+/);
  const listItems = new Map<number, ListInfo>();

  paragraphs.forEach((para, index) => {
    // Check if this paragraph is a list
    const listInfo = detectList(para);
    if (listInfo) {
      listItems.set(index, listInfo);
    }
  });

  return { paragraphs, listItems };
}

/**
 * Detect if a paragraph is a list and extract items
 */
function detectList(paragraph: string): ListInfo | null {
  const lines = paragraph.split('\n').filter(line => line.trim());
  if (lines.length === 0) return null;

  // Check for bullet list (-, *, +)
  const bulletRegex = /^[\s]*[-*+]\s+(.+)$/;
  const bulletMatch = lines[0].match(bulletRegex);
  if (bulletMatch && lines.every(line => bulletRegex.test(line))) {
    const marker = lines[0].match(/^[\s]*([-*+]\s+)/)?.[1] || '- ';
    const items = lines.map(line => line.replace(bulletRegex, '$1').trim());
    return { type: 'bullet', marker, items };
  }

  // Check for numbered list (1., 2., etc.)
  const numberedRegex = /^[\s]*\d+\.\s+(.+)$/;
  const numberedMatch = lines[0].match(numberedRegex);
  if (numberedMatch && lines.every(line => numberedRegex.test(line))) {
    const marker = '1. '; // Standardize to "1. " format
    const items = lines.map(line => line.replace(numberedRegex, '$1').trim());
    return { type: 'numbered', marker, items };
  }

  return null;
}

/**
 * Reconstruct text with preserved structure
 * Applies paragraph breaks and list formatting to transformed text
 */
export function restoreStructure(
  transformedText: string,
  originalStructure: MarkdownStructure
): string {
  // Strategy: Split transformed text into same number of paragraphs
  // This assumes the transformation preserves paragraph count (mostly true)

  const transformedParagraphs = splitIntoSameParagraphs(
    transformedText,
    originalStructure.paragraphs.length
  );

  const reconstructed: string[] = [];

  transformedParagraphs.forEach((para, index) => {
    const listInfo = originalStructure.listItems.get(index);

    if (listInfo) {
      // This paragraph was a list - restore list formatting
      const restoredList = restoreList(para, listInfo);
      reconstructed.push(restoredList);
    } else {
      // Regular paragraph
      reconstructed.push(para);
    }
  });

  // Join with double newlines (paragraph breaks)
  return reconstructed.join('\n\n');
}

/**
 * Split text into sentences, handling edge cases like URLs, quotes, abbreviations
 */
function smartSentenceSplit(text: string): string[] {
  // Handle periods that should NOT be treated as sentence boundaries:
  // 1. Period within words (no space after): "humanizer.com", "v2.0", "email@example.com"
  // 2. Period followed by quote: 'sentence."' in quoted lists
  // 3. Common abbreviations: Mr., Mrs., Dr., etc.

  const sentences: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    const prevChar = text[i - 1];

    current += char;

    // Check if this is a sentence-ending punctuation
    if (char === '.' || char === '!' || char === '?') {
      // Don't split if:
      // 1. Next char is not whitespace or quote (period within word like "example.com")
      // 2. Next char is quote followed by non-whitespace (quoted list item)
      const nextIsWhitespace = !nextChar || /\s/.test(nextChar);
      const nextIsQuote = nextChar === '"' || nextChar === "'";
      const afterQuote = text[i + 2];
      const quoteFollowedByNonWhitespace = nextIsQuote && afterQuote && !/\s/.test(afterQuote) && afterQuote !== '\n';

      // Split if: next is whitespace (or end), AND NOT (quote followed by non-whitespace)
      if ((nextIsWhitespace || nextIsQuote) && !quoteFollowedByNonWhitespace) {
        // But include the quote if present before splitting
        if (nextIsQuote) {
          current += nextChar;
          i++; // Skip the quote in next iteration
        }
        sentences.push(current.trim());
        current = '';
      }
    }
  }

  // Add remaining text
  if (current.trim()) {
    sentences.push(current.trim());
  }

  return sentences.length > 0 ? sentences : [text];
}

/**
 * Split transformed text into same number of paragraphs as original
 */
function splitIntoSameParagraphs(text: string, targetCount: number): string[] {
  // First, try splitting by existing paragraph breaks
  let paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  // If we have the right number, we're done
  if (paragraphs.length === targetCount) {
    return paragraphs;
  }

  // If we have too few paragraphs, split by sentences
  if (paragraphs.length < targetCount) {
    const sentences = smartSentenceSplit(text);
    const sentencesPerPara = Math.ceil(sentences.length / targetCount);

    paragraphs = [];
    for (let i = 0; i < targetCount; i++) {
      const start = i * sentencesPerPara;
      const end = Math.min((i + 1) * sentencesPerPara, sentences.length);
      const paraSentences = sentences.slice(start, end);
      if (paraSentences.length > 0) {
        paragraphs.push(paraSentences.join(' ').trim());
      }
    }
  }

  // If we have too many paragraphs, merge smallest ones
  while (paragraphs.length > targetCount) {
    // Find the shortest paragraph
    let minIndex = 0;
    let minLength = paragraphs[0].length;
    for (let i = 1; i < paragraphs.length; i++) {
      if (paragraphs[i].length < minLength) {
        minLength = paragraphs[i].length;
        minIndex = i;
      }
    }

    // Merge with next paragraph (or previous if it's the last)
    if (minIndex < paragraphs.length - 1) {
      paragraphs[minIndex] = paragraphs[minIndex] + ' ' + paragraphs[minIndex + 1];
      paragraphs.splice(minIndex + 1, 1);
    } else {
      paragraphs[minIndex - 1] = paragraphs[minIndex - 1] + ' ' + paragraphs[minIndex];
      paragraphs.splice(minIndex, 1);
    }
  }

  return paragraphs;
}

/**
 * Restore list formatting to transformed text
 */
function restoreList(transformedText: string, listInfo: ListInfo): string {
  // Split transformed text into sentences/items
  const sentences = smartSentenceSplit(transformedText);

  // Try to split into same number of items as original
  const targetItemCount = listInfo.items.length;
  let items: string[] = [];

  if (sentences.length >= targetItemCount) {
    // Distribute sentences across items
    const sentencesPerItem = Math.ceil(sentences.length / targetItemCount);
    for (let i = 0; i < targetItemCount; i++) {
      const start = i * sentencesPerItem;
      const end = Math.min((i + 1) * sentencesPerItem, sentences.length);
      const itemSentences = sentences.slice(start, end);
      if (itemSentences.length > 0) {
        items.push(itemSentences.join(' ').trim());
      }
    }
  } else {
    // Fewer sentences than items - just use what we have
    items = sentences.map(s => s.trim());
  }

  // Apply list markers
  const formattedItems = items.map((item, index) => {
    if (listInfo.type === 'numbered') {
      return `${index + 1}. ${item}`;
    } else {
      return `${listInfo.marker}${item}`;
    }
  });

  return formattedItems.join('\n');
}

/**
 * Protected region marker for content that should not be analyzed
 * These will be replaced with placeholders during analysis
 */
interface ProtectedRegion {
  start: number;
  end: number;
  type: 'code-block' | 'inline-code' | 'latex-block' | 'latex-inline';
  content: string;
}

/**
 * Extract protected regions (code blocks and LaTeX) that should NOT be analyzed
 * Returns the regions sorted by start position
 */
export function extractProtectedRegions(text: string): ProtectedRegion[] {
  const regions: ProtectedRegion[] = [];

  // 1. Fenced code blocks (```...``` or ~~~...~~~)
  const fencedCodeRegex = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
  let match;
  while ((match = fencedCodeRegex.exec(text)) !== null) {
    regions.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'code-block',
      content: match[0]
    });
  }

  // 2. LaTeX display blocks: \[...\] and $$...$$
  const latexBlockRegex = /\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g;
  while ((match = latexBlockRegex.exec(text)) !== null) {
    // Check if this region overlaps with an existing one
    const overlaps = regions.some(r =>
      (match!.index >= r.start && match!.index < r.end) ||
      (match!.index + match![0].length > r.start && match!.index + match![0].length <= r.end)
    );
    if (!overlaps) {
      regions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'latex-block',
        content: match[0]
      });
    }
  }

  // 3. LaTeX inline: \(...\) and $...$  (but NOT $$ which is block)
  // Match $...$ but not $$...$$
  const latexInlineRegex = /\\\([\s\S]*?\\\)|\$(?!\$)([^$\n]+?)\$(?!\$)/g;
  while ((match = latexInlineRegex.exec(text)) !== null) {
    const overlaps = regions.some(r =>
      (match!.index >= r.start && match!.index < r.end) ||
      (match!.index + match![0].length > r.start && match!.index + match![0].length <= r.end)
    );
    if (!overlaps) {
      regions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'latex-inline',
        content: match[0]
      });
    }
  }

  // 4. Inline code (`...`) - but not fenced blocks
  const inlineCodeRegex = /`([^`\n]+?)`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    const overlaps = regions.some(r =>
      (match!.index >= r.start && match!.index < r.end) ||
      (match!.index + match![0].length > r.start && match!.index + match![0].length <= r.end)
    );
    if (!overlaps) {
      regions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'inline-code',
        content: match[0]
      });
    }
  }

  // Sort by start position
  return regions.sort((a, b) => a.start - b.start);
}

/**
 * Remove protected regions from text, replacing with placeholder markers
 * Returns the cleaned text and the regions for restoration
 */
export function stripProtectedRegions(text: string): {
  strippedText: string;
  regions: ProtectedRegion[];
  placeholderMap: Map<string, ProtectedRegion>;
} {
  const regions = extractProtectedRegions(text);
  const placeholderMap = new Map<string, ProtectedRegion>();

  if (regions.length === 0) {
    return { strippedText: text, regions: [], placeholderMap };
  }

  let result = '';
  let lastEnd = 0;

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    // Add text before this region
    result += text.slice(lastEnd, region.start);
    // Add placeholder (empty space to maintain some structure)
    const placeholder = ` `;  // Single space placeholder
    placeholderMap.set(`__PROTECTED_${i}__`, region);
    result += placeholder;
    lastEnd = region.end;
  }

  // Add remaining text
  result += text.slice(lastEnd);

  return { strippedText: result, regions, placeholderMap };
}

/**
 * Strip markdown formatting (bold, italic, etc.) but preserve structure
 * Keeps paragraph breaks and list markers
 * NOW: Also preserves code blocks and LaTeX - they are NOT stripped
 */
export function stripInlineMarkdown(text: string): string {
  // First, protect code blocks and LaTeX from being modified
  const { strippedText: textWithoutProtected, regions } = stripProtectedRegions(text);

  let stripped = textWithoutProtected;

  // Remove bold (**text** or __text__)
  stripped = stripped.replace(/\*\*(.+?)\*\*/g, '$1');
  stripped = stripped.replace(/__(.+?)__/g, '$1');

  // Remove italic (*text* or _text_)
  // Be careful not to match list markers (-)
  stripped = stripped.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '$1');
  stripped = stripped.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '$1');

  // Note: Inline code is now protected, but we keep this for any that slipped through
  // stripped = stripped.replace(/`([^`]+?)`/g, '$1');

  // Remove links ([text](url)) - keep just the text
  stripped = stripped.replace(/\[([^\]]+?)\]\([^)]+?\)/g, '$1');

  // Keep paragraph breaks and list markers intact
  return stripped;
}

/**
 * Create position mapping between original markdown and stripped text
 * Tracks where each character in stripped text came from in original text
 *
 * Uses multi-pass approach to handle nested markdown (e.g., **bold _italic_**)
 */
export function createPositionMap(originalMarkdown: string): PositionMapping[] {
  // Build position map by applying same transforms as stripInlineMarkdown()
  // Track cumulative offset as we remove markdown syntax

  let currentText = originalMarkdown;
  const offsetMap: number[] = new Array(originalMarkdown.length).fill(0).map((_, i) => i);

  // Helper to apply a regex replacement and update offset map
  const applyTransform = (regex: RegExp, openLen: number, closeLen?: number) => {
    let match;
    let searchPos = 0;
    const closingLen = closeLen ?? openLen; // Default to symmetric

    while ((match = regex.exec(currentText.slice(searchPos))) !== null) {
      const fullMatch = match[0];
      const innerText = match[1];
      const matchStart = searchPos + match.index;
      const matchEnd = matchStart + fullMatch.length;
      const removedLength = fullMatch.length - innerText.length;

      if (removedLength === 0) {
        searchPos = matchEnd;
        continue;
      }

      // Replace in current text
      currentText = currentText.slice(0, matchStart) + innerText + currentText.slice(matchEnd);

      // Remove offset entries for the opening markdown markers
      // The innerText entries remain, pointing to their original positions
      offsetMap.splice(matchStart, openLen);

      // Remove offset entries for the closing markdown markers
      // Position shifts after first splice, so adjust accordingly
      offsetMap.splice(matchStart + innerText.length, closingLen);

      // Continue search from end of replacement
      searchPos = matchStart + innerText.length;
      regex.lastIndex = 0; // Reset regex state
    }
  };

  // Apply transforms in same order as stripInlineMarkdown()
  applyTransform(/\*\*(.+?)\*\*/g, 2);               // Bold **text** (2+2)
  applyTransform(/__(.+?)__/g, 2);                   // Bold __text__ (2+2)
  applyTransform(/(?<!\w)\*([^*]+?)\*(?!\w)/g, 1);  // Italic *text* (1+1)
  applyTransform(/(?<!\w)_([^_]+?)_(?!\w)/g, 1);    // Italic _text_ (1+1)
  applyTransform(/`([^`]+?)`/g, 1);                  // Code `text` (1+1)

  // Links need special handling: [text](url) has asymmetric markers
  const linkRegex = /\[([^\]]+?)\]\([^)]+?\)/g;
  let linkMatch;
  let searchPos = 0;
  while ((linkMatch = linkRegex.exec(currentText.slice(searchPos))) !== null) {
    const fullMatch = linkMatch[0];
    const linkText = linkMatch[1];
    const matchStart = searchPos + linkMatch.index;
    const matchEnd = matchStart + fullMatch.length;

    // Replace in current text
    currentText = currentText.slice(0, matchStart) + linkText + currentText.slice(matchEnd);

    // Remove opening '[' (1 char)
    offsetMap.splice(matchStart, 1);

    // Remove closing '](url)' = fullMatch.length - linkText.length - 1
    const closingLen = fullMatch.length - linkText.length - 1;
    offsetMap.splice(matchStart + linkText.length, closingLen);

    // Continue search
    searchPos = matchStart + linkText.length;
    linkRegex.lastIndex = 0;
  }

  // Build final position mappings
  const mappings: PositionMapping[] = [];
  for (let strippedPos = 0; strippedPos < currentText.length; strippedPos++) {
    mappings.push({
      strippedPos,
      originalPos: offsetMap[strippedPos],
      markdownLength: 0,
      type: 'none'
    });
  }

  return mappings;
}

/**
 * Adjust highlight positions from stripped text to original markdown text
 * Returns adjusted positions that account for markdown syntax
 */
export function adjustHighlightPositions(
  highlights: HighlightRange[],
  positionMap: PositionMapping[]
): Array<{ start: number; end: number; reason: string }> {
  return highlights.map(highlight => {
    // Find mapping for start position
    const startMapping = positionMap.find(m => m.strippedPos === highlight.start) || positionMap[0];
    // Find mapping for end position
    const endMapping = positionMap.find(m => m.strippedPos === highlight.end - 1) || positionMap[positionMap.length - 1];

    return {
      start: startMapping.originalPos,
      end: endMapping.originalPos + 1, // +1 because end is exclusive
      reason: highlight.reason
    };
  });
}

/**
 * Apply highlight <mark> tags to original markdown text
 * Preserves markdown syntax around and within highlighted regions
 */
export function applyHighlightsToMarkdown(
  originalMarkdown: string,
  adjustedHighlights: Array<{ start: number; end: number; reason: string }>
): string {
  // Sort highlights by start position (reverse order for insertion)
  const sorted = [...adjustedHighlights].sort((a, b) => b.start - a.start);

  let result = originalMarkdown;

  for (const highlight of sorted) {
    const before = result.slice(0, highlight.start);
    const highlightedText = result.slice(highlight.start, highlight.end);
    const after = result.slice(highlight.end);

    // Wrap the text in <mark> tags with title attribute for reason
    result = `${before}<mark title="${highlight.reason}">${highlightedText}</mark>${after}`;
  }

  return result;
}
