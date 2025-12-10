/**
 * WorkspaceContentPane - Renders workspace buffer content with optional highlights
 *
 * Extracted from MainWorkspace.tsx to:
 * 1. Consolidate highlight rendering logic in one place
 * 2. Fix Bug #3 (AI Analysis highlighting not working)
 * 3. Reduce duplication across multiple render paths
 */

import { useRef, forwardRef } from 'react';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { Icons } from '../layout/Icons';
import { stripMarkdown } from '../../services/transformationService';
import type { Buffer, BufferAnalysis } from '../../types/workspace';

interface HighlightRange {
  start: number;
  end: number;
  reason: string;
  type?: 'tellword' | 'suspect' | 'gptzero';
}

interface MediaProps {
  mediaManifest?: import('../../types').MediaManifest;
  mediaBaseUrl?: string;
}

interface WorkspaceContentPaneProps {
  /** The content to display */
  content: string;
  /** Buffer metadata for display name and analysis */
  buffer?: Buffer | null;
  /** Display name override */
  displayName?: string;
  /** External highlights (from AIAnalysisPane toggle) */
  externalHighlights?: HighlightRange[];
  /** Media props for MarkdownRenderer */
  mediaProps?: MediaProps;
  /** Background variant */
  variant?: 'primary' | 'secondary';
  /** Word count to display */
  wordCount?: number;
  /** Show copy buttons */
  showCopyButtons?: boolean;
  /** Toast callback */
  onToast?: (message: string) => void;
}

/**
 * HTML-escape a string to safely inject into innerHTML
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Apply AI analysis highlights to text content with type-based colors
 */
function applyHighlights(content: string, highlights: HighlightRange[]): string {
  if (!highlights || highlights.length === 0) {
    return escapeHtml(content);
  }

  // Sort highlights by start position (ascending) to process left-to-right
  const sorted = [...highlights]
    .filter(h => h.start >= 0 && h.end <= content.length && h.start < h.end)
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) {
    return escapeHtml(content);
  }

  // Build result by processing content segments
  const parts: string[] = [];
  let lastEnd = 0;

  for (const highlight of sorted) {
    // Skip overlapping highlights
    if (highlight.start < lastEnd) continue;

    // Add non-highlighted segment before this highlight
    if (highlight.start > lastEnd) {
      parts.push(escapeHtml(content.slice(lastEnd, highlight.start)));
    }

    // Add the highlighted segment with <mark> tag
    const highlighted = content.slice(highlight.start, highlight.end);
    const typeClass = highlight.type ? `ai-highlight-${highlight.type}` : 'ai-analysis-highlight';
    const escapedHighlighted = escapeHtml(highlighted);
    const escapedReason = escapeHtml(highlight.reason);
    parts.push(`<mark class="${typeClass}" title="${escapedReason}">${escapedHighlighted}</mark>`);

    lastEnd = highlight.end;
  }

  // Add any remaining content after the last highlight
  if (lastEnd < content.length) {
    parts.push(escapeHtml(content.slice(lastEnd)));
  }

  return parts.join('');
}

/**
 * Determine which highlights to use, with priority:
 * 1. External highlights (from AIAnalysisPane toggle) - highest priority
 * 2. Buffer analysis highlights (stored in workspace)
 * 3. None
 */
function getActiveHighlights(
  externalHighlights?: HighlightRange[],
  bufferAnalysis?: BufferAnalysis
): HighlightRange[] | null {
  // Priority 1: External highlights from AIAnalysisPane
  if (externalHighlights && externalHighlights.length > 0) {
    console.log('[WorkspaceContentPane] Using external highlights:', externalHighlights.length);
    return externalHighlights;
  }

  // Priority 2: Buffer analysis highlights
  if (bufferAnalysis?.highlights && bufferAnalysis.highlights.length > 0) {
    console.log('[WorkspaceContentPane] Using buffer analysis highlights:', bufferAnalysis.highlights.length);
    return bufferAnalysis.highlights;
  }

  // No highlights
  return null;
}

export const WorkspaceContentPane = forwardRef<HTMLDivElement, WorkspaceContentPaneProps>(
  function WorkspaceContentPane(
    {
      content,
      buffer,
      displayName,
      externalHighlights,
      mediaProps,
      variant = 'primary',
      wordCount,
      showCopyButtons = true,
      onToast,
    },
    ref
  ) {
    const effectiveName = displayName || buffer?.displayName || 'Content';
    const effectiveWordCount = wordCount ?? content.split(/\s+/).filter(Boolean).length;
    const activeHighlights = getActiveHighlights(externalHighlights, buffer?.analysis);

    const copyToClipboard = async (format: 'plain' | 'markdown') => {
      try {
        const textContent = format === 'plain' ? stripMarkdown(content) : content;
        await navigator.clipboard.writeText(textContent);
        onToast?.(format === 'plain' ? 'Plain text copied!' : 'Markdown copied!');
      } catch (err) {
        console.error('Failed to copy:', err);
        onToast?.('Failed to copy');
      }
    };

    return (
      <div
        ref={ref}
        className="flex-1 flex flex-col"
        style={{
          backgroundColor: variant === 'secondary' ? 'var(--bg-secondary)' : 'var(--bg-primary)',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          className="flex-1 overflow-y-auto"
          style={{
            width: '100%',
            minHeight: 0,
          }}
        >
          <div
            className="w-full max-w-5xl"
            style={{ padding: 'var(--space-xl)', margin: '0 auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="heading-md" style={{ color: 'var(--text-secondary)' }}>
                  {effectiveName}
                </h2>
                {buffer?.analysis?.aiScore !== undefined && (
                  <span
                    className={`workspace-buffer-toolbar__score ${
                      buffer.analysis.aiScore <= 30
                        ? 'workspace-buffer-toolbar__score--good'
                        : buffer.analysis.aiScore <= 60
                        ? 'workspace-buffer-toolbar__score--warning'
                        : 'workspace-buffer-toolbar__score--high'
                    }`}
                  >
                    {Math.round(buffer.analysis.aiScore)}% AI
                  </span>
                )}
              </div>

              {showCopyButtons && (
                <div className="flex items-center gap-2">
                  <button
                    className="copy-button"
                    onClick={() => copyToClipboard('plain')}
                    title="Copy as plain text"
                  >
                    <Icons.Copy /> Text
                  </button>
                  <button
                    className="copy-button"
                    onClick={() => copyToClipboard('markdown')}
                    title="Copy as markdown"
                  >
                    <Icons.Code /> MD
                  </button>
                </div>
              )}
            </div>

            {/* Content with optional highlights */}
            <div className="prose max-w-none" style={{ color: 'var(--text-primary)' }}>
              {activeHighlights ? (
                <div
                  className="whitespace-pre-wrap ai-analysis-highlighted-text"
                  dangerouslySetInnerHTML={{
                    __html: applyHighlights(content, activeHighlights),
                  }}
                />
              ) : (
                <MarkdownRenderer content={content} {...mediaProps} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export type { HighlightRange, WorkspaceContentPaneProps };
