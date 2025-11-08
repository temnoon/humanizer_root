import { useState } from 'react';

interface CopyButtonsProps {
  markdownContent: string;
  label?: string;
}

/**
 * Dual copy buttons for markdown content:
 * - Copy Text: Plain text without markdown formatting
 * - Copy Markdown: Raw markdown source
 *
 * Buttons are sticky-positioned to stay at top while scrolling
 */
export default function CopyButtons({ markdownContent, label }: CopyButtonsProps) {
  const [copiedState, setCopiedState] = useState<'text' | 'markdown' | null>(null);

  // Strip markdown to plain text
  const stripMarkdown = (markdown: string): string => {
    let text = markdown;

    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]+`/g, '');

    // Remove images: ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

    // Remove links: [text](url) -> text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove headings: ### Heading -> Heading
    text = text.replace(/^#+\s+(.+)$/gm, '$1');

    // Remove bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');

    // Remove italic: *text* or _text_
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/_([^_]+)_/g, '$1');

    // Remove blockquotes: > text
    text = text.replace(/^>\s+/gm, '');

    // Remove horizontal rules
    text = text.replace(/^---+$/gm, '');
    text = text.replace(/^___+$/gm, '');
    text = text.replace(/^\*\*\*+$/gm, '');

    // Remove list markers: - item or * item or 1. item
    text = text.replace(/^[\s]*[-*+]\s+/gm, '');
    text = text.replace(/^[\s]*\d+\.\s+/gm, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Clean up extra whitespace (but preserve single line breaks for paragraphs)
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  };

  const copyToClipboard = async (content: string, type: 'text' | 'markdown') => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedState(type);
      setTimeout(() => setCopiedState(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyText = () => {
    const plainText = stripMarkdown(markdownContent);
    copyToClipboard(plainText, 'text');
  };

  const handleCopyMarkdown = () => {
    copyToClipboard(markdownContent, 'markdown');
  };

  return (
    <div
      className="copy-button-group"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-md)'
      }}
    >
      {label && (
        <span style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-tertiary)',
          fontWeight: 500,
          marginRight: 'var(--spacing-sm)'
        }}>
          {label}
        </span>
      )}

      <button
        onClick={handleCopyText}
        className="copy-button copy-button-text"
        title="Copy as plain text (no formatting)"
      >
        {copiedState === 'text' ? '✓ Copied!' : '📄 Copy Text'}
      </button>

      <button
        onClick={handleCopyMarkdown}
        className="copy-button copy-button-markdown"
        title="Copy raw markdown source"
      >
        {copiedState === 'markdown' ? '✓ Copied!' : '📝 Copy Markdown'}
      </button>
    </div>
  );
}
