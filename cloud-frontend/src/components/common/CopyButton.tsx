// CopyButton Component - Dual copy functionality (text + markdown)
// Used across all transformation panels for easy copy/paste

import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
  variant?: 'text' | 'markdown' | 'both';
  className?: string;
}

/**
 * CopyButton - Professional copy functionality with visual feedback
 *
 * @param text - The content to copy
 * @param label - Optional label (default: "Copy")
 * @param variant - 'text' (strips markdown), 'markdown' (raw), or 'both' (dual buttons)
 * @param className - Additional CSS classes
 */
export function CopyButton({ text, label = 'Copy', variant = 'both', className = '' }: CopyButtonProps) {
  const [copiedType, setCopiedType] = useState<'text' | 'markdown' | null>(null);

  const stripMarkdown = (content: string): string => {
    return content
      // Remove markdown headers
      .replace(/^#+\s+/gm, '')
      // Remove bold/italic
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleCopy = async (type: 'text' | 'markdown') => {
    try {
      const contentToCopy = type === 'text' ? stripMarkdown(text) : text;
      await navigator.clipboard.writeText(contentToCopy);

      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('[CopyButton] Failed to copy:', err);
    }
  };

  if (variant === 'both') {
    return (
      <div className={`copy-button-group ${className}`}>
        <button
          onClick={() => handleCopy('text')}
          className="copy-button copy-button-text"
          title="Copy as plain text (markdown stripped)"
        >
          {copiedType === 'text' ? '✓ Copied!' : '📄 Copy Text'}
        </button>
        <button
          onClick={() => handleCopy('markdown')}
          className="copy-button copy-button-markdown"
          title="Copy with markdown formatting"
        >
          {copiedType === 'markdown' ? '✓ Copied!' : '📝 Copy Markdown'}
        </button>
      </div>
    );
  }

  // Single button variant
  return (
    <button
      onClick={() => handleCopy(variant === 'markdown' ? 'markdown' : 'text')}
      className={`copy-button ${className}`}
      title={variant === 'markdown' ? 'Copy with markdown' : 'Copy as plain text'}
    >
      {copiedType ? '✓ Copied!' : `📋 ${label}`}
    </button>
  );
}
