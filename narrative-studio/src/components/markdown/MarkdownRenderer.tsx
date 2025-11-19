import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { useTextSize } from '../../contexts/TextSizeContext';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
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

  // Replace [AUDIO:url] markers with HTML audio players
  formattedContent = formattedContent.replace(/\[AUDIO:([^\]]+)\]/g, (match, url) => {
    return `<audio controls src="${url}" style="width: 100%; max-width: 500px; margin: 1rem 0;"></audio>`;
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
