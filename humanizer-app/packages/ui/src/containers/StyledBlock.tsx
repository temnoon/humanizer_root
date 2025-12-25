/**
 * StyledBlock Components
 *
 * Decorative containers for content with various styling options.
 */

import type { ReactNode } from 'react';

type BlockVariant = 'default' | 'quote' | 'callout' | 'emphasis' | 'curator' | 'source';

interface StyledBlockProps {
  /** Block style variant */
  variant?: BlockVariant;

  /** Block content */
  children: ReactNode;

  /** Additional className */
  className?: string;
}

export function StyledBlock({
  variant = 'default',
  children,
  className = '',
}: StyledBlockProps) {
  const blockClasses = [
    'styled-block',
    variant !== 'default' && `styled-block--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={blockClasses}>{children}</div>;
}

/**
 * Quote block with optional attribution
 */
interface QuoteBlockProps {
  children: ReactNode;
  attribution?: string;
  className?: string;
}

export function QuoteBlock({ children, attribution, className = '' }: QuoteBlockProps) {
  return (
    <StyledBlock variant="quote" className={className}>
      {children}
      {attribution && (
        <footer style={{ marginTop: 'var(--space-small)', fontStyle: 'normal' }}>
          — {attribution}
        </footer>
      )}
    </StyledBlock>
  );
}

/**
 * Callout block for important notes
 */
interface CalloutBlockProps {
  children: ReactNode;
  icon?: string;
  className?: string;
}

export function CalloutBlock({ children, icon, className = '' }: CalloutBlockProps) {
  return (
    <StyledBlock variant="callout" className={className}>
      {children}
    </StyledBlock>
  );
}

/**
 * Pull quote - large emphasized quote
 */
interface PullQuoteProps {
  children: ReactNode;
  attribution?: string;
  className?: string;
}

export function PullQuote({ children, attribution, className = '' }: PullQuoteProps) {
  return (
    <blockquote className={`pull-quote ${className}`}>
      {children}
      {attribution && <cite className="pull-quote__attribution">{attribution}</cite>}
    </blockquote>
  );
}

/**
 * Drop cap paragraph
 */
interface DropCapProps {
  children: ReactNode;
  className?: string;
}

export function DropCap({ children, className = '' }: DropCapProps) {
  return <p className={`drop-cap ${className}`}>{children}</p>;
}

export default StyledBlock;
