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

  // Convert ChatGPT-style LaTeX delimiters to standard $ delimiters
  // ChatGPT uses \(...\) for inline and \[...\] for display
  // remarkMath expects $...$ for inline and $$...$$ for display
  const processedContent = content
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');

  return (
    <div className={`markdown-content text-${textSize} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
