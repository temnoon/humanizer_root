/**
 * MainWorkspace - Primary content display area
 *
 * Displays content from AUI buffers with beautiful markdown rendering.
 * Features:
 * - GitHub Flavored Markdown (tables, task lists, etc.)
 * - KaTeX math rendering (lazy loaded)
 * - Reddit-style extensions (spoilers, superscript)
 * - Syntax highlighted code blocks
 *
 * Shows WelcomeScreen when no content is active.
 */

import { useState, useCallback } from 'react';
import { MathMarkdown } from '../markdown';
import { WelcomeScreen } from './WelcomeScreen';

export interface WorkspaceContent {
  id: string;
  title: string;
  text: string;
  source?: {
    type: string;
    path?: string[];
  };
  metadata?: {
    wordCount?: number;
    authorRole?: string;
  };
}

export interface MainWorkspaceProps {
  content?: WorkspaceContent | null;
  onFindSimilar?: (text: string) => void;
}

export type ViewMode = 'read' | 'edit';

export function MainWorkspace({ content, onFindSimilar }: MainWorkspaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('read');
  const [editContent, setEditContent] = useState('');

  // Sync edit content when content changes
  const handleEnterEdit = useCallback(() => {
    if (content) {
      setEditContent(content.text);
    }
    setViewMode('edit');
  }, [content]);

  const handleCancelEdit = useCallback(() => {
    setViewMode('read');
  }, []);

  // Handle text selection for "Find Similar"
  const handleSelection = useCallback(() => {
    if (!onFindSimilar) return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      // Could show a floating toolbar here
    }
  }, [onFindSimilar]);

  // No content - show welcome screen
  if (!content) {
    return <WelcomeScreen />;
  }

  return (
    <div className="workspace" onMouseUp={handleSelection}>
      {/* Breadcrumb / Path */}
      {content.source?.path && (
        <nav className="workspace__breadcrumb">
          {content.source.path.map((p, i) => (
            <span key={i}>
              {i > 0 && <span className="workspace__breadcrumb-sep">&rsaquo;</span>}
              {p}
            </span>
          ))}
        </nav>
      )}

      {/* Workspace Header */}
      <div className="workspace__header">
        <div className="workspace__view-toggle" role="group" aria-label="View mode">
          <button
            className={`workspace__view-btn ${viewMode === 'read' ? 'workspace__view-btn--active' : ''}`}
            onClick={() => setViewMode('read')}
            aria-pressed={viewMode === 'read'}
          >
            Read
          </button>
          <button
            className={`workspace__view-btn ${viewMode === 'edit' ? 'workspace__view-btn--active' : ''}`}
            onClick={handleEnterEdit}
            aria-pressed={viewMode === 'edit'}
          >
            Edit
          </button>
          <span className="workspace__view-hint" aria-hidden="true">
            Cmd+E
          </span>
        </div>

        <div className="workspace__actions">
          <button
            className="workspace__action-btn"
            onClick={async () => {
              await navigator.clipboard.writeText(content.text);
            }}
            title="Copy as plain text"
          >
            Copy
          </button>
          <button
            className="workspace__action-btn"
            onClick={() => {
              const blob = new Blob([content.text], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${content.title || 'content'}.md`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            title="Download as markdown"
          >
            Download
          </button>
          {onFindSimilar && (
            <button
              className="workspace__action-btn workspace__action-btn--primary"
              onClick={() => onFindSimilar(content.text)}
              title="Find similar content in archive"
            >
              Find Similar
            </button>
          )}
        </div>
      </div>

      {/* Content - Read or Edit Mode */}
      {viewMode === 'read' ? (
        <article className="workspace__article">
          <MathMarkdown>{content.text}</MathMarkdown>
          {content.metadata?.wordCount && (
            <div className="workspace__stats">
              <span className="workspace__stat">
                {content.metadata.wordCount.toLocaleString()} words
              </span>
              {content.metadata.authorRole && (
                <span className="workspace__stat">{content.metadata.authorRole}</span>
              )}
            </div>
          )}
        </article>
      ) : (
        <div className="workspace__editor-pane">
          <textarea
            className="workspace__editor"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Edit markdown content..."
          />
          <div className="workspace__editor-actions">
            <button
              className="workspace__editor-btn workspace__editor-btn--primary"
              onClick={() => {
                // Would commit to buffer here
                setViewMode('read');
              }}
            >
              Apply Changes
            </button>
            <button
              className="workspace__editor-btn workspace__editor-btn--secondary"
              onClick={handleCancelEdit}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
