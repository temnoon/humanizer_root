/**
 * VerseContainer Component
 *
 * Specialized container for poetry and verse formatting.
 */

import type { ReactNode } from 'react';

interface VerseLineProps {
  /** Line content */
  children: ReactNode;

  /** Indentation level (0-3) */
  indent?: 0 | 1 | 2 | 3;

  /** Additional className */
  className?: string;
}

export function VerseLine({ children, indent = 0, className = '' }: VerseLineProps) {
  const lineClasses = [
    'verse-line',
    indent > 0 && `verse-line--indent-${indent}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={lineClasses}>{children}</span>;
}

interface VerseStanzaProps {
  /** Lines of the stanza */
  children: ReactNode;

  /** Additional className */
  className?: string;
}

export function VerseStanza({ children, className = '' }: VerseStanzaProps) {
  return <div className={`verse-stanza ${className}`}>{children}</div>;
}

interface VerseContainerProps {
  /** Verse content (stanzas and lines) */
  children: ReactNode;

  /** Center the text */
  centered?: boolean;

  /** Title of the poem */
  title?: string;

  /** Attribution/author */
  attribution?: string;

  /** Additional className */
  className?: string;
}

export function VerseContainer({
  children,
  centered = false,
  title,
  attribution,
  className = '',
}: VerseContainerProps) {
  const containerClasses = [
    'verse-container',
    centered && 'verse-container--centered',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {title && <h3 className="verse-container__title">{title}</h3>}
      {children}
      {attribution && <footer className="verse-container__attribution">— {attribution}</footer>}
    </div>
  );
}

/**
 * Parse text into verse lines and stanzas
 */
export function parseVerse(text: string): { stanzas: string[][] } {
  const lines = text.split('\n');
  const stanzas: string[][] = [];
  let currentStanza: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') {
      if (currentStanza.length > 0) {
        stanzas.push(currentStanza);
        currentStanza = [];
      }
    } else {
      currentStanza.push(line);
    }
  }

  if (currentStanza.length > 0) {
    stanzas.push(currentStanza);
  }

  return { stanzas };
}

/**
 * Render parsed verse
 */
interface VerseRendererProps {
  text: string;
  title?: string;
  attribution?: string;
  centered?: boolean;
  className?: string;
}

export function VerseRenderer({
  text,
  title,
  attribution,
  centered = false,
  className = '',
}: VerseRendererProps) {
  const { stanzas } = parseVerse(text);

  return (
    <VerseContainer title={title} attribution={attribution} centered={centered} className={className}>
      {stanzas.map((stanza, i) => (
        <VerseStanza key={`stanza-${i}`}>
          {stanza.map((line, j) => {
            // Detect indentation from leading spaces
            const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
            const indent = Math.min(3, Math.floor(leadingSpaces / 2)) as 0 | 1 | 2 | 3;

            return (
              <VerseLine key={`line-${i}-${j}`} indent={indent}>
                {line.trim()}
              </VerseLine>
            );
          })}
        </VerseStanza>
      ))}
    </VerseContainer>
  );
}

export default VerseContainer;
