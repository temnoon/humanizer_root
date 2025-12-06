/**
 * Block Markers for Format Preservation
 *
 * Wraps markdown structures in visible markers that survive LLM processing.
 * Format: [BLOCK:type]content[/BLOCK]
 */

export type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'ul' | 'ol' | 'li' | 'blockquote' | 'code' | 'hr';

export interface Block {
  type: BlockType;
  content: string;
  language?: string;
  children?: Block[];
}

/**
 * Parse markdown into blocks
 */
export function parseMarkdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') { i++; continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr', content: '' });
      i++; continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1|2|3|4|5|6;
      blocks.push({ type: `h${level}` as BlockType, content: headingMatch[2] });
      i++; continue;
    }

    // Code blocks
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', content: codeLines.join('\n'), language });
      continue;
    }

    // Block quotes
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // Unordered lists
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: Block[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push({ type: 'li', content: lines[i].trim().replace(/^[-*+]\s+/, '') });
        i++;
      }
      blocks.push({ type: 'ul', content: '', children: items });
      continue;
    }

    // Ordered lists
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: Block[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push({ type: 'li', content: lines[i].trim().replace(/^\d+\.\s+/, '') });
        i++;
      }
      blocks.push({ type: 'ol', content: '', children: items });
      continue;
    }

    // Paragraph - collect consecutive non-special lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i].trim();
      if (pLine === '' || pLine.startsWith('#') || pLine.startsWith('>') ||
          pLine.startsWith('```') || /^[-*+]\s+/.test(pLine) || /^\d+\.\s+/.test(pLine) ||
          /^(-{3,}|\*{3,}|_{3,})$/.test(pLine)) {
        break;
      }
      paraLines.push(pLine);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'p', content: paraLines.join(' ') });
    }
  }

  return blocks;
}

/**
 * Convert blocks to marked text
 */
export function blocksToMarkedText(blocks: Block[]): string {
  return blocks.map(block => {
    if (block.children && block.children.length > 0) {
      const childText = block.children.map(c => `[BLOCK:li]${c.content}[/BLOCK]`).join('\n');
      return `[BLOCK:${block.type}]\n${childText}\n[/BLOCK]`;
    }
    if (block.type === 'code' && block.language) {
      return `[BLOCK:code:${block.language}]${block.content}[/BLOCK]`;
    }
    return `[BLOCK:${block.type}]${block.content}[/BLOCK]`;
  }).join('\n\n');
}

/**
 * Parse marked text back to blocks
 */
export function parseMarkedText(markedText: string): Block[] {
  const blocks: Block[] = [];
  let remaining = markedText.trim();

  while (remaining.length > 0) {
    const startMatch = remaining.match(/^\[BLOCK:([a-z0-9:]+)\]/i);
    if (!startMatch) {
      if (remaining.trim()) {
        blocks.push({ type: 'p', content: remaining.trim() });
      }
      break;
    }

    const fullType = startMatch[1].toLowerCase();
    const [type, language] = fullType.split(':') as [BlockType, string | undefined];
    remaining = remaining.slice(startMatch[0].length);

    // Find matching end
    let depth = 1, content = '', pos = 0;
    while (pos < remaining.length && depth > 0) {
      if (remaining.slice(pos).match(/^\[BLOCK:/i)) {
        depth++;
        const next = remaining.slice(pos).match(/^\[BLOCK:[a-z0-9:]+\]/i);
        if (next) { content += next[0]; pos += next[0].length; continue; }
      }
      if (remaining.slice(pos).match(/^\[\/BLOCK\]/i)) {
        depth--;
        if (depth === 0) { pos += 8; break; }
        content += '[/BLOCK]'; pos += 8; continue;
      }
      content += remaining[pos]; pos++;
    }
    remaining = remaining.slice(pos).trim();

    // Parse nested content for lists
    if (['ul', 'ol'].includes(type)) {
      const children = parseMarkedText(content.trim());
      blocks.push({ type, content: '', children: children.length > 0 ? children : undefined });
    } else {
      blocks.push({ type, content: content.trim(), language });
    }
  }

  return blocks;
}

/**
 * Convert blocks back to markdown
 */
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'p': return block.content;
      case 'h1': return `# ${block.content}`;
      case 'h2': return `## ${block.content}`;
      case 'h3': return `### ${block.content}`;
      case 'h4': return `#### ${block.content}`;
      case 'h5': return `##### ${block.content}`;
      case 'h6': return `###### ${block.content}`;
      case 'hr': return '---';
      case 'code': return `\`\`\`${block.language || ''}\n${block.content}\n\`\`\``;
      case 'blockquote': return block.content.split('\n').map(l => `> ${l}`).join('\n');
      case 'ul': return block.children?.map(c => `- ${c.content}`).join('\n') || block.content;
      case 'ol': return block.children?.map((c, i) => `${i + 1}. ${c.content}`).join('\n') || block.content;
      case 'li': return `- ${block.content}`;
      default: return block.content;
    }
  }).filter(Boolean).join('\n\n');
}

/**
 * Insert block markers into markdown (main entry point)
 */
export function insertBlockMarkers(markdown: string): string {
  const blocks = parseMarkdownToBlocks(markdown);
  return blocksToMarkedText(blocks);
}

/**
 * Strip block markers and restore markdown (main entry point)
 */
export function stripBlockMarkers(markedText: string): string {
  const blocks = parseMarkedText(markedText);
  return blocksToMarkdown(blocks);
}

/**
 * Check if text has block markers
 */
export function hasBlockMarkers(text: string): boolean {
  return /\[BLOCK:[a-z0-9:]+\]/i.test(text);
}

/**
 * LLM instructions for preserving block markers
 */
export function getBlockMarkerInstructions(): string {
  return `IMPORTANT: This text uses [BLOCK:type] markers to preserve formatting.
You MUST keep all [BLOCK:type] and [/BLOCK] markers in place.
Only modify the text INSIDE the markers. Do not add, remove, or change markers.
Block types: p (paragraph), h1-h6 (headings), ul/ol/li (lists), blockquote, code.`;
}
