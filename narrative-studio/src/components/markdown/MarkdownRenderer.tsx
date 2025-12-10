import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { useTextSize } from '../../contexts/TextSizeContext';
import type { MediaManifest } from '../../types';

// Highlight range type - supports both position-based and text-based matching
export interface HighlightRange {
  start: number;
  end: number;
  reason: string;
  type?: 'tellword' | 'suspect' | 'gptzero';
  // Optional: the actual sentence text for text-based matching
  text?: string;
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  // Optional media manifest for file-id rewriting
  mediaManifest?: MediaManifest;
  // Base URL for media files (e.g., /api/conversations/{id}/media/)
  mediaBaseUrl?: string;
  // Optional highlights to apply BEFORE rendering (inserted as HTML into markdown)
  highlights?: HighlightRange[];
}

/**
 * Rewrite file-service://, sediment://, and file-ID references to actual URLs
 */
function rewriteMediaUrls(
  content: string,
  manifest: MediaManifest | undefined,
  baseUrl: string | undefined
): string {
  if (!manifest || !baseUrl) return content;

  let result = content;

  // Pattern 1: Replace file-service://file-ABC123 with actual URL
  // Matches: ![alt](file-service://file-ABC123) or src="file-service://file-ABC123"
  result = result.replace(
    /file-service:\/\/(file-[A-Za-z0-9]+)/g,
    (match, fileId) => {
      const filename = manifest.fileIds[fileId] || manifest.assetPointers[`file-service://${fileId}`];
      if (filename) {
        return `${baseUrl}${filename}`;
      }
      return match; // Keep original if no mapping found
    }
  );

  // Pattern 2: Replace sediment://file_abc123def-uuid with actual URL
  result = result.replace(
    /sediment:\/\/(file_[a-f0-9]{32})-[a-f0-9-]+/g,
    (match, fileHash) => {
      const filename = manifest.fileHashes[fileHash] || manifest.assetPointers[match];
      if (filename) {
        return `${baseUrl}${filename}`;
      }
      return match;
    }
  );

  // Pattern 3: Replace full file-service://... URLs with actual URL
  result = result.replace(
    /file-service:\/\/[^\s\)"'>]+/g,
    (match) => {
      const filename = manifest.assetPointers[match];
      if (filename) {
        return `${baseUrl}${filename}`;
      }
      return match;
    }
  );

  // Pattern 4: Replace sandbox:/ URLs (DALL-E generations)
  result = result.replace(
    /sandbox:\/mnt\/data\/([^\s\)"'>]+)/g,
    (match, filename) => {
      const hashedFilename = manifest.files[filename];
      if (hashedFilename) {
        return `${baseUrl}${hashedFilename}`;
      }
      return match;
    }
  );

  return result;
}

/**
 * Find a sentence in markdown by matching word tokens.
 * This handles cases where GPTZero returns plain text but the source has markdown.
 * For example: sentence="This is bold text" matches markdown="This is **bold** text"
 */
function findSentenceInMarkdown(sentence: string, markdown: string): { start: number; end: number } | null {
  // Extract words from the sentence (handles contractions like "don't")
  const sentenceWords = sentence.match(/\b[\w']+\b/g);
  if (!sentenceWords || sentenceWords.length < 2) return null; // Need at least 2 words

  const firstWord = sentenceWords[0].toLowerCase();
  let searchPos = 0;
  const lowerMd = markdown.toLowerCase();

  while (searchPos < markdown.length) {
    // Find first word in markdown
    const firstIdx = lowerMd.indexOf(firstWord, searchPos);
    if (firstIdx < 0) return null;

    // Check word boundary before match (not in middle of another word)
    if (firstIdx > 0 && /\w/.test(markdown[firstIdx - 1])) {
      searchPos = firstIdx + 1;
      continue;
    }

    // Check word boundary after first word
    const afterFirst = firstIdx + firstWord.length;
    if (afterFirst < markdown.length && /\w/.test(markdown[afterFirst])) {
      searchPos = firstIdx + 1;
      continue;
    }

    // Try to match remaining words from this position
    let mdPos = afterFirst;
    let matched = true;
    let lastMatchEnd = afterFirst;

    for (let i = 1; i < sentenceWords.length; i++) {
      const word = sentenceWords[i].toLowerCase();

      // Skip non-word chars in markdown (including markdown syntax like * _ [ ] etc)
      // But don't skip too far - max 50 chars to avoid matching across paragraphs
      let skipped = 0;
      while (mdPos < markdown.length && !/[a-zA-Z0-9]/.test(markdown[mdPos]) && skipped < 50) {
        mdPos++;
        skipped++;
      }

      if (skipped >= 50 || mdPos >= markdown.length) {
        matched = false;
        break;
      }

      // Find where the word ends
      let wordEnd = mdPos;
      while (wordEnd < markdown.length && /[\w']/.test(markdown[wordEnd])) {
        wordEnd++;
      }

      // Check if word matches
      const mdWord = markdown.slice(mdPos, wordEnd).toLowerCase();

      if (mdWord === word) {
        lastMatchEnd = wordEnd;
        mdPos = wordEnd;
      } else {
        matched = false;
        break;
      }
    }

    if (matched) {
      // Found the sentence! Expand to include trailing punctuation
      let end = lastMatchEnd;
      while (end < markdown.length && /[.,!?;:)\]"'—]/.test(markdown[end])) {
        end++;
      }
      return { start: firstIdx, end };
    }

    searchPos = firstIdx + 1;
  }

  return null;
}

/**
 * Apply highlights to markdown source by inserting <mark> tags.
 * Uses word-token matching to find sentences even when markdown formatting differs.
 * Works with rehype-raw to preserve the HTML in the final output.
 */
function applyHighlightsToMarkdown(
  markdown: string,
  highlights: HighlightRange[],
  originalContent: string
): string {
  if (!highlights || highlights.length === 0) return markdown;

  // Build matches with positions
  const matches: Array<{ start: number; end: number; type: string; reason: string }> = [];
  const usedPositions = new Set<string>();

  for (const h of highlights) {
    // Get the sentence text - either from text property or slice from original content
    const sentence = h.text || originalContent.slice(h.start, h.end);
    if (!sentence || sentence.trim().length < 10) continue;

    const match = findSentenceInMarkdown(sentence.trim(), markdown);
    if (match) {
      // Create a key to avoid duplicate matches at same position
      const posKey = `${match.start}-${match.end}`;
      if (usedPositions.has(posKey)) continue;

      // Check for overlaps with existing matches
      const overlaps = matches.some(m =>
        (match.start >= m.start && match.start < m.end) ||
        (match.end > m.start && match.end <= m.end) ||
        (match.start <= m.start && match.end >= m.end)
      );

      if (!overlaps) {
        matches.push({
          start: match.start,
          end: match.end,
          type: h.type || 'gptzero',
          reason: h.reason
        });
        usedPositions.add(posKey);
      }
    }
  }

  if (matches.length === 0) return markdown;

  // Sort by start position descending (insert from end to preserve positions)
  matches.sort((a, b) => b.start - a.start);

  let result = markdown;
  for (const m of matches) {
    const before = result.slice(0, m.start);
    const text = result.slice(m.start, m.end);
    const after = result.slice(m.end);

    // Escape reason for title attribute
    const escapedReason = m.reason
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    result = `${before}<mark class="ai-highlight-${m.type}" title="${escapedReason}">${text}</mark>${after}`;
  }

  return result;
}

export function MarkdownRenderer({ content, className = '', mediaManifest, mediaBaseUrl, highlights }: MarkdownRendererProps) {
  const { textSize } = useTextSize();

  // Safety check for undefined/null content
  if (!content) {
    return <div className={className}>No content available</div>;
  }

  // Format DALL-E prompts and document transcripts (extract from JSON)
  let formattedContent = content;
  if (content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);

      // Handle DALL-E prompts
      if (parsed.prompt) {
        formattedContent = `**Prompt:**\n\n${parsed.prompt}`;
      }
      // Handle document transcripts (e.g., audio transcriptions, image text extraction)
      else if (parsed.content && typeof parsed.content === 'string') {
        formattedContent = parsed.content;
      }
    } catch (e) {
      // Not valid JSON, use original content
    }
  }

  // Rewrite media URLs using manifest (file-service://, sediment://, etc.)
  formattedContent = rewriteMediaUrls(formattedContent, mediaManifest, mediaBaseUrl);

  // Replace [AUDIO:url] markers with HTML audio players
  formattedContent = formattedContent.replace(/\[AUDIO:([^\]]+)\]/g, (match, url) => {
    return `<audio controls src="${url}" style="width: 100%; max-width: 500px; margin: 1rem 0;"></audio>`;
  });

  // Replace [IMAGE:...] markers with img tags (for images extracted from multimodal content)
  formattedContent = formattedContent.replace(/\[IMAGE:([^\]]+)\]/g, (match, url) => {
    // Try to rewrite the URL if it's a file-service or sediment URL
    let imgSrc = url;
    if (mediaManifest && mediaBaseUrl) {
      const rewritten = rewriteMediaUrls(url, mediaManifest, mediaBaseUrl);
      if (rewritten !== url) {
        imgSrc = rewritten;
      }
    }
    return `<img src="${imgSrc}" alt="Uploaded image" style="max-width: 100%; height: auto; margin: 1rem 0; border-radius: 8px;" />`;
  });

  // Apply AI highlights BEFORE markdown processing
  // This inserts <mark> tags that rehype-raw will preserve
  if (highlights && highlights.length > 0) {
    formattedContent = applyHighlightsToMarkdown(formattedContent, highlights, content);
  }

  // Convert ChatGPT-style LaTeX delimiters to standard $ delimiters
  // ChatGPT uses \(...\) for inline and \[...\] for display
  // remarkMath expects $...$ for inline and $$...$$ for display
  const processedContent = formattedContent
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');

  return (
    <div className={`markdown-content text-${textSize} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [rehypeKatex, { strict: false, trust: true }],
          rehypeHighlight,
          rehypeRaw
        ]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
