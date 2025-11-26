import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { useTextSize } from '../../contexts/TextSizeContext';
import type { MediaManifest } from '../../types';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  // Optional media manifest for file-id rewriting
  mediaManifest?: MediaManifest;
  // Base URL for media files (e.g., /api/conversations/{id}/media/)
  mediaBaseUrl?: string;
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

export function MarkdownRenderer({ content, className = '', mediaManifest, mediaBaseUrl }: MarkdownRendererProps) {
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
