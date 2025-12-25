/**
 * DingbatFrame Component
 *
 * Decorative frames with typographic ornaments.
 */

import type { ReactNode } from 'react';

type DingbatStyle =
  | 'fleuron'      // ❧
  | 'asterism'     // ⁂
  | 'pilcrow'      // ¶
  | 'diamond'      // ◆ ◇
  | 'flourish'     // ❦
  | 'leaf'         // 🙚 🙛
  | 'custom';

interface DingbatFrameProps {
  /** Dingbat style */
  style?: DingbatStyle;

  /** Custom start dingbat (for style="custom") */
  startSymbol?: string;

  /** Custom end dingbat (for style="custom") */
  endSymbol?: string;

  /** Content */
  children: ReactNode;

  /** Additional className */
  className?: string;
}

export function DingbatFrame({
  style = 'fleuron',
  startSymbol,
  endSymbol,
  children,
  className = '',
}: DingbatFrameProps) {
  const frameClasses = [
    'dingbat-frame',
    style !== 'custom' && `dingbat-frame--${style}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // For custom symbols, use data attributes
  const dataAttrs =
    style === 'custom'
      ? {
          'data-dingbat-start': startSymbol || '❧',
          'data-dingbat-end': endSymbol || startSymbol || '❧',
        }
      : {};

  return (
    <div className={frameClasses} {...dataAttrs}>
      {children}
    </div>
  );
}

/**
 * Section divider with dingbat
 */
interface DingbatDividerProps {
  /** Symbol to display */
  symbol?: string;

  /** Additional className */
  className?: string;
}

const DIVIDER_SYMBOLS = {
  asterism: '⁂',
  fleuron: '❧',
  section: '§',
  pilcrow: '¶',
  star: '✦',
  diamond: '◆',
  bullet: '•••',
  wave: '〰',
  dots: '···',
};

export function DingbatDivider({
  symbol = 'asterism',
  className = '',
}: DingbatDividerProps) {
  const displaySymbol = DIVIDER_SYMBOLS[symbol as keyof typeof DIVIDER_SYMBOLS] || symbol;

  return (
    <div className={`dingbat-divider ${className}`} role="separator">
      <span className="dingbat-divider__symbol">{displaySymbol}</span>
    </div>
  );
}

/**
 * Bordered container with decorative borders
 */
type BorderStyle = 'solid' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset';

interface BorderedContainerProps {
  /** Border style */
  borderStyle?: BorderStyle;

  /** Content */
  children: ReactNode;

  /** Additional className */
  className?: string;
}

export function BorderedContainer({
  borderStyle = 'solid',
  children,
  className = '',
}: BorderedContainerProps) {
  const containerClasses = [
    'bordered-container',
    borderStyle !== 'solid' && `bordered-container--${borderStyle}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={containerClasses}>{children}</div>;
}

export default DingbatFrame;
