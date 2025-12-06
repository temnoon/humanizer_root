/**
 * Block Markers Service
 *
 * Implements visible block markers for formatting preservation through
 * LLM transformations. Uses [BLOCK:type] markers that are:
 * - Visible in raw text (debuggable)
 * - Obvious when buggy (not silently broken)
 * - Easy to inspect without special tools
 *
 * @see /docs/PASSAGE_SYSTEM_SPEC_v1.1.md Section 2.3
 */

// ============================================================
// BLOCK TYPES
// ============================================================

export type BlockType =
  | 'p'       // Paragraph
  | 'h1'      // Heading 1
  | 'h2'      // Heading 2
  | 'h3'      // Heading 3
  | 'h4'      // Heading 4
  | 'h5'      // Heading 5
  | 'h6'      // Heading 6
  | 'ul'      // Unordered list
  | 'ol'      // Ordered list
  | 'li'      // List item
  | 'blockquote' // Block quote
  | 'code'    // Code block
  | 'pre'     // Preformatted text
  | 'hr'      // Horizontal rule
  | 'br'      // Line break
  | 'div'     // Generic container
  | 'section' // Section
  | 'article' // Article
  | 'header'  // Header
  | 'footer'; // Footer

// ============================================================
// BLOCK STRUCTURE
// ============================================================

export interface Block {
  /** Block type */
  type: BlockType;
  /** Block content (text or nested blocks) */
  content: string;
  /** Original position in source (character offset) */
  startOffset?: number;
  /** End position in source */
  endOffset?: number;
  /** Nested blocks (for lists, etc.) */
  children?: Block[];
  /** Code language (for code blocks) */
  language?: string;
  /** List item number (for ordered lists) */
  number?: number;
}

// ============================================================
// MARKER CONSTANTS
// ============================================================

const BLOCK_START = '[BLOCK:';
const BLOCK_END = '[/BLOCK]';
const BLOCK_CLOSE = ']';

// Regex patterns
const BLOCK_START_REGEX = /\[BLOCK:([a-z0-9]+)\]/gi;
const BLOCK_END_REGEX = /\[\/BLOCK\]/gi;
const FULL_BLOCK_REGEX = /\[BLOCK:([a-z0-9]+)\]([\s\S]*?)\[\/BLOCK\]/gi;

// ============================================================
// MARKDOWN TO BLOCKS PARSING
// ============================================================

/**
 * Parse markdown text into block structure
 */
export function parseMarkdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split('\n');

  let currentOffset = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines (but track offset)
    if (trimmedLine === '') {
      currentOffset += line.length + 1; // +1 for newline
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedLine)) {
      blocks.push({
        type: 'hr',
        content: '',
        startOffset: currentOffset,
      });
      currentOffset += line.length + 1;
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({
        type: `h${level}` as BlockType,
        content: headingMatch[2],
        startOffset: currentOffset,
      });
      currentOffset += line.length + 1;
      i++;
      continue;
    }

    // Code blocks (fenced)
    if (trimmedLine.startsWith('```')) {
      const language = trimmedLine.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      const startOffset = currentOffset;
      currentOffset += line.length + 1;
      i++;

      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        currentOffset += lines[i].length + 1;
        i++;
      }

      // Skip closing ```
      if (i < lines.length) {
        currentOffset += lines[i].length + 1;
        i++;
      }

      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        startOffset,
        language,
      });
      continue;
    }

    // Block quotes
    if (trimmedLine.startsWith('>')) {
      const quoteLines: string[] = [];
      const startOffset = currentOffset;

      while (i < lines.length && (lines[i].trim().startsWith('>') || lines[i].trim() === '')) {
        const quoteLine = lines[i].trim();
        if (quoteLine === '') {
          // Check if next non-empty line is still a quote
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j >= lines.length || !lines[j].trim().startsWith('>')) break;
        }
        quoteLines.push(quoteLine.replace(/^>\s?/, ''));
        currentOffset += lines[i].length + 1;
        i++;
      }

      blocks.push({
        type: 'blockquote',
        content: quoteLines.join('\n').trim(),
        startOffset,
      });
      continue;
    }

    // Unordered lists
    if (/^[-*+]\s+/.test(trimmedLine)) {
      const listItems: Block[] = [];
      const startOffset = currentOffset;

      while (i < lines.length) {
        const listLine = lines[i].trim();
        if (/^[-*+]\s+/.test(listLine)) {
          listItems.push({
            type: 'li',
            content: listLine.replace(/^[-*+]\s+/, ''),
            startOffset: currentOffset,
          });
          currentOffset += lines[i].length + 1;
          i++;
        } else if (listLine === '') {
          // Check if list continues after blank line
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j >= lines.length || !/^[-*+]\s+/.test(lines[j].trim())) break;
          currentOffset += lines[i].length + 1;
          i++;
        } else {
          break;
        }
      }

      blocks.push({
        type: 'ul',
        content: '',
        startOffset,
        children: listItems,
      });
      continue;
    }

    // Ordered lists
    if (/^\d+\.\s+/.test(trimmedLine)) {
      const listItems: Block[] = [];
      const startOffset = currentOffset;
      let itemNumber = 1;

      while (i < lines.length) {
        const listLine = lines[i].trim();
        const olMatch = listLine.match(/^(\d+)\.\s+(.+)$/);
        if (olMatch) {
          listItems.push({
            type: 'li',
            content: olMatch[2],
            startOffset: currentOffset,
            number: itemNumber++,
          });
          currentOffset += lines[i].length + 1;
          i++;
        } else if (listLine === '') {
          // Check if list continues
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j >= lines.length || !/^\d+\.\s+/.test(lines[j].trim())) break;
          currentOffset += lines[i].length + 1;
          i++;
        } else {
          break;
        }
      }

      blocks.push({
        type: 'ol',
        content: '',
        startOffset,
        children: listItems,
      });
      continue;
    }

    // Regular paragraph - collect consecutive non-empty lines
    const paragraphLines: string[] = [];
    const startOffset = currentOffset;

    while (i < lines.length) {
      const pLine = lines[i];
      const pTrimmed = pLine.trim();

      // Stop on blank line or special syntax
      if (
        pTrimmed === '' ||
        pTrimmed.startsWith('#') ||
        pTrimmed.startsWith('>') ||
        pTrimmed.startsWith('```') ||
        /^[-*+]\s+/.test(pTrimmed) ||
        /^\d+\.\s+/.test(pTrimmed) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(pTrimmed)
      ) {
        break;
      }

      paragraphLines.push(pTrimmed);
      currentOffset += pLine.length + 1;
      i++;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'p',
        content: paragraphLines.join(' '),
        startOffset,
      });
    }
  }

  return blocks;
}

// ============================================================
// BLOCKS TO MARKED TEXT
// ============================================================

/**
 * Convert blocks to marked text (for LLM processing)
 */
export function blocksToMarkedText(blocks: Block[]): string {
  return blocks
    .map(block => blockToMarkedText(block))
    .join('\n\n');
}

function blockToMarkedText(block: Block): string {
  const { type, content, children, language } = block;

  // Handle nested blocks (lists)
  if (children && children.length > 0) {
    const childText = children
      .map(child => blockToMarkedText(child))
      .join('\n');
    return `${BLOCK_START}${type}${BLOCK_CLOSE}\n${childText}\n${BLOCK_END}`;
  }

  // Code blocks need special handling for language
  if (type === 'code' && language) {
    return `${BLOCK_START}${type}:${language}${BLOCK_CLOSE}${content}${BLOCK_END}`;
  }

  // Simple blocks
  return `${BLOCK_START}${type}${BLOCK_CLOSE}${content}${BLOCK_END}`;
}

// ============================================================
// MARKED TEXT TO BLOCKS
// ============================================================

/**
 * Parse marked text back into block structure
 */
export function parseMarkedText(markedText: string): Block[] {
  const blocks: Block[] = [];
  let remaining = markedText.trim();

  while (remaining.length > 0) {
    // Look for block start
    const startMatch = remaining.match(/^\[BLOCK:([a-z0-9:]+)\]/i);
    if (!startMatch) {
      // No more blocks - treat rest as plain text paragraph
      if (remaining.trim()) {
        blocks.push({ type: 'p', content: remaining.trim() });
      }
      break;
    }

    const fullType = startMatch[1].toLowerCase();
    const [type, language] = fullType.split(':') as [BlockType, string | undefined];
    remaining = remaining.slice(startMatch[0].length);

    // Find matching end
    let depth = 1;
    let content = '';
    let pos = 0;

    while (pos < remaining.length && depth > 0) {
      // Check for nested block start
      if (remaining.slice(pos).match(/^\[BLOCK:/i)) {
        depth++;
        const nextStart = remaining.slice(pos).match(/^\[BLOCK:[a-z0-9:]+\]/i);
        if (nextStart) {
          content += nextStart[0];
          pos += nextStart[0].length;
          continue;
        }
      }

      // Check for block end
      if (remaining.slice(pos).match(/^\[\/BLOCK\]/i)) {
        depth--;
        if (depth === 0) {
          pos += 8; // [/BLOCK]
          break;
        }
        content += BLOCK_END;
        pos += 8;
        continue;
      }

      content += remaining[pos];
      pos++;
    }

    remaining = remaining.slice(pos).trim();

    // Parse nested content for container blocks (lists, divs)
    // Note: blockquote has plain text content in our format, not nested blocks
    if (['ul', 'ol', 'div', 'section', 'article'].includes(type)) {
      const children = parseMarkedText(content.trim());
      blocks.push({
        type,
        content: '',
        children: children.length > 0 ? children : undefined,
      });
    } else {
      blocks.push({
        type,
        content: content.trim(),
        language,
      });
    }
  }

  return blocks;
}

// ============================================================
// BLOCKS TO MARKDOWN
// ============================================================

/**
 * Convert blocks back to markdown format
 */
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map(block => blockToMarkdown(block))
    .filter(Boolean)
    .join('\n\n');
}

function blockToMarkdown(block: Block): string {
  const { type, content, children, language, number } = block;

  switch (type) {
    case 'p':
      return content;

    case 'h1':
      return `# ${content}`;
    case 'h2':
      return `## ${content}`;
    case 'h3':
      return `### ${content}`;
    case 'h4':
      return `#### ${content}`;
    case 'h5':
      return `##### ${content}`;
    case 'h6':
      return `###### ${content}`;

    case 'hr':
      return '---';

    case 'code':
      return `\`\`\`${language || ''}\n${content}\n\`\`\``;

    case 'blockquote':
      return content.split('\n').map(line => `> ${line}`).join('\n');

    case 'ul':
      if (children) {
        return children.map(child => `- ${child.content}`).join('\n');
      }
      return content;

    case 'ol':
      if (children) {
        return children.map((child, i) => `${child.number || i + 1}. ${child.content}`).join('\n');
      }
      return content;

    case 'li':
      return number ? `${number}. ${content}` : `- ${content}`;

    case 'br':
      return '\n';

    case 'pre':
      return `\`\`\`\n${content}\n\`\`\``;

    case 'div':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
      if (children) {
        return blocksToMarkdown(children);
      }
      return content;

    default:
      return content;
  }
}

// ============================================================
// HIGH-LEVEL API
// ============================================================

/**
 * Insert block markers into markdown text
 * (Main entry point for preparing text for LLM transformation)
 */
export function insertBlockMarkers(markdown: string): string {
  const blocks = parseMarkdownToBlocks(markdown);
  return blocksToMarkedText(blocks);
}

/**
 * Strip block markers and restore markdown formatting
 * (Main entry point for post-processing LLM output)
 */
export function stripBlockMarkers(markedText: string): string {
  const blocks = parseMarkedText(markedText);
  return blocksToMarkdown(blocks);
}

/**
 * Check if text contains block markers
 */
export function hasBlockMarkers(text: string): boolean {
  return BLOCK_START_REGEX.test(text) || BLOCK_END_REGEX.test(text);
}

/**
 * Count blocks in marked text
 */
export function countBlocks(markedText: string): number {
  const matches = markedText.match(BLOCK_START_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Validate marked text structure
 * Returns true if markers are balanced, false otherwise
 */
export function validateMarkedText(markedText: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let depth = 0;
  let pos = 0;

  while (pos < markedText.length) {
    const startMatch = markedText.slice(pos).match(/^\[BLOCK:[a-z0-9:]+\]/i);
    if (startMatch) {
      depth++;
      pos += startMatch[0].length;
      continue;
    }

    const endMatch = markedText.slice(pos).match(/^\[\/BLOCK\]/i);
    if (endMatch) {
      depth--;
      if (depth < 0) {
        errors.push(`Unexpected [/BLOCK] at position ${pos}`);
      }
      pos += endMatch[0].length;
      continue;
    }

    pos++;
  }

  if (depth > 0) {
    errors.push(`Missing ${depth} closing [/BLOCK] marker(s)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// PLAIN TEXT UTILITIES
// ============================================================

/**
 * Extract plain text from marked text (for word count, etc.)
 */
export function extractPlainText(markedText: string): string {
  return markedText
    .replace(BLOCK_START_REGEX, '')
    .replace(BLOCK_END_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Create a simple paragraph-marked text from plain text
 * (splits on double newlines, wraps each chunk in [BLOCK:p])
 */
export function markParagraphs(plainText: string): string {
  const paragraphs = plainText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  return paragraphs
    .map(p => `${BLOCK_START}p${BLOCK_CLOSE}${p}${BLOCK_END}`)
    .join('\n\n');
}

// ============================================================
// LLM PROMPT HELPERS
// ============================================================

/**
 * Generate instruction text for LLM about block markers
 */
export function getBlockMarkerInstructions(): string {
  return `
This text uses [BLOCK:type] markers to preserve structure.
IMPORTANT: You MUST preserve these markers exactly in your output.

Rules:
1. Keep all [BLOCK:type] and [/BLOCK] markers in place
2. Only modify the text INSIDE the markers
3. Do not add, remove, or change the markers themselves
4. Maintain the same block structure

Example:
Input:  [BLOCK:p]Original paragraph text.[/BLOCK]
Output: [BLOCK:p]Transformed paragraph text.[/BLOCK]

Block types include: p (paragraph), h1-h6 (headings), ul/ol/li (lists), blockquote, code
`.trim();
}
