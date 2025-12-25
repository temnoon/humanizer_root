/**
 * Marginalia Components
 *
 * Side notes and annotations alongside main content.
 */

import type { ReactNode } from 'react';

interface MarginaliaNoteProps {
  /** Note content */
  children: ReactNode;

  /** Highlight the note */
  highlight?: boolean;

  /** Position relative to content (for reference) */
  anchorId?: string;

  /** Additional className */
  className?: string;
}

export function MarginaliaNote({
  children,
  highlight = false,
  anchorId,
  className = '',
}: MarginaliaNoteProps) {
  const noteClasses = [
    'marginalia-note',
    highlight && 'marginalia-note--highlight',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={noteClasses} data-anchor={anchorId}>
      {children}
    </aside>
  );
}

interface MarginaliaContainerProps {
  /** Main content */
  children: ReactNode;

  /** Side notes to display */
  notes?: ReactNode;

  /** Position of marginalia (right or left) */
  position?: 'right' | 'left';

  /** Additional className */
  className?: string;
}

export function MarginaliaContainer({
  children,
  notes,
  position = 'right',
  className = '',
}: MarginaliaContainerProps) {
  const containerClasses = [
    'marginalia-container',
    position === 'left' && 'marginalia-container--left',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (position === 'left') {
    return (
      <div className={containerClasses}>
        <div className="marginalia-container__notes">{notes}</div>
        <div className="marginalia-container__content">{children}</div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="marginalia-container__content">{children}</div>
      <div className="marginalia-container__notes">{notes}</div>
    </div>
  );
}

/**
 * Inline sidenote reference (like a footnote marker)
 */
interface SidenoteRefProps {
  /** Note number or symbol */
  marker: string | number;

  /** Associated note ID */
  noteId: string;

  /** Additional className */
  className?: string;
}

export function SidenoteRef({ marker, noteId, className = '' }: SidenoteRefProps) {
  return (
    <sup className={`sidenote-ref ${className}`}>
      <a href={`#${noteId}`} aria-describedby={noteId}>
        {marker}
      </a>
    </sup>
  );
}

export default MarginaliaContainer;
